import { describe, expect, it } from "vitest";
import { normalizeRemoteAnalysis, type LegacyHomeworkAnalysis, type MultipleHomeworkAnalysis } from "../src/remoteAnalysis";

const confidence = { problemText: 0.9, studentAnswer: 0.7, correctAnswerCandidate: 0.9, mistakeCause: 0.6 };

describe("remote homework analysis compatibility", () => {
  it("converts a legacy scalar analysis into one candidate", () => {
    const legacy: LegacyHomeworkAnalysis = {
      problemText: "問", studentAnswer: "誤答", correctAnswerCandidate: "正答", mistakeCause: "原因",
      confidence, evidence: [], warnings: [], needsHumanReview: true
    };
    expect(normalizeRemoteAnalysis(legacy).problems).toEqual([expect.objectContaining({ id: "problem-1", problemText: "問" })]);
  });

  it("preserves separated candidates and limits them to ten", () => {
    const analysis: MultipleHomeworkAnalysis = {
      problems: Array.from({ length: 12 }, (_, index) => ({ id: `p-${index}`, problemText: "問", studentAnswer: "誤答", correctAnswerCandidate: "正答", mistakeCause: "原因", confidence, evidence: [], warnings: [] })),
      warnings: [], needsHumanReview: true
    };
    expect(normalizeRemoteAnalysis(analysis).problems).toHaveLength(10);
  });
});
