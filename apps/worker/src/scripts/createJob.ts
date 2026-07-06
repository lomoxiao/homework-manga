/**
 * E2E テスト用 CLI: ローカルの宿題写真から v3 ジョブを作成する(GAS を経由しない)。
 *   npm run job:create --workspace @homework-manga/worker -- <画像パス>
 * 画像は jobs ディレクトリへコピーされ、worker の analysis phase がローカルキャッシュとして使う。
 */
import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { queueKeyOf } from "@homework-manga/contracts/homeworkJob";
import { env } from "../env.js";
import { getDb } from "../services/firebaseAdmin.js";

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath || !existsSync(imagePath)) {
    console.error("Usage: npm run job:create --workspace @homework-manga/worker -- <path-to-image>");
    process.exit(1);
  }
  if (!env.HOMEWORK_OWNER_UID) throw new Error("HOMEWORK_OWNER_UID is not set.");

  const extension = path.extname(imagePath).toLowerCase().replace(".", "") || "jpg";
  if (!["jpg", "jpeg", "png", "webp"].includes(extension)) throw new Error("JPEG / PNG / WebP の画像を指定してください。");

  const jobId = `homework-${randomUUID().replace(/-/g, "")}`;
  const jobDir = path.resolve(env.HOMEWORK_JOBS_DIR, jobId);
  await mkdir(jobDir, { recursive: true });
  await copyFile(imagePath, path.join(jobDir, `source.${extension === "jpeg" ? "jpg" : extension}`));

  const now = new Date().toISOString();
  await getDb().ref(`${env.HOMEWORK_JOBS_PATH}/${jobId}`).set({
    id: jobId,
    ownerUid: env.HOMEWORK_OWNER_UID,
    phase: "analyzing",
    runState: "queued",
    queueKey: queueKeyOf("analyzing", "queued"),
    createdAt: now,
    updatedAt: now
  });
  console.log(`created job: ${jobId}`);
  console.log(`image cached: ${jobDir}`);
  console.log("worker が起動していれば解析が始まります。");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
