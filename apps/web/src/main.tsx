import { render } from "preact";
import "./styles.css";
import { runAuthRecoveryIfRequested } from "./services/authRecovery";

const root = document.querySelector("#app");
if (!root) throw new Error("#app was not found");

// Appの静的import連鎖にfirebase初期化(モジュール評価時)が含まれるため、
// 破損IndexedDBの削除が終わるまで動的importで読み込みを遅らせる
void runAuthRecoveryIfRequested()
  .then(() => import("./App"))
  .then(({ App }) => render(<App />, root));
