const apiUrl = import.meta.env.VITE_HOMEWORK_GAS_API_URL as string | undefined;

export const homeworkGasConfigured = Boolean(apiUrl);

type GasResponse<T> = { ok: true; data: T } | { ok: false; error?: { message?: string } };

async function postGas<T>(body: Record<string, unknown>): Promise<T> {
  if (!apiUrl) throw new Error("VITE_HOMEWORK_GAS_API_URLが設定されていません。");
  const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" });
  if (!response.ok) throw new Error(`GASとの通信に失敗しました (${response.status})`);
  const result = await response.json() as GasResponse<T>;
  if (!result.ok) throw new Error(result.error?.message ?? "GAS処理に失敗しました。");
  return result.data;
}

export function uploadHomeworkToGas(input: { idToken: string; base64: string; fileName: string; contentType: string }) {
  return postGas<{ jobId: string }>({ action: "homeworkUpload", ...input });
}

export function retryHomeworkViaGas(idToken: string, jobId: string) {
  return postGas<{ jobId: string }>({ action: "homeworkRetry", idToken, jobId });
}
