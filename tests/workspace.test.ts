import mangaPlan from "../samples/manga_plan.json";
import { mangaPlanSchema } from "../src/schema";
import { createWorkspace, loadWorkspace, saveWorkspace, WORKSPACE_KEY } from "../src/workspace";

function memoryStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(WORKSPACE_KEY, initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); }
  };
}

describe("workspace persistence", () => {
  it("round-trips text and manga data without a photo", () => {
    const storage = memoryStorage();
    const original = createWorkspace(mangaPlanSchema.parse(mangaPlan));
    saveWorkspace(storage, { ...original, step: "scenario" });
    const loaded = loadWorkspace(storage);
    expect(loaded?.step).toBe("scenario");
    expect(loaded?.draft.problemText).toContain("りんご");
    expect(JSON.stringify(loaded)).not.toContain("data:image");
  });

  it("ignores corrupted and incompatible data", () => {
    expect(loadWorkspace(memoryStorage("not-json"))).toBeNull();
    expect(loadWorkspace(memoryStorage(JSON.stringify({ version: 2 })))).toBeNull();
  });
});
