import mangaPlan from "../samples/manga_plan.json";
import renderConfig from "../samples/final_render_config.json";
import { mangaPlanSchema, renderConfigSchema } from "../src/schema";

describe("sample JSON", () => {
  it("validates the six-panel manga plan", () => {
    const result = mangaPlanSchema.safeParse(mangaPlan);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.panels).toHaveLength(6);
  });

  it("rejects a plan with fewer than six panels", () => {
    const invalid = { ...mangaPlan, panels: mangaPlan.panels.slice(0, 5) };
    expect(mangaPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates the A4 render configuration", () => {
    expect(renderConfigSchema.safeParse(renderConfig).success).toBe(true);
  });
});
