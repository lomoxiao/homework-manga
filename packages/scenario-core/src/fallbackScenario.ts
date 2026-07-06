import { buildTemplatePanels, type RepairedScenario } from "@homework-manga/contracts/aiScenario";
import type { ApprovedProblem } from "@homework-manga/contracts/approvedProblem";
import type { SolutionStep } from "@homework-manga/contracts/mangaPlan";
import { classifyProblem } from "./curriculum";
import { verifyEquation } from "./mathVerifier";

/**
 * 決定論フォールバック: AI が全滅しても子どもに必ず漫画が届くようにする「保険」。
 * テンプレートコマ+検証済みの式+可能なら等分のバーモデル図解で MangaPlan の材料を作る。
 * planSource: "fallback" として保存され、保護者画面から [AIでもう一度作る] で再生成できる。
 */
export function buildFallbackScenario(approved: ApprovedProblem): RepairedScenario {
  const expression = (approved.canonicalAnswer || approved.correctAnswer).trim();
  const verified = verifyEquation(expression) === true;
  const steps: SolutionStep[] = [{
    id: "step-1",
    explanation: "問題の数量関係を確認する",
    expression: verified ? expression.slice(0, 100) : "",
    result: approved.correctAnswer.slice(0, 200)
  }];
  const panels = buildTemplatePanels(approved, steps);

  const division = verified ? parseDivisionEquation(expression) : null;
  if (division) {
    panels[2] = {
      ...panels[2],
      visualAid: {
        type: "bar_model",
        position: "center",
        total: { numerator: division.total, denominator: 1 },
        groupCount: division.groups,
        perGroup: { numerator: division.perGroup, denominator: 1 }
      }
    };
  }

  const classification = classifyProblem(approved.problemText);
  return {
    title: `${topicTitle(classification.topic)}`,
    problemClassification: classification.topic,
    solutionSteps: steps,
    panels
  };
}

function parseDivisionEquation(formula: string): { total: number; groups: number; perGroup: number } | null {
  const match = formula.match(/(\d+)\s*[÷/]\s*(\d+)\s*[=＝]\s*(\d+)/);
  if (!match) return null;
  const [, total, groups, perGroup] = match.map(Number);
  return total && groups && perGroup && total / groups === perGroup ? { total, groups, perGroup } : null;
}

function topicTitle(topic: string): string {
  const names: Record<string, string> = {
    division_equal_sharing: "同じ数ずつ分けるには？",
    fractions: "分数の関係を見つけよう",
    decimals: "小数を正しく計算しよう",
    area: "面積を図で考えよう",
    volume: "体積を組み立てよう",
    ratio_percent: "割合をもとに考えよう",
    speed: "速さの3つの量を結ぼう",
    average: "平均の意味をつかもう",
    tables_graphs: "表とグラフを読み取ろう"
  };
  return names[topic] ?? "問題のしくみを見つけよう";
}
