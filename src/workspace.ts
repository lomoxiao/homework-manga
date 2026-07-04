import type { HomeworkDraft, MangaPlan, WorkspaceState } from "./schema";
import { workspaceStateSchema } from "./schema";

export const WORKSPACE_KEY = "homework-manga:workspace:v1";

export const defaultDraft: HomeworkDraft = {
  grade: 4,
  subject: "math",
  problemText: "りんごが24個あります。3人で同じ数ずつ分けます。1人分は何個ですか。",
  studentAnswer: "24 - 3 = 21",
  correctAnswer: "24 ÷ 3 = 8",
  mistakeCause: "同じ数ずつ分ける場面で、人数の3を引く数だと考えている"
};

export function createWorkspace(mangaPlan: MangaPlan | null = null): WorkspaceState {
  return {
    version: 1,
    step: "input",
    draft: { ...defaultDraft },
    mangaPlan,
    scenarioEdited: false,
    updatedAt: new Date().toISOString()
  };
}

export function loadWorkspace(storage: Pick<Storage, "getItem">): WorkspaceState | null {
  try {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const result = workspaceStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(storage: Pick<Storage, "setItem">, state: WorkspaceState): WorkspaceState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  storage.setItem(WORKSPACE_KEY, JSON.stringify(next));
  return next;
}
