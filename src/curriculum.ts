import type { HomeworkDraft } from "./schema";
export const curriculumDomains = { number_calculation: "数と計算", geometry: "図形", measurement: "測定", change_relationships: "変化と関係", data: "データの活用" } as const;
export function classifyProblem(text: string): Pick<HomeworkDraft, "curriculumDomain" | "topic" | "problemType"> {
  if (/グラフ|表|平均|最頻値|データ/.test(text)) return { curriculumDomain: "data", topic: /平均/.test(text) ? "average" : "tables_graphs", problemType: "table_graph" };
  if (/面積|体積|角|三角形|四角形|円|周/.test(text)) return { curriculumDomain: "geometry", topic: /体積/.test(text) ? "volume" : /面積/.test(text) ? "area" : "shapes", problemType: "word_problem" };
  if (/時刻|時間|長さ|重さ|かさ|cm|km|kg|L|リットル/.test(text)) return { curriculumDomain: "measurement", topic: "measurement_units", problemType: "word_problem" };
  if (/割合|百分率|%|比例|反比例|速さ/.test(text)) return { curriculumDomain: "change_relationships", topic: /速さ/.test(text) ? "speed" : /比例/.test(text) ? "proportion" : "ratio_percent", problemType: "word_problem" };
  return { curriculumDomain: "number_calculation", topic: /分数/.test(text) ? "fractions" : /小数/.test(text) ? "decimals" : "arithmetic", problemType: /ですか|求め/.test(text) ? "word_problem" : "calculation" };
}
