import { useState } from "preact/hooks";
import { blobToBase64, prepareHomeworkImage } from "../upload";
import { homeworkGasConfigured, uploadHomeworkToGas } from "../homeworkGasClient";
import { getFirebaseIdToken } from "../services/firebaseClient";

/** 宿題写真の送信カード。GAS 経由で Drive 保存+/homeworkJobsV3 登録。 */
export function UploadCard({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [file, setFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  if (!homeworkGasConfigured) {
    return <section class="card upload-card"><p class="hint">写真送信には VITE_HOMEWORK_GAS_API_URL の設定が必要です。</p></section>;
  }

  const selectFile = (selected?: File) => {
    setError(undefined);
    if (!selected) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (!file) return;
    try {
      setError(undefined);
      setBusy("写真を圧縮しています…");
      const prepared = await prepareHomeworkImage(file);
      setBusy("送信しています…");
      const result = await uploadHomeworkToGas({
        idToken: await getFirebaseIdToken(),
        base64: await blobToBase64(prepared.blob),
        fileName: prepared.fileName,
        contentType: prepared.blob.type
      });
      setBusy(undefined);
      setFile(undefined);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(undefined);
      onCreated(result.jobId);
    } catch (cause) {
      setBusy(undefined);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <section class="card upload-card">
      <h2>宿題写真を送る</h2>
      <form onSubmit={submit}>
        <label class={`drop-zone ${previewUrl ? "has-photo" : ""}`}>
          <input
            id="web-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(event) => selectFile((event.currentTarget as HTMLInputElement).files?.[0])}
          />
          {previewUrl
            ? <><img src={previewUrl} alt="選択した宿題写真" /><span>タップして変更</span></>
            : <><b>📷</b><strong>撮影または写真を選択</strong><span>送信時に自動圧縮・5MBまで</span></>}
        </label>
        <p class="privacy-note">氏名・学校名・顔が写っていない写真を使ってください。</p>
        {error && <p class="warning">{error}</p>}
        <button class="primary big" type="submit" disabled={!file || Boolean(busy)}>
          {busy ?? "解析を開始"}
        </button>
      </form>
    </section>
  );
}
