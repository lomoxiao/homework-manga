import { z } from "zod";

const dialogueSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  tone: z.enum(["normal", "question", "encourage", "discovery"])
});

const barModelSchema = z.object({
  type: z.literal("bar_model"),
  total: z.number().positive(),
  groups: z.number().int().positive(),
  perGroup: z.number().positive(),
  label: z.string()
});

export const mangaPlanSchema = z.object({
  schemaVersion: z.literal("1.0"),
  jobId: z.string().min(1),
  title: z.string().min(1),
  problem: z.object({
    text: z.string().min(1),
    studentAnswer: z.string().min(1),
    correctAnswer: z.string().min(1)
  }),
  panels: z.array(z.object({
    panelNumber: z.number().int().min(1).max(6),
    learningPurpose: z.string().min(1),
    scene: z.string().min(1),
    characters: z.array(z.string()),
    characterPose: z.record(z.string()).default({}),
    characterExpression: z.record(z.string()).default({}),
    background: z.string(),
    props: z.array(z.string()).default([]),
    dialogue: z.array(dialogueSchema),
    narration: z.string().nullable(),
    visualAid: barModelSchema.nullable(),
    formula: z.array(z.string()),
    emphasisWords: z.array(z.string()),
    layout: z.object({
      size: z.enum(["small", "medium", "large"]),
      characterSide: z.enum(["left", "right"]),
      visualAidPosition: z.enum(["center", "bottom", "right"])
    }),
    assetIds: z.array(z.string())
  })).length(6)
});

export const renderConfigSchema = z.object({
  schemaVersion: z.literal("1.0"),
  templateId: z.literal("six-panel-a4-v1"),
  page: z.object({
    size: z.literal("A4"),
    orientation: z.literal("portrait"),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  theme: z.object({
    fontFamily: z.string(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    emphasisColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }),
  exports: z.array(z.enum(["html", "pdf", "png"])).min(1)
});

export const homeworkDraftSchema = z.object({
  grade: z.number().int().min(1).max(6),
  subject: z.literal("math"),
  problemText: z.string().trim().min(1, "問題文を入力してください"),
  studentAnswer: z.string().trim().min(1, "子どもの答えを入力してください"),
  correctAnswer: z.string().trim().min(1, "正しい答えを入力してください"),
  mistakeCause: z.string().trim().min(1, "つまずきの原因を入力してください")
});

export const workspaceStateSchema = z.object({
  version: z.literal(1),
  step: z.enum(["input", "analysis", "scenario", "preview"]),
  draft: homeworkDraftSchema,
  mangaPlan: mangaPlanSchema.nullable(),
  scenarioEdited: z.boolean(),
  updatedAt: z.string()
});

export type MangaPlan = z.infer<typeof mangaPlanSchema>;
export type MangaPanel = MangaPlan["panels"][number];
export type BarModelData = NonNullable<MangaPanel["visualAid"]>;
export type RenderConfig = z.infer<typeof renderConfigSchema>;
export type HomeworkDraft = z.infer<typeof homeworkDraftSchema>;
export type WorkspaceState = z.infer<typeof workspaceStateSchema>;
