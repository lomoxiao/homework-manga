import { z } from "zod";
import { escapeHtml } from "../utils";

export const visualAidSpecSchema = z.object({
  type: z.enum(["bar_model", "number_line", "fraction_bar", "ratio_diagram", "area_model", "clock", "table", "comparison", "unit_conversion"]),
  position: z.enum(["left", "center", "right", "bottom"]),
  labels: z.record(z.string()),
  highlight: z.object({ target: z.string(), colorRole: z.enum(["question", "answer", "warning"]) }).optional(),
  data: z.record(z.union([z.number(), z.string(), z.boolean()]))
});

export type VisualAidSpec = z.infer<typeof visualAidSpecSchema>;

export function renderSafeVisualAid(spec: VisualAidSpec): string {
  const parsed = visualAidSpecSchema.parse(spec);
  if (parsed.type === "number_line") return renderNumberLine(parsed);
  if (parsed.type === "comparison") return renderComparison(parsed);
  return `<div class="unsupported-visual" role="note">${escapeHtml(parsed.type)} は現在プレビュー非対応です。汎用表で確認してください。</div>`;
}

function renderNumberLine(spec: VisualAidSpec) {
  const min = Number(spec.data.min ?? 0);
  const max = Number(spec.data.max ?? 10);
  const ticks = Math.max(1, Math.min(20, Number(spec.data.ticks ?? 10)));
  const marks = Array.from({ length: ticks + 1 }, (_, index) => {
    const x = 30 + (340 * index / ticks);
    const value = min + ((max - min) * index / ticks);
    return `<path d="M${x} 42v16"/><text x="${x}" y="78" text-anchor="middle">${escapeHtml(String(value))}</text>`;
  }).join("");
  return `<svg viewBox="0 0 400 90" role="img" aria-label="数直線"><path d="M30 50H380"/>${marks}</svg>`;
}

function renderComparison(spec: VisualAidSpec) {
  const left = escapeHtml(String(spec.data.left ?? ""));
  const right = escapeHtml(String(spec.data.right ?? ""));
  const sign = escapeHtml(String(spec.data.sign ?? "?"));
  return `<svg viewBox="0 0 400 100" role="img" aria-label="比較図"><text x="90" y="62" text-anchor="middle">${left}</text><text x="200" y="62" text-anchor="middle" class="comparison-sign">${sign}</text><text x="310" y="62" text-anchor="middle">${right}</text></svg>`;
}
