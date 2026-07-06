import fc from "fast-check";
import { compareRational, divideRational, normalizeRational, rationalSchema, coerceRational } from "../src/rational";

describe("normalizeRational", () => {
  it("reduces to lowest terms with a positive denominator", () => {
    expect(normalizeRational(2, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(normalizeRational(-2, -4)).toEqual({ numerator: 1, denominator: 2 });
    expect(normalizeRational(1, -2)).toEqual({ numerator: -1, denominator: 2 });
    expect(normalizeRational(0, 5)).toEqual({ numerator: 0, denominator: 1 });
  });

  it("throws on a zero denominator", () => {
    expect(() => normalizeRational(1, 0)).toThrow();
  });

  it("is idempotent for any integer pair", () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }).filter((value) => value !== 0),
      (numerator, denominator) => {
        const once = normalizeRational(numerator, denominator);
        expect(normalizeRational(once.numerator, once.denominator)).toEqual(once);
        expect(once.denominator).toBeGreaterThan(0);
      }
    ));
  });
});

describe("rationalSchema", () => {
  it("normalizes on parse instead of rejecting", () => {
    expect(rationalSchema.parse({ numerator: 2, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
    expect(rationalSchema.parse({ numerator: "3", denominator: "6" })).toEqual({ numerator: 1, denominator: 2 });
  });

  it("rejects a zero denominator", () => {
    expect(rationalSchema.safeParse({ numerator: 1, denominator: 0 }).success).toBe(false);
  });
});

describe("rational arithmetic", () => {
  it("divides exactly", () => {
    expect(divideRational({ numerator: 24, denominator: 1 }, { numerator: 3, denominator: 1 })).toEqual({ numerator: 8, denominator: 1 });
    expect(divideRational({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 2, denominator: 1 });
  });

  it("compares across denominators", () => {
    expect(compareRational({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 })).toBe(0);
    expect(compareRational({ numerator: 1, denominator: 3 }, { numerator: 1, denominator: 2 })).toBe(-1);
  });

  it("coerces integers and rational-like objects", () => {
    expect(coerceRational(8)).toEqual({ numerator: 8, denominator: 1 });
    expect(coerceRational(0.5)).toEqual({ numerator: 1, denominator: 2 });
    expect(coerceRational({ numerator: 4, denominator: 8 })).toEqual({ numerator: 1, denominator: 2 });
    expect(coerceRational("abc")).toBeNull();
    expect(coerceRational({ numerator: 1, denominator: 0 })).toBeNull();
  });
});
