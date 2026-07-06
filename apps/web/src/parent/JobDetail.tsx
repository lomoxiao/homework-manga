import { useMemo, useState } from "preact/hooks";
import { homeworkAnalysisV3Schema, ANALYSIS_VERSION, type HomeworkAnalysisV3 } from "@homework-manga/contracts/aiAnalysis";
import { approvedProblemSchema } from "@homework-manga/contracts/approvedProblem";
import { unpackEnvelope } from "@homework-manga/contracts/firebaseCodec";
import { mangaPlanV3Schema, MANGA_PLAN_VERSION, type MangaPlanV3 } from "@homework-manga/contracts/mangaPlan";
import { approveJob, requestDeletion, requestRegenerate, type HomeworkJobV3 } from "../services/firebaseClient";
import { resolveDriveDisplayUrl } from "../driveImage";
import { parentPhaseView } from "../phaseLabels";
import { PlanViewer } from "../viewer/PlanViewer";

export function JobDetail({ job }: { job: HomeworkJobV3 }) {
  const view = parentPhaseView(job);
  return (
    <section class="card job-detail">
      <header class="detail-header">
        <span class={`badge tone-${view.tone}`}>{view.label}</span>
        <span class="job-date">{formatDate(job.createdAt)}</span>
      </header>
      {job.phase === "awaiting_approval" && <AnalysisReview job={job} />}
      {job.phase === "ready" && <ReadyView job={job} />}
      {job.phase === "failed" && <FailedView job={job} />}
      {(job.phase === "captured" || job.phase === "analyzing" || job.phase === "scripting" || job.phase === "deleting") && (
        <div class="progress-screen"><div class="spinner" /><p>{view.detail}</p></div>
      )}
      {job.phase !== "deleting" && (
        <footer class="detail-actions">
          <button type="button" class="danger" onClick={() => confirmDelete(job)}>この宿題を削除</button>
        </footer>
      )}
    </section>
  );
}

function AnalysisReview({ job }: { job: HomeworkJobV3 }) {
  const analysis = useMemo(() => unpackAnalysis(job), [job]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(analysis?.problems.length === 1);
  const [error, setError] = useState<string | undefined>();

  if (!analysis) return <p class="warning">解析結果を読み込めませんでした。「もう一度作る」をお試しください。</p>;
  const problem = analysis.problems[Math.min(selectedIndex, analysis.problems.length - 1)];
  const imageUrl = job.sourceImage ? resolveDriveDisplayUrl(job.sourceImage) : undefined;

  const submit = async (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    try {
      const approved = approvedProblemSchema.parse({
        problemText: String(data.get("problemText")),
        studentAnswer: String(data.get("studentAnswer")),
        correctAnswer: String(data.get("correctAnswer")),
        mistakeCause: String(data.get("mistakeCause")),
        canonicalAnswer: String(data.get("correctAnswer")),
        selectedProblemId: problem.id
      });
      await approveJob(job, approved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div class="review-layout">
      <div class="photo-review">
        {imageUrl
          ? <img src={imageUrl} alt="宿題写真" referrerpolicy="no-referrer" />
          : <p class="hint">写真プレビューはありません。</p>}
      </div>
      <form class="draft-form" onSubmit={submit}>
        {analysis.problems.length > 1 && (
          <div class="problem-candidates">
            <p>まんがにする問題を選んでください:</p>
            {analysis.problems.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                class={`problem-candidate ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => { setSelectedIndex(index); setConfirmed(true); }}
              >
                <b>{candidate.id}</b>
                <span>{candidate.problemText}</span>
              </button>
            ))}
          </div>
        )}
        <Field key={`${problem.id}-p`} name="problemText" label="問題文" value={problem.problemText} confidence={problem.confidence.problemText} />
        <Field key={`${problem.id}-s`} name="studentAnswer" label="子どもの答え" value={problem.studentAnswer} confidence={problem.confidence.studentAnswer} />
        <Field key={`${problem.id}-c`} name="correctAnswer" label="正しい答え" value={problem.correctAnswerCandidate} confidence={problem.confidence.correctAnswerCandidate} />
        <Field key={`${problem.id}-m`} name="mistakeCause" label="つまずきの原因" value={problem.mistakeCause} confidence={problem.confidence.mistakeCause} />
        {[...analysis.warnings, ...problem.warnings].length > 0 && (
          <p class="warning">{[...analysis.warnings, ...problem.warnings].join(" / ")}</p>
        )}
        {error && <p class="warning">{error}</p>}
        <button class="primary big" type="submit" disabled={!confirmed && analysis.problems.length > 1}>
          この内容でまんがを作る
        </button>
      </form>
    </div>
  );
}

function Field({ name, label, value, confidence }: { name: string; label: string; value: string; confidence: number }) {
  const low = confidence < 0.75;
  return (
    <label class={`field ${low ? "low-confidence" : ""}`}>
      {label}
      <span class="confidence">読み取り {Math.round(confidence * 100)}%</span>
      <textarea name={name} rows={2} defaultValue={value} />
    </label>
  );
}

function ReadyView({ job }: { job: HomeworkJobV3 }) {
  const plan = useMemo(() => unpackPlan(job), [job]);
  const [showNotes, setShowNotes] = useState(false);
  if (!plan) return <p class="warning">まんがデータを読み込めませんでした。「もう一度作る」をお試しください。</p>;
  return (
    <div class="ready-view">
      {plan.planSource === "fallback" && (
        <p class="notice">AIの下書きがうまくいかなかったため、自動生成(簡易版)で作成しました。</p>
      )}
      <div class="detail-actions">
        <button type="button" class="primary" onClick={() => window.print()}>PDF / 印刷</button>
        <a class="button" href={`#/kids?job=${encodeURIComponent(job.id)}`}>こどもモードで読む</a>
        <button type="button" onClick={() => regenerate(job)}>AIでもう一度作る</button>
      </div>
      {plan.repairNotes.length > 0 && (
        <details class="repair-notes" open={showNotes}>
          <summary onClick={() => setShowNotes(!showNotes)}>自動修復の記録({plan.repairNotes.length}件)</summary>
          <ul>{plan.repairNotes.map((note, index) => <li key={index}><code>{note.code}</code> {note.detail}</li>)}</ul>
        </details>
      )}
      <PlanViewer plan={plan} />
    </div>
  );
}

function FailedView({ job }: { job: HomeworkJobV3 }) {
  return (
    <div class="failed-view">
      <p class="warning">{job.failure?.messageForParent ?? "処理に失敗しました。"}</p>
      <div class="detail-actions">
        <button type="button" class="primary" onClick={() => regenerate(job)}>もう一度作る</button>
      </div>
      {job.failure?.detailJson && (
        <details class="repair-notes">
          <summary>技術的な詳細</summary>
          <pre>{prettyDetail(job.failure.detailJson)}</pre>
        </details>
      )}
    </div>
  );
}

function unpackAnalysis(job: HomeworkJobV3): HomeworkAnalysisV3 | null {
  if (!job.artifacts?.analysis) return null;
  const result = unpackEnvelope(homeworkAnalysisV3Schema, ANALYSIS_VERSION, job.artifacts.analysis);
  return result.ok ? result.value : null;
}

function unpackPlan(job: HomeworkJobV3): MangaPlanV3 | null {
  if (!job.artifacts?.mangaPlan) return null;
  const result = unpackEnvelope(mangaPlanV3Schema, MANGA_PLAN_VERSION, job.artifacts.mangaPlan);
  return result.ok ? result.value : null;
}

function regenerate(job: HomeworkJobV3): void {
  void requestRegenerate(job).catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
}

function confirmDelete(job: HomeworkJobV3): void {
  if (!window.confirm("Google Driveの宿題写真と解析結果・まんがデータを削除しますか？")) return;
  void requestDeletion(job).catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
}

function prettyDetail(detailJson: string): string {
  try {
    return JSON.stringify(JSON.parse(detailJson), null, 2);
  } catch {
    return detailJson;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
