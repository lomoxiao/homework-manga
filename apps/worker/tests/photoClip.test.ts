import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { HomeworkFigure } from "@homework-manga/contracts/aiAnalysis";
import { rendererSpecSchema } from "@homework-manga/contracts/mangaPlan";
import { bboxToRegion, buildPhotoClip, selectPhotoClipFigure } from "../src/services/photoClip";

const figure = (overrides: Partial<HomeworkFigure> = {}): HomeworkFigure => ({
  kind: "diagram",
  description: "長方形の図",
  labels: ["4cm", "6cm"],
  bbox: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
  relationToMistake: "",
  ...overrides
});

describe("selectPhotoClipFigure", () => {
  it("誤答に関係する図を最優先する", () => {
    const related = figure({ kind: "illustration", relationToMistake: "きょりと道のりを混同" });
    expect(selectPhotoClipFigure([figure({ kind: "student_drawing" }), related])).toBe(related);
  });
  it("関係図が無ければ student_drawing → diagram の順", () => {
    const drawing = figure({ kind: "student_drawing" });
    const diagram = figure({ kind: "diagram" });
    expect(selectPhotoClipFigure([diagram, drawing])).toBe(drawing);
    expect(selectPhotoClipFigure([figure({ kind: "illustration" }), diagram])).toBe(diagram);
  });
  it("候補が無ければ undefined", () => {
    expect(selectPhotoClipFigure([])).toBeUndefined();
    expect(selectPhotoClipFigure([figure({ kind: "illustration" }), figure({ kind: "graph" })])).toBeUndefined();
  });
});

describe("bboxToRegion", () => {
  const image = { width: 800, height: 600 };
  it("相対bboxを絶対pxへ変換する", () => {
    expect(bboxToRegion({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, image)).toEqual({ left: 200, top: 150, width: 400, height: 300 });
  });
  it("画像外へはみ出す範囲は画像内へクランプする", () => {
    expect(bboxToRegion({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, image)).toEqual({ left: 720, top: 540, width: 80, height: 60 });
    expect(bboxToRegion({ x: -0.2, y: 0, w: 0.5, h: 0.5 }, image)).toEqual({ left: 0, top: 0, width: 400, height: 300 });
  });
  it("退化した範囲(8px未満)は undefined", () => {
    expect(bboxToRegion({ x: 0.5, y: 0.5, w: 0.001, h: 0.5 }, image)).toBeUndefined();
    expect(bboxToRegion({ x: 1, y: 0, w: 0.5, h: 0.5 }, image)).toBeUndefined();
  });
});

describe("buildPhotoClip", () => {
  it("実画像から切り抜いて 200KB 以下の jpeg data URI を返す", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "photo-clip-"));
    const imagePath = path.join(dir, "source.jpg");
    await writeFile(imagePath, await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 240, g: 230, b: 210 } } }).jpeg().toBuffer());

    const spec = await buildPhotoClip({ figures: [figure({ relationToMistake: "縦4cmを横として式に使っている" })], imagePath });
    expect(spec).toBeDefined();
    expect(spec).toMatchObject({ type: "photo_clip", position: "center", caption: "縦4cmを横として式に使っている" });
    if (spec?.type !== "photo_clip") throw new Error("unreachable");
    expect(spec.dataUri.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(spec.dataUri.length).toBeLessThanOrEqual(300_000);
    expect(rendererSpecSchema.safeParse(spec).success).toBe(true);

    // 切り抜き結果が bbox 相当のサイズ(幅600→480へ縮小)であること
    const clipped = sharp(Buffer.from(spec.dataUri.slice("data:image/jpeg;base64,".length), "base64"));
    const meta = await clipped.metadata();
    expect(meta.width).toBe(480);
  });

  it("caption は 100 字に切り詰める", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "photo-clip-"));
    const imagePath = path.join(dir, "source.jpg");
    await writeFile(imagePath, await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } } }).jpeg().toBuffer());

    const spec = await buildPhotoClip({ figures: [figure({ relationToMistake: "あ".repeat(200) })], imagePath });
    if (spec?.type !== "photo_clip") throw new Error("photo_clip が生成されるはず");
    expect(spec.caption).toHaveLength(100);
    expect(spec.caption.endsWith("…")).toBe(true);
  });

  it("画像が読めない場合は undefined(throw しない)", async () => {
    const spec = await buildPhotoClip({ figures: [figure({ relationToMistake: "x" })], imagePath: path.join(tmpdir(), "missing-photo-clip.jpg") });
    expect(spec).toBeUndefined();
  });
});
