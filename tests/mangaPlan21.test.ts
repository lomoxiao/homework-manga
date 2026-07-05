import { MANGA_PLAN_SCHEMA_HASH, mangaPlan21Schema, readMangaPlan } from "../src/mangaPlan21";

const panel = (panelNumber: number) => ({ panelNumber, learningPurpose: "purpose", scene: "classroom", solutionStepId: "s1", characters: ["hero"], characterPose: {}, characterExpression: {}, background: "classroom", props: [], dialogue: [{ speaker: "hero", text: "hello", tone: "normal" as const }], narration: null, visualAid: null, formula: [], emphasisWords: [], layout: { size: "medium" as const, characterSide: "left" as const, visualAidPosition: "center" as const }, assetIds: [] });
const plan = { schemaVersion: "2.1", contractVersion: "2.1", schemaHash: MANGA_PLAN_SCHEMA_HASH, jobId: "job", title: "title", problem: { text: "problem", studentAnswer: "1", correctAnswer: "2" }, panels: Array.from({ length: 6 }, (_, i) => panel(i + 1)), warnings: [] };
describe("2.1 reader", () => {
  it("requires contract version and schema hash", () => { expect(mangaPlan21Schema.safeParse(plan).success).toBe(true); expect(mangaPlan21Schema.safeParse({ ...plan, schemaHash: "wrong" }).success).toBe(false); });
  it("isolates legacy plans", () => { expect(readMangaPlan({ schemaVersion: "2.0" })).toEqual({ kind: "legacy_unreadable", version: "2.0" }); expect(readMangaPlan({ schemaVersion: "1.0" })).toEqual({ kind: "legacy_unreadable", version: "1.0" }); });
});
