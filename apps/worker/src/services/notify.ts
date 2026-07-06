import { env } from "../env.js";

/**
 * Slack 通知(任意)。宿題専用 Slack アプリの bot token が未設定なら何もしない。
 * 通知失敗はログに残すが処理は止めない(通知は副次的機能)。
 */
export async function notifySlack(text: string): Promise<void> {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_HOMEWORK_CHANNEL_ID) return;
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
      body: JSON.stringify({ channel: env.SLACK_HOMEWORK_CHANNEL_ID, text })
    });
    const result = (await response.json()) as { ok: boolean; error?: string };
    if (!result.ok) console.error(`[worker] Slack notify failed: ${result.error}`);
  } catch (error) {
    console.error("[worker] Slack notify failed", error);
  }
}

export function reviewUrl(jobId: string): string {
  return env.HOMEWORK_REVIEW_BASE_URL ? `${env.HOMEWORK_REVIEW_BASE_URL}?job=${encodeURIComponent(jobId)}` : jobId;
}
