import { generateScenario, parseDivision } from "../src/scenarioGenerator";
import { defaultDraft } from "@homework-manga/contracts/defaultDraft";

describe("division scenario generator", () => {
  it("parses an exact division formula", () => {
    expect(parseDivision("24 ÷ 3 = 8")).toEqual({ total: 24, groups: 3, perGroup: 8 });
    expect(parseDivision("24 / 3 = 8")).toEqual({ total: 24, groups: 3, perGroup: 8 });
  });

  it("rejects inconsistent or unsupported formulas", () => {
    expect(parseDivision("24 ÷ 3 = 9")).toBeNull();
    expect(parseDivision("24 - 3 = 21")).toBeNull();
  });

  it("creates six instructional panels and a correct bar model", () => {
    const result = generateScenario(defaultDraft);
    expect(result.supported).toBe(true);
    expect(result.plan.panels).toHaveLength(6);
    expect(result.plan.panels.map((panel) => panel.panelNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.plan.panels[2].visualAid).toMatchObject({ total: 24, groups: 3, perGroup: 8 });
    expect(result.plan.panels[5].formula).toContain("24 ÷ 3 = 8");
  });

  it("supports verified subtraction problems", () => {
    const result = generateScenario({ ...defaultDraft, problemText: "りんごを3個食べました。", correctAnswer: "24 - 3 = 21" });
    expect(result.supported).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.plan.panels).toHaveLength(6);
  });
});
