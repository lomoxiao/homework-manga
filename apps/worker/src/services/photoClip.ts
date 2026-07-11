import sharp from "sharp";
import type { HomeworkFigure } from "@homework-manga/contracts/aiAnalysis";
import type { RendererSpec } from "@homework-manga/contracts/mangaPlan";

const CLIP_WIDTH = 480;
const MAX_CLIP_BYTES = 200 * 1024;
const JPEG_QUALITIES = [70, 60, 50] as const;
const CAPTION_MAX = 100;

/**
 * error_location コマに載せる図を選ぶ。
 * 誤答に関係すると解析された図を最優先し、次点は子どもの書き込み → 問題の図。
 */
export function selectPhotoClipFigure(figures: HomeworkFigure[]): HomeworkFigure | undefined {
  return (
    figures.find((figure) => figure.relationToMistake.trim() !== "") ??
    figures.find((figure) => figure.kind === "student_drawing") ??
    figures.find((figure) => figure.kind === "diagram")
  );
}

/** bbox(相対0..1)を画像の絶対pxへ変換する。枠外は画像内にクランプし、退化した領域は undefined。 */
export function bboxToRegion(
  bbox: { x: number; y: number; w: number; h: number },
  image: { width: number; height: number }
): { left: number; top: number; width: number; height: number } | undefined {
  const left = Math.round(Math.min(Math.max(bbox.x, 0), 1) * image.width);
  const top = Math.round(Math.min(Math.max(bbox.y, 0), 1) * image.height);
  const width = Math.min(Math.round(bbox.w * image.width), image.width - left);
  const height = Math.min(Math.round(bbox.h * image.height), image.height - top);
  if (width < 8 || height < 8) return undefined;
  return { left, top, width, height };
}

/**
 * 実写真から figure の範囲を切り抜いて photo_clip spec を作る。
 * 失敗(画像破損・サイズ超過など)は undefined を返し、漫画生成自体は止めない。
 */
export async function buildPhotoClip(input: {
  figures: HomeworkFigure[];
  imagePath: string;
}): Promise<RendererSpec | undefined> {
  const figure = selectPhotoClipFigure(input.figures);
  if (!figure) return undefined;
  try {
    const image = sharp(input.imagePath).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return undefined;
    const region = bboxToRegion(figure.bbox, { width: meta.width, height: meta.height });
    if (!region) return undefined;

    for (const quality of JPEG_QUALITIES) {
      const buffer = await image
        .clone()
        .extract(region)
        .resize({ width: CLIP_WIDTH, withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
      if (buffer.length <= MAX_CLIP_BYTES) {
        return {
          type: "photo_clip",
          position: "center",
          dataUri: `data:image/jpeg;base64,${buffer.toString("base64")}`,
          caption: buildCaption(figure)
        };
      }
    }
    return undefined;
  } catch (error) {
    console.warn(`[photoClip] 切り抜きに失敗したためスキップします: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function buildCaption(figure: HomeworkFigure): string {
  const text = figure.relationToMistake.trim() || figure.description;
  return text.length > CAPTION_MAX ? `${text.slice(0, CAPTION_MAX - 1)}…` : text;
}
