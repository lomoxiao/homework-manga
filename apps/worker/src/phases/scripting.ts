import { aiScenarioOutputJsonSchema } from "@homework-manga/contracts/aiScenarioOutputJsonSchema";
import { approvedProblemSchema, APPROVED_PROBLEM_VERSION } from "@homework-manga/contracts/approvedProblem";
import { packEnvelope, unpackEnvelope } from "@homework-manga/contracts/firebaseCodec";
import { mangaPlanV3Schema, MANGA_PLAN_VERSION } from "@homework-manga/contracts/mangaPlan";
import { env } from "../env.js";
import { claimJob, completePhase, ensureJobDir, failPhase } from "../queue/jobStore.js";
import { runCodex } from "../services/codexRunner.js";
import { notifySlack, reviewUrl } from "../services/notify.js";
import { buildPhotoClip } from "../services/photoClip.js";
import { resolveSourceImage } from "../services/sourceImage.js";
import { generateScenarioWithRepair, type ScenarioModelRun } from "./scenarioEngine.js";
import type { HomeworkJobV3 } from "@homework-manga/contracts/homeworkJob";
import type { ApprovedProblem } from "@homework-manga/contracts/approvedProblem";

export async function processScriptingJob(jobId: string): Promise<void> {
  const job = await claimJob(jobId, "scripting");
  if (!job) return;
  console.log(`[scripting] started job=${job.id} attempt=${job.attempt?.scripting ?? 1}`);
  try {
    const approvedEnvelope = job.artifacts?.approved;
    if (!approvedEnvelope) {
      await failPhase(job, "INTERNAL_ERROR", { reason: "artifacts.approved がありません。承認からやり直してください。" });
      return;
    }
    const approved = unpackEnvelope(approvedProblemSchema, APPROVED_PROBLEM_VERSION, approvedEnvelope);
    if (!approved.ok) {
      await failPhase(job, "INTERNAL_ERROR", approved.error);
      return;
    }

    const jobDir = await ensureJobDir(job.id);
    const run: ScenarioModelRun = env.HOMEWORK_FAULT
      ? faultInjectedRun(env.HOMEWORK_FAULT)
      : async (prompt, attempt) => {
          const raw = await runCodex({ prompt, jobDir, logLabel: `scenario-a${attempt}`, outputSchema: aiScenarioOutputJsonSchema });
          return raw.result;
        };

    const inject = await preparePhotoClipInjection(job, approved.value, jobDir);
    const result = await generateScenarioWithRepair({ jobId: job.id, approved: approved.value, run, inject });
    await completePhase(job, "ready", {
      "artifacts/mangaPlan": packEnvelope(mangaPlanV3Schema, MANGA_PLAN_VERSION, result.plan)
    });
    console.log(`[scripting] completed job=${job.id} planSource=${result.plan.planSource} aiAttempts=${result.attempts} fallback=${result.usedFallback} repairNotes=${result.plan.repairNotes.length}`);
    await notifySlack(result.usedFallback
      ? `まんが教材を自動生成(簡易版)で作成しました。確認して必要なら再生成してください。\n${reviewUrl(job.id)}`
      : `まんが教材ができあがりました！\n${reviewUrl(job.id)}`);
  } catch (error) {
    await failPhase(job, "INTERNAL_ERROR", error);
  }
}

/** 解析済み figures があれば実写真の切り抜きを error_location コマ用に用意する。失敗しても漫画生成は続行。 */
async function preparePhotoClipInjection(job: HomeworkJobV3, approved: ApprovedProblem, jobDir: string) {
  if (!approved.figures.length) return undefined;
  try {
    const imagePath = await resolveSourceImage(job, jobDir);
    const spec = await buildPhotoClip({ figures: approved.figures, imagePath });
    if (!spec) return undefined;
    console.log(`[scripting] photo_clip injected job=${job.id} bytes=${spec.type === "photo_clip" ? spec.dataUri.length : 0}`);
    return { role: "error_location" as const, spec };
  } catch (error) {
    console.warn(`[scripting] photo_clip をスキップします job=${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/** 故障注入(HOMEWORK_FAULT): リトライ→フォールバック経路の定期確認用。 */
function faultInjectedRun(fault: string): ScenarioModelRun {
  return async () => {
    if (fault === "json_broken") return '{"status": "verified", "title": "壊れたJSON", "panels": [';
    if (fault === "math_wrong") {
      return JSON.stringify({
        status: "verified",
        verification: { status: "verified", confidence: 0.9, warnings: [] },
        title: "検算NGの出力",
        problemClassification: "equal_division",
        solutionSteps: [{ id: "step-1", explanation: "わり算する", expression: "24 / 3 = 9", result: "9" }],
        panels: ["problem", "error_location", "visualization", "solution", "check", "transfer"].map((role) => ({
          role, learningPurpose: "確認", scene: "教室", solutionStepId: "step-1",
          dialogueText: "考えよう", narration: null, visualIntent: null, formula: [], emphasisWords: []
        })),
        reason: null
      });
    }
    // five_panels: 修復層で PANEL_PADDED になり ready に到達する(フォールバック不要)ことの確認用
    return JSON.stringify({
      status: "verified",
      verification: { status: "verified", confidence: 0.9, warnings: [] },
      title: "5コマしかない出力",
      problemClassification: "equal_division",
      solutionSteps: [{ id: "step-1", explanation: "わり算する", expression: "24 / 3 = 8", result: "8" }],
      panels: ["problem", "error_location", "visualization", "solution", "check"].map((role) => ({
        role, learningPurpose: "確認", scene: "教室", solutionStepId: "step-1",
        dialogueText: "考えよう", narration: null, visualIntent: null, formula: [], emphasisWords: []
      })),
      reason: null
    });
  };
}
