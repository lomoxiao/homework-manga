import { z } from "zod";
import { coerceRational, compareRational, divideRational, type Rational } from "./rational";
import {
  MANGA_PLAN_VERSION, PANEL_ROLES, mangaPlanV3Schema, repairNoteSchema,
  type MangaPlanV3, type PanelRole, type RendererSpec, type RepairNote, type SolutionStep
} from "./mangaPlan";
import type { ApprovedProblem } from "./approvedProblem";

/* ------------------------------------------------------------------ */
/* 寛容スキーマ: AI出力は必ず壊れる前提。1フィールドの破損で全体を落とさない。 */
/* ------------------------------------------------------------------ */

/** undefined/null を空文字へ寄せる寛容文字列(coerce だと "undefined" になるため)。 */
const looseString = z.preprocess((value) => (value === null || value === undefined ? "" : value), z.coerce.string()).catch("");
const looseStringArray = z.array(looseString).catch([]);

const looseStepSchema = z.object({
  id: looseString,
  explanation: looseString,
  expression: looseString,
  result: looseString
}).passthrough();

const loosePanelSchema = z.object({
  role: looseString,
  learningPurpose: looseString,
  scene: looseString,
  solutionStepId: looseString,
  dialogueText: looseString,
  narration: z.coerce.string().nullish().catch(null),
  visualIntent: z.record(z.unknown()).nullish().catch(null),
  formula: looseStringArray,
  emphasisWords: looseStringArray
}).passthrough();

export const aiScenarioLooseSchema = z.object({
  status: z.enum(["verified", "needs_review", "unsupported"]).catch("needs_review"),
  verification: z.object({
    status: z.enum(["verified", "needs_review", "unsupported"]).catch("needs_review"),
    confidence: z.coerce.number().min(0).max(1).catch(0),
    warnings: looseStringArray
  }).catch({ status: "needs_review", confidence: 0, warnings: [] }),
  title: z.coerce.string().nullish().catch(null),
  problemClassification: z.coerce.string().nullish().catch(null),
  solutionSteps: z.array(looseStepSchema).catch([]),
  panels: z.array(loosePanelSchema).catch([]),
  reason: z.coerce.string().nullish().catch(null)
}).passthrough();
export type AiScenarioLoose = z.infer<typeof aiScenarioLooseSchema>;

/* ------------------------------------------------------------------ */
/* 修復層: 形式の乱れは機械修復し RepairNote に記録。数学的な誤りだけをリトライへ回す。 */
/* ------------------------------------------------------------------ */

export type RepairedPanel = {
  role: PanelRole;
  learningPurpose: string;
  scene: string;
  solutionStepId: string;
  dialogueText: string;
  narration?: string;
  visualAid?: RendererSpec;
  formula: string[];
  emphasisWords: string[];
};

export type RepairedScenario = {
  title: string;
  problemClassification: string;
  solutionSteps: SolutionStep[];
  panels: RepairedPanel[];
};

export type RetryReason = { code: "MATH_INCORRECT" | "NO_PANEL_MATERIAL" | "OUTPUT_UNPARSEABLE"; detail: string };
export type EquationVerifier = (expression: string) => boolean | null;
export type ScenarioRepairResult =
  | { ok: true; scenario: RepairedScenario; notes: RepairNote[] }
  | { ok: false; retry: RetryReason[]; notes: RepairNote[] };

const note = (code: RepairNote["code"], detail: string, panelIndex?: number): RepairNote =>
  repairNoteSchema.parse(panelIndex === undefined ? { code, detail: detail.slice(0, 500) } : { code, detail: detail.slice(0, 500), panelIndex });

const clip = (value: string, max: number, notes: RepairNote[], field: string, panelIndex?: number): string => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  notes.push(note("FIELD_TRUNCATED", `${field} を ${max} 文字に切り詰めました`, panelIndex));
  return trimmed.slice(0, max);
};

const FORMULA_PATTERN = /^[0-9０-９+\-−×÷*/=＝().,、:：%\s]+$/u;

export function repairScenario(raw: unknown, approved: ApprovedProblem, options: { verifyEquation?: EquationVerifier } = {}): ScenarioRepairResult {
  const notes: RepairNote[] = [];
  const loose = aiScenarioLooseSchema.safeParse(raw);
  if (!loose.success) return { ok: false, retry: [{ code: "OUTPUT_UNPARSEABLE", detail: loose.error.issues[0]?.message ?? "unparseable" }], notes };
  const data = loose.data;
  if (data.panels.length === 0) return { ok: false, retry: [{ code: "NO_PANEL_MATERIAL", detail: "panels が空です" }], notes };

  // --- solutionSteps: 空なら承認済み情報から合成、ID重複・欠落は採番して直す ---
  const steps: SolutionStep[] = [];
  const seenIds = new Set<string>();
  for (const [index, step] of data.solutionSteps.entries()) {
    const explanation = step.explanation.trim();
    if (!explanation) continue;
    let id = step.id.trim() || `step-${index + 1}`;
    if (seenIds.has(id)) {
      const renumbered = `step-${index + 1}-${seenIds.size}`;
      notes.push(note("STEP_REF_FIXED", `重複した step id "${id}" を "${renumbered}" に採番し直しました`));
      id = renumbered;
    }
    seenIds.add(id);
    steps.push({
      id: id.slice(0, 100),
      explanation: clip(explanation, 500, notes, "solutionSteps.explanation"),
      expression: step.expression.trim().slice(0, 100),
      result: step.result.trim().slice(0, 200)
    });
  }
  if (steps.length === 0) {
    steps.push({
      id: "step-1",
      explanation: "問題の数量関係を確認する",
      expression: (approved.canonicalAnswer || approved.correctAnswer).slice(0, 100),
      result: approved.correctAnswer.slice(0, 200)
    });
    notes.push(note("STEP_SYNTHESIZED", "solutionSteps が空のため承認済みの答えから合成しました"));
  }

  // --- 検算: 数学的な誤りは修復しない(リトライへ) ---
  if (options.verifyEquation) {
    const failures = steps.filter((step) => step.expression && options.verifyEquation!(step.expression) === false);
    if (failures.length) {
      return { ok: false, retry: failures.map((step) => ({ code: "MATH_INCORRECT" as const, detail: `式が成立しません: ${step.expression}` })), notes };
    }
  }

  // --- panels: 規定 role 順へ正規化(不足は合成、過剰は切り詰め) ---
  const byRole = new Map<PanelRole, (typeof data.panels)[number]>();
  const unmatched: (typeof data.panels)[number][] = [];
  for (const panel of data.panels) {
    const role = panel.role.trim() as PanelRole;
    if ((PANEL_ROLES as readonly string[]).includes(role) && !byRole.has(role)) byRole.set(role, panel);
    else unmatched.push(panel);
  }
  for (const role of PANEL_ROLES) {
    if (byRole.has(role)) continue;
    const candidate = unmatched.shift();
    if (candidate) {
      byRole.set(role, candidate);
      notes.push(note("ROLE_REORDERED", `role "${candidate.role || "(空)"}" のコマを "${role}" に割り当て直しました`));
    }
  }
  if (unmatched.length) notes.push(note("PANEL_TRUNCATED", `余剰の ${unmatched.length} コマを切り詰めました`));

  const stepIdSet = new Set(steps.map((step) => step.id));
  const panels: RepairedPanel[] = PANEL_ROLES.map((role, index) => {
    const template = templatePanel(role, approved, steps);
    const source = byRole.get(role);
    if (!source) {
      notes.push(note("PANEL_PADDED", `不足していた "${role}" コマをテンプレートから補完しました`, index));
      return template;
    }
    const learningPurpose = clip(source.learningPurpose, 200, notes, "learningPurpose", index) || template.learningPurpose;
    const scene = clip(source.scene, 500, notes, "scene", index) || template.scene;
    let dialogueText = clip(source.dialogueText, 500, notes, "dialogueText", index);
    if (!dialogueText) {
      dialogueText = template.dialogueText;
      notes.push(note("DIALOGUE_SYNTHESIZED", `空のセリフを "${role}" の定型セリフで補いました`, index));
    }
    let solutionStepId = source.solutionStepId.trim();
    if (!stepIdSet.has(solutionStepId)) {
      const fallbackId = steps[Math.min(index, steps.length - 1)].id;
      if (solutionStepId) notes.push(note("STEP_REF_FIXED", `不明な step 参照 "${solutionStepId}" を "${fallbackId}" に差し替えました`, index));
      solutionStepId = fallbackId;
    }
    let narration = source.narration?.trim() || undefined;
    const formula: string[] = [];
    for (const entry of source.formula.map((value) => value.trim()).filter(Boolean)) {
      if (FORMULA_PATTERN.test(entry)) formula.push(entry.slice(0, 100));
      else {
        narration = narration ? `${narration} ${entry}`.slice(0, 500) : entry.slice(0, 500);
        notes.push(note("FORMULA_MOVED", `式でない文字列をナレーションへ移しました: ${entry.slice(0, 50)}`, index));
      }
    }
    const visual = compileVisualIntent(source.visualIntent ?? null);
    let visualAid: RendererSpec | undefined;
    if (visual.ok) {
      visualAid = visual.spec;
      notes.push(...visual.notes.map((item) => ({ ...item, panelIndex: index })));
    } else {
      notes.push(note("VISUAL_DROPPED", `図解を生成できないため外しました: ${visual.detail}`, index));
    }
    return {
      role,
      learningPurpose,
      scene,
      solutionStepId,
      dialogueText,
      narration: narration ? narration.slice(0, 500) : undefined,
      visualAid,
      formula: formula.slice(0, 10),
      emphasisWords: source.emphasisWords.map((word) => word.trim()).filter(Boolean).map((word) => word.slice(0, 50)).slice(0, 20)
    };
  });

  const title = (data.title ?? "").trim().slice(0, 200) || defaultTitle(approved, notes);
  return {
    ok: true,
    scenario: {
      title,
      problemClassification: (data.problemClassification ?? "").trim().slice(0, 100) || "unclassified",
      solutionSteps: steps,
      panels
    },
    notes
  };
}

function defaultTitle(approved: ApprovedProblem, notes: RepairNote[]): string {
  notes.push(note("TITLE_DEFAULTED", "タイトルが空のため既定タイトルを使用しました"));
  return `${approved.problemText.slice(0, 20)}の考え方`;
}

/** 全6コマをテンプレートから合成する(決定論フォールバックと PANEL_PADDED 補完が同じロジックを使う)。 */
export function buildTemplatePanels(approved: ApprovedProblem, steps: SolutionStep[]): RepairedPanel[] {
  return PANEL_ROLES.map((role) => templatePanel(role, approved, steps));
}

/** リトライ時に元プロンプトへ追記するフィードバック。違反内容を具体的に列挙する。 */
export function buildRetryFeedback(reasons: RetryReason[]): string {
  return [
    "",
    "## 前回の出力は次の理由で使用できませんでした。すべて修正して、JSONオブジェクトだけを出力し直してください。",
    ...reasons.map((reason, index) => `${index + 1}. [${reason.code}] ${reason.detail}`),
    "数値の等式は必ず左辺と右辺が数学的に一致していること。検算してから出力してください。"
  ].join("\n");
}

function templatePanel(role: PanelRole, approved: ApprovedProblem, steps: SolutionStep[]): RepairedPanel {
  const first = steps[0];
  const mid = steps[Math.min(1, steps.length - 1)];
  const last = steps[steps.length - 1];
  const base = { narration: undefined, visualAid: undefined, emphasisWords: [] as string[] };
  switch (role) {
    case "problem":
      return { ...base, role, learningPurpose: "問題と自分の考えを確認する", scene: "主人公が宿題を見直す", solutionStepId: first.id, dialogueText: `自分は「${approved.studentAnswer}」と考えたよ。`.slice(0, 500), formula: [] };
    case "error_location":
      return { ...base, role, learningPurpose: "つまずいた地点を特定する", scene: "先生が考え方を問いかける", solutionStepId: first.id, dialogueText: "どの数量や条件を使う問題かな？", formula: [] };
    case "visualization":
      return { ...base, role, learningPurpose: "数量や図形の関係を可視化する", scene: "図を使って関係を整理する", solutionStepId: first.id, dialogueText: first.explanation.slice(0, 500), formula: first.expression ? [first.expression] : [] };
    case "solution":
      return { ...base, role, learningPurpose: "正しい考え方を段階的に説明する", scene: "主人公が解法を言葉にする", solutionStepId: mid.id, dialogueText: mid.explanation.slice(0, 500), formula: mid.expression ? [mid.expression] : [] };
    case "check":
      return { ...base, role, learningPurpose: "解法と答えを検算する", scene: "先生が式と答えを確かめる", solutionStepId: last.id, dialogueText: "式・単位・問題の条件に合うか確かめよう。", formula: [last.expression || approved.canonicalAnswer || approved.correctAnswer].filter(Boolean).map((value) => value.slice(0, 100)) };
    case "transfer":
      return { ...base, role, learningPurpose: "次に使える判断基準を定着させる", scene: "主人公が答えと手掛かりをまとめる", solutionStepId: last.id, dialogueText: `答えは「${approved.correctAnswer}」。条件と式を結び付ければいいんだね。`.slice(0, 500), formula: [] };
  }
}

/* ------------------------------------------------------------------ */
/* visualIntent → RendererSpec: 検証で落とすのではなく、導出できる値は計算で「直す」。 */
/* ------------------------------------------------------------------ */

type VisualCompileResult =
  | { ok: true; spec?: RendererSpec; notes: RepairNote[] }
  | { ok: false; detail: string };

export function compileVisualIntent(intent: Record<string, unknown> | null): VisualCompileResult {
  if (!intent) return { ok: true, notes: [] };
  const notes: RepairNote[] = [];
  const type = String(intent.type ?? "");
  const rational = (key: string): Rational | null => {
    const raw = intent[key];
    const value = coerceRational(raw);
    if (value && typeof raw === "object" && raw !== null) {
      const source = raw as Record<string, unknown>;
      if (Number(source.numerator) !== value.numerator || Number(source.denominator) !== value.denominator) {
        notes.push(note("RATIONAL_NORMALIZED", `${key} を既約分数 ${value.numerator}/${value.denominator} に正規化しました`));
      }
    }
    return value;
  };
  switch (type) {
    case "tabular_data": {
      const headers = toStringArray(intent.headers).map((header) => header.slice(0, 200)).filter(Boolean).slice(0, 10);
      if (!headers.length) return { ok: false, detail: "tabular_data に headers がありません" };
      const rows = (Array.isArray(intent.rows) ? intent.rows : []).map((row) => toStringArray(row).map((cell) => cell.slice(0, 200))).filter((row) => row.length > 0).slice(0, 20);
      if (!rows.length) return { ok: false, detail: "tabular_data に rows がありません" };
      const fixed = rows.map((row) => row.length === headers.length ? row : row.length > headers.length ? row.slice(0, headers.length) : [...row, ...Array(headers.length - row.length).fill("")]);
      if (fixed.some((row, i) => row.length !== rows[i].length)) notes.push(note("FIELD_TRUNCATED", "表の行の長さを headers に合わせて調整しました"));
      return { ok: true, spec: { type: "table", position: "center", headers, rows: fixed }, notes };
    }
    case "equal_groups": {
      const total = rational("total");
      const groupCount = toPositiveInt(intent.groupCount, 100);
      if (!total || !groupCount) return { ok: false, detail: "equal_groups の total / groupCount を読み取れません" };
      return { ok: true, spec: { type: "bar_model", position: "center", total, groupCount, perGroup: divideRational(total, { numerator: groupCount, denominator: 1 }) }, notes };
    }
    case "part_whole": {
      const numerator = toNonNegativeInt(intent.numerator);
      const denominator = toPositiveInt(intent.denominator, 100);
      if (numerator === null || !denominator) return { ok: false, detail: "part_whole の numerator / denominator を読み取れません" };
      if (numerator > denominator) return { ok: false, detail: `仮分数 ${numerator}/${denominator} は fraction_bar で表せません` };
      return { ok: true, spec: { type: "fraction_bar", position: "center", numerator, denominator }, notes };
    }
    case "scale_marks": {
      const min = rational("min");
      const max = rational("max");
      if (!min || !max || compareRational(min, max) >= 0) return { ok: false, detail: "scale_marks の min / max が不正です" };
      const tickCount = Math.min(20, Math.max(1, toPositiveInt(intent.tickCount, 20) ?? 10));
      const rawMarks = Array.isArray(intent.marks) ? intent.marks : [];
      const marks: { value: Rational; label?: string }[] = [];
      for (const rawMark of rawMarks.slice(0, 20)) {
        const record = (rawMark && typeof rawMark === "object" ? rawMark : {}) as Record<string, unknown>;
        const value = coerceRational(record.value);
        if (!value || compareRational(value, min) < 0 || compareRational(value, max) > 0) {
          notes.push(note("VISUAL_DROPPED", "範囲外または不正な目盛りを除外しました"));
          continue;
        }
        const label = typeof record.label === "string" && record.label.trim() ? record.label.trim().slice(0, 50) : undefined;
        marks.push(label === undefined ? { value } : { value, label });
      }
      return { ok: true, spec: { type: "number_line", position: "center", min, max, tickCount, marks }, notes };
    }
    case "compare_quantities": {
      const left = rational("left");
      const right = rational("right");
      if (!left || !right) return { ok: false, detail: "compare_quantities の left / right を読み取れません" };
      const comparison = compareRational(left, right);
      return {
        ok: true,
        spec: {
          type: "comparison", position: "center", left, right,
          leftLabel: String(intent.leftLabel ?? "左").trim().slice(0, 200) || "左",
          rightLabel: String(intent.rightLabel ?? "右").trim().slice(0, 200) || "右",
          unit: String(intent.unit ?? "").trim().slice(0, 30),
          operator: comparison < 0 ? "<" : comparison > 0 ? ">" : "=",
          ratio: right.numerator === 0 ? null : divideRational(left, right)
        },
        notes
      };
    }
    default:
      return { ok: false, detail: `未知の visualIntent type: ${type || "(空)"}` };
  }
}

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item ?? "").trim()) : []);
const toPositiveInt = (value: unknown, max: number): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
};
const toNonNegativeInt = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/* ------------------------------------------------------------------ */
/* コンパイラ: 演出(キャラ・表情・背景・レイアウト)を決定論的に付与して内部厳格モデルへ。 */
/* ------------------------------------------------------------------ */

const ROLE_PRESENTATION = {
  problem: { character: "hero", expression: "confused", pose: "thinking", background: "classroom", tone: "question" },
  error_location: { character: "teacher", expression: "calm", pose: "pointing", background: "classroom", tone: "question" },
  visualization: { character: "teacher", expression: "smile", pose: "pointing", background: "classroom", tone: "normal" },
  solution: { character: "hero", expression: "discovery", pose: "thinking", background: "classroom", tone: "discovery" },
  check: { character: "teacher", expression: "smile", pose: "pointing", background: "blackboard", tone: "normal" },
  transfer: { character: "hero", expression: "happy", pose: "thinking", background: "classroom", tone: "encourage" }
} as const;

export function compileMangaPlan(input: {
  jobId: string;
  approved: ApprovedProblem;
  scenario: RepairedScenario;
  notes: RepairNote[];
  planSource?: "ai" | "fallback";
}): MangaPlanV3 {
  const planSource = input.planSource === "fallback" ? "fallback" : input.notes.length > 0 ? "ai_repaired" : "ai";
  return mangaPlanV3Schema.parse({
    schemaVersion: MANGA_PLAN_VERSION,
    jobId: input.jobId,
    planSource,
    title: input.scenario.title,
    problem: {
      text: input.approved.problemText,
      studentAnswer: input.approved.studentAnswer,
      correctAnswer: input.approved.correctAnswer
    },
    solutionSteps: input.scenario.solutionSteps,
    layoutTemplate: "six-panel-a4-v1",
    panels: input.scenario.panels.map((panel, index) => {
      const style = ROLE_PRESENTATION[panel.role];
      return {
        role: panel.role,
        learningPurpose: panel.learningPurpose,
        scene: panel.scene,
        solutionStepId: panel.solutionStepId,
        dialogue: [{ speaker: style.character, text: panel.dialogueText, tone: style.tone }],
        ...(panel.narration === undefined ? {} : { narration: panel.narration }),
        ...(panel.visualAid === undefined ? {} : { visualAid: panel.visualAid }),
        formula: panel.formula,
        emphasisWords: panel.emphasisWords,
        presentation: {
          casts: [{ character: style.character, expression: style.expression, pose: style.pose, side: index % 2 === 0 ? "left" : "right" }],
          background: style.background,
          size: panel.visualAid ? "large" : "medium",
          visualAidPosition: "center"
        }
      };
    }),
    repairNotes: input.notes.slice(0, 50)
  });
}
