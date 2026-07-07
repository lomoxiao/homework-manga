import { compileMangaPlan, repairScenario, type RepairedScenario } from "../src/aiScenario";
import { approvedProblemSchema } from "../src/approvedProblem";
import { mangaPlanV3Schema, PANEL_ROLES } from "../src/mangaPlan";

const approved = approvedProblemSchema.parse({
  problemText: "りんごが24個あります。3人で同じ数ずつ分けます。1人分は何個ですか。",
  studentAnswer: "24 - 3 = 21",
  correctAnswer: "24 ÷ 3 = 8",
  mistakeCause: "等分の場面で引き算をしている",
  canonicalAnswer: "24 ÷ 3 = 8"
});

const step = (id: string, expression = "24 ÷ 3 = 8") => ({ id, explanation: "24個を3人で等分する", expression, result: "8個" });
const panel = (role: string, overrides: Record<string, unknown> = {}) => ({
  role, learningPurpose: "確認する", scene: "教室", solutionStepId: "step-1",
  dialogueText: "考えてみよう", narration: null, visualIntent: null, formula: [], emphasisWords: [], ...overrides
});
const validScenario = (overrides: Record<string, unknown> = {}) => ({
  status: "verified", verification: { status: "verified", confidence: 0.9, warnings: [] },
  title: "同じ数ずつ分けるには？", problemClassification: "equal_groups",
  solutionSteps: [step("step-1")], panels: PANEL_ROLES.map((role) => panel(role)), reason: null, ...overrides
});

const notesOf = (result: ReturnType<typeof repairScenario>) => (result.ok ? result.notes : result.notes).map((item) => item.code);

describe("repairScenario: 形式の乱れは機械修復する", () => {
  it("accepts a clean scenario without notes", () => {
    const result = repairScenario(validScenario(), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notes).toEqual([]);
      expect(result.scenario.panels.map((item) => item.role)).toEqual([...PANEL_ROLES]);
    }
  });

  it("pads five panels up to six", () => {
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.slice(0, 5).map((role) => panel(role)) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels).toHaveLength(6);
      expect(notesOf(result)).toContain("PANEL_PADDED");
    }
  });

  it("truncates seven panels down to six", () => {
    const result = repairScenario(validScenario({ panels: [...PANEL_ROLES.map((role) => panel(role)), panel("problem")] }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels).toHaveLength(6);
      expect(notesOf(result)).toContain("PANEL_TRUNCATED");
    }
  });

  it("reassigns unknown and duplicated roles in canonical order", () => {
    const roles = ["problem", "problem", "banana", "solution", "check", "transfer"];
    const result = repairScenario(validScenario({ panels: roles.map((role) => panel(role)) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels.map((item) => item.role)).toEqual([...PANEL_ROLES]);
      expect(notesOf(result)).toContain("ROLE_REORDERED");
    }
  });

  it("fixes unknown solutionStepId references", () => {
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, { solutionStepId: "no-such-step" })) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels.every((item) => item.solutionStepId === "step-1")).toBe(true);
      expect(notesOf(result)).toContain("STEP_REF_FIXED");
    }
  });

  it("synthesizes solution steps and dialogue when missing", () => {
    const result = repairScenario(validScenario({ solutionSteps: [], panels: PANEL_ROLES.map((role) => panel(role, { dialogueText: "" })) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.solutionSteps[0].id).toBe("step-1");
      expect(notesOf(result)).toContain("STEP_SYNTHESIZED");
      expect(notesOf(result)).toContain("DIALOGUE_SYNTHESIZED");
      expect(result.scenario.panels.every((item) => item.dialogueText.length > 0)).toBe(true);
    }
  });

  it("normalizes unreduced rationals inside visual intents", () => {
    const intent = { type: "equal_groups", requirement: "required", total: { numerator: 48, denominator: 2 }, groupCount: 3 };
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, role === "visualization" ? { visualIntent: intent } : {})) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const aid = result.scenario.panels[2].visualAid;
      expect(aid).toMatchObject({ type: "bar_model", total: { numerator: 24, denominator: 1 }, groupCount: 3, perGroup: { numerator: 8, denominator: 1 } });
      expect(notesOf(result)).toContain("RATIONAL_NORMALIZED");
    }
  });

  it("drops broken visual intents instead of failing", () => {
    const intent = { type: "part_whole", numerator: 5, denominator: 2 };
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, { visualIntent: intent })) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels.every((item) => item.visualAid === undefined)).toBe(true);
      expect(notesOf(result)).toContain("VISUAL_DROPPED");
    }
  });

  it("compiles labeled_shape with derived square sides and highlight", () => {
    const intent = {
      type: "labeled_shape", requirement: "optional", shape: "square",
      width: { numerator: 5, denominator: 1 }, height: null, radius: null, shapeUnit: "cm",
      shapeLabels: [{ text: "5cm", side: "bottom" }, { text: "", side: "left" }, { text: "?", side: "diagonal" }],
      highlightSide: "bottom"
    };
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, role === "visualization" ? { visualIntent: intent } : {})) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const aid = result.scenario.panels[2].visualAid;
      expect(aid).toMatchObject({
        type: "geometry_shape", shape: "square",
        width: { numerator: 5, denominator: 1 }, height: { numerator: 5, denominator: 1 },
        labels: [{ text: "5cm", side: "bottom" }], highlightSide: "bottom", unit: "cm"
      });
      expect(notesOf(result)).toContain("VISUAL_DROPPED");
    }
  });

  it("drops labeled_shape without required dimensions", () => {
    const intent = { type: "labeled_shape", shape: "circle", radius: null };
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, role === "visualization" ? { visualIntent: intent } : {})) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels[2].visualAid).toBeUndefined();
      expect(notesOf(result)).toContain("VISUAL_DROPPED");
    }
  });

  it("compiles area_grid and clamps highlightCells to the grid size", () => {
    const intent = { type: "area_grid", gridColumns: 6, gridRows: 4, shapeUnit: "cm²", highlightCells: 99 };
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, role === "visualization" ? { visualIntent: intent } : {})) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels[2].visualAid).toMatchObject({ type: "area_grid", columns: 6, rows: 4, unit: "cm²", highlightCells: 24 });
      expect(notesOf(result)).toContain("RATIONAL_NORMALIZED");
    }
  });

  it("moves non-formula strings out of formula", () => {
    const result = repairScenario(validScenario({ panels: PANEL_ROLES.map((role) => panel(role, { formula: ["24 ÷ 3 = 8", "答えを確かめよう"] })) }), approved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.panels[0].formula).toEqual(["24 ÷ 3 = 8"]);
      expect(result.scenario.panels[0].narration).toContain("答えを確かめよう");
      expect(notesOf(result)).toContain("FORMULA_MOVED");
    }
  });

  it("survives a null-heavy payload", () => {
    const result = repairScenario({ status: null, title: null, solutionSteps: null, panels: [{ role: null, dialogueText: null }], reason: null }, approved);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenario.panels).toHaveLength(6);
  });
});

describe("repairScenario: リトライへ回すのは数学的な誤りと素材ゼロだけ", () => {
  it("rejects mathematically wrong steps when a verifier is supplied", () => {
    const result = repairScenario(validScenario({ solutionSteps: [step("step-1", "24 ÷ 3 = 9")] }), approved, { verifyEquation: (expr) => (expr.includes("9") ? false : true) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retry[0].code).toBe("MATH_INCORRECT");
  });

  it("rejects an empty panel list", () => {
    const result = repairScenario(validScenario({ panels: [] }), approved);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retry[0].code).toBe("NO_PANEL_MATERIAL");
  });
});

describe("compileMangaPlan", () => {
  const scenarioOf = (raw: Record<string, unknown>): { scenario: RepairedScenario; notes: ReturnType<typeof repairScenario> extends infer R ? (R extends { ok: true; notes: infer N } ? N : never) : never } => {
    const result = repairScenario(raw, approved);
    if (!result.ok) throw new Error("expected repair to succeed");
    return { scenario: result.scenario, notes: result.notes as never };
  };

  it("produces a valid strict plan with deterministic presentation", () => {
    const { scenario, notes } = scenarioOf(validScenario());
    const plan = compileMangaPlan({ jobId: "job-1", approved, scenario, notes });
    expect(mangaPlanV3Schema.safeParse(plan).success).toBe(true);
    expect(plan.planSource).toBe("ai");
    expect(plan.panels[0].presentation.casts[0]).toEqual({ character: "hero", expression: "confused", pose: "thinking", side: "left" });
    expect(plan.panels[4].presentation.background).toBe("blackboard");
    expect(plan.panels[1].presentation.casts[0].side).toBe("right");
  });

  it("marks repaired plans as ai_repaired", () => {
    const { scenario, notes } = scenarioOf(validScenario({ panels: PANEL_ROLES.slice(0, 5).map((role) => panel(role)) }));
    const plan = compileMangaPlan({ jobId: "job-2", approved, scenario, notes });
    expect(plan.planSource).toBe("ai_repaired");
    expect(plan.repairNotes.length).toBeGreaterThan(0);
  });
});
