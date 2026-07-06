export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function prepareHomeworkImage(file: File): Promise<{ blob: Blob; fileName: string }> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("JPEG、PNG、WebP、HEICの画像を選択してください。");
  if (file.type === "image/heic" || file.type === "image/heif") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("HEIC画像は5MB以下にしてください。");
    return { blob: file, fileName: file.name };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("画像を圧縮できませんでした。")), "image/jpeg", 0.85));
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("圧縮後も5MBを超えています。写真の解像度を下げてください。");
    return { blob, fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch (error) {
    if (file.size <= MAX_UPLOAD_BYTES) return { blob: file, fileName: file.name };
    throw error;
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
