import { zodToJsonSchema } from "zod-to-json-schema";
import { mangaPlanV3Schema } from "../src/mangaPlan";
import { homeworkAnalysisV3Schema } from "../src/aiAnalysis";
import { approvedProblemSchema } from "../src/approvedProblem";
import { homeworkJobV3Schema } from "../src/homeworkJob";

// schemaHash リテラルの代替: 契約が意図せず変わったらスナップショットが割れる。
// 構造を変える場合はバージョンをバンプし、migrations.ts に移行を登録してから更新すること。
describe("contract snapshots", () => {
  it("MangaPlan v3", () => {
    expect(zodToJsonSchema(mangaPlanV3Schema, "MangaPlanV3")).toMatchSnapshot();
  });
  it("HomeworkAnalysis v3", () => {
    expect(zodToJsonSchema(homeworkAnalysisV3Schema, "HomeworkAnalysisV3")).toMatchSnapshot();
  });
  it("ApprovedProblem v3", () => {
    expect(zodToJsonSchema(approvedProblemSchema, "ApprovedProblemV3")).toMatchSnapshot();
  });
  it("HomeworkJob v3 node", () => {
    expect(zodToJsonSchema(homeworkJobV3Schema, "HomeworkJobV3")).toMatchSnapshot();
  });
});
