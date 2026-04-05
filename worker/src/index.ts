import dotenv from "dotenv";
dotenv.config({ path: "./.env", quiet: true });

import { PrismaClient } from "@prisma/client";
import { Kafka } from "kafkajs"

const TOPIC_NAME = "zap-events"

const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: ['localhost:9092']
})

const db = new PrismaClient();
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const REQUEST_TIMEOUT_MS = 10000;

type ActionForExecution = {
  id: string;
  actionId: string;
  metadata: any;
};

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

  const headers: Record<string, string> = {};
  if (Array.isArray(metadata.headers)) {
    for (const header of metadata.headers) {
      if (header?.key) {
        headers[header.key] = String(header.value || "");
      }
    }
  }

  let body: string | undefined = undefined;
  if (method !== "GET") {
    if (metadata.bodyTemplate && typeof metadata.bodyTemplate === "string") {
      const rendered = renderBodyTemplate(metadata.bodyTemplate, payload);
      body = JSON.stringify(JSON.parse(rendered));
    } else {
      body = JSON.stringify(payload);
    }
  }

  const requestSummary = {
    url: metadata.url,
    method,
    headerNames: Object.keys(headers),
    bodyPreview: body ? body.slice(0, 500) : null,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(metadata.url, {
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
