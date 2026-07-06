import { z } from "zod";
import { err, ok, type Result } from "./result";
import { runMigrations } from "./migrations";

/**
 * Firebase RTDB は null / 空配列 / 空オブジェクトを保存しないため、
 * 成果物は JSON 文字列としてまるごと保存する(タグ付け codec は廃止)。
 * encode/decode が完全対称になり、null/空問題が構造的に消える。
 */
export const envelopeSchema = z.object({
  v: z.string().min(1),
  json: z.string().min(1),
  savedAt: z.string().min(1)
}).strict();
export type Envelope = z.infer<typeof envelopeSchema>;

export type DecodeError =
  | { code: "ENVELOPE_INVALID"; detail: string }
  | { code: "JSON_PARSE_FAILED"; detail: string }
  | { code: "UNSUPPORTED_VERSION"; version: string }
  | { code: "SCHEMA_MISMATCH"; issues: z.ZodIssue[] };

export function packEnvelope<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, version: string, value: unknown, now: () => string = () => new Date().toISOString()): Envelope {
  return { v: version, json: JSON.stringify(schema.parse(value)), savedAt: now() };
}

export function unpackEnvelope<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, version: string, raw: unknown): Result<T, DecodeError> {
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return err({ code: "ENVELOPE_INVALID", detail: envelope.error.issues[0]?.message ?? "invalid envelope" });
  let data: unknown;
  try {
    data = JSON.parse(envelope.data.json);
  } catch (cause) {
    return err({ code: "JSON_PARSE_FAILED", detail: cause instanceof Error ? cause.message : String(cause) });
  }
  const migrated = runMigrations(envelope.data.v, version, data);
  if (!migrated.ok) return err({ code: "UNSUPPORTED_VERSION", version: migrated.version });
  const parsed = schema.safeParse(migrated.data);
  return parsed.success ? ok(parsed.data) : err({ code: "SCHEMA_MISMATCH", issues: parsed.error.issues });
}
