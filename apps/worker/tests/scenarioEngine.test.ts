import { approvedProblemSchema } from "@homework-manga/contracts/approvedProblem";
import { mangaPlanV3Schema } from "@homework-manga/contracts/mangaPlan";
import { generateScenarioWithRepair } from "../src/phases/scenarioEngine";
import { extractJsonObject } from "../src/services/extractJson";

const approved = approvedProblemSchema.parse({
  problemText: "りんごが24こあります。3人で同じ数ずつ分けます。1人分は何こになりますか。",
  studentAnswer: "24 - 3 = 21",
  correctAnswer: "24 ÷ 3 = 8",
  mistakeCause: "等分の場面で引き算をしている",
  canonicalAnswer: "24 ÷ 3 = 8"
});

const cleanOutput = () => JSON.stringify({
  status: "verified",
  verification: { status: "verified", confidence: 0.9, warnings: [] },
  title: "同じ数ずつ分けよう",
  problemClassification: "equal_division",
  solutionSteps: [{ id: "step-1", explanation: "24こを3人で等分する", expression: "24 / 3 = 8", result: "8" }],
  panels: ["problem", "error_location", "visualization", "solution", "check", "transfer"].map((role) => ({
    role, learningPurpose: "ねらい", scene: "教室", solutionStepId: "step-1",
    dialogueText: "考えてみよう", narration: null, visualIntent: null, formula: [], emphasisWords: []
  })),
  reason: null
});

describe("generateScenarioWithRepair: 必ず ready 相当の plan に到達する", () => {
  it("clean output → planSource ai, 1 attempt", async () => {
    const result = await generateScenarioWithRepair({ jobId: "job-1", approved, run: async () => cleanOutput() });
    expect(result.usedFallback).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.plan.planSource).toBe("ai");
    expect(mangaPlanV3Schema.safeParse(result.plan).success).toBe(true);
  });

  it("broken json → retry feedback 付きで再実行して成功", async () => {
    const prompts: string[] = [];
    const result = await generateScenarioWithRepair({
      jobId: "job-2", approved,
      run: async (prompt, attempt) => {
        prompts.push(prompt);
        return attempt === 1 ? '{"status": "verified", "panels": [' : cleanOutput();
      }
    });
    expect(result.attempts).toBe(2);
    expect(result.usedFallback).toBe(false);
    expect(prompts[1]).toContain("前回の出力は次の理由で使用できませんでした");
  });

  it("math wrong every time → 決定論フォールバックで必ず完成する", async () => {
    const wrong = cleanOutput().replace('"24 / 3 = 8"', '"24 / 3 = 9"');
    const result = await generateScenarioWithRepair({ jobId: "job-3", approved, run: async () => wrong, maxAiAttempts: 2 });
    expect(result.usedFallback).toBe(true);
    expect(result.plan.planSource).toBe("fallback");
    expect(result.retryHistory).toHaveLength(2);
    expect(result.retryHistory[0][0].code).toBe("MATH_INCORRECT");
    expect(mangaPlanV3Schema.safeParse(result.plan).success).toBe(true);
    // フォールバックでも等分問題はバーモデル図解を持つ
    expect(result.plan.panels[2].visualAid).toMatchObject({ type: "bar_model", groupCount: 3 });
  });

  it("model run 自体の例外もリトライ扱いになりフォールバックへ", async () => {
    const result = await generateScenarioWithRepair({
      jobId: "job-4", approved,
      run: async () => { throw new Error("codex timeout"); },
      maxAiAttempts: 2
    });
    expect(result.usedFallback).toBe(true);
    expect(result.plan.panels).toHaveLength(6);
  });

  it("5コマ出力は修復(PANEL_PADDED)で ai_repaired として成功する", async () => {
    const parsed = JSON.parse(cleanOutput());
    parsed.panels = parsed.panels.slice(0, 5);
    const result = await generateScenarioWithRepair({ jobId: "job-5", approved, run: async () => JSON.stringify(parsed) });
    expect(result.attempts).toBe(1);
    expect(result.plan.planSource).toBe("ai_repaired");
    expect(result.plan.repairNotes.some((note) => note.code === "PANEL_PADDED")).toBe(true);
  });
});

describe("extractJsonObject", () => {
  it("フェンス付きJSONを読む", () => {
    expect(extractJsonObject('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
  it("末尾が欠けたJSONを jsonrepair で補修する", () => {
    expect(extractJsonObject('{"a": [1, 2')).toEqual({ a: [1, 2] });
    expect(extractJsonObject('前置きテキスト {"a": {"b": "こん')).toEqual({ a: { b: "こん" } });
  });
  it("JSONが全く無ければ throw する", () => {
    expect(() => extractJsonObject("no json here")).toThrow();
  });
});
