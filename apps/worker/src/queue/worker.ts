import { queueKeyOf, setRunState } from "@homework-manga/contracts/homeworkJob";
import { processAnalysisJob } from "../phases/analysis.js";
import { processDeletionJob } from "../phases/deletion.js";
import { processScriptingJob } from "../phases/scripting.js";
import { jobsRef, jobRef } from "./jobStore.js";

/**
 * queueKey(phase:runState の導出キー)を購読して phase 実行を駆動する。
 * Slack トリガーは不要 — GAS/web が queued を書けばここで検知する。
 */
export function startQueueWorkers(): () => void {
  const subscriptions = [
    subscribe("analyzing:queued", processAnalysisJob),
    subscribe("scripting:queued", processScriptingJob),
    subscribe("deleting:queued", processDeletionJob)
  ];
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}

function subscribe(queueKey: string, handler: (jobId: string) => Promise<void>): () => void {
  const query = jobsRef().orderByChild("queueKey").equalTo(queueKey);
  const onChild = (snapshot: { key: string | null }) => {
    if (!snapshot.key) return;
    console.log(`[queue] detected ${queueKey} job=${snapshot.key}`);
    void handler(snapshot.key).catch((error) => console.error(`[queue] handler failed job=${snapshot.key}`, error));
  };
  const onError = (error: Error) => console.error(`[queue] listener failed for ${queueKey}`, error);
  query.on("child_added", onChild, onError);
  return () => query.off("child_added", onChild);
}

/**
 * 起動時復旧: 前回実行中(running)のまま落ちたジョブを queued へ戻す。
 * error→queued の正規遷移を経由するため、attempt 上限は claim 時に効く。
 */
export async function recoverInterruptedJobs(): Promise<number> {
  let recovered = 0;
  for (const phase of ["analyzing", "scripting", "deleting"] as const) {
    const snapshot = await jobsRef().orderByChild("queueKey").equalTo(queueKeyOf(phase, "running")).get();
    if (!snapshot.exists()) continue;
    const jobs = snapshot.val() as Record<string, { phase: typeof phase; runState: "running" }>;
    for (const jobId of Object.keys(jobs)) {
      const errored = setRunState({ phase, runState: "running" }, "error");
      const queued = setRunState({ phase, runState: "error" }, "queued");
      await jobRef(jobId).update({ ...errored, ...queued });
      console.warn(`[recovery] requeued interrupted job=${jobId} phase=${phase}`);
      recovered += 1;
    }
  }
  return recovered;
}
