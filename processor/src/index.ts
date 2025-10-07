import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { PrismaClient } from "@prisma/client"
import { Kafka } from "kafkajs"


const TOPIC_NAME = "zap-events"

const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: ['localhost:9092']
})

const client = new PrismaClient()

async function main() {
  const procuder = kafka.producer();
  await procuder.connect()

  while (1) {
    const pendingRows = await client.zapRunOutbox.findMany({
      where: {},
      take: 10
    })

    procuder.send({
      topic: TOPIC_NAME,
      messages: pendingRows.map(r => ({
        value: r.zapRunId
      }))
    })

    await client.zapRunOutbox.deleteMany({
      where: {
        id: {
          in: pendingRows.map(x => x.id)
        }
      }
    })
  }
}

main()

