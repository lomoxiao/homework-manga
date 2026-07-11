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
      { type: "area_grid", position: "center", columns: 6, rows: 4, unit: "cm²", highlightCells: 10 },
      { type: "angle_fan", position: "center", degrees: 90, label: "90°" },
      { type: "angle_fan", position: "center", degrees: 360, label: "1回転" },
      { type: "angle_fan", position: "center", degrees: 200, label: "" }
    ] as const;
    for (const input of specs) { const html = renderSafeVisualAid(visualAidSpecSchema.parse(input)); expect(html).not.toMatch(/NaN|Infinity/); }
  });
  it("reduces number line tick labels instead of showing unreduced fractions", () => {
    const html = renderSafeVisualAid(visualAidSpecSchema.parse({
      type: "number_line", position: "center",
      min: { numerator: 0, denominator: 1 }, max: { numerator: 1400, denominator: 1 },
      tickCount: 2, marks: []
    }));
    // 0..1400 を2目盛りで割ると 0, 700, 1400。以前は 0/2, 1400/2, 2800/2 と出ていた。
    expect(html).toContain(">0<");
    expect(html).toContain(">700<");
    expect(html).toContain(">1400<");
    expect(html).not.toContain("/2");
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
  it("renders photo_clip as figure with caption", () => {
    const html = renderSafeVisualAid(visualAidSpecSchema.parse({
      type: "photo_clip", position: "center",
      dataUri: "data:image/jpeg;base64,/9j/AAAA", caption: "きみのプリントのここ！"
    }));
    expect(html).toContain('<figure class="visual-photo">');
    expect(html).toContain('src="data:image/jpeg;base64,/9j/AAAA"');
    expect(html).toContain("<figcaption>きみのプリントのここ！</figcaption>");
  });
  it("escapes markup in photo_clip caption", () => {
    const html = renderSafeVisualAid(visualAidSpecSchema.parse({
      type: "photo_clip", position: "center",
      dataUri: "data:image/jpeg;base64,AAAA", caption: '<img onerror="x">'
    }));
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;img");
  });
  it("rejects photo_clip with a non-jpeg data uri", () => {
    expect(visualAidSpecSchema.safeParse({ type: "photo_clip", position: "center", dataUri: "data:image/png;base64,AAAA", caption: "x" }).success).toBe(false);
    expect(visualAidSpecSchema.safeParse({ type: "photo_clip", position: "center", dataUri: "https://example.com/x.jpg", caption: "x" }).success).toBe(false);
  });
});
