import { renderSafeVisualAid, visualAidSpecSchema } from "../src/svg/visualAid";

describe("safe visual aid renderer", () => {
  it("renders a deterministic number line", () => {
    const spec = visualAidSpecSchema.parse({ type: "number_line", position: "center", labels: {}, data: { min: 0, max: 10, ticks: 5 } });
    const svg = renderSafeVisualAid(spec);
    expect(svg).toContain("aria-label=\"数直線\"");
    expect(svg.match(/<text/g)).toHaveLength(6);
  });

  it("does not execute unsupported raw SVG", () => {
    const spec = visualAidSpecSchema.parse({ type: "clock", position: "center", labels: {}, data: { hour: 3 } });
    expect(renderSafeVisualAid(spec)).toContain("プレビュー非対応");
  });
});
