import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import "../env.js";

let cachedDb: Database | undefined;

/**
 * Firebase Admin を遅延初期化して Realtime Database ハンドルを返す。
 * Admin 資格情報はセキュリティルールをバイパスするため、DB がロックモードでも読み書きできる。
 *  - FIREBASE_SERVICE_ACCOUNT_JSON : インライン JSON(CI シークレット)
 *  - FIREBASE_SERVICE_ACCOUNT_PATH : 鍵ファイルパス(ローカル)
 */
export function getDb(): Database {
  if (cachedDb) return cachedDb;
  const databaseURL = requireEnv("FIREBASE_DATABASE_URL");
  const serviceAccount = loadServiceAccount();
  const app: App = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount), databaseURL });
  cachedDb = getDatabase(app);
  return cachedDb;
}

// firebase-admin の cert() は snake_case の Google 鍵オブジェクトを実行時に受け付ける
// (ドキュメント記載の cert(require('key.json')) パターン)ため any で扱う。
function loadServiceAccount(): any {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(error as Error).message}`);
    }
  }
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!keyPath) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON (inline) or FIREBASE_SERVICE_ACCOUNT_PATH (file).");
  if (!existsSync(keyPath)) throw new Error(`Service account file not found: ${keyPath}`);
  try {
    return JSON.parse(readFileSync(keyPath, "utf8"));
  } catch (error) {
    throw new Error(`Service account file is not valid JSON: ${keyPath} (${(error as Error).message})`);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}
