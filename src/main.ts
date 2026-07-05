import "./styles.css";
import rawSamplePlan from "../samples/manga_plan.json";
import rawRenderConfig from "../samples/final_render_config.json";
import { homeworkDraftSchema, mangaPlanSchema, renderConfigSchema, type MangaPanel, type VisualAid, type WorkspaceState } from "./schema";
import { generateScenario } from "./scenarioGenerator";
import { createWorkspace, loadWorkspace, saveWorkspace, WORKSPACE_KEY } from "./workspace";
import { renderSafeVisualAid } from "./svg/visualAid";
import { emphasize, escapeHtml } from "./utils";
import { approveHomeworkJob, firebaseConfigured, getFirebaseIdToken, loginWithGoogle, observeAuth, observeHomeworkJob, requestHomeworkDeletion, type RemoteHomeworkJob } from "./firebaseClient";
import { homeworkGasConfigured, uploadHomeworkToGas } from "./homeworkGasClient";
import { blobToBase64, prepareHomeworkImage } from "./upload";
import rawAssetCatalog from "../public/assets/metadata.json";
import { assetCatalogSchema } from "./assets";
import { normalizeRemoteAnalysis } from "./remoteAnalysis";
import { remoteJobProgress } from "./remoteJobStatus";
import { resolveDriveDisplayUrl } from "./driveImage";

const app = document.querySelector<HTMLElement>("#app")!;
if (!app) throw new Error("#app was not found");

const samplePlan = mangaPlanSchema.parse(rawSamplePlan);
const renderConfig = renderConfigSchema.parse(rawRenderConfig);
const assetCatalog = assetCatalogSchema.parse(rawAssetCatalog).assets;
let state: WorkspaceState = loadWorkspace(localStorage) ?? createWorkspace(samplePlan);
let photoUrl: string | null = null;
let photoName = "";
let selectedPanel = 1;
let formErrors: Record<string, string> = {};
let scenarioWarning = "";
let activeRemoteJobId = "";
let selectedRemoteProblemIndex = 0;
let remoteSelectionConfirmed = false;

document.documentElement.style.setProperty("--primary", renderConfig.theme.primaryColor);
document.documentElement.style.setProperty("--emphasis", renderConfig.theme.emphasisColor);
document.documentElement.style.setProperty("--font-family", renderConfig.theme.fontFamily);

const remoteJobId = new URLSearchParams(window.location.search).get("job");
if (remoteJobId) startRemoteMode(remoteJobId);
else if (firebaseConfigured && homeworkGasConfigured) startWebUploadMode();
else render();

function startWebUploadMode(): void {
  observeAuth((user) => {
    if (!user) {
      app.innerHTML = '<section class="workflow-card auth-screen"><h2>&#23487;&#38988;&#20889;&#30495;&#12434;&#36865;&#12427;</h2><p>&#35377;&#21487;&#12373;&#12428;&#12383;Google&#12450;&#12459;&#12454;&#12531;&#12488;&#12391;&#12525;&#12464;&#12452;&#12531;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;&#12290;</p><button id="google-login" class="primary">Google&#12391;&#12525;&#12464;&#12452;&#12531;</button></section>';
      document.querySelector("#google-login")?.addEventListener("click", () => void loginWithGoogle());
      return;
    }
    app.innerHTML = '<section class="workflow-card upload-screen"><header class="section-heading"><p>NEW HOMEWORK</p><h2>&#23487;&#38988;&#20889;&#30495;&#12434;&#36865;&#12427;</h2><span>&#20889;&#30495;&#12399;Google Drive&#12408;&#20445;&#23384;&#12375;&#12289;&#35299;&#26512;&#29366;&#27841;&#12399;&#12371;&#12398;&#30011;&#38754;&#12391;&#30906;&#35469;&#12391;&#12365;&#12414;&#12377;&#12290;</span></header><form id="web-upload-form"><label class="drop-zone"><input id="web-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" /><b>&#8593;</b><strong>&#25774;&#24433;&#12414;&#12383;&#12399;&#20889;&#30495;&#12434;&#36984;&#25246;</strong><span>&#36865;&#20449;&#26178;&#12395;&#33258;&#21205;&#22311;&#32302;&#12539;5MB&#12414;&#12391;</span></label><div id="web-photo-preview"></div><p id="upload-error" class="warning" hidden></p><button id="upload-submit" class="primary" type="submit" disabled>&#35299;&#26512;&#12434;&#38283;&#22987;</button></form></section>';
    let selectedFile: File | undefined;
    const input = document.querySelector<HTMLInputElement>("#web-photo-input")!;
    const submit = document.querySelector<HTMLButtonElement>("#upload-submit")!;
    input.addEventListener("change", () => {
      selectedFile = input.files?.[0];
      submit.disabled = !selectedFile;
      const preview = document.querySelector<HTMLElement>("#web-photo-preview")!;
      preview.innerHTML = selectedFile ? '<img src="' + URL.createObjectURL(selectedFile) + '" alt="homework preview" />' : "";
    });
    document.querySelector<HTMLFormElement>("#web-upload-form")!.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedFile) return;
      const error = document.querySelector<HTMLElement>("#upload-error")!;
      try {
        submit.disabled = true; submit.textContent = "Preparing image..."; error.hidden = true;
        const prepared = await prepareHomeworkImage(selectedFile);
        submit.textContent = "Uploading to Drive...";
        const result = await uploadHomeworkToGas({ idToken: await getFirebaseIdToken(), base64: await blobToBase64(prepared.blob), fileName: prepared.fileName, contentType: prepared.blob.type });
        window.location.assign("?job=" + encodeURIComponent(result.jobId));
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause); error.hidden = false;
        submit.disabled = false; submit.textContent = "Retry upload";
      }
    });
  });
}

function startRemoteMode(jobId: string): void {
  if (!firebaseConfigured) {
    app.innerHTML = `<section class="workflow-card"><h2>Firebase設定が必要です</h2><p>VITE_FIREBASE_* を設定して再ビルドしてください。</p></section>`;
    return;
  }
  observeAuth((user) => {
    if (!user) {
      app.innerHTML = `<section class="workflow-card auth-screen"><h2>宿題を確認する</h2><p>許可されたGoogleアカウントでログインしてください。</p><button id="google-login" class="primary">Googleでログイン</button></section>`;
      document.querySelector("#google-login")?.addEventListener("click", () => loginWithGoogle());
      return;
    }
    observeHomeworkJob(jobId, (job) => renderRemoteJob(jobId, user.uid, job));
  });
}

async function renderRemoteJob(jobId: string, uid: string, job: RemoteHomeworkJob | null): Promise<void> {
  if (!job) { app.innerHTML = `<section class="workflow-card"><h2>宿題が見つかりません</h2><p>削除済みか、URLが正しくありません。</p></section>`; return; }
  if (job.ownerUid !== uid) { app.innerHTML = `<section class="workflow-card"><h2>アクセスできません</h2><p>この宿題の所有者ではありません。</p></section>`; return; }
  if (job.status === "delete_requested" || job.status === "deleting") { app.innerHTML = `<section class="workflow-card progress-screen"><div class="spinner"></div><h2>削除を処理しています</h2><p>Botが起動すると、Google Drive画像とジョブを削除します。この画面は閉じて構いません。</p></section>`; return; }
  if (job.status === "scenario_review_required" && job.mangaPlan) {
    const parsedPlan = mangaPlanSchema.safeParse(job.mangaPlan);
    if (!parsedPlan.success) { app.innerHTML = `<section class="workflow-card"><h2>Invalid scenario format</h2><p class="warning">Regenerate this scenario.</p></section>`; return; }
    const approved = homeworkDraftSchema.parse(job.approvedAnalysis);
    state = saveWorkspace(localStorage, { ...createWorkspace(parsedPlan.data), step: "scenario", draft: approved, mangaPlan: parsedPlan.data });
    history.replaceState({}, "", location.pathname); render(); return;
  }
  if (["scenario_queued", "scenario_generating", "scenario_validating"].includes(job.status)) {
    const progress = remoteJobProgress(job.status);
    app.innerHTML = `<section class="workflow-card progress-screen"><div class="spinner"></div><h2>${escapeHtml(progress.title)}</h2><p>${escapeHtml(progress.detail)}</p></section>`; return;
  }
  if (job.status === "unsupported" || job.status === "needs_review") {
    app.innerHTML = `<section class="workflow-card"><h2>Automatic generation stopped</h2><p class="warning">${escapeHtml(job.error ?? "The problem could not be verified safely.")}</p></section>`; return;
  }
  if (job.status === "failed") { app.innerHTML = `<section class="workflow-card"><h2>Processing failed</h2><p class="warning">${escapeHtml(job.error ?? "Unknown error")}</p><p>Submit the homework again to create a new job.</p></section>`; return; }
  if (!job.analysis) { const progress = remoteJobProgress(job.status); app.innerHTML = `<section class="workflow-card progress-screen"><div class="spinner"></div><h2>${escapeHtml(progress.title)}</h2><p>${escapeHtml(progress.detail)}</p></section>`; return; }
  const analysis = normalizeRemoteAnalysis(job.analysis);
  if (activeRemoteJobId !== job.id) {
    activeRemoteJobId = job.id;
    selectedRemoteProblemIndex = 0;
    remoteSelectionConfirmed = analysis.problems.length === 1;
  }
  if (selectedRemoteProblemIndex >= analysis.problems.length) selectedRemoteProblemIndex = 0;
  const selectedProblem = analysis.problems[selectedRemoteProblemIndex];
  const source = job.sourceImage?.provider === "google_drive" ? job.sourceImage : undefined;
  const displayUrl = source ? resolveDriveDisplayUrl(source) : undefined;
  const imageMarkup = source && displayUrl
    ? `<img id="homework-source-image" src="${escapeHtml(displayUrl)}" alt="宿題写真" referrerpolicy="no-referrer" /><p id="drive-image-fallback" class="warning" hidden>画像を直接表示できません。<a href="${escapeHtml(source.viewUrl)}" target="_blank" rel="noreferrer">Google Driveで開く</a></p><p class="privacy-note">この画像はリンクを知っている人が閲覧できます。削除処理が完了するまで公開リンクは有効です。</p>`
    : source ? `<p class="warning">&#30011;&#20687;&#12434;&#30452;&#25509;&#34920;&#31034;&#12391;&#12365;&#12414;&#12379;&#12435;&#12290;<a href="${escapeHtml(source.viewUrl)}" target="_blank" rel="noreferrer">Google Drive&#12391;&#38283;&#12367;</a></p>` : `<p class="warning">Drive画像情報がありません。</p>`;
  const deletionError = job.status === "delete_failed" ? `<p class="warning">前回の削除に失敗しました: ${escapeHtml(job.error ?? "原因不明")}</p>` : "";
  const candidates = analysis.problems.length > 1 ? `<section class="problem-picker"><h3>漫画にする問題を選択</h3><p>候補を確認し、1問をクリックしてください。</p><div class="problem-candidates">${analysis.problems.map((problem, index) => `<button type="button" class="problem-candidate ${index === selectedRemoteProblemIndex ? "selected" : ""}" data-remote-problem="${index}" aria-pressed="${index === selectedRemoteProblemIndex}"><b>${escapeHtml(problem.id)}</b><span>${escapeHtml(problem.problemText)}</span><small>誤答: ${escapeHtml(problem.studentAnswer)}</small></button>`).join("")}</div></section>` : "";
  const warnings = [...analysis.warnings, ...selectedProblem.warnings];
  app.innerHTML = `<section class="workflow-card"><header class="section-heading"><p>HOMEWORK JOB</p><h2>解析結果を確認</h2><span>内容を修正してから漫画シナリオへ進んでください。</span></header>${candidates}<div class="review-layout"><div class="photo-review">${imageMarkup}</div><form id="remote-review" class="draft-form"><div class="manual-badge">選択中: ${escapeHtml(selectedProblem.id)}</div>${remoteField("problemText", "問題文", selectedProblem.problemText, selectedProblem.confidence.problemText)}${remoteField("studentAnswer", "子どもの答え", selectedProblem.studentAnswer, selectedProblem.confidence.studentAnswer)}${remoteField("correctAnswer", "正しい答え候補", selectedProblem.correctAnswerCandidate, selectedProblem.confidence.correctAnswerCandidate)}${remoteField("mistakeCause", "つまずきの原因", selectedProblem.mistakeCause, selectedProblem.confidence.mistakeCause)}${warnings.length ? `<p class="warning">${warnings.map(escapeHtml).join("<br>")}</p>` : ""}${deletionError}<div class="actions split"><button id="delete-remote" type="button">${job.status === "delete_failed" ? "削除を再試行" : "この宿題を削除"}</button><button class="primary" type="submit" ${remoteSelectionConfirmed ? "" : "disabled"}>承認してシナリオへ</button></div>${remoteSelectionConfirmed ? "" : `<p class="selection-required">候補を1つクリックすると承認できます。</p>`}</form></div></section>`;
  document.querySelectorAll<HTMLButtonElement>("[data-remote-problem]").forEach((button) => button.addEventListener("click", () => {
    selectedRemoteProblemIndex = Number(button.dataset.remoteProblem ?? 0);
    remoteSelectionConfirmed = true;
    void renderRemoteJob(jobId, uid, job);
  }));
  document.querySelector<HTMLImageElement>("#homework-source-image")?.addEventListener("error", (event) => {
    (event.currentTarget as HTMLImageElement).hidden = true;
    const fallback = document.querySelector<HTMLElement>("#drive-image-fallback");
    if (fallback) fallback.hidden = false;
  });
  document.querySelector<HTMLFormElement>("#remote-review")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const draft = { grade: 4, subject: "math" as const, problemText: String(data.get("problemText")), studentAnswer: String(data.get("studentAnswer")), correctAnswer: String(data.get("correctAnswer")), mistakeCause: String(data.get("mistakeCause")) };
    const parsed = homeworkDraftSchema.parse(draft);
    await approveHomeworkJob(jobId, selectedProblem.id, parsed);
  });
  document.querySelector("#delete-remote")?.addEventListener("click", async () => {
    if (!window.confirm("Google Driveの宿題写真とFirebaseの解析結果・漫画データを削除しますか？")) return;
    await requestHomeworkDeletion(job.id);
    app.innerHTML = `<section class="workflow-card progress-screen"><div class="spinner"></div><h2>削除を受け付けました</h2><p>Botが起動中なら、Google Drive画像とジョブを順に削除します。</p></section>`;
  });
}

function remoteField(name: string, label: string, value: string, confidence = 0): string {
  const low = confidence < 0.75 ? " low-confidence" : "";
  return `<label class="field${low}">${label}<span class="confidence">信頼度 ${Math.round(confidence * 100)}%</span><textarea name="${name}" rows="3">${escapeHtml(value)}</textarea></label>`;
}

function render(): void {
  renderToolbar();
  app.innerHTML = `
    <nav class="steps" aria-label="作成手順">
      ${stepButton("input", "1", "写真を入力")}
      ${stepButton("analysis", "2", "内容を確認")}
      ${stepButton("scenario", "3", "シナリオを確認")}
      ${stepButton("preview", "4", "漫画プレビュー")}
    </nav>
    ${state.step === "input" ? renderInput() : ""}
    ${state.step === "analysis" ? renderAnalysis() : ""}
    ${state.step === "scenario" ? renderScenario() : ""}
    ${state.step === "preview" ? renderPreview() : ""}`;
  bindEvents();
}

function renderToolbar(): void {
  const status = document.querySelector<HTMLElement>("#save-status");
  if (status) status.textContent = "作業データは端末内に保存";
  const reset = document.querySelector<HTMLButtonElement>("#reset-dialogue");
  if (reset) { reset.textContent = "最初から"; reset.onclick = resetWorkspace; }
  const print = document.querySelector<HTMLButtonElement>("#print-page");
  if (print) {
    print.hidden = state.step !== "preview";
    print.onclick = () => window.print();
  }
}

function stepButton(step: WorkspaceState["step"], number: string, label: string): string {
  const order = ["input", "analysis", "scenario", "preview"];
  const current = order.indexOf(state.step);
  const index = order.indexOf(step);
  const className = index === current ? "active" : index < current ? "done" : "";
  return `<div class="step ${className}"><span>${index < current ? "✓" : number}</span>${label}</div>`;
}

function renderInput(): string {
  return `<section class="workflow-card input-screen">
    <header class="section-heading"><p>STEP 1</p><h2>宿題の写真を入力</h2><span>写真は外部へ送信せず、この画面だけで表示します。</span></header>
    <div class="input-layout">
      <div>
        <label id="drop-zone" class="drop-zone ${photoUrl ? "has-photo" : ""}">
          <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" />
          ${photoUrl ? `<img src="${photoUrl}" alt="選択した宿題写真" /><strong>${escapeHtml(photoName)}</strong><span>クリックして変更</span>` : `<b>↑</b><strong>宿題の写真をアップロード</strong><span>JPEG / PNG / WebP、10MBまで</span>`}
        </label>
        ${errorHtml("photo")}
        <aside class="privacy-note"><b>プライバシー確認</b><span>氏名、学校名、顔が写っていない写真を使用してください。写真は保存されません。</span></aside>
      </div>
      <form id="draft-form" class="draft-form">
        <div class="field-row"><label>学年<select name="grade">${[1,2,3,4,5,6].map((n) => `<option value="${n}" ${state.draft.grade === n ? "selected" : ""}>小学${n}年</option>`).join("")}</select></label><label>教科<select disabled><option>算数</option></select></label></div>
        ${field("problemText", "問題文", state.draft.problemText, true)}
        ${field("studentAnswer", "子どもの答え", state.draft.studentAnswer)}
        ${field("correctAnswer", "正しい答え", state.draft.correctAnswer)}
        <div class="actions"><button class="primary" type="submit">内容を確認する →</button></div>
      </form>
    </div>
  </section>`;
}

function renderAnalysis(): string {
  return `<section class="workflow-card">
    <header class="section-heading"><p>STEP 2</p><h2>問題とつまずきを確認</h2><span>自動解析前のMVPです。内容を確認して必要なら修正してください。</span></header>
    <div class="review-layout">
      <div class="photo-review">${photoUrl ? `<img src="${photoUrl}" alt="宿題写真" />` : `<div class="photo-missing">写真は保存されていません<br><button data-action="back-input" type="button">写真を再選択</button></div>`}</div>
      <form id="analysis-form" class="draft-form">
        <div class="manual-badge">手入力内容</div>
        ${field("problemText", "問題文", state.draft.problemText, true)}
        ${field("studentAnswer", "子どもの答え", state.draft.studentAnswer)}
        ${field("correctAnswer", "正しい答え", state.draft.correctAnswer)}
        ${field("mistakeCause", "つまずきの原因", state.draft.mistakeCause, true)}
        ${state.draft.studentAnswer.trim() === state.draft.correctAnswer.trim() ? `<p class="warning">誤答と正答が同じです。内容を確認してください。</p>` : ""}
        <div class="actions split"><button data-action="back-input" type="button">← 戻る</button><button class="primary" type="submit">シナリオを作る →</button></div>
      </form>
    </div>
  </section>`;
}

function renderScenario(): string {
  if (!state.mangaPlan) return `<section class="workflow-card"><p>シナリオがありません。</p></section>`;
  const panel = state.mangaPlan.panels[selectedPanel - 1];
  return `<section class="workflow-card scenario-screen">
    <header class="section-heading"><p>STEP 3</p><h2>6コマのシナリオを確認</h2><span>各コマを選択し、学習目的やセリフを編集できます。</span></header>
    ${scenarioWarning ? `<p class="warning">${escapeHtml(scenarioWarning)}</p>` : ""}
    <div class="scenario-layout">
      <div class="panel-cards">${state.mangaPlan.panels.map((item) => renderPanelCard(item)).join("")}</div>
      <form id="panel-form" class="inspector">
        <div class="inspector-title"><h3>選択中のコマ</h3><span>コマ ${panel.panelNumber}</span></div>
        ${field("learningPurpose", "学習目的", panel.learningPurpose)}
        ${field("scene", "場面", panel.scene, true)}
        ${field("dialogue", "セリフ", panel.dialogue[0]?.text ?? "", true)}
        ${field("narration", "ナレーション", panel.narration ?? "", true)}
        ${field("formula", "式（1行に1つ）", panel.formula.join("\n"), true)}
        <label class="field">キャラクター<select name="character"><option value="hero" ${panel.characters[0] === "hero" ? "selected" : ""}>ハル</option><option value="teacher" ${panel.characters[0] === "teacher" ? "selected" : ""}>先生</option></select></label>
        <label class="field">表情<select name="expression">${["confused","calm","focused","discovery","smile","happy"].map((value) => `<option value="${value}" ${Object.values(panel.characterExpression)[0] === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        ${renderVisualAidEditor(panel.visualAid)}
        <button class="save-panel" type="submit">このコマを保存</button>
      </form>
    </div>
    <div class="actions split"><button data-action="back-analysis" type="button">← 内容確認へ</button><button data-action="preview" class="primary" type="button">漫画をプレビュー →</button></div>
  </section>`;
}

function renderVisualAidEditor(aid: VisualAid | null): string {
  if (!aid) return "";
  if (aid.type !== "bar_model") return `<p class="manual-badge">Visual: ${escapeHtml(aid.type)} (generated from a verified specification)</p>`;
  const invalid = aid.total / aid.groups !== aid.perGroup;
  return `<fieldset><legend>Bar model</legend><div class="field-row">${numberField("total", "Total", aid.total)}${numberField("groups", "Groups", aid.groups)}${numberField("perGroup", "Each", aid.perGroup)}</div>${invalid ? '<p class="warning">Total / groups must equal each.</p>' : ""}</fieldset>`;
}

function renderPanelCard(panel: MangaPanel): string {
  return `<button class="panel-card ${panel.panelNumber === selectedPanel ? "selected" : ""}" data-panel="${panel.panelNumber}" type="button"><span>${panel.panelNumber}</span><b>${escapeHtml(panel.learningPurpose)}</b><p>${escapeHtml(panel.dialogue[0]?.text ?? "")}</p>${panel.formula.length ? `<strong>${escapeHtml(panel.formula[0])}</strong>` : ""}</button>`;
}

function renderPreview(): string {
  if (!state.mangaPlan) return "";
  return `<section class="preview-screen">
    <aside class="usage-note"><strong>最終確認</strong>吹き出しを直接編集できます。印刷ボタンからA4 PDFとして保存できます。</aside>
    ${renderManga(state.mangaPlan)}
    <div class="actions preview-actions"><button data-action="back-scenario" type="button">← シナリオ編集へ</button><button data-action="print" class="primary" type="button">PDF / 印刷</button></div>
  </section>`;
}

function renderManga(plan: NonNullable<WorkspaceState["mangaPlan"]>): string {
  return `<article class="manga-page" aria-label="${escapeHtml(plan.title)}"><header class="page-title"><span class="subject-label">算数・文章題</span><h2>${escapeHtml(plan.title)}</h2><p>${emphasize(plan.problem.text, ["同じ数ずつ", "1人分"])}</p></header><div class="panel-grid">${plan.panels.map(renderMangaPanel).join("")}</div><footer class="answer-strip"><span>まちがい</span><s>${escapeHtml(plan.problem.studentAnswer)}</s><b>考え直すと</b><strong>${escapeHtml(plan.problem.correctAnswer)}</strong></footer></article>`;
}

function renderMangaPanel(panel: MangaPanel): string {
  const character = panel.characters[0] ?? "hero";
  const expression = panel.characterExpression[character] ?? "calm";
  const aid = panel.visualAid ? `<div class="visual-aid">${renderSafeVisualAid(panel.visualAid)}</div>` : "";
  const formula = panel.formula.length ? `<div class="formula-block">${panel.formula.map((f) => `<span>${escapeHtml(f)}</span>`).join("")}</div>` : "";
  const selectedAsset = assetCatalog.find((asset) => panel.assetIds.includes(asset.assetId));
  const characterHtml = selectedAsset
    ? `<img class="asset-character" src="${escapeHtml(new URL(selectedAsset.filePath, document.baseURI).href)}" alt="${escapeHtml(character)} ${escapeHtml(expression)}" />`
    : `<div class="dummy-character ${character === "teacher" ? "teacher" : "hero"}"><span class="face">${faceFor(expression)}</span><span class="body"></span></div>`;
  return `<section class="panel panel-${panel.panelNumber} character-${panel.layout.characterSide}"><div class="panel-number">${panel.panelNumber}</div><div class="scene-backdrop backdrop-${escapeHtml(panel.background)}"></div>${characterHtml}<div class="dialogue-stack">${panel.dialogue.map((line, index) => `<div class="speech-bubble" contenteditable="true" data-dialogue="${panel.panelNumber}-${index}">${emphasize(line.text, panel.emphasisWords)}</div>`).join("")}</div>${aid}${formula}${panel.narration ? `<p class="narration">${emphasize(panel.narration, panel.emphasisWords)}</p>` : ""}</section>`;
}

function field(name: string, label: string, value: string, multiline = false): string {
  const control = multiline ? `<textarea name="${name}" rows="3">${escapeHtml(value)}</textarea>` : `<input name="${name}" value="${escapeHtml(value)}" />`;
  return `<label class="field">${label}${control}${errorHtml(name)}</label>`;
}
function numberField(name: string, label: string, value: number): string { return `<label class="field">${label}<input name="${name}" type="number" min="1" value="${value}" /></label>`; }
function errorHtml(name: string): string { return formErrors[name] ? `<small class="field-error">${escapeHtml(formErrors[name])}</small>` : ""; }

function bindEvents(): void {
  document.querySelector<HTMLInputElement>("#photo-input")?.addEventListener("change", (event) => setPhoto((event.currentTarget as HTMLInputElement).files?.[0]));
  const dropZone = document.querySelector<HTMLElement>("#drop-zone");
  dropZone?.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragging"); });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
  dropZone?.addEventListener("drop", (event) => { event.preventDefault(); setPhoto(event.dataTransfer?.files[0]); });
  document.querySelector<HTMLFormElement>("#draft-form")?.addEventListener("submit", submitInput);
  document.querySelector<HTMLFormElement>("#analysis-form")?.addEventListener("submit", submitAnalysis);
  document.querySelector<HTMLFormElement>("#panel-form")?.addEventListener("submit", submitPanel);
  document.querySelectorAll<HTMLElement>("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
  document.querySelectorAll<HTMLElement>("[data-panel]").forEach((button) => button.addEventListener("click", () => { selectedPanel = Number(button.dataset.panel); render(); }));
  document.querySelectorAll<HTMLElement>("[data-dialogue]").forEach((bubble) => bubble.addEventListener("input", () => updatePreviewDialogue(bubble)));
}

function submitInput(event: SubmitEvent): void {
  event.preventDefault();
  updateDraft(new FormData(event.currentTarget as HTMLFormElement));
  formErrors = validateDraft();
  if (!photoUrl) formErrors.photo = "宿題写真を選択してください";
  if (Object.keys(formErrors).length) return render();
  setState({ ...state, step: "analysis" });
}

function submitAnalysis(event: SubmitEvent): void {
  event.preventDefault();
  updateDraft(new FormData(event.currentTarget as HTMLFormElement));
  formErrors = validateDraft();
  if (Object.keys(formErrors).length) return render();
  if (state.scenarioEdited && !window.confirm("編集済みシナリオを再生成しますか？")) return;
  const result = generateScenario(state.draft);
  scenarioWarning = result.warning ?? "";
  selectedPanel = 1;
  setState({ ...state, step: "scenario", mangaPlan: result.plan, scenarioEdited: false });
}

function submitPanel(event: SubmitEvent): void {
  event.preventDefault();
  if (!state.mangaPlan) return;
  const data = new FormData(event.currentTarget as HTMLFormElement);
  const panels = [...state.mangaPlan.panels];
  const current = panels[selectedPanel - 1];
  const character = String(data.get("character"));
  const visualAid = current.visualAid?.type === "bar_model" ? { ...current.visualAid, total: Number(data.get("total")), groups: Number(data.get("groups")), perGroup: Number(data.get("perGroup")) } : current.visualAid;
  panels[selectedPanel - 1] = { ...current, learningPurpose: String(data.get("learningPurpose")), scene: String(data.get("scene")), dialogue: [{ ...current.dialogue[0], text: String(data.get("dialogue")) }], narration: String(data.get("narration")) || null, formula: String(data.get("formula")).split("\n").map((v) => v.trim()).filter(Boolean), characters: [character], characterPose: { [character]: character === "teacher" ? "pointing" : "thinking" }, characterExpression: { [character]: String(data.get("expression")) }, visualAid };
  setState({ ...state, mangaPlan: { ...state.mangaPlan, panels }, scenarioEdited: true });
}

function handleAction(event: Event): void {
  const action = (event.currentTarget as HTMLElement).dataset.action;
  if (action === "back-input") setState({ ...state, step: "input" });
  if (action === "back-analysis") setState({ ...state, step: "analysis" });
  if (action === "back-scenario") setState({ ...state, step: "scenario" });
  if (action === "preview") setState({ ...state, step: "preview" });
  if (action === "print") window.print();
}

function updateDraft(data: FormData): void {
  state = { ...state, draft: { ...state.draft, grade: Number(data.get("grade") ?? state.draft.grade), problemText: String(data.get("problemText")), studentAnswer: String(data.get("studentAnswer")), correctAnswer: String(data.get("correctAnswer")), mistakeCause: String(data.get("mistakeCause") ?? state.draft.mistakeCause) } };
}

function validateDraft(): Record<string, string> {
  const result = homeworkDraftSchema.safeParse(state.draft);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

function setPhoto(file?: File): void {
  formErrors = {};
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { formErrors.photo = "JPEG、PNG、WebPのみ選択できます"; return render(); }
  if (file.size > 10 * 1024 * 1024) { formErrors.photo = "写真は10MB以下にしてください"; return render(); }
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);
  photoName = file.name;
  render();
}

function updatePreviewDialogue(element: HTMLElement): void {
  if (!state.mangaPlan) return;
  const [panelIndex, dialogueIndex] = (element.dataset.dialogue ?? "1-0").split("-").map(Number);
  const panels = [...state.mangaPlan.panels];
  const current = panels[panelIndex - 1];
  const dialogue = [...current.dialogue];
  dialogue[dialogueIndex] = { ...dialogue[dialogueIndex], text: element.innerText.trim() };
  panels[panelIndex - 1] = { ...current, dialogue };
  state = saveWorkspace(localStorage, { ...state, mangaPlan: { ...state.mangaPlan, panels }, scenarioEdited: true });
}

function setState(next: WorkspaceState): void { state = saveWorkspace(localStorage, next); render(); }
function resetWorkspace(): void { if (!window.confirm("入力内容とシナリオを消して最初から始めますか？")) return; localStorage.removeItem(WORKSPACE_KEY); if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = null; photoName = ""; state = createWorkspace(samplePlan); render(); }
function faceFor(expression: string): string { if (["happy", "smile", "discovery"].includes(expression)) return "◠‿◠"; if (["confused", "surprised"].includes(expression)) return "•﹏•"; if (expression === "focused") return "•̀ᴗ•́"; return "•‿•"; }
