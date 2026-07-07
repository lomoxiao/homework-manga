/**
 * Codex CLI の --output-schema へ渡す JSON Schema(シナリオ生成)。
 *
 * OpenAI 構造化出力の制約(additionalProperties: false、全フィールド required、
 * nullable は type 配列で表現)に合わせるため、zod からの自動生成ではなく
 * 手書き定数として contracts に一元管理する。受け側の aiScenarioLooseSchema は
 * このスキーマの出力をすべて受容する(契約テストで担保)。
 */
export const PROBLEM_CLASSIFICATIONS = ["table_data", "equal_division", "fraction_part_whole", "number_line", "quantity_comparison", "geometry", "other"] as const;
export const NUMERIC_EQUATION_PATTERN = String.raw`^\s*-?\d+(?:\.\d+)?\s*[+\-*/xX×÷]\s*-?\d+(?:\.\d+)?\s*[=＝]\s*-?\d+(?:\.\d+)?\s*$`;

const PANEL_ROLES_FOR_AI = ["problem", "error_location", "visualization", "solution", "check", "transfer"] as const;

const aiRational = { type: ["object", "null"], additionalProperties: false, required: ["numerator", "denominator"], properties: { numerator: { type: "integer" }, denominator: { type: "integer", minimum: 1 } } };
const aiTextArray = { type: ["array", "null"], maxItems: 10, items: { type: "string", minLength: 1, maxLength: 200 } };
const aiIntent = {
  type: ["object", "null"], additionalProperties: false,
  required: ["type", "requirement", "headers", "rows", "total", "groupCount", "numerator", "denominator", "min", "max", "tickCount", "marks", "left", "right", "leftLabel", "rightLabel", "unit", "shape", "width", "height", "radius", "shapeUnit", "shapeLabels", "highlightSide", "gridColumns", "gridRows", "highlightCells", "degrees", "angleLabel"],
  properties: {
    type: { enum: ["tabular_data", "equal_groups", "part_whole", "scale_marks", "compare_quantities", "labeled_shape", "area_grid", "angle_measure"] },
    requirement: { enum: ["required", "optional"] },
    headers: aiTextArray,
    rows: { type: ["array", "null"], maxItems: 20, items: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 200 } } },
    total: aiRational,
    groupCount: { type: ["integer", "null"], minimum: 1, maximum: 100 },
    numerator: { type: ["integer", "null"], minimum: 0 },
    denominator: { type: ["integer", "null"], minimum: 1, maximum: 100 },
    min: aiRational,
    max: aiRational,
    tickCount: { type: ["integer", "null"], minimum: 1, maximum: 20 },
    marks: { type: ["array", "null"], maxItems: 20, items: { type: "object", additionalProperties: false, required: ["value", "label"], properties: { value: { ...aiRational, type: "object" }, label: { type: ["string", "null"], minLength: 1, maxLength: 200 } } } },
    left: aiRational,
    right: aiRational,
    leftLabel: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    rightLabel: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    unit: { type: ["string", "null"], maxLength: 30 },
    shape: { enum: ["rectangle", "square", "triangle", "right_triangle", "circle", null] },
    width: aiRational,
    height: aiRational,
    radius: aiRational,
    shapeUnit: { type: ["string", "null"], maxLength: 10 },
    shapeLabels: { type: ["array", "null"], maxItems: 6, items: { type: "object", additionalProperties: false, required: ["text", "side"], properties: { text: { type: "string", minLength: 1, maxLength: 50 }, side: { enum: ["top", "bottom", "left", "right", "center"] } } } },
    highlightSide: { enum: ["top", "bottom", "left", "right", "none", null] },
    gridColumns: { type: ["integer", "null"], minimum: 1, maximum: 20 },
    gridRows: { type: ["integer", "null"], minimum: 1, maximum: 20 },
    highlightCells: { type: ["integer", "null"], minimum: 0, maximum: 400 },
    degrees: { type: ["integer", "null"], minimum: 1, maximum: 360 },
    angleLabel: { type: ["string", "null"], maxLength: 50 }
  }
};
const aiVerification = { type: "object", additionalProperties: false, required: ["status", "confidence", "warnings"], properties: { status: { enum: ["verified", "needs_review", "unsupported"] }, confidence: { type: "number", minimum: 0, maximum: 1 }, warnings: { type: "array", maxItems: 20, items: { type: "string", maxLength: 500 } } } };

export const aiScenarioOutputJsonSchema: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["status", "verification", "title", "problemClassification", "solutionSteps", "panels", "reason"],
  properties: {
    status: { enum: ["verified", "needs_review", "unsupported"] },
    verification: aiVerification,
    title: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    problemClassification: { enum: [...PROBLEM_CLASSIFICATIONS, null] },
    solutionSteps: {
      type: "array", maxItems: 20,
      items: { type: "object", additionalProperties: false, required: ["id", "explanation", "expression", "result"], properties: { id: { type: "string", minLength: 1, maxLength: 100 }, explanation: { type: "string", minLength: 1, maxLength: 500 }, expression: { type: "string", minLength: 1, maxLength: 100, pattern: NUMERIC_EQUATION_PATTERN }, result: { type: "string", minLength: 1, maxLength: 100 } } }
    },
    panels: {
      type: "array", maxItems: 6,
      items: {
        type: "object", additionalProperties: false,
        required: ["role", "learningPurpose", "scene", "solutionStepId", "dialogueText", "narration", "visualIntent", "formula", "emphasisWords"],
        properties: {
          role: { enum: PANEL_ROLES_FOR_AI },
          learningPurpose: { type: "string", minLength: 1, maxLength: 200 },
          scene: { type: "string", minLength: 1, maxLength: 500 },
          solutionStepId: { type: "string", minLength: 1, maxLength: 100 },
          dialogueText: { type: "string", minLength: 1, maxLength: 500 },
          narration: { type: ["string", "null"], maxLength: 500 },
          visualIntent: aiIntent,
          formula: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 100, pattern: NUMERIC_EQUATION_PATTERN } },
          emphasisWords: { type: "array", maxItems: 20, items: { type: "string", maxLength: 50 } }
        }
      }
    },
    reason: { type: ["string", "null"], minLength: 1, maxLength: 500 }
  }
};

/** シナリオ生成プロンプト。承認済み1問(JSON)を埋め込んで返す。 */
export function buildScenarioPrompt(approved: unknown): string {
  return [
    "Return exactly one JSON object matching the supplied JSON Schema. Generate instructional content only; presentation fields are added by code.",
    "Use this exact six-panel role order: problem, error_location, visualization, solution, check, transfer.",
    "A panel has at most one visualIntent. Allowed intents only: tabular_data, equal_groups, part_whole, scale_marks, compare_quantities, labeled_shape, area_grid, angle_measure. Never emit derived values.",
    "For a visualIntent, fill only fields belonging to its type and set every other intent field to null. A missing visualIntent is null.",
    "For geometry problems use labeled_shape (shape + width/height/radius + shapeUnit + shapeLabels; set highlightSide to the side the student misread, or none) to show the figure, area_grid (gridColumns x gridRows cells + shapeUnit; highlightCells may mark the student's wrong count) to visualize area as unit squares, or angle_measure (degrees + angleLabel) for angle size problems. Classify such problems as geometry.",
    "For verified output: reason is null. For needs_review or unsupported: title and problemClassification are null, solutionSteps and panels are empty arrays, and reason explains why.",
    "Classify by the mathematical operation being taught, not by how givens are displayed. A table_data problem asks the learner to read, complete, or aggregate a table. Merely presenting values in a table does not make it table_data. Questions asking 何倍/how many times or dividing by a reference quantity are quantity_comparison.",
    "All mathematical values inside visualIntent are normalized rationals: {numerator: integer, denominator: positive integer}.",
    "Every solutionSteps.expression and every panels.formula entry must be one numeric equation such as 1.8 / 2.5 = 0.72. Never put variables, Japanese labels, words, or units in these fields. Put explanatory forms such as 赤の倍率 = 赤の長さ ÷ 黄色の長さ in dialogueText or learningPurpose instead.",
    "Allowed numeric operators are +, -, *, /, x, X, ×, and ÷. Do not use inequalities or chained equations.",
    "Write all Japanese text (dialogueText, learningPurpose, scene, narration, title) in vocabulary suitable for elementary school students.",
    `Approved problem: ${JSON.stringify(approved)}`
  ].join("\n");
}
