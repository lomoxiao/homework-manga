import { z } from "zod";

export const CONTRACT_VERSION = "2.1" as const;
export const SCHEMA_VERSION = "2.1" as const;
export const MANGA_PLAN_SCHEMA_HASH = "sha256:a03f163d16835f82499c547306b503db5ab957039eb0cfe97d121ef29d310259" as const;
const text = z.string().min(1).max(200);
export const rationalSchema = z.object({ numerator: z.number().int(), denominator: z.number().int().positive() }).strict();
const position = z.enum(["left", "center", "right", "bottom"]);
const mark = z.object({ value: rationalSchema, label: text.optional() }).strict();
export const rendererSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("table"), position, headers: z.array(text).min(1).max(10), rows: z.array(z.array(text).min(1).max(10)).min(1).max(20) }).strict(),
  z.object({ type: z.literal("bar_model"), position, total: rationalSchema, groupCount: z.number().int().positive().max(100), perGroup: rationalSchema }).strict(),
  z.object({ type: z.literal("fraction_bar"), position, numerator: z.number().int().nonnegative(), denominator: z.number().int().positive().max(100) }).strict(),
  z.object({ type: z.literal("number_line"), position, min: rationalSchema, max: rationalSchema, tickCount: z.number().int().min(1).max(20), marks: z.array(mark).max(20) }).strict(),
  z.object({ type: z.literal("comparison"), position, left: rationalSchema, right: rationalSchema, leftLabel: text, rightLabel: text, unit: z.string().max(30), operator: z.enum(["<", "=", ">"]), ratio: rationalSchema.nullable() }).strict()
]);
const dialogue = z.object({ speaker: text, text: z.string().min(1).max(500), tone: z.enum(["normal", "question", "encourage", "discovery"]) }).strict();
const panel = z.object({ panelNumber: z.number().int().min(1).max(6), learningPurpose: text, scene: z.string().min(1).max(500), solutionStepId: text, characters: z.array(text).min(1).max(4), characterPose: z.record(z.string()), characterExpression: z.record(z.string()), background: text, props: z.array(text).max(20), dialogue: z.array(dialogue).min(1).max(6), narration: z.string().max(500).nullable(), visualAid: rendererSpecSchema.nullable(), formula: z.array(z.string().max(100)).max(10), emphasisWords: z.array(z.string().max(50)).max(20), layout: z.object({ size: z.enum(["small", "medium", "large"]), characterSide: z.enum(["left", "right"]), visualAidPosition: z.enum(["center", "bottom", "right"]) }).strict(), assetIds: z.array(text).max(10) }).strict();
export const mangaPlan21Schema = z.object({ schemaVersion: z.literal(SCHEMA_VERSION), contractVersion: z.literal(CONTRACT_VERSION), schemaHash: z.literal(MANGA_PLAN_SCHEMA_HASH), jobId: text, title: text, problem: z.object({ text: z.string().min(1).max(2000), studentAnswer: z.string().min(1).max(500), correctAnswer: z.string().min(1).max(500) }).strict(), panels: z.array(panel).length(6), warnings: z.array(z.string().max(500)).max(20) }).strict();
export type MangaPlan21 = z.infer<typeof mangaPlan21Schema>;
export type RendererSpec = z.infer<typeof rendererSpecSchema>;

export type PlanReadResult = { kind: "current"; plan: MangaPlan21 } | { kind: "legacy_unreadable"; version: string } | { kind: "invalid"; reason: string };
export function readMangaPlan(value: unknown): PlanReadResult {
  const current = mangaPlan21Schema.safeParse(decodeFirebaseValue(value)); if (current.success) return { kind: "current", plan: current.data };
  const version = value && typeof value === "object" ? String((value as Record<string, unknown>).schemaVersion ?? "unknown") : "unknown";
  if (version === "1.0" || version === "2.0") return { kind: "legacy_unreadable", version };
  return { kind: "invalid", reason: current.error.issues.sort((a, b) => b.path.length - a.path.length)[0]?.message ?? "invalid MangaPlan" };
}
export function decodeFirebaseValue(value: unknown): unknown { if (Array.isArray(value)) return value.map(decodeFirebaseValue); if (value && typeof value === "object") { const record = value as Record<string, unknown>; if (Object.keys(record).length === 1 && record.__mangaPlanCodec === "null") return null; if (Object.keys(record).length === 1 && record.__mangaPlanCodec === "empty_array") return []; if (Object.keys(record).length === 1 && record.__mangaPlanCodec === "empty_object") return {}; return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, decodeFirebaseValue(v)])); } return value; }
