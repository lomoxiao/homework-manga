import mangaPlan from "../fixtures/manga_plan.json";
import renderConfig from "../fixtures/final_render_config.json";
import { mangaPlanSchema, renderConfigSchema } from "../src/schema";

describe("sample JSON", () => {
  it("validates the six-panel manga plan", () => {
    const result = mangaPlanSchema.safeParse(mangaPlan);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.panels).toHaveLength(6);
  });

  it("normalizes Firebase-omitted nullable panel fields", () => {
    const firebasePlan = JSON.parse(JSON.stringify(mangaPlan));
    delete firebasePlan.panels[0].narration;
    delete firebasePlan.panels[0].visualAid;

    const result = mangaPlanSchema.safeParse(firebasePlan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.panels[0].narration).toBeNull();
      expect(result.data.panels[0].visualAid).toBeNull();
    }
  });
  it("rejects a plan with fewer than six panels", () => {
    const invalid = { ...mangaPlan, panels: mangaPlan.panels.slice(0, 5) };
    expect(mangaPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates the A4 render configuration", () => {
    expect(renderConfigSchema.safeParse(renderConfig).success).toBe(true);
  });
});
