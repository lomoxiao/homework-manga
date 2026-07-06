import {
  buildRetryFeedback, compileMangaPlan, repairScenario, type RetryReason
} from "@homework-manga/contracts/aiScenario";
import { buildScenarioPrompt } from "@homework-manga/contracts/aiScenarioOutputJsonSchema";
import type { ApprovedProblem } from "@homework-manga/contracts/approvedProblem";
import type { MangaPlanV3 } from "@homework-manga/contracts/mangaPlan";
import { buildFallbackScenario } from "@homework-manga/scenario-core/fallbackScenario";
import { verifyEquation } from "@homework-manga/scenario-core/mathVerifier";
import { extractJsonObject } from "../services/extractJson.js";

/** モデル実行(実体は Codex CLI。テスト・故障注入では fixture を返す)。 */
export type ScenarioModelRun = (prompt: string, attempt: number) => Promise<string>;

export type ScenarioEngineResult = {
  plan: MangaPlanV3;
  attempts: number;
  usedFallback: boolean;
  retryHistory: RetryReason[][];
};

/**
 * AI出力は必ず壊れる前提のシナリオ生成エンジン。
 *   1回目: 通常プロンプト
 *   リトライ: 違反内容(Zod issue / 検算NG)を列挙したフィードバックを追記して再実行
 *   全滅: scenario-core の決定論生成へフォールバック(子どもには必ず漫画が届く)
 */
export async function generateScenarioWithRepair(input: {
  jobId: string;
  approved: ApprovedProblem;
  run: ScenarioModelRun;
  maxAiAttempts?: number;
}): Promise<ScenarioEngineResult> {
  const maxAttempts = input.maxAiAttempts ?? 3;
  const basePrompt = buildScenarioPrompt(input.approved);
  const retryHistory: RetryReason[][] = [];
  let prompt = basePrompt;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let reasons: RetryReason[];
    try {
      const raw = await input.run(prompt, attempt);
      let parsed: unknown;
      try {
        parsed = extractJsonObject(raw);
      } catch (error) {
        reasons = [{ code: "OUTPUT_UNPARSEABLE", detail: error instanceof Error ? error.message : String(error) }];
        retryHistory.push(reasons);
        prompt = basePrompt + buildRetryFeedback(reasons);
        continue;
      }
      const repaired = repairScenario(parsed, input.approved, { verifyEquation });
      if (repaired.ok) {
        const plan = compileMangaPlan({ jobId: input.jobId, approved: input.approved, scenario: repaired.scenario, notes: repaired.notes });
        return { plan, attempts: attempt, usedFallback: false, retryHistory };
      }
      reasons = repaired.retry;
    } catch (error) {
      reasons = [{ code: "OUTPUT_UNPARSEABLE", detail: `model run failed: ${error instanceof Error ? error.message : String(error)}` }];
    }
    retryHistory.push(reasons);
    prompt = basePrompt + buildRetryFeedback(reasons);
  }

  const fallback = buildFallbackScenario(input.approved);
  const plan = compileMangaPlan({ jobId: input.jobId, approved: input.approved, scenario: fallback, notes: [], planSource: "fallback" });
  return { plan, attempts: maxAttempts, usedFallback: true, retryHistory };
}
