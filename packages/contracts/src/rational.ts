import { z } from "zod";

export type Rational = { numerator: number; denominator: number };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** 分母を正、既約分数へ「直す」。検証で落とすのではなく常に正規化する。 */
export function normalizeRational(numerator: number, denominator: number): Rational {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) throw new Error(`invalid rational: ${numerator}/${denominator}`);
  const sign = denominator < 0 ? -1 : 1;
  const g = gcd(numerator, denominator) || 1;
  return { numerator: (sign * numerator) / g, denominator: (sign * denominator) / g };
}

export function divideRational(a: Rational, b: Rational): Rational {
  if (b.numerator === 0) throw new Error("division by zero rational");
  return normalizeRational(a.numerator * b.denominator, a.denominator * b.numerator);
}

export function compareRational(a: Rational, b: Rational): -1 | 0 | 1 {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function rationalToNumber(value: Rational): number {
  return value.numerator / value.denominator;
}

/** parse すると必ず既約・分母正へ正規化される Rational スキーマ。 */
export const rationalSchema = z
  .object({ numerator: z.coerce.number().int(), denominator: z.coerce.number().int() })
  .transform((value, ctx) => {
    if (value.denominator === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "denominator must not be 0" });
      return z.NEVER;
    }
    return normalizeRational(value.numerator, value.denominator);
  });

/** 整数 or Rational 風オブジェクトを Rational へ寄せる(AI出力の受け口用)。 */
export function coerceRational(value: unknown): Rational | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return { numerator: value, denominator: 1 };
    const scaled = Math.round(value * 100);
    return normalizeRational(scaled, 100);
  }
  const parsed = rationalSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
