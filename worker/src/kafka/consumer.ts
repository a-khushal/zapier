import { Kafka } from "kafkajs";
import { KAFKA_BROKERS, TOPIC_NAME } from "../config";
import { executeZapRun } from "../execution/executeZapRun";

const kafka = new Kafka({
  clientId: "outbox-processor",
  brokers: KAFKA_BROKERS,
});

export async function startWorkerConsumer() {
  const consumer = kafka.consumer({ groupId: "main-worker" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: false });

  await consumer.run({
    autoCommit: false,
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

      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: (parseInt(message.offset, 10) + 1).toString(),
        },
      ]);
    },
  });
}
