import { useState } from "preact/hooks";
import { compileMangaPlan } from "@homework-manga/contracts/aiScenario";
import { approvedProblemSchema, type ApprovedProblem } from "@homework-manga/contracts/approvedProblem";
import type { MangaPlanV3 } from "@homework-manga/contracts/mangaPlan";
import { buildFallbackScenario } from "@homework-manga/scenario-core/fallbackScenario";
import { PlanViewer } from "../viewer/PlanViewer";

const STORAGE_KEY = "homework-manga:local:v3";

const defaultInput = {
  problemText: "りんごが24個あります。3人で同じ数ずつ分けます。1人分は何個ですか。",
  studentAnswer: "24 - 3 = 21",
  correctAnswer: "24 ÷ 3 = 8",
  mistakeCause: "同じ数ずつ分ける場面で、人数の3を引く数だと考えている"
};

/**
 * ローカル完結モード(オフラインデモ・保険)。
 * 手入力から決定論生成(scenario-core)で即座にまんがを作る。AI・Firebase 不要。
 */
export function LocalApp() {
  const [input, setInput] = useState(loadInput);
  const [plan, setPlan] = useState<MangaPlanV3 | null>(null);
  const [error, setError] = useState<string | undefined>();

  const generate = (event: Event) => {
    event.preventDefault();
    try {
      const approved: ApprovedProblem = approvedProblemSchema.parse({ ...input, canonicalAnswer: input.correctAnswer });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
      const scenario = buildFallbackScenario(approved);
      setPlan(compileMangaPlan({ jobId: `local-${Date.now()}`, approved, scenario, notes: [], planSource: "fallback" }));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const update = (key: keyof typeof defaultInput) => (event: Event) =>
    setInput({ ...input, [key]: (event.currentTarget as HTMLTextAreaElement).value });

  return (
    <div class="local-app">
      <section class="card">
        <h2>おためしモード(手入力・オフライン)</h2>
        <form class="draft-form" onSubmit={generate}>
          <label class="field">問題文<textarea rows={2} value={input.problemText} onInput={update("problemText")} /></label>
          <label class="field">子どもの答え<textarea rows={1} value={input.studentAnswer} onInput={update("studentAnswer")} /></label>
          <label class="field">正しい答え<textarea rows={1} value={input.correctAnswer} onInput={update("correctAnswer")} /></label>
          <label class="field">つまずきの原因<textarea rows={2} value={input.mistakeCause} onInput={update("mistakeCause")} /></label>
          {error && <p class="warning">{error}</p>}
          <div class="detail-actions">
            <button class="primary big" type="submit">まんがを作る</button>
            {plan && <button type="button" onClick={() => window.print()}>PDF / 印刷</button>}
          </div>
        </form>
      </section>
      {plan && <PlanViewer plan={plan} />}
    </div>
  );
}

function loadInput(): typeof defaultInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultInput;
    const parsed = JSON.parse(raw) as Partial<typeof defaultInput>;
    return { ...defaultInput, ...parsed };
  } catch {
    return defaultInput;
  }
}
