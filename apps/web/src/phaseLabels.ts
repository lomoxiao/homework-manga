import type { HomeworkJobV3 } from "@homework-manga/contracts/homeworkJob";

export type PhaseTone = "progress" | "action" | "ok" | "error";
export type PhaseView = { label: string; detail: string; tone: PhaseTone };

/** 保護者向けの日本語ステータス(英日混在を廃止し、この1箇所に集約)。 */
export function parentPhaseView(job: HomeworkJobV3): PhaseView {
  switch (job.phase) {
    case "captured":
      return { label: "受付済み", detail: "解析の順番を待っています。", tone: "progress" };
    case "analyzing":
      return job.runState === "running"
        ? { label: "解析中", detail: "AIが宿題写真を読み取っています(数分かかります)。", tone: "progress" }
        : { label: "解析待ち", detail: "ワーカーが起動すると自動的に解析が始まります。", tone: "progress" };
    case "awaiting_approval":
      return { label: "確認待ち", detail: "解析結果を確認して、まんがにする問題を承認してください。", tone: "action" };
    case "scripting":
      return job.runState === "running"
        ? { label: "まんが作成中", detail: "解き方の6コマシナリオを作っています(数分かかります)。", tone: "progress" }
        : { label: "まんが作成待ち", detail: "作成の順番を待っています。", tone: "progress" };
    case "ready":
      return { label: "できあがり", detail: "まんが教材が完成しました。", tone: "ok" };
    case "failed":
      return { label: "うまくいきませんでした", detail: job.failure?.messageForParent ?? "「もう一度作る」をお試しください。", tone: "error" };
    case "deleting":
      return { label: "削除中", detail: "写真とデータを削除しています。", tone: "progress" };
  }
}

/** 子ども向けの語彙(P5 ほんだな・待ち演出で使用)。 */
export function kidsPhaseView(job: HomeworkJobV3): string {
  if (job.phase === "ready") return "よめるよ！";
  if (job.phase === "analyzing" || job.phase === "captured") return "先生が しゃしんを よんでいるよ…";
  if (job.phase === "scripting") return "まんがを かいているよ！";
  if (job.phase === "awaiting_approval") return "じゅんびちゅう";
  return "じゅんびちゅう";
}
