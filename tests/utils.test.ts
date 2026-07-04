import { emphasize, escapeHtml } from "../src/utils";

describe("HTML output safety", () => {
  it("escapes untrusted dialogue", () => {
    expect(escapeHtml("<script>bad()</script>")).toBe("&lt;script&gt;bad()&lt;/script&gt;");
  });

  it("marks configured learning words", () => {
    expect(emphasize("同じ数ずつ分ける", ["同じ数ずつ"])).toBe("<mark>同じ数ずつ</mark>分ける");
  });
});
