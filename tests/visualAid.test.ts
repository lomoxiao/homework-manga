import { renderSafeVisualAid, visualAidSpecSchema } from "../src/svg/visualAid";

describe("MangaPlan 2.1 visual renderer", () => {
  it("renders a real table rather than comma-joining arrays", () => { const html = renderSafeVisualAid(visualAidSpecSchema.parse({ type: "table", position: "center", headers: ["x", "y"], rows: [["1", "2"], ["3", "4"]] })); expect(html).toContain("<table"); expect(html).toContain("<td>1</td>"); expect(html).not.toContain("1,2"); });
  it("renders every validated type without unsafe numeric output", () => {
    const specs = [
      { type: "bar_model", position: "center", total: { numerator: 3, denominator: 1 }, groupCount: 2, perGroup: { numerator: 3, denominator: 2 } },
      { type: "fraction_bar", position: "center", numerator: 2, denominator: 3 },
      { type: "number_line", position: "center", min: { numerator: 0, denominator: 1 }, max: { numerator: 1, denominator: 1 }, tickCount: 2, marks: [{ value: { numerator: 1, denominator: 2 }, label: "half" }] },
      { type: "comparison", position: "center", left: { numerator: 1, denominator: 2 }, right: { numerator: 1, denominator: 4 }, leftLabel: "A", rightLabel: "B", unit: "L", operator: ">", ratio: { numerator: 2, denominator: 1 } }
    ] as const;
    for (const input of specs) { const html = renderSafeVisualAid(visualAidSpecSchema.parse(input)); expect(html).not.toMatch(/NaN|Infinity/); }
  });
  it("rejects unknown and removed renderers", () => { for (const type of ["area_model", "ratio_diagram", "geometry", "clock", "place_value", "unit_conversion", "bar_chart", "line_chart"]) expect(visualAidSpecSchema.safeParse({ type }).success).toBe(false); });
});
