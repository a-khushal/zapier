import dotenv from "dotenv";
dotenv.config({ path: "./.env", quiet: true });

import { PrismaClient } from "@prisma/client";
import { Kafka } from "kafkajs"

declare const require: any;
declare const process: any;
declare const Buffer: any;
const crypto = require("crypto");

const TOPIC_NAME = "zap-events"

const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: ['localhost:9092']
})

const db = new PrismaClient();
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const MIN_REQUEST_TIMEOUT_MS = 1000;
const MAX_REQUEST_TIMEOUT_MS = 30000;
const WEBHOOK_TARGET_ALLOWLIST = (process.env.WEBHOOK_TARGET_ALLOWLIST || "")
  .split(",")
  .map((item: string) => item.trim().toLowerCase())
  .filter(Boolean);

type ActionForExecution = {
  id: string;
  actionId: string;
  metadata: any;
};

function getEncryptionKey() {
  const rawKey = process.env.ACTIONS_ENCRYPTION_KEY;
  if (!rawKey) {
    return null;
  }
  return crypto.createHash("sha256").update(rawKey).digest();
}

function decryptSecretIfEncrypted(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  if (!value.startsWith("enc:v1:")) {
    return value;
  }

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted secret format");
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("ACTIONS_ENCRYPTION_KEY is required to decrypt auth secrets");
  }

  const iv = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const encrypted = Buffer.from(parts[4], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function resolveAuth(metadata: any) {
  const auth = metadata?.auth;
  if (!auth || typeof auth !== "object") {
    return { type: "none" };
  }

  const nextAuth: any = { ...auth };
  if (nextAuth.type === "api_key") {
    nextAuth.value = decryptSecretIfEncrypted(nextAuth.value);
  }

  return nextAuth;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePayloadPath(payload: any, path: string) {
  const keys = path.split(".");
  let value = payload;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return "";
    }
    value = value[key];
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function renderBodyTemplate(template: string, payload: any) {
  return template.replace(/\{\{\s*payload\.([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path) => {
    return resolvePayloadPath(payload, path);
  });
}

function isUnsafeWebhookTarget(url: string) {
  if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
    return false;
  }

  const hostname = new URL(url).hostname.toLowerCase();
  const isAllowlisted = WEBHOOK_TARGET_ALLOWLIST.some(
    (entry: string) => hostname === entry || hostname.endsWith(`.${entry}`)
  );
  if (isAllowlisted) {
    return false;
  }

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function normalizeTimeoutMs(timeoutMs: unknown) {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const rounded = Math.floor(timeoutMs);
  if (rounded < MIN_REQUEST_TIMEOUT_MS) {
    return MIN_REQUEST_TIMEOUT_MS;
  }
  if (rounded > MAX_REQUEST_TIMEOUT_MS) {
    return MAX_REQUEST_TIMEOUT_MS;
  }

  return rounded;
}

async function executeAction(action: ActionForExecution, payload: unknown) {
  if (action.actionId !== "post_webhook") {
    return {
      success: false,
      shouldRetry: false,
      error: `Unsupported action type: ${action.actionId}`,
      requestSummary: {
        actionId: action.actionId,
      },
    };
  }

  const metadata = action.metadata || {};
  if (!metadata.url) {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook requires metadata.url",
      requestSummary: {},
    };
  }

  const method = (metadata.method || "POST").toUpperCase();
  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  if (!allowedMethods.includes(method)) {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook method must be GET, POST, PUT, PATCH or DELETE",
      requestSummary: {
        url: metadata.url,
        method,
      },
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(metadata.url);
  } catch {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook requires a valid URL",
      requestSummary: {},
    };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook URL must be http or https",
      requestSummary: {
        url: metadata.url,
      },
    };
  }

  if (method === "GET" && metadata.bodyTemplate) {
    return {
      success: false,
      shouldRetry: false,
      error: "GET method cannot have a body template",
      requestSummary: {
        url: metadata.url,
        method,
      },
    };
  }

  const headers: Record<string, string> = {};
  if (Array.isArray(metadata.headers)) {
    for (const header of metadata.headers) {
      const key = String(header?.key || "").trim();
      if (!key) {
        return {
          success: false,
          shouldRetry: false,
          error: "post_webhook header keys must be non-empty",
          requestSummary: {
            url: metadata.url,
            method,
          },
        };
      }
      headers[key] = String(header.value || "");
    }
  }

  let requestUrl = metadata.url;
  const auth = resolveAuth(metadata);
  if (auth.type === "api_key") {
    if (!auth.key || !auth.value) {
      return {
        success: false,
        shouldRetry: false,
        error: "post_webhook api_key auth requires key and value",
        requestSummary: {
          url: metadata.url,
          method,
        },
      };
    }

    if (auth.addTo === "query") {
      const urlObj = new URL(requestUrl);
      urlObj.searchParams.set(String(auth.key), String(auth.value));
      requestUrl = urlObj.toString();
    } else {
      headers[String(auth.key)] = String(auth.value);
    }
  }

  if (isUnsafeWebhookTarget(requestUrl)) {
    return {
      success: false,
      shouldRetry: false,
      error: "Unsafe webhook target URL is blocked in production",
      requestSummary: {
        url: requestUrl,
        method,
      },
    };
  }

  const timeoutMs = normalizeTimeoutMs(metadata.timeoutMs);

  let body: string | undefined = undefined;
  if (method !== "GET") {
    if (metadata.bodyTemplate && typeof metadata.bodyTemplate === "string") {
      try {
        const rendered = renderBodyTemplate(metadata.bodyTemplate, payload);
        body = JSON.stringify(JSON.parse(rendered));
      } catch {
        return {
          success: false,
          shouldRetry: false,
          error: "Body template must be valid JSON after substitution",
          requestSummary: {
            url: requestUrl,
            method,
            authType: auth.type || "none",
            timeoutMs,
          },
        };
      }
    } else {
      body = JSON.stringify(payload);
    }
  }

  const requestSummary = {
    url: requestUrl,
    method,
    headerNames: Object.keys(headers),
    bodyPreview: body ? body.slice(0, 500) : null,
    authType: auth.type || "none",
    timeoutMs,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(requestUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
      signal: controller.signal,
    });

    const responseBody = await response.text();

    if (response.status >= 500) {
      return {
        success: false,
        shouldRetry: true,
        error: `post_webhook failed with status ${response.status}`,
        requestSummary,
        responseStatus: response.status,
        responseBody,
      };
    }

    if (response.status >= 400) {
      return {
        success: false,
        shouldRetry: false,
        error: `post_webhook failed with status ${response.status}`,
        requestSummary,
        responseStatus: response.status,
        responseBody,
      };
    }

    return {
      success: true,
      shouldRetry: false,
      requestSummary,
      responseStatus: response.status,
      responseBody,
      output: {
        status: response.status,
        response: responseBody,
      },
    };
  } catch (error) {
    return {
      success: false,
      shouldRetry: true,
      error: String(error),
      requestSummary,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function executeZapRun(zapRunId: string) {
  const zapRun = await db.zapRun.findUnique({
    where: { id: zapRunId },
    include: {
      zap: {
        include: {
          actions: {
            orderBy: { sortingOrder: "asc" },
          },
        },
      },
    },
  });

  if (!zapRun) {
    return;
  }

  const payload = zapRun.metadata;

  for (const action of zapRun.zap.actions) {
    const startedAt = new Date();
    const step = await db.zapRunStep.create({
      data: {
        zapRunId: zapRun.id,
        actionId: action.id,
        status: "FAILED",
        input: payload as any,
        startedAt,
      },
    });

    let finalError = "Action failed";
    let finalOutput: any = null;
    let attemptCount = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attemptCount = attempt;
      const attemptStartedAt = new Date();

      const result = await executeAction(
        {
          id: action.id,
          actionId: action.actionId,
          metadata: action.metadata,
        },
        payload
      );

      await db.zapRunStepAttempt.create({
        data: {
          zapRunStepId: step.id,
          attemptNumber: attempt,
          requestSummary: result.requestSummary as any,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody,
          error: result.error,
          startedAt: attemptStartedAt,
          completedAt: new Date(),
        },
      });

      if (result.success) {
        finalOutput = result.output;
        break;
      }

      if (result.error) {
        finalError = result.error;
      }

      if (!result.shouldRetry || attempt === MAX_ATTEMPTS) {
        break;
      }

      await sleep(BACKOFF_MS[attempt - 1] || BACKOFF_MS[BACKOFF_MS.length - 1]);
    }

    if (finalOutput) {
      await db.zapRunStep.update({
        where: { id: step.id },
        data: {
          status: "SUCCESS",
          output: finalOutput as any,
          attemptCount,
          completedAt: new Date(),
        },
      });
      continue;
    }

    await db.zapRunStep.update({
      where: { id: step.id },
      data: {
        status: "FAILED",
        error: finalError,
        attemptCount,
        completedAt: new Date(),
      },
    });

    throw new Error(finalError);
  }
}

async function main() {
  const consumer = kafka.consumer({ groupId: "main-worker" });
  await consumer.connect();

  await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: false })

  await consumer.run({
    autoCommit: false, // to manually acknowledge that the consumer has finished the job not just pulled it out of kafka
    eachMessage: async ({ topic, partition, message }) => {
      const zapRunId = message.value?.toString() || "";
      if (!zapRunId) {
        console.error("Worker received empty zapRunId");
        return;
      }

      try {
        await executeZapRun(zapRunId);
        console.log({
          partition,
          offset: message.offset,
          zapRunId,
          status: "processed",
        });
      } catch (error) {
        console.error("Worker failed to process zap run", {
          partition,
          offset: message.offset,
          zapRunId,
          error: String(error),
        });
      }

      await consumer.commitOffsets([{
        topic: TOPIC_NAME,
        partition: partition,
        offset: (parseInt(message.offset) + 1).toString()
      }])
    },
  })
}

main();
