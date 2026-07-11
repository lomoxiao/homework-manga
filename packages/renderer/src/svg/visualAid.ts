import { rendererSpecSchema, type RendererSpec } from "@homework-manga/contracts/mangaPlan";
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
    case "geometry_shape": return geometryShape(spec);
    case "area_grid": return areaGrid(spec);
    case "angle_fan": return angleFan(spec);
    case "photo_clip": return photoClip(spec);
  }
}

function photoClip(s: Extract<RendererSpec, { type: "photo_clip" }>) {
  // dataUri はスキーマで data:image/jpeg;base64, 固定を検証済み。属性値はさらにエスケープする。
  return `<figure class="visual-photo"><img src="${e(s.dataUri)}" alt="${e(s.caption)}"/><figcaption>${e(s.caption)}</figcaption></figure>`;
}
function barModel(s: Extract<RendererSpec, { type: "bar_model" }>) { const cells = Array.from({ length: s.groupCount }, (_, i) => `<rect x="${20 + i * 360 / s.groupCount}" y="25" width="${360 / s.groupCount}" height="48" fill="#e8f4ff" stroke="#334"/><text x="${20 + (i + .5) * 360 / s.groupCount}" y="55" text-anchor="middle">${e(number(s.perGroup))}</text>`).join(""); return `<svg viewBox="0 0 400 100" role="img" aria-label="equal groups">${cells}<text x="200" y="94" text-anchor="middle">${e(number(s.total))}</text></svg>`; }
function fractionBar(s: Extract<RendererSpec, { type: "fraction_bar" }>) { const cells = Array.from({ length: s.denominator }, (_, i) => `<rect x="${20 + i * 360 / s.denominator}" y="25" width="${360 / s.denominator}" height="55" fill="${i < s.numerator ? "#ffd166" : "#fff"}" stroke="#334"/>`).join(""); return `<svg viewBox="0 0 400 105" role="img" aria-label="fraction bar">${cells}<text x="200" y="101" text-anchor="middle">${s.numerator}/${s.denominator}</text></svg>`; }
function numberLine(s: Extract<RendererSpec, { type: "number_line" }>) { const min = numeric(s.min), max = numeric(s.max); const ticks = Array.from({ length: s.tickCount + 1 }, (_, i) => { const x = 30 + 340 * i / s.tickCount; return `<path d="M${x} 42v16"/><text x="${x}" y="78" text-anchor="middle">${e(number({ numerator: s.min.numerator * s.tickCount + i * (s.max.numerator * s.min.denominator - s.min.numerator * s.max.denominator), denominator: s.min.denominator * s.tickCount }))}</text>`; }).join(""); const marks = s.marks.map((m) => { const x = 30 + 340 * (numeric(m.value) - min) / (max - min); return `<circle cx="${x}" cy="50" r="5"/><text x="${x}" y="20" text-anchor="middle">${e(m.label ?? number(m.value))}</text>`; }).join(""); return `<svg viewBox="0 0 400 90" role="img" aria-label="number line"><path d="M30 50H380"/>${ticks}${marks}</svg>`; }
function comparison(s: Extract<RendererSpec, { type: "comparison" }>) { return `<div class="visual-comparison" role="img" aria-label="quantity comparison"><span>${e(s.leftLabel)} ${e(number(s.left))}${e(s.unit)}</span><strong>${e(s.operator)}</strong><span>${e(s.rightLabel)} ${e(number(s.right))}${e(s.unit)}</span></div>`; }

const HIGHLIGHT_STROKE = "#d97706";

function geometryShape(s: Extract<RendererSpec, { type: "geometry_shape" }>) {
  // 図形は 60..340 × 30..120 の枠内に描く。実寸比は width/height があれば反映(極端な比は 3:1 に制限)。
  const box = { x: 60, y: 30, w: 280, h: 90 };
  const ratio = s.width && s.height ? Math.min(3, Math.max(1 / 3, numeric(s.width) / numeric(s.height))) : 1.5;
  const side = (name: "top" | "bottom" | "left" | "right", x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${s.highlightSide === name ? HIGHLIGHT_STROKE : "#334"}" stroke-width="${s.highlightSide === name ? 5 : 3}" fill="none"/>`;
  let body = "";
  if (s.shape === "circle") {
    const r = 45;
    const cx = 200, cy = box.y + box.h / 2;
    body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e8f4ff" stroke="#334" stroke-width="3"/><path d="M${cx} ${cy}H${cx + r}" stroke="${s.highlightSide !== "none" ? HIGHLIGHT_STROKE : "#334"}" stroke-width="3"/>${s.radius ? `<text x="${cx + r / 2}" y="${cy - 8}" text-anchor="middle">${e(number(s.radius))}${e(s.unit)}</text>` : ""}`;
  } else if (s.shape === "triangle" || s.shape === "right_triangle") {
    const w = Math.min(box.w, box.h * ratio), h = w / ratio;
    const x0 = 200 - w / 2, y0 = box.y + (box.h - h) / 2;
    const apex = s.shape === "right_triangle" ? x0 : x0 + w / 2;
    body = `<path d="M${x0} ${y0 + h}L${x0 + w} ${y0 + h}L${apex} ${y0}Z" fill="#e8f4ff" stroke="none"/>` +
      side("bottom", x0, y0 + h, x0 + w, y0 + h) + side("left", x0, y0 + h, apex, y0) + side("right", x0 + w, y0 + h, apex, y0);
  } else {
    const w = s.shape === "square" ? Math.min(box.w, box.h) : Math.min(box.w, box.h * ratio);
    const h = s.shape === "square" ? w : w / ratio;
    const x0 = 200 - w / 2, y0 = box.y + (box.h - h) / 2;
    body = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#e8f4ff" stroke="none"/>` +
      side("top", x0, y0, x0 + w, y0) + side("bottom", x0, y0 + h, x0 + w, y0 + h) + side("left", x0, y0, x0, y0 + h) + side("right", x0 + w, y0, x0 + w, y0 + h);
  }
  const labelPos: Record<string, { x: number; y: number }> = {
    top: { x: 200, y: 20 }, bottom: { x: 200, y: 142 }, left: { x: 34, y: 80 }, right: { x: 366, y: 80 }, center: { x: 200, y: 80 }
  };
  const labels = s.labels.map((label) => `<text x="${labelPos[label.side].x}" y="${labelPos[label.side].y}" text-anchor="middle" fill="${s.highlightSide === label.side ? HIGHLIGHT_STROKE : "#334"}">${e(label.text)}</text>`).join("");
  return `<svg viewBox="0 0 400 150" role="img" aria-label="labeled shape">${body}${labels}</svg>`;
}

function angleFan(s: Extract<RendererSpec, { type: "angle_fan" }>) {
  const cx = 200, cy = 115, r = 80;
  // SVG は y 軸が下向きなので反時計回りの角を負の角度で計算する
  const sweep = Math.min(s.degrees, 359.9);
  const rad = (-sweep * Math.PI) / 180;
  const endX = +(cx + r * Math.cos(rad)).toFixed(2);
  const endY = +(cy + r * Math.sin(rad)).toFixed(2);
  const largeArc = sweep > 180 ? 1 : 0;
  const fan = s.degrees >= 360
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd166" fill-opacity="0.5" stroke="#334" stroke-width="3"/>`
    : `<path d="M${cx} ${cy}L${cx + r} ${cy}A${r} ${r} 0 ${largeArc} 0 ${endX} ${endY}Z" fill="#ffd166" fill-opacity="0.5" stroke="#334" stroke-width="3"/>`;
  return `<svg viewBox="0 0 400 150" role="img" aria-label="angle">${fan}<text x="${cx}" y="142" text-anchor="middle">${e(s.label || `${s.degrees}°`)}</text></svg>`;
}

function areaGrid(s: Extract<RendererSpec, { type: "area_grid" }>) {
  const cell = Math.min(340 / s.columns, 100 / s.rows);
  const w = cell * s.columns, h = cell * s.rows;
  const x0 = 200 - w / 2, y0 = 15 + (100 - h) / 2;
  const highlight = s.highlightCells ?? 0;
  const cells = Array.from({ length: s.rows * s.columns }, (_, i) => {
    const col = i % s.columns, row = Math.floor(i / s.columns);
    return `<rect x="${x0 + col * cell}" y="${y0 + row * cell}" width="${cell}" height="${cell}" fill="${i < highlight ? "#ffd166" : "#e8f4ff"}" stroke="#334"/>`;
  }).join("");
  const total = s.columns * s.rows;
  return `<svg viewBox="0 0 400 150" role="img" aria-label="area grid">${cells}<text x="200" y="142" text-anchor="middle">${s.columns} × ${s.rows} = ${total}${e(s.unit)}</text></svg>`;
}
