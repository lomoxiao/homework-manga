import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { env } from "../env.js";
import { copySanitizedCodexConfig } from "./codexConfig.js";

export type RunCodexInput = {
  prompt: string;
  jobDir: string;
  logLabel: string;
  imagePath?: string;
  outputSchema?: Record<string, unknown>;
};

export type RunCodexResult = { result: string; lastMessagePath: string };

/**
 * Codex CLI をヘッドレス実行し、--output-last-message ファイルの内容を返す。
 * 各段階の入出力(プロンプト・stdout・stderr・最終出力)は必ず jobDir に保存する。
 * 実運用で失敗した出力はそのままテスト fixture へ昇格できる。
 */
export async function runCodex(input: RunCodexInput): Promise<RunCodexResult> {
  const lastMessagePath = path.join(input.jobDir, `codex-${input.logLabel}-last-message.txt`);
  const promptFilePath = path.join(input.jobDir, `codex-${input.logLabel}-input.md`);
  const outputSchemaPath = input.outputSchema ? path.join(input.jobDir, `codex-${input.logLabel}-output-schema.json`) : undefined;
  const prompt = input.imagePath ? input.prompt : wrapTextOnlyPrompt(input.prompt);

  try {
    if (outputSchemaPath) await writeFile(outputSchemaPath, `${JSON.stringify(input.outputSchema, null, 2)}\n`, "utf8");
    const execution = await runCodexExec(prompt, {
      lastMessagePath,
      promptFilePath,
      imagePaths: input.imagePath ? [path.resolve(input.imagePath)] : [],
      outputSchemaPath
    });
    await writeFile(path.join(input.jobDir, `codex-${input.logLabel}-stdout.log`), execution.stdout, "utf8");
    await writeFile(path.join(input.jobDir, `codex-${input.logLabel}-stderr.log`), execution.stderr, "utf8");
    if (execution.exitCode !== 0) throw new Error(`codex exec failed with exit code ${execution.exitCode}`);
    const lastMessage = await readFile(lastMessagePath, "utf8");
    if (!lastMessage.trim()) throw new Error("codex returned an empty result");
    return { result: lastMessage, lastMessagePath };
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await writeFile(path.join(input.jobDir, `codex-${input.logLabel}-error.log`), `${message}\n`, "utf8").catch(() => {});
    throw error;
  }
}

function wrapTextOnlyPrompt(prompt: string) {
  return `Run this task as a text-only generation task.

Constraints:
- Do not call shell commands or external tools.
- Do not edit, create, delete, or inspect files.
- Use only the information embedded in this prompt.
- Return only the final requested text. Do not include operational commentary.

${prompt}`;
}

type ExecOptions = {
  lastMessagePath: string;
  promptFilePath: string;
  imagePaths: string[];
  outputSchemaPath?: string;
};

async function runCodexExec(prompt: string, options: ExecOptions): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const codexHome = await prepareRunnerCodexHome();
  const command = resolveCodexCommand(env.CODEX_CLI_COMMAND, codexHome);
  await writeFile(options.promptFilePath, prompt, "utf8");

  return new Promise((resolve, reject) => {
    const args = [
      "exec",
      "--skip-git-repo-check",
      "-C", process.cwd(),
      "--model", env.CODEX_MODEL,
      "--output-last-message", options.lastMessagePath,
      "--sandbox", env.CODEX_EXEC_SANDBOX,
      ...options.imagePaths.flatMap((imagePath) => ["--image", imagePath]),
      ...(options.outputSchemaPath ? ["--output-schema", options.outputSchemaPath] : []),
      "-"
    ];

    let child;
    try {
      child = spawn(command, args, { shell: false, env: { ...process.env, CODEX_HOME: codexHome }, windowsHide: true });
    } catch (error) {
      reject(error);
      return;
    }

    child.stdin?.end(prompt, "utf8");

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill();
      settled = true;
      reject(new Error(`codex exec timed out after ${env.CODEX_EXEC_TIMEOUT_MS}ms`));
    }, env.CODEX_EXEC_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function prepareRunnerCodexHome() {
  const runnerHome = path.resolve(env.CODEX_RUNNER_HOME);
  const sourceHome = path.resolve(env.CODEX_SOURCE_HOME ?? process.env.CODEX_HOME ?? path.join(process.env.USERPROFILE ?? "", ".codex"));

  await mkdir(runnerHome, { recursive: true });
  await mkdir(path.join(runnerHome, "bin"), { recursive: true });
  await mkdir(path.join(runnerHome, "sessions"), { recursive: true });
  await mkdir(path.join(runnerHome, "tmp"), { recursive: true });

  await copyIfExists(path.join(sourceHome, "auth.json"), path.join(runnerHome, "auth.json"));
  const configCopy = await copySanitizedCodexConfig(path.join(sourceHome, "config.toml"), path.join(runnerHome, "config.toml"));
  if (configCopy.removedServiceTier !== undefined) {
    console.warn(`[codex] Ignored unsupported top-level service_tier=${JSON.stringify(configCopy.removedServiceTier)} while preparing ${runnerHome}.`);
  }
  await copyIfExists(path.join(sourceHome, "AGENTS.md"), path.join(runnerHome, "AGENTS.md"));
  await copyExeIfNeeded(resolveExternalCodexCommand(env.CODEX_CLI_COMMAND), path.join(runnerHome, "bin", "codex.exe"));

  return runnerHome;
}

async function copyIfExists(source: string, destination: string) {
  if (!existsSync(source)) return;
  await copyFile(source, destination);
}

// codex.exe は起動中にコピーしようとすると EBUSY になるため、既に存在する場合はスキップする。
async function copyExeIfNeeded(source: string, destination: string) {
  if (!existsSync(source) || existsSync(destination)) return;
  try {
    await copyFile(source, destination);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EBUSY" || code === "EPERM") return;
    throw error;
  }
}

function resolveCodexCommand(command: string, codexHome: string) {
  const runnerCodex = path.resolve(codexHome, "bin", "codex.exe");
  if (process.platform === "win32" && existsSync(runnerCodex)) return runnerCodex;
  if (command !== "codex" || process.platform !== "win32") return command;
  return getUserCodexCandidates().find((candidate) => existsSync(candidate)) ?? command;
}

function resolveExternalCodexCommand(command: string) {
  if (command !== "codex" || process.platform !== "win32") return command;
  return getUserCodexCandidates().find((candidate) => existsSync(candidate)) ?? command;
}

function getUserCodexCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;
  return [
    path.join(homedir(), "AppData", "Local", "OpenAI", "Codex", "bin", "codex.exe"),
    userProfile ? path.join(userProfile, "AppData", "Local", "OpenAI", "Codex", "bin", "codex.exe") : undefined,
    localAppData ? path.join(localAppData, "OpenAI", "Codex", "bin", "codex.exe") : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));
}
