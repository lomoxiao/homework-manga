import { approvedProblemSchema } from "@homework-manga/contracts/approvedProblem";
import { compileMangaPlan } from "@homework-manga/contracts/aiScenario";
import { mangaPlanV3Schema } from "@homework-manga/contracts/mangaPlan";
import { buildFallbackScenario } from "../src/fallbackScenario";

describe("buildFallbackScenario", () => {
  it("等分問題はバーモデル図解つきの6コマを合成し、厳格スキーマを通過する", () => {
    const approved = approvedProblemSchema.parse({
      problemText: "りんごが24こあります。3人で同じ数ずつ分けます。1人分は何こですか。",
      studentAnswer: "24 - 3 = 21",
      correctAnswer: "24 ÷ 3 = 8",
      mistakeCause: "等分を引き算と混同",
      canonicalAnswer: "24 ÷ 3 = 8"
    });
    const scenario = buildFallbackScenario(approved);
    expect(scenario.panels).toHaveLength(6);
    expect(scenario.panels[2].visualAid).toMatchObject({ type: "bar_model", groupCount: 3 });
    expect(scenario.solutionSteps[0].expression).toBe("24 ÷ 3 = 8");
    const plan = compileMangaPlan({ jobId: "fallback-1", approved, scenario, notes: [], planSource: "fallback" });
    expect(plan.planSource).toBe("fallback");
    expect(mangaPlanV3Schema.safeParse(plan).success).toBe(true);
  });

  it("面積問題はマス目図解つきの6コマを合成し、厳格スキーマを通過する", () => {
    const approved = approvedProblemSchema.parse({
      problemText: "たての長さが4cm、よこの長さが6cmの長方形があります。面積は何cm²ですか。",
      studentAnswer: "4 + 6 = 10",
      correctAnswer: "4 × 6 = 24",
      mistakeCause: "面積の公式ではなく辺を足している",
      canonicalAnswer: "4 × 6 = 24"
    });
    const scenario = buildFallbackScenario(approved);
    expect(scenario.panels[2].visualAid).toMatchObject({ type: "area_grid", columns: 6, rows: 4, unit: "cm²" });
    const plan = compileMangaPlan({ jobId: "fallback-area", approved, scenario, notes: [], planSource: "fallback" });
    expect(mangaPlanV3Schema.safeParse(plan).success).toBe(true);
  });

  it("辺が20を超える面積問題ではマス目図解を付けない", () => {
    const approved = approvedProblemSchema.parse({
      problemText: "たて30m、よこ50mの畑の面積は何m²ですか。",
      studentAnswer: "80",
      correctAnswer: "30 × 50 = 1500",
      mistakeCause: "辺を足した",
      canonicalAnswer: "30 × 50 = 1500"
    });
    const scenario = buildFallbackScenario(approved);
    expect(scenario.panels[2].visualAid).toBeUndefined();
  });

  it("検証できない答えでは式を含めず、それでも完成する", () => {
    const approved = approvedProblemSchema.parse({
      problemText: "三角形をかきましょう。",
      studentAnswer: "かけなかった",
      correctAnswer: "作図",
      mistakeCause: "定規の使い方"
    });
    const scenario = buildFallbackScenario(approved);
    expect(scenario.panels).toHaveLength(6);
    expect(scenario.solutionSteps[0].expression).toBe("");
    const plan = compileMangaPlan({ jobId: "fallback-2", approved, scenario, notes: [], planSource: "fallback" });
    expect(mangaPlanV3Schema.safeParse(plan).success).toBe(true);
  });
});
