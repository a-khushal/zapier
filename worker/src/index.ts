import dotenv from "dotenv";
import { startWorkerConsumer } from "./kafka/consumer";

dotenv.config({ path: "./.env", quiet: true });

async function main() {
  await startWorkerConsumer();
}

main().catch((error) => {
  console.error("Worker boot failed", error);
  process.exit(1);
});
