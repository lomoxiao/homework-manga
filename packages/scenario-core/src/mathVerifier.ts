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
