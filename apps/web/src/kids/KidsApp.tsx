import { useEffect, useMemo, useState } from "preact/hooks";
import { unpackEnvelope } from "@homework-manga/contracts/firebaseCodec";
import { mangaPlanV3Schema, MANGA_PLAN_VERSION, type MangaPlanV3 } from "@homework-manga/contracts/mangaPlan";
import { firebaseConfigured, loginWithGoogle, observeAuth, observeMyJobs, recordKidsRead, type HomeworkJobV3, type User } from "../services/firebaseClient";
import { kidsPhaseView } from "../phaseLabels";
import { AuthRecoveryScreen, useAuthWatchdog } from "../AuthWatchdog";
import { PanelView, PlanViewer } from "../viewer/PlanViewer";

/**
 * 子どもモード: failed は一切見せない。ready の漫画だけが「ほんだな」に並び、
 * 生成中は「じゅんびちゅう」の閉じた本として表示する。
 */
export function KidsApp() {
  const user = useAuth();
  const authTimedOut = useAuthWatchdog(user === undefined);
  if (!firebaseConfigured) return <section class="card kids-card"><p>じゅんびが できていないよ。おうちの人に きいてね。</p></section>;
  if (user === undefined) {
    if (authTimedOut) return <AuthRecoveryScreen kids />;
    return <div class="progress-screen kids"><div class="spinner" /></div>;
  }
  if (!user) {
    return (
      <section class="card kids-card auth-screen">
        <h2>しゅくだい まんが</h2>
        <p>おうちの人と いっしょに ログインしてね。</p>
        <button class="primary big" onClick={() => void loginWithGoogle()}>ログイン</button>
      </section>
    );
  }
  return <Bookshelf uid={user.uid} />;
}

function Bookshelf({ uid }: { uid: string }) {
  const [jobs, setJobs] = useState<HomeworkJobV3[] | undefined>();
  useEffect(() => observeMyJobs(uid, setJobs), [uid]);
  const [readingId, setReadingId] = useState<string | null>(() => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("job"));

  if (jobs === undefined) return <div class="progress-screen kids"><div class="spinner" /><p>ほんだなを ひらいているよ…</p></div>;

  const books = jobs
    .filter((job) => job.phase === "ready")
    .map((job) => ({ job, plan: unpackPlan(job) }))
    .filter((book): book is { job: HomeworkJobV3; plan: MangaPlanV3 } => book.plan !== null);
  const preparing = jobs.filter((job) => job.phase === "analyzing" || job.phase === "scripting" || job.phase === "captured" || job.phase === "awaiting_approval");
  const totalStamps = jobs.reduce((sum, job) => sum + (job.child?.stamps ?? 0), 0);

  const reading = books.find((book) => book.job.id === readingId);
  if (reading) return <Reader job={reading.job} plan={reading.plan} onClose={() => setReadingId(null)} />;

  return (
    <div class="kids-home">
      <header class="kids-header">
        <h2>📚 ほんだな</h2>
        <span class="stamp-counter" title="あつめたスタンプ">⭐ {totalStamps}</span>
      </header>
      {books.length === 0 && preparing.length === 0 && <p class="kids-empty">まだ まんがが ないよ。おうちの人に しゃしんを おくってもらおう！</p>}
      <div class="bookshelf">
        {books.map(({ job, plan }) => (
          <button key={job.id} type="button" class={`book ${job.child?.readCount ? "" : "book-new"}`} onClick={() => setReadingId(job.id)}>
            {!job.child?.readCount && <span class="new-ribbon">NEW!</span>}
            <span class="book-title">{plan.title}</span>
            <span class="book-stamps">{"⭐".repeat(Math.min(job.child?.stamps ?? 0, 5))}</span>
          </button>
        ))}
        {preparing.map((job) => (
          <div key={job.id} class="book book-preparing">
            <span class="book-title">じゅんびちゅう</span>
            <span class="book-status">{kidsPhaseView(job)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reader({ job, plan, onClose }: { job: HomeworkJobV3; plan: MangaPlanV3; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [finished, setFinished] = useState(false);
  const total = plan.panels.length;
  const wide = useMemo(() => window.matchMedia("(min-width: 900px)").matches, []);

  const finish = () => {
    setFinished(true);
    void recordKidsRead(job).catch(() => {});
  };

  if (finished) {
    return (
      <div class="kids-finish">
        <div class="confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={`--i:${index}`} />)}</div>
        <h2>よくがんばったね！ ⭐</h2>
        <p>まちがいは たからもの。ひとつ かしこくなったよ！</p>
        <div class="detail-actions">
          <button class="primary big" type="button" onClick={() => { setFinished(false); setPage(0); }}>もういちど よむ</button>
          <button class="big" type="button" onClick={onClose}>ほんだなへ もどる</button>
        </div>
      </div>
    );
  }

  if (wide) {
    return (
      <div class="kids-reader wide">
        <button class="reader-close" type="button" onClick={onClose}>← ほんだな</button>
        <PlanViewer plan={plan} />
        <div class="detail-actions center">
          <button class="primary big" type="button" onClick={finish}>よみおわった！</button>
        </div>
      </div>
    );
  }

  return (
    <div class="kids-reader">
      <header class="reader-bar">
        <button class="reader-close" type="button" onClick={onClose}>←</button>
        <span class="reader-title">{plan.title}</span>
        <span class="reader-progress">{page + 1} / {total}</span>
      </header>
      <div class="reader-panel" key={page}>
        <PanelView panel={plan.panels[page]} number={page + 1} />
      </div>
      <div class="reader-dots">
        {plan.panels.map((_, index) => <i key={index} class={index === page ? "active" : ""} />)}
      </div>
      <div class="reader-nav">
        <button class="big" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>← まえ</button>
        {page < total - 1
          ? <button class="primary big" type="button" onClick={() => setPage(page + 1)}>つぎ →</button>
          : <button class="primary big" type="button" onClick={finish}>よみおわった！</button>}
      </div>
    </div>
  );
}

function useAuth(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => observeAuth(setUser), []);
  return user;
}

function unpackPlan(job: HomeworkJobV3): MangaPlanV3 | null {
  if (!job.artifacts?.mangaPlan) return null;
  const result = unpackEnvelope(mangaPlanV3Schema, MANGA_PLAN_VERSION, job.artifacts.mangaPlan);
  return result.ok ? result.value : null;
}
