import { z } from "zod";

export const curriculumDomainSchema = z.enum(["number_calculation", "geometry", "measurement", "change_relationships", "data"]);
export const problemTypeSchema = z.enum(["calculation", "word_problem", "construction", "multiple_choice", "table_graph", "explanation"]);
export const verificationMethodSchema = z.enum(["rational_arithmetic", "ratio_percent", "unit_conversion", "geometry_formula", "statistics", "table_consistency", "substitution", "manual"]);
const dialogueSchema = z.object({ speaker: z.string(), text: z.string(), tone: z.enum(["normal", "question", "encourage", "discovery"]) });
const barModelSchema = z.object({ type: z.literal("bar_model"), total: z.number().positive(), groups: z.number().int().positive(), perGroup: z.number().positive(), label: z.string() });
const aidPrimitive = z.union([z.number(), z.string(), z.boolean()]);
const aidValue = z.union([aidPrimitive, z.array(aidPrimitive)]);
const pluginAid = <T extends string>(type: T) => z.object({
  type: z.literal(type), position: z.enum(["left", "center", "right", "bottom"]).default("center"),
  labels: z.record(aidValue).default({}), data: z.record(aidValue)
});
export const visualAidSchema = z.union([
  barModelSchema, pluginAid("number_line"), pluginAid("place_value"), pluginAid("fraction_bar"), pluginAid("area_model"),
  pluginAid("ratio_diagram"), pluginAid("geometry"), pluginAid("clock"), pluginAid("unit_conversion"), pluginAid("table"),
  pluginAid("bar_chart"), pluginAid("line_chart"), pluginAid("comparison")
]);
const solutionStepSchema = z.object({ id: z.string().min(1), explanation: z.string().min(1), expression: z.string().default(""), result: z.string().default("") });
export const verificationSchema = z.object({
  method: verificationMethodSchema, status: z.enum(["verified", "needs_review", "unsupported"]), confidence: z.number().min(0).max(1), warnings: z.array(z.string()).default([])
});

export const mangaPlanSchema = z.object({
  schemaVersion: z.enum(["1.0", "2.0"]), jobId: z.string().min(1), title: z.string().min(1),
  problem: z.object({ text: z.string().min(1), studentAnswer: z.string().min(1), correctAnswer: z.string().min(1) }),
  panels: z.array(z.object({
    panelNumber: z.number().int().min(1).max(6), learningPurpose: z.string().min(1), scene: z.string().min(1), solutionStepId: z.string().nullable().default(null),
    characters: z.array(z.string()), characterPose: z.record(z.string()).default({}), characterExpression: z.record(z.string()).default({}),
    background: z.string(), props: z.array(z.string()).default([]), dialogue: z.array(dialogueSchema), narration: z.string().nullable(),
    visualAid: visualAidSchema.nullable(), formula: z.array(z.string()), emphasisWords: z.array(z.string()),
    layout: z.object({ size: z.enum(["small", "medium", "large"]), characterSide: z.enum(["left", "right"]), visualAidPosition: z.enum(["center", "bottom", "right"]) }), assetIds: z.array(z.string())
  })).length(6)
});

export const renderConfigSchema = z.object({
  schemaVersion: z.literal("1.0"), templateId: z.literal("six-panel-a4-v1"),
  page: z.object({ size: z.literal("A4"), orientation: z.literal("portrait"), width: z.number().int().positive(), height: z.number().int().positive() }),
  theme: z.object({ fontFamily: z.string(), primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), emphasisColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }), exports: z.array(z.enum(["html", "pdf", "png"])).min(1)
});

export const homeworkDraftSchema = z.object({
  schemaVersion: z.literal("2.0").default("2.0"), grade: z.number().int().min(1).max(6).nullable().default(null), subject: z.literal("math"),
  curriculumDomain: curriculumDomainSchema.default("number_calculation"), topic: z.string().default("unclassified"), problemType: problemTypeSchema.default("word_problem"),
  problemText: z.string().trim().min(1, "問題文を入力してください"), studentAnswer: z.string().trim().min(1, "子どもの答えを入力してください"),
  correctAnswer: z.string().trim().min(1, "正しい答えを入力してください"), mistakeCause: z.string().trim().min(1, "つまずきの原因を入力してください"),
  givens: z.array(z.string()).default([]), unknowns: z.array(z.string()).default([]), constraints: z.array(z.string()).default([]), studentWork: z.array(z.string()).default([]),
  canonicalAnswer: z.string().default(""), solutionSteps: z.array(solutionStepSchema).default([]), misconception: z.string().default(""),
  verification: verificationSchema.default({ method: "manual", status: "needs_review", confidence: 0, warnings: ["未検証です。"] })
});
const workspaceV2Schema = z.object({ version: z.literal(2), step: z.enum(["input", "analysis", "scenario", "preview"]), draft: homeworkDraftSchema, mangaPlan: mangaPlanSchema.nullable(), scenarioEdited: z.boolean(), updatedAt: z.string() });
export const workspaceStateSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const state = value as Record<string, unknown>; if (state.version !== 1) return value;
  return { ...state, version: 2, draft: { ...(state.draft as object), schemaVersion: "2.0" } };
}, workspaceV2Schema);
export type MangaPlan = z.infer<typeof mangaPlanSchema>;
export type MangaPanel = MangaPlan["panels"][number];
export type VisualAid = NonNullable<MangaPanel["visualAid"]>;
export type BarModelData = Extract<VisualAid, { type: "bar_model" }>;
export type RenderConfig = z.infer<typeof renderConfigSchema>;
export type HomeworkDraft = z.infer<typeof homeworkDraftSchema>;
export type WorkspaceState = z.infer<typeof workspaceV2Schema>;
export type Verification = z.infer<typeof verificationSchema>;
