import path from "node:path";
import { readdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { HomeworkJobV3 } from "@homework-manga/contracts/homeworkJob";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * 宿題写真を用意する。jobDir にキャッシュ済みならそれを使い(リトライ・後段フェーズ・ローカルテスト)、
 * なければ sourceImage.downloadUrl(Google Drive)から取得して正規化・保存する。
 */
export async function resolveSourceImage(job: HomeworkJobV3, jobDir: string): Promise<string> {
  const cached = (await readdir(jobDir)).find((name) => /^source\.(jpg|jpeg|png|webp)$/i.test(name));
  if (cached) return path.join(jobDir, cached);

  const source = job.sourceImage;
  if (!source) throw new Error("sourceImage がなく、jobDir にも source.* がありません。");
  if (!ALLOWED_MIME.has(source.contentType) || !source.size || source.size > MAX_BYTES) throw new Error("宿題写真の形式またはサイズが不正です。");
  const response = await fetch(source.downloadUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Google Drive画像のダウンロードに失敗しました (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  validateSignature(buffer, source.contentType);
  const normalized = source.contentType === "image/heic" || source.contentType === "image/heif"
    ? { buffer: await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer(), extension: "jpg" }
    : { buffer, extension: source.contentType === "image/png" ? "png" : source.contentType === "image/webp" ? "webp" : "jpg" };
  const imagePath = path.join(jobDir, `source.${normalized.extension}`);
  await writeFile(imagePath, normalized.buffer);
  return imagePath;
}

function validateSignature(buffer: Buffer, mime: string) {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  const heif = buffer.subarray(4, 12).toString().startsWith("ftyp") && /(heic|heix|hevc|hevx|mif1|msf1)/.test(buffer.subarray(8, 16).toString());
  if ((mime === "image/jpeg" && !jpeg) || (mime === "image/png" && !png) || (mime === "image/webp" && !webp) || ((mime === "image/heic" || mime === "image/heif") && !heif)) {
    throw new Error("画像形式と内容が一致しません。");
  }
}
