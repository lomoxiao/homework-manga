const RECOVERY_FLAG_KEY = "hmAuthRecoveryRequested";
// Firebase SDKが作るIndexedDB。firebaseLocalStorageDbが破損するとauth初期化が
// 完了せずonAuthStateChangedが発火しなくなる（multimodal-article-viewerで実績）ため、
// 復旧時はこれらごと削除する。
const FIREBASE_INDEXED_DB_NAMES = ["firebaseLocalStorageDb", "firebase-heartbeat-database"];

/** 復旧フラグを立てて再読み込みする。削除自体は次回起動時のrunAuthRecoveryIfRequestedが行う。 */
export function requestAuthRecovery(): void {
  try {
    window.sessionStorage.setItem(RECOVERY_FLAG_KEY, "1");
  } catch {
    // sessionStorage不可時はフラグなし再読み込みにフォールバック
  }
  window.location.reload();
}

function consumeRecoveryFlag(): boolean {
  try {
    if (window.sessionStorage.getItem(RECOVERY_FLAG_KEY) !== "1") return false;
    window.sessionStorage.removeItem(RECOVERY_FLAG_KEY);
    return true;
  } catch {
    return false;
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.deleteDatabase(name);
    } catch {
      resolve();
      return;
    }
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

/** firebaseモジュールの読み込み前に呼ぶこと（自アプリの接続が削除のブロック要因になるため）。 */
export async function runAuthRecoveryIfRequested(): Promise<void> {
  if (!consumeRecoveryFlag() || !window.indexedDB) return;
  // 破損したIndexedDBでは削除要求も返らないことがあるため待ち時間に上限を設ける
  await Promise.race([
    Promise.all(FIREBASE_INDEXED_DB_NAMES.map(deleteDatabase)),
    new Promise<void>((resolve) => window.setTimeout(resolve, 3000))
  ]);
}
