import type { HomeworkDraft, MangaPlan, MangaPanel } from "./schema";
import rawCatalog from "../public/assets/metadata.json";
import { assetCatalogSchema, selectAsset } from "./assets";

const assetCatalog = assetCatalogSchema.parse(rawCatalog).assets;

type Division = { total: number; groups: number; perGroup: number };

export type ScenarioResult = { plan: MangaPlan; supported: boolean; warning?: string };

export function generateScenario(draft: HomeworkDraft): ScenarioResult {
  const division = parseDivision(draft.correctAnswer);
  const supported = division !== null && /同じ数ずつ|分け/.test(draft.problemText);
  const aid = division ? {
    type: "bar_model" as const,
    total: division.total,
    groups: division.groups,
    perGroup: division.perGroup,
    label: "1人分"
  } : null;
  const correct = draft.correctAnswer;
  const wrong = draft.studentAnswer;
  const panels: MangaPanel[] = [
    panel(1, "問題場面と誤答を確認する", "主人公が宿題の答えを見直す", "hero", "confused",
      `この問題、${wrong}でいいのかな？`, `まず、自分の答えが問題の場面に合うか確かめます。`, null, [wrong], ["問題"]),
    panel(2, "誤った式が表す意味を確認する", "先生が誤った式の意味を問いかける", "teacher", "calm",
      `その式は、問題の「同じ数ずつ分ける」を表しているかな？`, draft.mistakeCause, null, [wrong], ["同じ数ずつ"]),
    panel(3, "具体的な操作で正しい考え方を示す", "具体物を同じ数ずつ配る", "teacher", "smile",
      supported && division ? `${division.total}個を${division.groups}人に、同じ数ずつ配ってみよう。` : "具体物を使って、同じ数ずつ分けてみよう。",
      "どのグループも同じ数になるように分けます。", aid, [], ["同じ数ずつ"]),
    panel(4, "図から数量関係を確認する", "横棒図で全体と1人分を確認する", "hero", "discovery",
      division ? `${division.total}を${division.groups}つに同じように分けると、1つ分は${division.perGroup}だ！` : "図にすると、全部と1つ分の関係が見えるね。",
      null, aid, [], ["1つ分"]),
    panel(5, "正しい式へ変換する", "先生が図と式を結び付ける", "teacher", "smile",
      "同じ数ずつ分ける場面は、割り算で表せるよ。", "図で確かめた関係を式にします。", null, [correct], ["同じ数ずつ", "割り算"]),
    panel(6, "答えと判断の手掛かりを定着させる", "主人公が正しい答えを書く", "hero", "happy",
      `「同じ数ずつ」が合図！ 正しい式は${correct}だね。`, "まちがいは、考え方を見つけるヒントになります。", null, [correct], ["同じ数ずつ"])
  ];

  return {
    plan: {
      schemaVersion: "1.0",
      jobId: `hw-${Date.now()}`,
      title: supported ? "同じ数ずつ分けるには？" : "問題の場面を式にしよう",
      problem: { text: draft.problemText, studentAnswer: wrong, correctAnswer: correct },
      panels
    },
    supported,
    warning: supported ? undefined : "この問題は等分除として判定できなかったため、汎用シナリオを生成しました。"
  };
}

export function parseDivision(formula: string): Division | null {
  const match = formula.match(/(\d+)\s*[÷/]\s*(\d+)\s*=\s*(\d+)/);
  if (!match) return null;
  const [, total, groups, perGroup] = match.map(Number);
  if (!total || !groups || !perGroup || total / groups !== perGroup) return null;
  return { total, groups, perGroup };
}

function panel(
  panelNumber: number,
  learningPurpose: string,
  scene: string,
  character: "hero" | "teacher",
  expression: string,
  dialogue: string,
  narration: string | null,
  visualAid: MangaPanel["visualAid"],
  formula: string[],
  emphasisWords: string[]
): MangaPanel {
  const selectedAsset = selectAsset(assetCatalog, {
    category: "character",
    character,
    emotion: expression,
    action: character === "teacher" ? "pointing" : "thinking",
    storyBeat: panelNumber === 1 ? "question" : panelNumber === 3 ? "guided-discovery" : undefined,
    preferredPosition: panelNumber % 2 ? "left" : "right"
  });
  return {
    panelNumber, learningPurpose, scene, characters: [character],
    characterPose: { [character]: character === "teacher" ? "pointing" : "thinking" },
    characterExpression: { [character]: expression }, background: panelNumber === 5 ? "blackboard" : "classroom",
    props: [], dialogue: [{ speaker: character === "teacher" ? "先生" : "ハル", text: dialogue, tone: panelNumber === 6 ? "discovery" : "normal" }],
    narration, visualAid, formula, emphasisWords,
    layout: { size: visualAid ? "large" : "medium", characterSide: panelNumber % 2 ? "left" : "right", visualAidPosition: "center" },
    assetIds: [selectedAsset?.assetId ?? `dummy-${character}-${expression}`]
  };
}
