import { existsSync, readFileSync } from "node:fs";
import { env } from "../env.js";

/**
 * Google Drive ファイル削除(REST + OAuth リフレッシュトークン)。
 * googleapis 依存を持ち込まず、削除に必要な最小限だけ実装する。
 */
export function driveConfigured(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CREDENTIALS && env.GOOGLE_OAUTH_TOKEN && existsSync(env.GOOGLE_OAUTH_CREDENTIALS) && existsSync(env.GOOGLE_OAUTH_TOKEN));
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.ok || response.status === 404) return;
  throw new Error(`Drive delete failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
}

async function getAccessToken(): Promise<string> {
  if (!driveConfigured()) throw new Error("GOOGLE_OAUTH_CREDENTIALS / GOOGLE_OAUTH_TOKEN が未設定です。");
  const credentials = JSON.parse(readFileSync(env.GOOGLE_OAUTH_CREDENTIALS!, "utf8")) as { installed?: { client_id: string; client_secret: string }; web?: { client_id: string; client_secret: string } };
  const client = credentials.installed ?? credentials.web;
  if (!client) throw new Error("OAuth credentials に installed/web がありません。");
  const token = JSON.parse(readFileSync(env.GOOGLE_OAUTH_TOKEN!, "utf8")) as { refresh_token?: string };
  if (!token.refresh_token) throw new Error("OAuth token に refresh_token がありません。");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`OAuth token refresh failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("OAuth token refresh returned no access_token.");
  return data.access_token;
}
