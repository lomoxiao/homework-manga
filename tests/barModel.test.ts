import { renderBarModel } from "../src/svg/barModel";

describe("renderBarModel", () => {
  const svg = renderBarModel({
    type: "bar_model",
    total: 24,
    groups: 3,
    perGroup: 8,
    label: "1人分"
  });

  it("renders 24 split into three equal segments", () => {
    expect(svg.match(/class="bar-segment"/g)).toHaveLength(3);
    expect(svg).toContain("全部で 24個");
    expect(svg.match(/8個/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("contains an accessible explanation and the per-person answer", () => {
    expect(svg).toContain("24個を3等分し、1人分は8個");
    expect(svg).toContain("1人分：8個");
  });
});
