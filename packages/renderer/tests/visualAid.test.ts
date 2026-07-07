import { renderSafeVisualAid, visualAidSpecSchema } from "../src/svg/visualAid";

describe("MangaPlan 2.1 visual renderer", () => {
  it("renders a real table rather than comma-joining arrays", () => { const html = renderSafeVisualAid(visualAidSpecSchema.parse({ type: "table", position: "center", headers: ["x", "y"], rows: [["1", "2"], ["3", "4"]] })); expect(html).toContain("<table"); expect(html).toContain("<td>1</td>"); expect(html).not.toContain("1,2"); });
  it("renders every validated type without unsafe numeric output", () => {
    const specs = [
      { type: "bar_model", position: "center", total: { numerator: 3, denominator: 1 }, groupCount: 2, perGroup: { numerator: 3, denominator: 2 } },
      { type: "fraction_bar", position: "center", numerator: 2, denominator: 3 },
      { type: "number_line", position: "center", min: { numerator: 0, denominator: 1 }, max: { numerator: 1, denominator: 1 }, tickCount: 2, marks: [{ value: { numerator: 1, denominator: 2 }, label: "half" }] },
      { type: "comparison", position: "center", left: { numerator: 1, denominator: 2 }, right: { numerator: 1, denominator: 4 }, leftLabel: "A", rightLabel: "B", unit: "L", operator: ">", ratio: { numerator: 2, denominator: 1 } },
      { type: "geometry_shape", position: "center", shape: "rectangle", width: { numerator: 6, denominator: 1 }, height: { numerator: 4, denominator: 1 }, radius: null, unit: "cm", labels: [{ text: "4cm", side: "left" }, { text: "6cm", side: "bottom" }], highlightSide: "left" },
      { type: "geometry_shape", position: "center", shape: "circle", width: null, height: null, radius: { numerator: 3, denominator: 1 }, unit: "cm", labels: [], highlightSide: "none" },
      { type: "geometry_shape", position: "center", shape: "right_triangle", width: { numerator: 3, denominator: 1 }, height: { numerator: 4, denominator: 1 }, radius: null, unit: "", labels: [], highlightSide: "none" },
      { type: "area_grid", position: "center", columns: 6, rows: 4, unit: "cm²", highlightCells: 10 }
    ] as const;
    for (const input of specs) { const html = renderSafeVisualAid(visualAidSpecSchema.parse(input)); expect(html).not.toMatch(/NaN|Infinity/); }
  });
  it("escapes markup in geometry labels", () => {
    const html = renderSafeVisualAid(visualAidSpecSchema.parse({
      type: "geometry_shape", position: "center", shape: "square",
      width: { numerator: 5, denominator: 1 }, height: { numerator: 5, denominator: 1 }, radius: null,
      unit: "cm", labels: [{ text: "<script>alert(1)</script>", side: "top" }], highlightSide: "none"
    }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("highlights the misread side of the shape", () => {
    const html = renderSafeVisualAid(visualAidSpecSchema.parse({
      type: "geometry_shape", position: "center", shape: "rectangle",
      width: { numerator: 6, denominator: 1 }, height: { numerator: 4, denominator: 1 }, radius: null,
      unit: "cm", labels: [], highlightSide: "left"
    }));
    expect(html).toContain("#d97706");
  });
  it("fills exactly highlightCells cells in the area grid", () => {
    const html = renderSafeVisualAid(visualAidSpecSchema.parse({ type: "area_grid", position: "center", columns: 3, rows: 2, unit: "", highlightCells: 4 }));
    expect(html.match(/#ffd166/g)).toHaveLength(4);
    expect(html).toContain("3 × 2 = 6");
  });
  it("rejects unknown and removed renderers", () => { for (const type of ["area_model", "ratio_diagram", "geometry", "clock", "place_value", "unit_conversion", "bar_chart", "line_chart"]) expect(visualAidSpecSchema.safeParse({ type }).success).toBe(false); });
});
