import { z } from "zod";
import { rationalSchema } from "./rational";

export const MANGA_PLAN_VERSION = "3.0" as const;

/** 6コマの規定 role 順。修復層はこの順序へ正規化する。 */
export const PANEL_ROLES = ["problem", "error_location", "visualization", "solution", "check", "transfer"] as const;
export type PanelRole = (typeof PANEL_ROLES)[number];

export const REPAIR_NOTE_CODES = [
  "RATIONAL_NORMALIZED",
  "PANEL_PADDED",
  "PANEL_TRUNCATED",
  "ROLE_REORDERED",
  "STEP_REF_FIXED",
  "VISUAL_DROPPED",
  "DIALOGUE_SYNTHESIZED",
  "FORMULA_MOVED",
  "FIELD_DEFAULTED",
  "FIELD_TRUNCATED",
  "STEP_SYNTHESIZED",
  "TITLE_DEFAULTED"
] as const;
export const repairNoteSchema = z.object({
  code: z.enum(REPAIR_NOTE_CODES),
  panelIndex: z.number().int().min(0).optional(),
  detail: z.string().max(500)
}).strict();
export type RepairNote = z.infer<typeof repairNoteSchema>;

const shortText = z.string().min(1).max(200);
const position = z.enum(["left", "center", "right", "bottom"]);
const mark = z.object({ value: rationalSchema, label: z.string().max(50).optional() }).strict();

export const GEOMETRY_SHAPES = ["rectangle", "square", "triangle", "right_triangle", "circle"] as const;
export const SHAPE_LABEL_SIDES = ["top", "bottom", "left", "right", "center"] as const;
const shapeLabel = z.object({ text: z.string().min(1).max(50), side: z.enum(SHAPE_LABEL_SIDES) }).strict();

export const rendererSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("table"), position, headers: z.array(shortText).min(1).max(10), rows: z.array(z.array(z.string().max(200)).min(1).max(10)).min(1).max(20) }).strict(),
  z.object({ type: z.literal("bar_model"), position, total: rationalSchema, groupCount: z.number().int().positive().max(100), perGroup: rationalSchema }).strict(),
  z.object({ type: z.literal("fraction_bar"), position, numerator: z.number().int().nonnegative(), denominator: z.number().int().positive().max(100) }).strict(),
  z.object({ type: z.literal("number_line"), position, min: rationalSchema, max: rationalSchema, tickCount: z.number().int().min(1).max(20), marks: z.array(mark).max(20) }).strict(),
  z.object({ type: z.literal("comparison"), position, left: rationalSchema, right: rationalSchema, leftLabel: shortText, rightLabel: shortText, unit: z.string().max(30), operator: z.enum(["<", "=", ">"]), ratio: rationalSchema.nullable() }).strict(),
  z.object({ type: z.literal("geometry_shape"), position, shape: z.enum(GEOMETRY_SHAPES), width: rationalSchema.nullable(), height: rationalSchema.nullable(), radius: rationalSchema.nullable(), unit: z.string().max(10), labels: z.array(shapeLabel).max(6), highlightSide: z.enum(["top", "bottom", "left", "right", "none"]) }).strict(),
  z.object({ type: z.literal("area_grid"), position, columns: z.number().int().min(1).max(20), rows: z.number().int().min(1).max(20), unit: z.string().max(10), highlightCells: z.number().int().min(0).max(400).nullable() }).strict(),
  z.object({ type: z.literal("angle_fan"), position, degrees: z.number().int().min(1).max(360), label: z.string().max(50) }).strict()
]);
export type RendererSpec = z.infer<typeof rendererSpecSchema>;

export const characterSchema = z.enum(["hero", "teacher"]);
export type Character = z.infer<typeof characterSchema>;

const castSchema = z.object({
  character: characterSchema,
  expression: z.string().min(1).max(50),
  pose: z.string().min(1).max(50),
  side: z.enum(["left", "right"])
}).strict();

/** 演出。AI出力からは受け取らず、コンパイラが決定論的に付与する。 */
export const panelPresentationSchema = z.object({
  casts: z.array(castSchema).min(1).max(4),
  background: z.string().min(1).max(200),
  size: z.enum(["small", "medium", "large"]),
  visualAidPosition: z.enum(["center", "bottom", "right"])
}).strict();
export type PanelPresentation = z.infer<typeof panelPresentationSchema>;

const dialogueSchema = z.object({
  speaker: characterSchema,
  text: z.string().min(1).max(500),
  tone: z.enum(["normal", "question", "encourage", "discovery"])
}).strict();

export const solutionStepSchema = z.object({
  id: z.string().min(1).max(100),
  explanation: z.string().min(1).max(500),
  expression: z.string().max(100).default(""),
  result: z.string().max(200).default("")
}).strict();
export type SolutionStep = z.infer<typeof solutionStepSchema>;

export const panelSchema = z.object({
  role: z.enum(PANEL_ROLES),
  learningPurpose: z.string().min(1).max(200),
  scene: z.string().min(1).max(500),
  solutionStepId: z.string().min(1).max(100),
  dialogue: z.array(dialogueSchema).min(1).max(6),
  narration: z.string().min(1).max(500).optional(),
  visualAid: rendererSpecSchema.optional(),
  formula: z.array(z.string().min(1).max(100)).max(10),
  emphasisWords: z.array(z.string().min(1).max(50)).max(20),
  presentation: panelPresentationSchema
}).strict();
export type MangaPanelV3 = z.infer<typeof panelSchema>;

export const mangaPlanV3Schema = z.object({
  schemaVersion: z.literal(MANGA_PLAN_VERSION),
  jobId: z.string().min(1).max(200),
  planSource: z.enum(["ai", "ai_repaired", "fallback"]),
  title: z.string().min(1).max(200),
  problem: z.object({
    text: z.string().min(1).max(2000),
    studentAnswer: z.string().min(1).max(500),
    correctAnswer: z.string().min(1).max(500)
  }).strict(),
  solutionSteps: z.array(solutionStepSchema).min(1).max(20),
  layoutTemplate: z.enum(["six-panel-a4-v1"]),
  panels: z.array(panelSchema).min(4).max(8),
  repairNotes: z.array(repairNoteSchema).max(50)
}).strict().superRefine((plan, ctx) => {
  const ids = new Set(plan.solutionSteps.map((step) => step.id));
  plan.panels.forEach((panel, index) => {
    if (!ids.has(panel.solutionStepId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["panels", index, "solutionStepId"], message: `unknown solutionStepId: ${panel.solutionStepId}` });
  });
});
export type MangaPlanV3 = z.infer<typeof mangaPlanV3Schema>;
