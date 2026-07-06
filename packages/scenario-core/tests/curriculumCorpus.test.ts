import { generateScenario } from "../src/scenarioGenerator";
import { defaultDraft } from "@homework-manga/contracts/defaultDraft";

describe("cross-curriculum safety corpus", () => {
  it.each([
    ["小数", "1.5 × 4 = 6"], ["分数", "1/2 + 1/2 = 1"], ["加法", "12 + 8 = 20"], ["減法", "30 - 12 = 18"]
  ])("generates only after verification: %s", (_name, answer) => {
    const result = generateScenario({ ...defaultDraft, correctAnswer: answer, canonicalAnswer: answer, solutionSteps: [{ id: "s1", explanation: "計算する", expression: answer, result: answer }] });
    expect(result.supported).toBe(true); expect(result.plan.panels).toHaveLength(6);
    expect(result.plan.panels.every((panel) => panel.solutionStepId !== undefined)).toBe(true);
  });
  it("does not claim support for unverifiable free text", () => {
    const result = generateScenario({ ...defaultDraft, problemType: "explanation", correctAnswer: "説明", canonicalAnswer: "", solutionSteps: [] });
    expect(result.supported).toBe(false); expect(result.warning).toContain("自動検証");
  });
});
