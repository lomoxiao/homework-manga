import { visualAidSchema, type VisualAid } from "../schema";
import { escapeHtml } from "../utils";
import { renderBarModel } from "./barModel";

export const visualAidSpecSchema = visualAidSchema;
const e = (value: unknown) => escapeHtml(String(value ?? ""));
export function renderSafeVisualAid(spec: VisualAid): string {
  if (spec.type === "bar_model") return renderBarModel(spec);
  const d = spec.data;
  if (spec.type === "number_line") return numberLine(d);
  if (spec.type === "place_value") return tableSvg("位取り表", d);
  if (spec.type === "fraction_bar" || spec.type === "area_model") return fractionArea(spec.type, d);
  if (spec.type === "ratio_diagram") return ratio(d);
  if (spec.type === "geometry") return geometry(d);
  if (spec.type === "clock") return clock(d);
  if (spec.type === "unit_conversion" || spec.type === "table") return tableSvg(spec.type === "table" ? "表" : "単位換算", d);
  if (spec.type === "bar_chart" || spec.type === "line_chart") return chart(spec.type, d);
  if (spec.type === "comparison") return comparison(d);
  return `<div class="unsupported-visual" role="note">${e((spec as { type: string }).type)} はプレビュー非対応です。</div>`;
}
function numberLine(d: Record<string, unknown>) { const min=Number(d.min??0), max=Number(d.max??10), ticks=Math.max(1,Math.min(20,Number(d.ticks??10))); const marks=Array.from({length:ticks+1},(_,i)=>{const x=30+340*i/ticks;return `<path d="M${x} 42v16"/><text x="${x}" y="78" text-anchor="middle">${e(min+(max-min)*i/ticks)}</text>`}).join(""); return `<svg viewBox="0 0 400 90" role="img" aria-label="数直線"><path d="M30 50H380"/>${marks}</svg>`; }
function comparison(d: Record<string, unknown>) { return `<svg viewBox="0 0 400 100" role="img" aria-label="比較図"><text x="90" y="62" text-anchor="middle">${e(d.left)}</text><text x="200" y="62" text-anchor="middle">${e(d.sign??"?")}</text><text x="310" y="62" text-anchor="middle">${e(d.right)}</text></svg>`; }
function fractionArea(type:string,d:Record<string,unknown>){const parts=Math.max(1,Math.min(20,Number(d.denominator??d.parts??4))),filled=Math.max(0,Math.min(parts,Number(d.numerator??d.filled??1)));const cells=Array.from({length:parts},(_,i)=>`<rect x="${20+i*360/parts}" y="28" width="${360/parts}" height="58" fill="${i<filled?'#ffd166':'#fff'}" stroke="#334"/>`).join("");return `<svg viewBox="0 0 400 110" role="img" aria-label="${e(type)}">${cells}<text x="200" y="105" text-anchor="middle">${filled}/${parts}</text></svg>`}
function ratio(d:Record<string,unknown>){return `<svg viewBox="0 0 400 110" role="img" aria-label="割合図"><rect x="30" y="25" width="340" height="50" fill="#e8f4ff" stroke="#334"/><rect x="30" y="25" width="${340*Math.max(0,Math.min(1,Number(d.ratio??0.5)))}" height="50" fill="#ffd166"/><text x="200" y="103" text-anchor="middle">${e(d.label??d.ratio)}</text></svg>`}
function geometry(d:Record<string,unknown>){const shape=String(d.shape??"rectangle");const body=shape==="circle"?'<circle cx="200" cy="55" r="38"/>':shape==="triangle"?'<path d="M200 15L80 95H320Z"/>':'<rect x="80" y="20" width="240" height="75"/>';return `<svg viewBox="0 0 400 115" role="img" aria-label="図形"><g fill="#e8f4ff" stroke="#334">${body}</g><text x="200" y="110" text-anchor="middle">${e(d.label??shape)}</text></svg>`}
function clock(d:Record<string,unknown>){const h=Number(d.hour??0)%12,m=Number(d.minute??0)%60,ha=(h+m/60)*30,ma=m*6;return `<svg viewBox="0 0 140 140" role="img" aria-label="時計"><circle cx="70" cy="70" r="58" fill="#fff" stroke="#334"/><path d="M70 70l${35*Math.sin(ha*Math.PI/180)} ${-35*Math.cos(ha*Math.PI/180)}M70 70l${48*Math.sin(ma*Math.PI/180)} ${-48*Math.cos(ma*Math.PI/180)}" stroke="#334" stroke-width="4"/></svg>`}
function tableSvg(label:string,d:Record<string,unknown>){return `<div class="visual-table" role="img" aria-label="${e(label)}"><strong>${e(label)}</strong>${Object.entries(d).map(([k,v])=>`<span>${e(k)}：${e(v)}</span>`).join("")}</div>`}
function chart(type:string,d:Record<string,unknown>){const values=String(d.values??"").split(",").map(Number).filter(Number.isFinite);if(!values.length)return tableSvg("グラフ",d);const max=Math.max(...values,1);const points=values.map((v,i)=>`${30+i*330/Math.max(1,values.length-1)},${95-v/max*70}`).join(" ");const bars=values.map((v,i)=>`<rect x="${25+i*350/values.length}" y="${95-v/max*70}" width="${300/values.length}" height="${v/max*70}"/>`).join("");return `<svg viewBox="0 0 400 110" role="img" aria-label="グラフ"><g fill="#80bfff" stroke="#334">${type==='line_chart'?`<polyline points="${points}" fill="none" stroke-width="3"/>`:bars}</g></svg>`}
