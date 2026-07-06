import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithRedirect, type User } from "firebase/auth";
import { equalTo, getDatabase, onValue, orderByChild, query, ref, update } from "firebase/database";
import { approvedProblemSchema, APPROVED_PROBLEM_VERSION, type ApprovedProblem } from "@homework-manga/contracts/approvedProblem";
import { packEnvelope } from "@homework-manga/contracts/firebaseCodec";
import { homeworkJobV3Schema, transitionPhase, type HomeworkJobV3 } from "@homework-manga/contracts/homeworkJob";

const JOBS_PATH = "/homeworkJobsV3";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(config).every(Boolean);
const app = firebaseConfigured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getDatabase(app) : null;

export type { HomeworkJobV3, User };

export function observeAuth(callback: (user: User | null) => void): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle(): Promise<void> {
  if (!auth) throw new Error("Firebase is not configured");
  await signInWithRedirect(auth, new GoogleAuthProvider());
}

export async function getFirebaseIdToken(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Googleログインが必要です。");
  return user.getIdToken();
}

/** 自分のジョブ一覧を購読(新しい順)。ルールの query-based read に一致する形でクエリする。 */
export function observeMyJobs(uid: string, callback: (jobs: HomeworkJobV3[]) => void): () => void {
  if (!db) return () => {};
  const jobsQuery = query(ref(db, JOBS_PATH), orderByChild("ownerUid"), equalTo(uid));
  return onValue(jobsQuery, (snapshot) => {
    const jobs: HomeworkJobV3[] = [];
    snapshot.forEach((child) => {
      const parsed = homeworkJobV3Schema.safeParse(child.val());
      if (parsed.success) jobs.push(parsed.data);
    });
    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(jobs);
  }, (error) => {
    console.error("[firebase] jobs subscription failed", error);
    callback([]);
  });
}

export function observeJob(jobId: string, callback: (job: HomeworkJobV3 | null) => void): () => void {
  if (!db) return () => {};
  return onValue(ref(db, `${JOBS_PATH}/${jobId}`), (snapshot) => {
    if (!snapshot.exists()) return callback(null);
    const parsed = homeworkJobV3Schema.safeParse(snapshot.val());
    callback(parsed.success ? parsed.data : null);
  });
}

/** 解析結果の承認: approved を保存して scripting を起動する。 */
export async function approveJob(job: HomeworkJobV3, approved: ApprovedProblem): Promise<void> {
  if (!db) throw new Error("Firebase is not configured");
  const next = transitionPhase({ phase: job.phase, runState: job.runState }, "scripting", "queued");
  await update(ref(db, `${JOBS_PATH}/${job.id}`), {
    ...next,
    "artifacts/approved": packEnvelope(approvedProblemSchema, APPROVED_PROBLEM_VERSION, approved),
    "artifacts/mangaPlan": null,
    failure: null
  });
}

/** もう一度作る: 承認済みなら scripting から、なければ analyzing からやり直す。 */
export async function requestRegenerate(job: HomeworkJobV3): Promise<void> {
  if (!db) throw new Error("Firebase is not configured");
  const target = job.artifacts?.approved ? "scripting" : "analyzing";
  const next = transitionPhase({ phase: job.phase, runState: job.runState }, target, "queued");
  await update(ref(db, `${JOBS_PATH}/${job.id}`), {
    ...next,
    failure: null,
    ...(target === "scripting" ? { "artifacts/mangaPlan": null } : { "artifacts/analysis": null, "artifacts/mangaPlan": null })
  });
}

/** 子どもモードの読了記録: スタンプを1つ増やす。 */
export async function recordKidsRead(job: HomeworkJobV3): Promise<void> {
  if (!db) return;
  await update(ref(db, `${JOBS_PATH}/${job.id}`), {
    "child/readCount": (job.child?.readCount ?? 0) + 1,
    "child/stamps": (job.child?.stamps ?? 0) + 1,
    "child/lastReadAt": new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

/** 削除依頼: worker が Drive 画像とジョブノードを消す。 */
export async function requestDeletion(job: HomeworkJobV3): Promise<void> {
  if (!db) throw new Error("Firebase is not configured");
  const next = transitionPhase({ phase: job.phase, runState: job.runState }, "deleting", "queued");
  await update(ref(db, `${JOBS_PATH}/${job.id}`), { ...next, failure: null });
}
