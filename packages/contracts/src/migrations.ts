/**
 * Envelope の schemaVersion 移行レジストリ。
 * minor バージョンアップ時はここへ「前バージョン → 次バージョン」の変換を登録する。
 * チェーンが最新版まで届かないバージョンは unpack 時に UNSUPPORTED_VERSION になる。
 */
export type Migration = { to: string; migrate: (data: unknown) => unknown };

const MIGRATIONS: Record<string, Migration> = {
  // 例: "3.0": { to: "3.1", migrate: (data) => ({ ...(data as object), newField: defaultValue }) }
};

export function runMigrations(fromVersion: string, targetVersion: string, data: unknown): { ok: true; data: unknown } | { ok: false; version: string } {
  let version = fromVersion;
  let current = data;
  const seen = new Set<string>();
  while (version !== targetVersion) {
    if (seen.has(version)) return { ok: false, version };
    seen.add(version);
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, version };
    current = step.migrate(current);
    version = step.to;
  }
  return { ok: true, data: current };
}
