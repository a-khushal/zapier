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

type ActionForExecution = {
  id: string;
  actionId: string;
  metadata: any;
};

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
  switch (action.actionId) {
    case "post_webhook": {
      const metadata = action.metadata || {};
      if (!metadata.url) {
        throw new Error("post_webhook requires metadata.url");
      }

      const method = (metadata.method || "POST").toUpperCase();
      const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
      if (!allowedMethods.includes(method)) {
        throw new Error("post_webhook method must be GET, POST, PUT, PATCH or DELETE");
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

      const response = await fetch(metadata.url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`post_webhook failed with status ${response.status}`);
      }

      return {
        output: {
          status: response.status,
          response: await response.text()
        },
      };
    }

    default:
      throw new Error(`Unsupported action type: ${action.actionId}`);
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
    try {
      const result = await executeAction(
        {
          id: action.id,
          actionId: action.actionId,
          metadata: action.metadata,
        },
        payload
      );
      await db.zapRunStep.create({
        data: {
          zapRunId: zapRun.id,
          actionId: action.id,
          status: "SUCCESS",
          input: payload as any,
          output: result.output as any,
          startedAt,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await db.zapRunStep.create({
        data: {
          zapRunId: zapRun.id,
          actionId: action.id,
          status: "FAILED",
          input: payload as any,
          error: String(error),
          startedAt,
          completedAt: new Date(),
        },
      });
      throw error;
    }
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
