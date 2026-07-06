import type { MangaPanelV3, MangaPlanV3 } from "@homework-manga/contracts/mangaPlan";
import { renderSafeVisualAid } from "@homework-manga/renderer/svg/visualAid";
import { emphasize, escapeHtml } from "@homework-manga/renderer/utils";
import { assetCatalogSchema, selectAsset } from "@homework-manga/renderer/assets";
import rawAssetCatalog from "@homework-manga/renderer/assets/metadata.json";

const assetCatalog = assetCatalogSchema.parse(rawAssetCatalog).assets;
const SPEAKER_NAMES = { hero: "ハル", teacher: "先生" } as const;

/**
 * MangaPlan v3 のA4見開きレンダラ(画面・印刷共用)。
 * 演出は presentation から決定論的に描画し、素材が無ければダミーキャラへフォールバックする。
 */
export function PlanViewer({ plan }: { plan: MangaPlanV3 }) {
  return (
    <article class="manga-page" aria-label={plan.title}>
      <header class="page-title">
        <span class="subject-label">算数</span>
        <h2>{plan.title}</h2>
        <p dangerouslySetInnerHTML={{ __html: emphasize(plan.problem.text, collectEmphasis(plan)) }} />
      </header>
      <div class="panel-grid">
        {plan.panels.map((panel, index) => (
          <Panel key={index} panel={panel} number={index + 1} />
        ))}
      </div>
      <footer class="answer-strip">
        <span>まちがい</span>
        <s>{plan.problem.studentAnswer}</s>
        <b>考え直すと</b>
        <strong>{plan.problem.correctAnswer}</strong>
      </footer>
    </article>
  );
}

export function PanelView({ panel, number }: { panel: MangaPanelV3; number: number }) {
  return <Panel panel={panel} number={number} />;
}

function Panel({ panel, number }: { panel: MangaPanelV3; number: number }) {
  const cast = panel.presentation.casts[0];
  const asset = selectAsset(assetCatalog, {
    category: "character",
    character: cast.character,
    emotion: cast.expression,
    action: cast.pose,
    preferredPosition: cast.side
  });
  return (
    <section class={`panel character-${cast.side} backdrop-${panel.presentation.background} ${panel.visualAid ? "has-visual" : ""}`}>
      <div class="panel-number">{number}</div>
      {asset ? (
        <img class="asset-character" src={new URL(asset.filePath, document.baseURI).href} alt={`${SPEAKER_NAMES[cast.character]}(${cast.expression})`} />
      ) : (
        <div class={`dummy-character ${cast.character}`}>
          <span class="face">{faceFor(cast.expression)}</span>
          <span class="body" />
        </div>
      )}
      <div class="dialogue-stack">
        {panel.dialogue.map((line, index) => (
          <div key={index} class={`speech-bubble tone-${line.tone}`}>
            <b class="speaker">{SPEAKER_NAMES[line.speaker]}</b>
            <span dangerouslySetInnerHTML={{ __html: emphasize(line.text, panel.emphasisWords) }} />
          </div>
        ))}
      </div>
      {panel.visualAid && <div class="visual-aid" dangerouslySetInnerHTML={{ __html: renderSafeVisualAid(panel.visualAid) }} />}
      {panel.formula.length > 0 && (
        <div class="formula-block">
          {panel.formula.map((formula, index) => <span key={index} dangerouslySetInnerHTML={{ __html: escapeHtml(formula) }} />)}
        </div>
      )}
      {panel.narration && <p class="narration" dangerouslySetInnerHTML={{ __html: emphasize(panel.narration, panel.emphasisWords) }} />}
    </section>
  );
}

function collectEmphasis(plan: MangaPlanV3): string[] {
  return [...new Set(plan.panels.flatMap((panel) => panel.emphasisWords))].slice(0, 8);
}

function faceFor(expression: string): string {
  if (["happy", "smile", "discovery"].includes(expression)) return "◠‿◠";
  if (["confused", "surprised"].includes(expression)) return "•﹏•";
  if (expression === "focused") return "•̀ᴗ•́";
  return "•‿•";
}
