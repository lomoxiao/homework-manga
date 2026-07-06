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
