import { repairAnalysis } from "../src/aiAnalysis";

describe("repairAnalysis", () => {
  it("normalizes a well-formed multi-problem payload", () => {
    const result = repairAnalysis({
      problems: [{
        id: "problem-1", problemText: "24÷3は？", studentAnswer: "21", correctAnswerCandidate: "8",
        mistakeCause: "引き算をした", confidence: { problemText: 0.9, studentAnswer: 0.8, correctAnswerCandidate: 0.7, mistakeCause: 0.6 },
        evidence: ["筆算の跡"], warnings: []
      }],
      warnings: ["影があります"]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.problems).toHaveLength(1);
      expect(result.analysis.problems[0].id).toBe("problem-1");
      expect(result.analysis.warnings).toEqual(["影があります"]);
    }
  });

  it("fills ids, clamps confidence, and drops empty problems", () => {
    const result = repairAnalysis({
      problems: [
        { problemText: "1+1は？", studentAnswer: "3", correctAnswerCandidate: "2", mistakeCause: "", confidence: { problemText: 2, studentAnswer: -1, correctAnswerCandidate: "0.5", mistakeCause: null }, evidence: null, warnings: null },
        { problemText: "", studentAnswer: "", correctAnswerCandidate: "", mistakeCause: "" }
      ]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.problems).toHaveLength(1);
      expect(result.analysis.problems[0].id).toBe("problem-1");
      expect(result.analysis.problems[0].confidence.problemText).toBe(0);
      expect(result.analysis.problems[0].confidence.correctAnswerCandidate).toBe(0.5);
    }
  });

  it("fails closed when nothing is readable", () => {
    expect(repairAnalysis({ problems: [] }).ok).toBe(false);
    expect(repairAnalysis("garbage").ok).toBe(false);
    expect(repairAnalysis({ problems: [{ problemText: "   " }] }).ok).toBe(false);
  });
});
