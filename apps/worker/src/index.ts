import { env } from "./env.js";
import { recoverInterruptedJobs, startQueueWorkers } from "./queue/worker.js";

async function main() {
  console.log(`[worker] homework worker starting (jobs path: ${env.HOMEWORK_JOBS_PATH})`);
  const recovered = await recoverInterruptedJobs();
  if (recovered > 0) console.log(`[worker] requeued ${recovered} interrupted job(s)`);
  startQueueWorkers();
  console.log("[worker] queue listeners started: analyzing:queued, scripting:queued");
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
