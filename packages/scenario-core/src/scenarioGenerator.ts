import type { HomeworkDraft, MangaPlan, MangaPanel, VisualAid } from "@homework-manga/contracts/schema";
import rawCatalog from "@homework-manga/renderer/assets/metadata.json";
import { assetCatalogSchema, selectAsset } from "@homework-manga/renderer/assets";
import { classifyProblem } from "./curriculum";
import { verifyDraft } from "./mathVerifier";
const assetCatalog = assetCatalogSchema.parse(rawCatalog).assets;
type Division = { total: number; groups: number; perGroup: number };
export type ScenarioResult = { plan: MangaPlan; supported: boolean; warning?: string };

export function generateScenario(input: HomeworkDraft): ScenarioResult {
  const classification = input.topic === "unclassified" ? classifyProblem(input.problemText) : { curriculumDomain: input.curriculumDomain, topic: input.topic, problemType: input.problemType };
  const draft = { ...input, ...classification, canonicalAnswer: input.canonicalAnswer || input.correctAnswer };
  const verification = verifyDraft(draft); const division = parseDivision(draft.canonicalAnswer);
  const supported = verification.status === "verified";
  const steps = draft.solutionSteps.length ? draft.solutionSteps : [{ id: "step-1", explanation: "問題の数量関係を確認する", expression: draft.canonicalAnswer, result: draft.correctAnswer }];
  const aid = supported ? chooseVisualAid(draft, division) : null;
  const p1 = steps[0], p2 = steps[Math.min(1, steps.length - 1)], last = steps[steps.length - 1];
  const panels: MangaPanel[] = [
    panel(1,"問題と自分の考えを確認する","主人公が宿題を見直す","hero","confused",`自分は「${draft.studentAnswer}」と考えたよ。`,draft.problemText,null,[draft.studentAnswer],["問題"],null),
    panel(2,"つまずいた地点を特定する","先生が考え方を問いかける","teacher","calm","どの数量や条件を使う問題かな？",draft.misconception||draft.mistakeCause,null,[],["条件"],p1.id),
    panel(3,"数量や図形の関係を可視化する","図を使って関係を整理する","teacher","smile",p1.explanation,"与えられた情報と求めるものを結び付けます。",aid,p1.expression?[p1.expression]:[],["関係"],p1.id),
    panel(4,"正しい考え方を段階的に説明する","主人公が解法を言葉にする","hero","discovery",p2.explanation,p2.result||null,null,p2.expression?[p2.expression]:[],["考え方"],p2.id),
    panel(5,"解法と答えを検算する","先生が式と答えを確かめる","teacher","smile","式・単位・問題の条件に合うか確かめよう。",`検証: ${verification.method}（信頼度${Math.round(verification.confidence*100)}%）`,null,[last.expression||draft.canonicalAnswer],["検算"],last.id),
    panel(6,"次に使える判断基準を定着させる","主人公が答えと手掛かりをまとめる","hero","happy",`答えは「${draft.correctAnswer}」。条件と式を結び付ければいいんだね。`,"まちがいは、考え方を見つけるヒントになります。",null,[draft.canonicalAnswer],["答え","条件"],last.id)
  ];
  const warning = supported ? verification.warnings.join(" ") || undefined : verification.warnings.join(" ") || "この問題は安全に自動検証できません。";
  return { plan: { schemaVersion:"2.0",jobId:`hw-${Date.now()}`,title: supported?topicTitle(draft.topic):"要確認：この問題の考え方",problem:{text:draft.problemText,studentAnswer:draft.studentAnswer,correctAnswer:draft.correctAnswer},panels }, supported, warning };
}
function topicTitle(topic:string){const names:Record<string,string>={division_equal_sharing:"同じ数ずつ分けるには？",fractions:"分数の関係を見つけよう",decimals:"小数を正しく計算しよう",area:"面積を図で考えよう",volume:"体積を組み立てよう",ratio_percent:"割合をもとに考えよう",speed:"速さの3つの量を結ぼう",average:"平均の意味をつかもう",tables_graphs:"表とグラフを読み取ろう"};return names[topic]??"問題のしくみを見つけよう"}
function chooseVisualAid(d:HomeworkDraft,division:Division|null):VisualAid|null{
  if(division)return{type:"bar_model",...division,label:"1つ分"};
  if(d.topic==="fractions")return{type:"fraction_bar",position:"center",labels:{},data:{numerator:1,denominator:2}};
  if(d.topic==="area"||d.topic==="volume"||d.topic==="shapes")return{type:"geometry",position:"center",labels:{},data:{shape:"rectangle",label:d.topic}};
  if(d.topic==="ratio_percent"||d.topic==="proportion"||d.topic==="speed")return{type:"ratio_diagram",position:"center",labels:{},data:{ratio:0.5,label:"数量の関係"}};
  if(d.topic==="measurement_units")return{type:"unit_conversion",position:"center",labels:{},data:{rule:"単位をそろえる"}};
  if(d.topic==="average"||d.topic==="tables_graphs")return{type:"table",position:"center",labels:{},data:{rule:"値を整理する"}};
  return{type:"number_line",position:"center",labels:{},data:{min:0,max:10,ticks:10}};
}
export function parseDivision(formula:string):Division|null{const m=formula.match(/(\d+)\s*[÷/]\s*(\d+)\s*=\s*(\d+)/);if(!m)return null;const [,total,groups,perGroup]=m.map(Number);return total&&groups&&perGroup&&total/groups===perGroup?{total,groups,perGroup}:null}
function panel(panelNumber:number,learningPurpose:string,scene:string,character:"hero"|"teacher",expression:string,dialogue:string,narration:string|null,visualAid:VisualAid|null,formula:string[],emphasisWords:string[],solutionStepId:string|null):MangaPanel{
  const asset=selectAsset(assetCatalog,{category:"character",character,emotion:expression,action:character==="teacher"?"pointing":"thinking",storyBeat:panelNumber===1?"question":panelNumber===3?"guided-discovery":undefined,preferredPosition:panelNumber%2?"left":"right"});
  return{panelNumber,learningPurpose,scene,solutionStepId,characters:[character],characterPose:{[character]:character==="teacher"?"pointing":"thinking"},characterExpression:{[character]:expression},background:panelNumber===5?"blackboard":"classroom",props:[],dialogue:[{speaker:character==="teacher"?"先生":"ハル",text:dialogue,tone:panelNumber===6?"discovery":"normal"}],narration,visualAid,formula,emphasisWords,layout:{size:visualAid?"large":"medium",characterSide:panelNumber%2?"left":"right",visualAidPosition:"center"},assetIds:[asset?.assetId??`dummy-${character}-${expression}`]};
}
