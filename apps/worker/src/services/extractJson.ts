import { jsonrepair } from "jsonrepair";

/**
 * Codex 出力テキストから JSON オブジェクトを取り出す。
 * フェンス除去 → 先頭 { から末尾 } までの抽出 → JSON.parse。
 * 失敗時は jsonrepair で末尾欠け・引用符崩れを補修してから再パースする。
 */
export function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("JSON object not found in output");
  const end = cleaned.lastIndexOf("}");
  const candidate = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(jsonrepair(end > start ? cleaned.slice(start) : candidate));
  }
}
