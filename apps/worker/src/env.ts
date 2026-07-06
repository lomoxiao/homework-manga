import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  FIREBASE_DATABASE_URL: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  HOMEWORK_OWNER_UID: z.string().optional(),
  /** v3 ジョブのルートパス。旧 /homeworkJobs とは分離する。 */
  HOMEWORK_JOBS_PATH: z.string().default("/homeworkJobsV3"),
  HOMEWORK_JOBS_DIR: z.string().default("./jobs/homework"),
  HOMEWORK_REVIEW_BASE_URL: z.string().url().optional(),
  HOMEWORK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  /** 宿題専用 Slack アプリの bot token(通知のみ・任意)。article 側とアプリを共有しないこと。 */
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_HOMEWORK_CHANNEL_ID: z.string().optional(),
  CODEX_CLI_COMMAND: z.string().default("codex").refine(
    (value) => !value.toLowerCase().includes("\\windowsapps\\"),
    { message: "CODEX_CLI_COMMAND must not point to a WindowsApps path. Set the full path to the user-installed codex.exe." }
  ),
  CODEX_RUNNER_HOME: z.string().default("./.codex-runner-home"),
  CODEX_SOURCE_HOME: z.string().optional(),
  CODEX_MODEL: z.string().default("gpt-5.5"),
  CODEX_EXEC_SANDBOX: z.enum(["read-only", "workspace-write", "danger-full-access"]).default("workspace-write"),
  CODEX_EXEC_TIMEOUT_MS: z.coerce.number().int().positive().default(900_000),
  /** 故障注入: json_broken | five_panels | math_wrong。リトライ→フォールバック経路の定期確認用。 */
  HOMEWORK_FAULT: z.enum(["json_broken", "five_panels", "math_wrong"]).optional(),
  /** 削除フェーズで Drive 画像も消す場合に設定(未設定なら RTDB ノードのみ削除)。 */
  GOOGLE_OAUTH_CREDENTIALS: z.string().optional(),
  GOOGLE_OAUTH_TOKEN: z.string().optional()
});

export const env = envSchema.parse(process.env);

function loadDotEnv() {
  applyEnvFile(".env");
  applyEnvFile(join(homedir(), ".content-extractor", ".env"));
}

function applyEnvFile(envPath: string) {
  try {
    if (!existsSync(envPath)) return;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env は任意。デプロイ環境では環境変数を直接注入する。
  }
}
