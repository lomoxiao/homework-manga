import { z } from "zod";

export const ANALYSIS_VERSION = "3.0" as const;

const confidence = z.coerce.number().min(0).max(1).catch(0);
/** undefined/null を空文字へ寄せる寛容文字列(coerce だと "undefined" になるため)。 */
const looseString = z.preprocess((value) => (value === null || value === undefined ? "" : value), z.coerce.string()).catch("");
const looseCoordinate = z.coerce.number().catch(Number.NaN);

const looseFigureSchema = z.object({
  kind: looseString,
  description: looseString,
  labels: z.array(z.coerce.string()).catch([]),
  bbox: z.object({ x: looseCoordinate, y: looseCoordinate, w: looseCoordinate, h: looseCoordinate }).nullish().catch(null),
  relationToMistake: looseString
}).passthrough();

/** AI(画像解析)出力の寛容な受け口。1フィールドの破損で全体を落とさない。 */
const looseProblemSchema = z.object({
  id: looseString,
  problemText: looseString,
  studentAnswer: looseString,
  correctAnswerCandidate: looseString,
  mistakeCause: looseString,
  confidence: z.object({
    problemText: confidence,
    studentAnswer: confidence,
    correctAnswerCandidate: confidence,
    mistakeCause: confidence
  }).catch({ problemText: 0, studentAnswer: 0, correctAnswerCandidate: 0, mistakeCause: 0 }),
  evidence: z.array(z.coerce.string()).catch([]),
  warnings: z.array(z.coerce.string()).catch([]),
  figures: z.array(looseFigureSchema).catch([])
}).passthrough();

export const aiAnalysisLooseSchema = z.object({
  problems: z.array(looseProblemSchema).catch([]),
  warnings: z.array(z.coerce.string()).catch([])
}).passthrough();

export const FIGURE_KINDS = ["diagram", "graph", "illustration", "student_drawing"] as const;

/** 画像全体を1とした左上原点の相対座標。B3(写真切り抜き)のクロップ範囲になる。 */
const figureBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1)
}).strict();

export const homeworkFigureSchema = z.object({
  kind: z.enum(FIGURE_KINDS),
  description: z.string().min(1).max(300),
  labels: z.array(z.string().min(1).max(50)).max(10),
  bbox: figureBboxSchema,
  relationToMistake: z.string().max(300)
}).strict();
export type HomeworkFigure = z.infer<typeof homeworkFigureSchema>;

/** 内部厳格モデル。常に複数問題形式(単一問題は要素1の配列)。 */
const problemSchema = z.object({
  id: z.string().min(1).max(100),
  problemText: z.string().min(1).max(2000),
  studentAnswer: z.string().max(500),
  correctAnswerCandidate: z.string().max(500),
  mistakeCause: z.string().max(1000),
  confidence: z.object({
    problemText: z.number().min(0).max(1),
    studentAnswer: z.number().min(0).max(1),
    correctAnswerCandidate: z.number().min(0).max(1),
    mistakeCause: z.number().min(0).max(1)
  }).strict(),
  evidence: z.array(z.string().max(500)).max(20),
  warnings: z.array(z.string().max(500)).max(20),
  // 旧 Envelope(figures なし)も読めるよう default で受ける(バージョン 3.0 据置)
  figures: z.array(homeworkFigureSchema).max(5).default([])
}).strict();

export const homeworkAnalysisV3Schema = z.object({
  schemaVersion: z.literal(ANALYSIS_VERSION),
  problems: z.array(problemSchema).min(1).max(10),
  warnings: z.array(z.string().max(500)).max(20)
}).strict();
export type HomeworkAnalysisV3 = z.infer<typeof homeworkAnalysisV3Schema>;

export type AnalysisRepairResult =
  | { ok: true; analysis: HomeworkAnalysisV3 }
  | { ok: false; reason: string };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 壊れた figure は個別に除外する(問題全体は落とさない)。bbox が使えない figure も除外。 */
function repairFigure(raw: z.infer<typeof looseFigureSchema>): HomeworkFigure | null {
  const kind = raw.kind.trim() as (typeof FIGURE_KINDS)[number];
  if (!(FIGURE_KINDS as readonly string[]).includes(kind)) return null;
  const description = raw.description.trim().slice(0, 300);
  if (!description) return null;
  const bbox = raw.bbox;
  if (!bbox || [bbox.x, bbox.y, bbox.w, bbox.h].some((value) => Number.isNaN(value))) return null;
  const x = clamp01(bbox.x);
  const y = clamp01(bbox.y);
  const w = Math.min(clamp01(bbox.w), 1 - x);
  const h = Math.min(clamp01(bbox.h), 1 - y);
  if (w <= 0 || h <= 0) return null;
  return {
    kind,
    description,
    labels: raw.labels.map((label) => label.trim().slice(0, 50)).filter(Boolean).slice(0, 10),
    bbox: { x, y, w, h },
    relationToMistake: raw.relationToMistake.trim().slice(0, 300)
  };
}

/** 寛容スキーマで受けた解析結果を厳格モデルへ正規化する。問題が1つも読めなければ失敗(=写真の撮り直し案内)。 */
export function repairAnalysis(raw: unknown): AnalysisRepairResult {
  const loose = aiAnalysisLooseSchema.safeParse(raw);
  if (!loose.success) return { ok: false, reason: "解析結果の形式を読み取れませんでした。" };
  const problems = loose.data.problems
    .filter((problem) => problem.problemText.trim().length > 0)
    .slice(0, 10)
    .map((problem, index) => ({
      id: problem.id.trim() || `problem-${index + 1}`,
      problemText: problem.problemText.trim().slice(0, 2000),
      studentAnswer: problem.studentAnswer.trim().slice(0, 500),
      correctAnswerCandidate: problem.correctAnswerCandidate.trim().slice(0, 500),
      mistakeCause: problem.mistakeCause.trim().slice(0, 1000),
      confidence: problem.confidence,
      evidence: problem.evidence.slice(0, 20).map((item) => item.slice(0, 500)),
      warnings: problem.warnings.slice(0, 20).map((item) => item.slice(0, 500)),
      figures: problem.figures.map(repairFigure).filter((figure): figure is HomeworkFigure => figure !== null).slice(0, 5)
    }));
  if (problems.length === 0) return { ok: false, reason: "写真から問題を読み取れませんでした。" };
  const seen = new Set<string>();
  for (const problem of problems) {
    if (seen.has(problem.id)) problem.id = `${problem.id}-${seen.size + 1}`;
    seen.add(problem.id);
  }
  return {
    ok: true,
    analysis: homeworkAnalysisV3Schema.parse({
      schemaVersion: ANALYSIS_VERSION,
      problems,
      warnings: loose.data.warnings.slice(0, 20).map((item) => item.slice(0, 500))
    })
  };
}
