/**
 * E2E テスト用 CLI: 解析済みジョブの問題を1つ承認して scripting を起動する(web UI の代替)。
 *   npm run job:approve --workspace @homework-manga/worker -- <jobId> [problemId]
 */
import { homeworkAnalysisV3Schema, ANALYSIS_VERSION } from "@homework-manga/contracts/aiAnalysis";
import { approvedProblemSchema, APPROVED_PROBLEM_VERSION } from "@homework-manga/contracts/approvedProblem";
import { packEnvelope, unpackEnvelope } from "@homework-manga/contracts/firebaseCodec";
import { homeworkJobV3Schema, transitionPhase } from "@homework-manga/contracts/homeworkJob";
import { env } from "../env.js";
import { getDb } from "../services/firebaseAdmin.js";

async function main() {
  const [jobId, problemId] = process.argv.slice(2);
  if (!jobId) {
    console.error("Usage: npm run job:approve --workspace @homework-manga/worker -- <jobId> [problemId]");
    process.exit(1);
  }
  const ref = getDb().ref(`${env.HOMEWORK_JOBS_PATH}/${jobId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists()) throw new Error(`job not found: ${jobId}`);
  const job = homeworkJobV3Schema.parse(snapshot.val());
  if (job.phase !== "awaiting_approval") throw new Error(`job is not awaiting approval (phase=${job.phase})`);
  if (!job.artifacts?.analysis) throw new Error("artifacts.analysis がありません。");

  const analysis = unpackEnvelope(homeworkAnalysisV3Schema, ANALYSIS_VERSION, job.artifacts.analysis);
  if (!analysis.ok) throw new Error(`analysis unpack failed: ${JSON.stringify(analysis.error)}`);
  const problem = problemId
    ? analysis.value.problems.find((item) => item.id === problemId)
    : analysis.value.problems[0];
  if (!problem) throw new Error(`problem not found: ${problemId ?? "(first)"}`);

  const approved = approvedProblemSchema.parse({
    problemText: problem.problemText,
    studentAnswer: problem.studentAnswer || "(未記入)",
    correctAnswer: problem.correctAnswerCandidate || "(未確認)",
    mistakeCause: problem.mistakeCause || "(未分析)",
    canonicalAnswer: problem.correctAnswerCandidate,
    selectedProblemId: problem.id
  });

  const next = transitionPhase({ phase: job.phase, runState: job.runState }, "scripting", "queued");
  await ref.update({
    ...next,
    "artifacts/approved": packEnvelope(approvedProblemSchema, APPROVED_PROBLEM_VERSION, approved),
    "artifacts/mangaPlan": null,
    failure: null
  });
  console.log(`approved problem "${problem.id}" for job ${jobId} → scripting:queued`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
