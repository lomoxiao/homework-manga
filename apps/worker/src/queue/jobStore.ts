import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  homeworkJobV3Schema, queueKeyOf, setRunState, transitionPhase, FAILURE_MESSAGES,
  type FailureCode, type HomeworkJobV3, type Phase, type RunState
} from "@homework-manga/contracts/homeworkJob";
import { env } from "../env.js";
import { getDb } from "../services/firebaseAdmin.js";

export const jobsRef = () => getDb().ref(env.HOMEWORK_JOBS_PATH);
export const jobRef = (jobId: string) => getDb().ref(`${env.HOMEWORK_JOBS_PATH}/${jobId}`);

export async function readJob(jobId: string): Promise<HomeworkJobV3 | null> {
  const snapshot = await jobRef(jobId).get();
  if (!snapshot.exists()) return null;
  const parsed = homeworkJobV3Schema.safeParse(snapshot.val());
  if (!parsed.success) {
    console.error(`[worker] job node is not a valid v3 job: ${jobId}`, parsed.error.issues[0]);
    return null;
  }
  return parsed.data;
}

/**
 * queued の phase を running へ遷移させてジョブを1ワーカーに割り当てる。
 * RTDB transaction で行うため二重実行は起きない。
 */
export async function claimJob(jobId: string, phase: Phase): Promise<HomeworkJobV3 | null> {
  const tx = await jobRef(jobId).transaction((value: Record<string, unknown> | null) => {
    if (!value || value.phase !== phase || value.runState !== "queued") return undefined;
    const patch = setRunState({ phase, runState: "queued" }, "running");
    const attempt = { ...((value.attempt as Record<string, number>) ?? {}) };
    attempt[phase] = (attempt[phase] ?? 0) + 1;
    return { ...value, ...patch, attempt };
  });
  if (!tx.committed || !tx.snapshot.exists()) return null;
  const parsed = homeworkJobV3Schema.safeParse(tx.snapshot.val());
  return parsed.success ? parsed.data : null;
}

/** phase 完了: 成果物などのパッチと合わせて次 phase へ進める。 */
export async function completePhase(job: HomeworkJobV3, to: Phase, patch: Record<string, unknown> = {}): Promise<void> {
  const next = transitionPhase({ phase: job.phase, runState: job.runState === "queued" ? "running" : job.runState }, to, to === "ready" || to === "awaiting_approval" ? "done" : "queued");
  await jobRef(job.id).update({ ...patch, ...next, failure: null });
}

/** phase 失敗: attempt が残っていれば queued へ戻し、尽きたら failed へ。 */
export async function failPhase(job: HomeworkJobV3, code: FailureCode, detail: unknown): Promise<void> {
  const attempts = job.attempt?.[job.phase] ?? 1;
  const detailJson = JSON.stringify(detail instanceof Error ? { message: detail.message, stack: detail.stack } : detail).slice(0, 20000);
  if (attempts < env.HOMEWORK_MAX_ATTEMPTS) {
    const patch = { phase: job.phase, runState: "queued" as RunState, queueKey: queueKeyOf(job.phase, "queued"), updatedAt: new Date().toISOString() };
    await jobRef(job.id).update({ ...patch, failure: { code, messageForParent: FAILURE_MESSAGES[code], detailJson } });
    console.warn(`[worker] retrying job=${job.id} phase=${job.phase} attempt=${attempts} code=${code}`);
    return;
  }
  // 尽きた場合、原因が伝わるコード(写真・検算)は保持し、それ以外は ATTEMPTS_EXHAUSTED に集約する。
  const finalCode: FailureCode = code === "IMAGE_UNREADABLE" || code === "MATH_UNVERIFIED" ? code : "ATTEMPTS_EXHAUSTED";
  const next = transitionPhase({ phase: job.phase, runState: "running" }, "failed", "error");
  await jobRef(job.id).update({ ...next, failure: { code: finalCode, messageForParent: FAILURE_MESSAGES[finalCode], detailJson } });
  console.error(`[worker] failed job=${job.id} phase=${job.phase} code=${finalCode}`);
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = path.resolve(env.HOMEWORK_JOBS_DIR, jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}
