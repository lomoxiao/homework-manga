export type AnalysisConfidence = {
  problemText: number;
  studentAnswer: number;
  correctAnswerCandidate: number;
  mistakeCause: number;
};

export type RemoteProblemAnalysis = {
  id: string;
  problemText: string;
  studentAnswer: string;
  correctAnswerCandidate: string;
  mistakeCause: string;
  confidence: AnalysisConfidence;
  evidence: string[];
  warnings: string[];
};

export type MultipleHomeworkAnalysis = {
  problems: RemoteProblemAnalysis[];
  warnings: string[];
  needsHumanReview: true;
};

export type LegacyHomeworkAnalysis = Omit<RemoteProblemAnalysis, "id"> & { needsHumanReview: true };
export type RemoteHomeworkAnalysis = MultipleHomeworkAnalysis | LegacyHomeworkAnalysis;

export function normalizeRemoteAnalysis(analysis: RemoteHomeworkAnalysis): MultipleHomeworkAnalysis {
  if ("problems" in analysis) return { ...analysis, problems: analysis.problems.slice(0, 10) };
  return {
    problems: [{
      id: "problem-1",
      problemText: analysis.problemText,
      studentAnswer: analysis.studentAnswer,
      correctAnswerCandidate: analysis.correctAnswerCandidate,
      mistakeCause: analysis.mistakeCause,
      confidence: analysis.confidence,
      evidence: analysis.evidence,
      warnings: analysis.warnings
    }],
    warnings: [],
    needsHumanReview: true
  };
}
