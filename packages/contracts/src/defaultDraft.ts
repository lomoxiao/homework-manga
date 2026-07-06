import type { HomeworkDraft } from "./schema";

export const defaultDraft: HomeworkDraft = {
  schemaVersion: "2.0", grade: 4, subject: "math", curriculumDomain: "number_calculation", topic: "division_equal_sharing", problemType: "word_problem",
  problemText: "りんごが24個あります。3人で同じ数ずつ分けます。1人分は何個ですか。", studentAnswer: "24 - 3 = 21", correctAnswer: "24 ÷ 3 = 8",
  mistakeCause: "同じ数ずつ分ける場面で、人数の3を引く数だと考えている", givens: ["りんご24個", "3人"], unknowns: ["1人分"], constraints: ["同じ数ずつ"],
  studentWork: ["24 - 3 = 21"], canonicalAnswer: "24 ÷ 3 = 8",
  solutionSteps: [{ id: "step-1", explanation: "24個を3人で等分する", expression: "24 ÷ 3 = 8", result: "1人分は8個" }],
  misconception: "等分の場面を減法として捉えた", verification: { method: "rational_arithmetic", status: "verified", confidence: 0.99, warnings: [] }
};
