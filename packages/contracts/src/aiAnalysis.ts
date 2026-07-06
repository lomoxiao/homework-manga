import { z } from "zod";

export const ANALYSIS_VERSION = "3.0" as const;

const confidence = z.coerce.number().min(0).max(1).catch(0);
/** undefined/null を空文字へ寄せる寛容文字列(coerce だと "undefined" になるため)。 */
const looseString = z.preprocess((value) => (value === null || value === undefined ? "" : value), z.coerce.string()).catch("");

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
  warnings: z.array(z.coerce.string()).catch([])
}).passthrough();

export const aiAnalysisLooseSchema = z.object({
  problems: z.array(looseProblemSchema).catch([]),
  warnings: z.array(z.coerce.string()).catch([])
}).passthrough();

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
  warnings: z.array(z.string().max(500)).max(20)
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
      warnings: problem.warnings.slice(0, 20).map((item) => item.slice(0, 500))
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
