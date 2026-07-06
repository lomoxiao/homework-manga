import type { HomeworkDraft, Verification } from "@homework-manga/contracts/schema";
type Rational = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
function rational(n: bigint, d = 1n): Rational { if (d === 0n) throw new Error("zero denominator"); const g = gcd(n, d); const sign = d < 0n ? -1n : 1n; return { n: n / g * sign, d: d / g * sign }; }
function parseNumber(raw: string): Rational | null {
  const s = raw.trim().replace(/,/g, ""); const fraction = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fraction) return rational(BigInt(fraction[1]), BigInt(fraction[2]));
  const decimal = s.match(/^(-?)(\d+)(?:\.(\d+))?$/); if (!decimal) return null;
  const digits = decimal[3] ?? ""; return rational(BigInt(`${decimal[1]}${decimal[2]}${digits}`), 10n ** BigInt(digits.length));
}
const eq = (a: Rational, b: Rational) => a.n * b.d === b.n * a.d;
function calculate(a: Rational, op: string, b: Rational): Rational | null {
  if (op === "+") return rational(a.n * b.d + b.n * a.d, a.d * b.d);
  if (op === "-") return rational(a.n * b.d - b.n * a.d, a.d * b.d);
  if (op === "×" || op === "*") return rational(a.n * b.n, a.d * b.d);
  if ((op === "÷" || op === "/") && b.n !== 0n) return rational(a.n * b.d, a.d * b.n);
  return null;
}
export function verifyEquation(input: string): boolean | null {
  const m = input.replace(/＝/g, "=").replace(/−/g, "-").match(/(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*([+\-×*÷/])\s*(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*=\s*(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)/);
  if (!m) return null; const [a, b, answer] = [parseNumber(m[1]), parseNumber(m[3]), parseNumber(m[4])];
  if (!a || !b || !answer) return null; const actual = calculate(a, m[2], b); return actual ? eq(actual, answer) : false;
}
export function verifyDraft(draft: HomeworkDraft): Verification {
  const equation = verifyEquation(draft.canonicalAnswer || draft.correctAnswer);
  if (equation === true) return { method: "rational_arithmetic", status: "verified", confidence: 0.99, warnings: [] };
  if (equation === false) return { method: "rational_arithmetic", status: "needs_review", confidence: 0, warnings: ["正答候補の式が成立しません。"] };
  if (draft.problemType === "construction" || draft.problemType === "explanation") return { method: "manual", status: "unsupported", confidence: 0, warnings: ["作図・自由記述は自動検証できません。"] };
  if (draft.solutionSteps.length > 0) {
    const invalid = draft.solutionSteps.some((step) => step.expression && verifyEquation(step.expression) === false);
    return invalid ? { method: "substitution", status: "needs_review", confidence: 0, warnings: ["解法の途中式に不整合があります。"] }
      : { method: "substitution", status: "verified", confidence: 0.85, warnings: ["構造化された解法を検証しました。最終確認を行ってください。"] };
  }
  return { method: "manual", status: "unsupported", confidence: 0, warnings: ["決定論的に検証できる式または解法情報が不足しています。"] };
}
