import { classifyProblem } from "../src/curriculum";

describe("curriculum classification", () => {
  it.each([
    ["3/4 + 1/4を計算しましょう", "number_calculation"],
    ["長方形の面積を求めましょう", "geometry"],
    ["2kmは何mですか", "measurement"],
    ["定価の20%はいくらですか", "change_relationships"],
    ["表から平均を求めましょう", "data"]
  ] as const)("classifies %s", (text, domain) => expect(classifyProblem(text).curriculumDomain).toBe(domain));
});
