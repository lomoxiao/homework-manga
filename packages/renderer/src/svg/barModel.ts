import type { BarModelData } from "@homework-manga/contracts/schema";
import { escapeHtml } from "../utils";

export function renderBarModel(data: BarModelData): string {
  const width = 440;
  const height = 154;
  const barX = 30;
  const barY = 48;
  const barWidth = 380;
  const barHeight = 48;
  const segmentWidth = barWidth / data.groups;
  const segments = Array.from({ length: data.groups }, (_, index) => {
    const x = barX + segmentWidth * index;
    return `<g class="bar-segment">
      <rect x="${x}" y="${barY}" width="${segmentWidth}" height="${barHeight}" rx="4" />
      <text x="${x + segmentWidth / 2}" y="${barY + 30}" text-anchor="middle">${escapeHtml(String(data.perGroup))}個</text>
    </g>`;
  }).join("");

  return `<svg class="bar-model" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(data.total + "個を" + data.groups + "等分し、1人分は" + data.perGroup + "個")}">
    <text class="bar-title" x="220" y="25" text-anchor="middle">全部で ${escapeHtml(String(data.total))}個</text>
    ${segments}
    <path class="brace" d="M30 111 v8 h380 v-8" fill="none" />
    <text class="bar-answer" x="220" y="143" text-anchor="middle">${escapeHtml(data.label)}：${escapeHtml(String(data.perGroup))}個</text>
  </svg>`;
}
