import { homeworkAnalysisV3Schema, repairAnalysis, ANALYSIS_VERSION } from "../src/aiAnalysis";
import { approvedProblemSchema } from "../src/approvedProblem";

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

  it("normalizes figures and clamps bbox into the unit square", () => {
    const result = repairAnalysis({
      problems: [{
        problemText: "長方形の面積は？", studentAnswer: "10", correctAnswerCandidate: "24", mistakeCause: "辺の取り違え",
        figures: [{
          kind: "diagram", description: "縦4cm横6cmの長方形",
          labels: ["4cm", "6cm", ""],
          bbox: { x: 0.8, y: -0.2, w: 0.5, h: 1.4 },
          relationToMistake: "縦を横として使った"
        }]
      }]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const figure = result.analysis.problems[0].figures[0];
      expect(figure.bbox.x).toBe(0.8);
      expect(figure.bbox.y).toBe(0);
      expect(figure.bbox.w).toBeCloseTo(0.2);
      expect(figure.bbox.h).toBe(1);
      expect(figure.labels).toEqual(["4cm", "6cm"]);
    }
  });

  it("drops broken figures individually without failing the problem", () => {
    const result = repairAnalysis({
      problems: [{
        problemText: "1+1は？", studentAnswer: "3", correctAnswerCandidate: "2", mistakeCause: "",
        figures: [
          { kind: "unknown-kind", description: "x", bbox: { x: 0, y: 0, w: 0.5, h: 0.5 } },
          { kind: "graph", description: "", bbox: { x: 0, y: 0, w: 0.5, h: 0.5 } },
          { kind: "graph", description: "目盛りのグラフ", bbox: null },
          { kind: "graph", description: "目盛りのグラフ", bbox: { x: 0, y: 0, w: "壊れた", h: 0.5 } },
          { kind: "graph", description: "幅ゼロ", bbox: { x: 1, y: 0, w: 0.5, h: 0.5 } },
          { kind: "student_drawing", description: "子どもの補助線", bbox: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 } }
        ]
      }]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.problems[0].figures).toHaveLength(1);
      expect(result.analysis.problems[0].figures[0].kind).toBe("student_drawing");
    }
  });

  it("keeps reading pre-figures payloads (backward compatibility)", () => {
    const legacyProblem = {
      id: "problem-1", problemText: "24÷3は？", studentAnswer: "21", correctAnswerCandidate: "8",
      mistakeCause: "引き算をした", confidence: { problemText: 0.9, studentAnswer: 0.8, correctAnswerCandidate: 0.7, mistakeCause: 0.6 },
      evidence: [], warnings: []
    };
    const parsed = homeworkAnalysisV3Schema.parse({ schemaVersion: ANALYSIS_VERSION, problems: [legacyProblem], warnings: [] });
    expect(parsed.problems[0].figures).toEqual([]);

    const approved = approvedProblemSchema.parse({
      problemText: "24÷3は？", studentAnswer: "21", correctAnswer: "8", mistakeCause: "引き算をした"
    });
    expect(approved.figures).toEqual([]);
  });
});
