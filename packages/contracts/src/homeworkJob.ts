import { z } from "zod";
import { envelopeSchema } from "./firebaseCodec";

/**
 * ジョブ状態は「phase(どこまで進んだか)× runState(その phase の実行状態)」の直交2軸。
 * queueKey は常に導出するため二重管理は構造的に発生しない。
 */
export const PHASES = ["captured", "analyzing", "awaiting_approval", "scripting", "ready", "failed", "deleting"] as const;
export type Phase = (typeof PHASES)[number];

export const RUN_STATES = ["queued", "running", "done", "error"] as const;
export type RunState = (typeof RUN_STATES)[number];

export const PHASE_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  captured: ["analyzing", "deleting"],
  analyzing: ["awaiting_approval", "failed", "deleting"],
  awaiting_approval: ["scripting", "deleting"],
  scripting: ["ready", "awaiting_approval", "failed", "deleting"],
  ready: ["scripting", "deleting"],
  failed: ["analyzing", "scripting", "deleting"],
  deleting: ["failed"]
};

const RUN_STATE_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  queued: ["running"],
  running: ["done", "error"],
  done: [],
  error: ["queued"]
};

export const queueKeyOf = (phase: Phase, runState: RunState): string => `${phase}:${runState}`;

export const FAILURE_CODES = ["IMAGE_UNREADABLE", "AI_OUTPUT_UNUSABLE", "MATH_UNVERIFIED", "ATTEMPTS_EXHAUSTED", "INTERNAL_ERROR"] as const;
export type FailureCode = (typeof FAILURE_CODES)[number];

/** 保護者向け文言。web と worker(Slack通知)が同じマップを使う。 */
export const FAILURE_MESSAGES: Record<FailureCode, string> = {
  IMAGE_UNREADABLE: "写真がうまく読み取れませんでした。明るい場所で、ページ全体が入るように撮り直してみてください。",
  AI_OUTPUT_UNUSABLE: "AIの下書きがうまく作れませんでした。「もう一度作る」を押すと再挑戦します。",
  MATH_UNVERIFIED: "計算の確認が取れなかったため止めました。問題文と答えを確認して、もう一度お試しください。",
  ATTEMPTS_EXHAUSTED: "何度か試しましたが完成できませんでした。時間をおいて「もう一度作る」をお試しください。",
  INTERNAL_ERROR: "処理中に問題が起きました。「もう一度作る」を押すと再開します。"
};

const failureSchema = z.object({
  code: z.enum(FAILURE_CODES),
  messageForParent: z.string().min(1).max(500),
  detailJson: z.string().max(20000).optional()
}).strict();

const sourceImageSchema = z.object({
  provider: z.literal("google_drive"),
  fileId: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  viewUrl: z.string().min(1),
  downloadUrl: z.string().min(1),
  displayUrl: z.string().optional()
}).strict();

export const homeworkJobV3Schema = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  phase: z.enum(PHASES),
  runState: z.enum(RUN_STATES),
  queueKey: z.string().min(1),
  attempt: z.record(z.number().int().nonnegative()).optional(),
  failure: failureSchema.optional(),
  sourceImage: sourceImageSchema.optional(),
  artifacts: z.object({
    analysis: envelopeSchema.optional(),
    approved: envelopeSchema.optional(),
    mangaPlan: envelopeSchema.optional()
  }).strict().optional(),
  child: z.object({
    readCount: z.number().int().nonnegative().optional(),
    lastReadAt: z.string().optional(),
    stamps: z.number().int().nonnegative().optional()
  }).strict().optional()
}).strict();
export type HomeworkJobV3 = z.infer<typeof homeworkJobV3Schema>;

export type TransitionInput = Pick<HomeworkJobV3, "phase" | "runState">;
export type TransitionResult = { phase: Phase; runState: RunState; queueKey: string; updatedAt: string };

export class IllegalTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`illegal transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

/** phase をまたぐ遷移。RTDB transaction 内で使い、結果パッチをそのまま update する。 */
export function transitionPhase(job: TransitionInput, to: Phase, runState: RunState = "queued", now: () => string = () => new Date().toISOString()): TransitionResult {
  if (!PHASE_TRANSITIONS[job.phase].includes(to)) throw new IllegalTransitionError(queueKeyOf(job.phase, job.runState), queueKeyOf(to, runState));
  return { phase: to, runState, queueKey: queueKeyOf(to, runState), updatedAt: now() };
}

/** 同一 phase 内の実行状態遷移(queued→running→done/error、error→queued=リトライ)。 */
export function setRunState(job: TransitionInput, runState: RunState, now: () => string = () => new Date().toISOString()): TransitionResult {
  if (!RUN_STATE_TRANSITIONS[job.runState].includes(runState)) throw new IllegalTransitionError(queueKeyOf(job.phase, job.runState), queueKeyOf(job.phase, runState));
  return { phase: job.phase, runState, queueKey: queueKeyOf(job.phase, runState), updatedAt: now() };
}
