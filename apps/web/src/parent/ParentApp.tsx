import { useEffect, useState } from "preact/hooks";
import { firebaseConfigured, loginWithGoogle, observeAuth, observeMyJobs, type HomeworkJobV3, type User } from "../services/firebaseClient";
import { parentPhaseView } from "../phaseLabels";
import { AuthRecoveryScreen, useAuthWatchdog } from "../AuthWatchdog";
import { UploadCard } from "./UploadCard";
import { JobDetail } from "./JobDetail";

export function ParentApp() {
  const user = useAuth();
  const authTimedOut = useAuthWatchdog(user === undefined);
  if (!firebaseConfigured) {
    return <section class="card"><h2>Firebase設定が必要です</h2><p>VITE_FIREBASE_* を設定して再ビルドしてください。</p></section>;
  }
  if (user === undefined) {
    if (authTimedOut) return <AuthRecoveryScreen />;
    return <div class="progress-screen"><div class="spinner" /></div>;
  }
  if (!user) {
    return (
      <section class="card auth-screen">
        <h2>宿題まんがをはじめる</h2>
        <p>許可されたGoogleアカウントでログインしてください。</p>
        <button class="primary big" onClick={() => void loginWithGoogle()}>Googleでログイン</button>
      </section>
    );
  }
  return <ParentHome uid={user.uid} />;
}

function ParentHome({ uid }: { uid: string }) {
  const jobs = useMyJobs(uid);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("job"));
  const selected = jobs?.find((job) => job.id === selectedId) ?? null;

  return (
    <div class="parent-home">
      <UploadCard onCreated={(jobId) => setSelectedId(jobId)} />
      <section class="card">
        <h2>宿題の一覧</h2>
        {jobs === undefined && <div class="progress-screen"><div class="spinner" /></div>}
        {jobs !== undefined && jobs.length === 0 && <p class="hint">まだ宿題がありません。上から写真を送ってください。</p>}
        <ul class="job-list">
          {(jobs ?? []).map((job) => {
            const view = parentPhaseView(job);
            return (
              <li key={job.id}>
                <button type="button" class={`job-row ${job.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(job.id)}>
                  <span class={`badge tone-${view.tone}`}>{view.label}</span>
                  <span class="job-title">{jobTitle(job)}</span>
                  <span class="job-date">{shortDate(job.createdAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {selected && <JobDetail job={selected} />}
      {selectedId && !selected && jobs !== undefined && (
        <section class="card"><p class="hint">この宿題は削除されたか、見つかりませんでした。</p></section>
      )}
    </div>
  );
}

function useAuth(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => observeAuth(setUser), []);
  return user;
}

function useMyJobs(uid: string): HomeworkJobV3[] | undefined {
  const [jobs, setJobs] = useState<HomeworkJobV3[] | undefined>(undefined);
  useEffect(() => observeMyJobs(uid, setJobs), [uid]);
  return jobs;
}

function jobTitle(job: HomeworkJobV3): string {
  return `宿題 ${job.id.slice(-6)}`;
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}/${date.getDate()}`;
}
