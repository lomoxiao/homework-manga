import { rendererSpecSchema, type RendererSpec } from "../mangaPlan21";
import { escapeHtml } from "../utils";

export const visualAidSpecSchema = rendererSpecSchema;
const e = (value: unknown) => escapeHtml(String(value ?? ""));
const number = (v: { numerator: number; denominator: number }) => v.denominator === 1 ? String(v.numerator) : `${v.numerator}/${v.denominator}`;
const numeric = (v: { numerator: number; denominator: number }) => v.numerator / v.denominator;

export function renderSafeVisualAid(spec: RendererSpec): string {
  switch (spec.type) {
    case "table": return `<table class="visual-table"><thead><tr>${spec.headers.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${spec.rows.map((row) => `<tr>${row.map((cell) => `<td>${e(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "bar_model": return barModel(spec);
    case "fraction_bar": return fractionBar(spec);
    case "number_line": return numberLine(spec);
    case "comparison": return comparison(spec);
  }
}
function barModel(s: Extract<RendererSpec, { type: "bar_model" }>) { const cells = Array.from({ length: s.groupCount }, (_, i) => `<rect x="${20 + i * 360 / s.groupCount}" y="25" width="${360 / s.groupCount}" height="48" fill="#e8f4ff" stroke="#334"/><text x="${20 + (i + .5) * 360 / s.groupCount}" y="55" text-anchor="middle">${e(number(s.perGroup))}</text>`).join(""); return `<svg viewBox="0 0 400 100" role="img" aria-label="equal groups">${cells}<text x="200" y="94" text-anchor="middle">${e(number(s.total))}</text></svg>`; }
function fractionBar(s: Extract<RendererSpec, { type: "fraction_bar" }>) { const cells = Array.from({ length: s.denominator }, (_, i) => `<rect x="${20 + i * 360 / s.denominator}" y="25" width="${360 / s.denominator}" height="55" fill="${i < s.numerator ? "#ffd166" : "#fff"}" stroke="#334"/>`).join(""); return `<svg viewBox="0 0 400 105" role="img" aria-label="fraction bar">${cells}<text x="200" y="101" text-anchor="middle">${s.numerator}/${s.denominator}</text></svg>`; }
function numberLine(s: Extract<RendererSpec, { type: "number_line" }>) { const min = numeric(s.min), max = numeric(s.max); const ticks = Array.from({ length: s.tickCount + 1 }, (_, i) => { const x = 30 + 340 * i / s.tickCount; return `<path d="M${x} 42v16"/><text x="${x}" y="78" text-anchor="middle">${e(number({ numerator: s.min.numerator * s.tickCount + i * (s.max.numerator * s.min.denominator - s.min.numerator * s.max.denominator), denominator: s.min.denominator * s.tickCount }))}</text>`; }).join(""); const marks = s.marks.map((m) => { const x = 30 + 340 * (numeric(m.value) - min) / (max - min); return `<circle cx="${x}" cy="50" r="5"/><text x="${x}" y="20" text-anchor="middle">${e(m.label ?? number(m.value))}</text>`; }).join(""); return `<svg viewBox="0 0 400 90" role="img" aria-label="number line"><path d="M30 50H380"/>${ticks}${marks}</svg>`; }
function comparison(s: Extract<RendererSpec, { type: "comparison" }>) { return `<div class="visual-comparison" role="img" aria-label="quantity comparison"><span>${e(s.leftLabel)} ${e(number(s.left))}${e(s.unit)}</span><strong>${e(s.operator)}</strong><span>${e(s.rightLabel)} ${e(number(s.right))}${e(s.unit)}</span></div>`; }
