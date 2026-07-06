import fc from "fast-check";
import { z } from "zod";
import { packEnvelope, unpackEnvelope } from "../src/firebaseCodec";
import { MANGA_PLAN_VERSION, mangaPlanV3Schema } from "../src/mangaPlan";
import { compileMangaPlan, repairScenario } from "../src/aiScenario";
import { approvedProblemSchema } from "../src/approvedProblem";
import { PANEL_ROLES } from "../src/mangaPlan";

const now = () => "2026-01-01T00:00:00.000Z";

describe("envelope roundtrip", () => {
  // 空配列・undefined・日本語・絵文字・境界長を重点的に生成し、pack→unpack の完全対称性を確認する
  const text = (max: number) => fc.oneof(
    fc.string({ minLength: 1, maxLength: max }),
    fc.constantFrom("りんごが24個🍎", "１/２ と ½", "改行\nタブ\tと \"引用\"", "　全角空白　", "é (結合文字)")
  ).map((value) => value.slice(0, max).trim() || "x");

  const scenarioArbitrary = fc.record({
    title: text(200),
    dialogue: fc.array(text(400), { minLength: 6, maxLength: 6 }),
    narration: fc.option(text(400), { nil: undefined }),
    emphasis: fc.array(text(40), { maxLength: 5 }),
    formulaCount: fc.integer({ min: 0, max: 3 })
  });

  it("unpack(pack(plan)) === plan for generated plans", () => {
    const approved = approvedProblemSchema.parse({
      problemText: "りんごが24個あります。3人で同じ数ずつ分けます。",
      studentAnswer: "24 - 3 = 21",
      correctAnswer: "24 ÷ 3 = 8",
      mistakeCause: "等分と減法の混同"
    });
    fc.assert(fc.property(scenarioArbitrary, (input) => {
      const repair = repairScenario({
        status: "verified",
        title: input.title,
        problemClassification: "equal_groups",
        solutionSteps: [{ id: "step-1", explanation: "等分する", expression: "24 ÷ 3 = 8", result: "8" }],
        panels: PANEL_ROLES.map((role, index) => ({
          role,
          learningPurpose: "ねらい",
          scene: "教室",
          solutionStepId: "step-1",
          dialogueText: input.dialogue[index],
          narration: input.narration ?? null,
          visualIntent: null,
          formula: Array.from({ length: input.formulaCount }, () => "24 ÷ 3 = 8"),
          emphasisWords: input.emphasis
        }))
      }, approved);
      expect(repair.ok).toBe(true);
      if (!repair.ok) return;
      const plan = compileMangaPlan({ jobId: "job-roundtrip", approved, scenario: repair.scenario, notes: repair.notes });
      const envelope = packEnvelope(mangaPlanV3Schema, MANGA_PLAN_VERSION, plan, now);
      const unpacked = unpackEnvelope(mangaPlanV3Schema, MANGA_PLAN_VERSION, envelope);
      expect(unpacked).toEqual({ ok: true, value: plan });
    }), { numRuns: 50 });
  });

  it("fails closed on unknown versions", () => {
    const envelope = { v: "9.9", json: JSON.stringify({}), savedAt: now() };
    const result = unpackEnvelope(mangaPlanV3Schema, MANGA_PLAN_VERSION, envelope);
    expect(result).toEqual({ ok: false, error: { code: "UNSUPPORTED_VERSION", version: "9.9" } });
  });

  it("reports broken JSON and invalid envelopes distinctly", () => {
    const broken = unpackEnvelope(z.object({}), "1.0", { v: "1.0", json: "{oops", savedAt: now() });
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error.code).toBe("JSON_PARSE_FAILED");
    const invalid = unpackEnvelope(z.object({}), "1.0", { nope: true });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe("ENVELOPE_INVALID");
  });

  it("keeps empty arrays intact (the original Firebase failure mode)", () => {
    const schema = z.object({ warnings: z.array(z.string()), narrationless: z.string().optional() }).strict();
    const value = { warnings: [] };
    const unpacked = unpackEnvelope(schema, "1.0", packEnvelope(schema, "1.0", value, now));
    expect(unpacked).toEqual({ ok: true, value: { warnings: [] } });
  });
});
