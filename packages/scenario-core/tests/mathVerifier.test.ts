import { verifyEquation } from "../src/mathVerifier";

describe("deterministic math verification", () => {
  it.each(["12 + 8 = 20", "30 - 12 = 18", "1.5 × 4 = 6", "24 ÷ 3 = 8", "1/2 + 1/2 = 1"])("verifies exact rational arithmetic: %s", (formula) => {
    expect(verifyEquation(formula)).toBe(true);
  });
  it("rejects an inconsistent answer", () => expect(verifyEquation("24 ÷ 3 = 9")).toBe(false));
  it("returns null for non-equation input", () => expect(verifyEquation("作図")).toBeNull());
});
