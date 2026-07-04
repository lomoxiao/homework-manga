export type DriveImageSource = { fileId: string; displayUrl?: string };

const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,}$/;

export function buildDriveThumbnailUrl(fileId: string): string | undefined {
  if (!DRIVE_FILE_ID.test(fileId)) return undefined;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000`;
}

export function resolveDriveDisplayUrl(source: DriveImageSource): string | undefined {
  if (source.displayUrl) {
    try {
      const url = new URL(source.displayUrl);
      if (url.protocol === "https:" && url.hostname === "drive.google.com" && url.pathname === "/thumbnail" && url.searchParams.get("id") === source.fileId) {
        return url.toString();
      }
    } catch {
      // Fall back to a URL derived from the trusted Firebase file ID.
    }
  }
  return buildDriveThumbnailUrl(source.fileId);
}
