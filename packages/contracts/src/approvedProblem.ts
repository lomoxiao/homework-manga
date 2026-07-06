import { z } from "zod";

export const APPROVED_PROBLEM_VERSION = "3.0" as const;

/** 保護者が確認・承認した1問。シナリオ生成(AI・決定論とも)の入力になる。 */
export const approvedProblemSchema = z.object({
  schemaVersion: z.literal(APPROVED_PROBLEM_VERSION).default(APPROVED_PROBLEM_VERSION),
  grade: z.number().int().min(1).max(6).nullable().default(null),
  subject: z.literal("math").default("math"),
  problemText: z.string().trim().min(1, "問題文を入力してください").max(2000),
  studentAnswer: z.string().trim().min(1, "子どもの答えを入力してください").max(500),
  correctAnswer: z.string().trim().min(1, "正しい答えを入力してください").max(500),
  mistakeCause: z.string().trim().min(1, "つまずきの原因を入力してください").max(1000),
  canonicalAnswer: z.string().max(500).default(""),
  selectedProblemId: z.string().max(100).default("")
}).strict();
export type ApprovedProblem = z.infer<typeof approvedProblemSchema>;
