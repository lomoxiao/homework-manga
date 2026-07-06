import { repairScenario, aiScenarioLooseSchema } from "../src/aiScenario";
import { aiScenarioOutputJsonSchema } from "../src/aiScenarioOutputJsonSchema";
import { approvedProblemSchema } from "../src/approvedProblem";

// Codex へ渡す --output-schema(手書き・OpenAI構造化出力互換)に完全準拠した出力を、
// 受け側の寛容スキーマ+修復層が必ず受容できることを担保するドリフト防止テスト。
const approved = approvedProblemSchema.parse({
  problemText: "赤いリボンは1.8m、黄色いリボンは2.5mです。赤は黄色の何倍ですか。",
  studentAnswer: "0.72",
  correctAnswer: "1.8 / 2.5 = 0.72",
  mistakeCause: "どちらを基準にするか迷った"
});

const nullIntent = {
  type: "compare_quantities", requirement: "optional",
  headers: null, rows: null, total: null, groupCount: null, numerator: null, denominator: null,
  min: null, max: null, tickCount: null, marks: null,
  left: { numerator: 9, denominator: 5 }, right: { numerator: 5, denominator: 2 },
  leftLabel: "赤", rightLabel: "黄色", unit: "m"
};

const schemaCompliantOutput = {
  status: "verified",
  verification: { status: "verified", confidence: 0.92, warnings: [] },
  title: "何倍かをくらべよう",
  problemClassification: "quantity_comparison",
  solutionSteps: [
    { id: "step-1", explanation: "赤の長さを黄色の長さで割る", expression: "1.8 / 2.5 = 0.72", result: "0.72" }
  ],
  panels: ["problem", "error_location", "visualization", "solution", "check", "transfer"].map((role) => ({
    role,
    learningPurpose: "比べる基準を確認する",
    scene: "教室でリボンを比べる",
    solutionStepId: "step-1",
    dialogueText: "どちらを基準にするのかな？",
    narration: null,
    visualIntent: role === "visualization" ? nullIntent : null,
    formula: role === "check" ? ["1.8 / 2.5 = 0.72"] : [],
    emphasisWords: ["基準"]
  })),
  reason: null
};

describe("aiScenarioOutputJsonSchema と受け側の整合", () => {
  it("スキーマ準拠の出力を寛容スキーマがそのまま受ける", () => {
    expect(aiScenarioLooseSchema.safeParse(schemaCompliantOutput).success).toBe(true);
  });

  it("スキーマ準拠の出力が修復層をノート最小で通過する", () => {
    const result = repairScenario(schemaCompliantOutput, approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels).toHaveLength(6);
      const visual = result.scenario.panels[2].visualAid;
      expect(visual).toMatchObject({ type: "comparison", operator: "<" });
    }
  });

  it("required 一覧が寛容スキーマの主要フィールドと一致している", () => {
    const required = aiScenarioOutputJsonSchema.required as string[];
    expect(required.sort()).toEqual(["panels", "problemClassification", "reason", "solutionSteps", "status", "title", "verification"].sort());
  });
});
