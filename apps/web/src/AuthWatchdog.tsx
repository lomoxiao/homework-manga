import { useEffect, useState } from "preact/hooks";
import { requestAuthRecovery } from "./services/authRecovery";

// IndexedDB破損時はonAuthStateChangedが一切発火しないため、時間経過でしか検知できない
const AUTH_WATCHDOG_TIMEOUT_MS = 8000;

/** auth解決待ち(pending)が続いたらtrueを返す。 */
export function useAuthWatchdog(pending: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!pending) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), AUTH_WATCHDOG_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);
  return timedOut;
}

export function AuthRecoveryScreen({ kids = false }: { kids?: boolean }) {
  return (
    <section class={`card auth-screen${kids ? " kids-card" : ""}`}>
      <h2>{kids ? "うまく つながらないよ" : "接続に時間がかかっています"}</h2>
      <p>
        {kids
          ? "おうちの人と いっしょに したのボタンを おしてね。"
          : "サインイン処理が完了しません。通信状況に問題がなければ、ブラウザに保存されたセッション記録が壊れている可能性があります。"}
      </p>
      <div class="recovery-actions">
        <button class="primary big" onClick={() => window.location.reload()}>再読み込み</button>
        <button class="big" onClick={requestAuthRecovery}>セッション記録を初期化して再読み込み</button>
      </div>
      <p class="hint">初期化すると再ログインが必要になります。同じサイト上の他アプリ（記事ビューアなど）も再ログインになります。</p>
    </section>
  );
}
