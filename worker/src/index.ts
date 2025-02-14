import { Kafka } from "kafkajs"

const TOPIC_NAME = "zap-events"

const kafka = new Kafka({
  clientId: 'outbox-processor',
  brokers: ['localhost:9092']
})

async function main() {
    const consumer = kafka.consumer({ groupId: "main-worker" });
    await consumer.connect();
    
    await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true })

    await consumer.run({
        autoCommit: false, // to manually acknowledge that the consumer has finished the job not just pulled it out of kafka
        eachMessage: async ({ topic, partition, message }) => {
          console.log({
            partition,
            offset: message.offset,
            value: message.value?.toString(),
          })
          await consumer.commitOffsets([{
            topic: TOPIC_NAME,
            partition: partition,
            offset: (parseInt(message.offset) + 1).toString()
          }])
        },
      })
}

main();