import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithRedirect, type User } from "firebase/auth";
import { getDatabase, onValue, ref, update } from "firebase/database";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export type RemoteHomeworkJob = {
  id: string;
  ownerUid: string;
  status: string;
  stage: string;
  sourceImage?: {
    provider: "google_drive";
    fileId: string;
    contentType: string;
    size: number;
    viewUrl: string;
    downloadUrl: string;
  };
  analysis?: {
    problemText: string;
    studentAnswer: string;
    correctAnswerCandidate: string;
    mistakeCause: string;
    confidence: Record<string, number>;
    evidence: string[];
    warnings: string[];
    needsHumanReview: true;
  };
  error?: string;
};

export const firebaseConfigured = Object.values(config).every(Boolean);
const app = firebaseConfigured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getDatabase(app) : null;

export function observeAuth(callback: (user: User | null) => void) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured");
  await signInWithRedirect(auth, new GoogleAuthProvider());
}

export function observeHomeworkJob(jobId: string, callback: (job: RemoteHomeworkJob | null) => void) {
  if (!db) return () => {};
  return onValue(ref(db, `/homeworkJobs/${jobId}`), (snapshot) => callback(snapshot.exists() ? snapshot.val() as RemoteHomeworkJob : null));
}

export async function approveHomeworkJob(jobId: string, approvedAnalysis: Record<string, unknown>, mangaPlan: Record<string, unknown>) {
  if (!db) throw new Error("Firebase is not configured");
  await update(ref(db, `/homeworkJobs/${jobId}`), { approvedAnalysis, mangaPlan, status: "completed", stage: "completed", updatedAt: new Date().toISOString() });
}

export async function requestHomeworkDeletion(jobId: string) {
  if (!db) throw new Error("Firebase is not configured");
  await update(ref(db, `/homeworkJobs/${jobId}`), {
    status: "delete_requested",
    stage: "delete_requested",
    error: null,
    deleteRequestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}
