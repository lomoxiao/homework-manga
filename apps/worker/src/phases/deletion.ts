import path from "node:path";
import { rm } from "node:fs/promises";
import { env } from "../env.js";
import { claimJob, failPhase, jobRef } from "../queue/jobStore.js";
import { deleteDriveFile, driveConfigured } from "../services/googleDrive.js";

/**
 * 削除フェーズ: Drive 画像(設定時)→ローカル jobDir → RTDB ノードの順に消す。
 * 成功するとノードごと消えるため、保護者画面の一覧からも消える。
 */
export async function processDeletionJob(jobId: string): Promise<void> {
  const job = await claimJob(jobId, "deleting");
  if (!job) return;
  console.log(`[deletion] started job=${job.id}`);
  try {
    if (job.sourceImage?.provider === "google_drive") {
      if (driveConfigured()) {
        await deleteDriveFile(job.sourceImage.fileId);
      } else {
        console.warn(`[deletion] Drive OAuth 未設定のため Drive 画像は残ります: fileId=${job.sourceImage.fileId}`);
      }
    }
    await rm(path.resolve(env.HOMEWORK_JOBS_DIR, job.id), { recursive: true, force: true });
    await jobRef(job.id).remove();
    console.log(`[deletion] completed job=${job.id}`);
  } catch (error) {
    await failPhase(job, "INTERNAL_ERROR", error);
  }
}
