/**
 * Defensive readers for saved JSON. Local storage can hold anything (old versions, a half-written
 * value, hand edits), and these boards are read on page load, so a bad value must be dropped, not
 * crash the page.
 */

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FieldKind = "string" | "number";

/** True when `value` is an object whose listed fields have the listed types (numbers must be finite). */
export function hasFields(value: unknown, fields: Record<string, FieldKind>): boolean {
  if (!isPlainRecord(value)) return false;
  for (const [key, kind] of Object.entries(fields)) {
    const v = value[key];
    if (kind === "string" ? typeof v !== "string" : typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  return true;
}

/**
 * Parses a saved `{ key: entry }` map, keeping only entries with the listed fields. Anything else
 * (null, an array, a number, junk entries) gives back what's still usable, or `{}`.
 */
export function parseEntryMap<T>(raw: string | null, fields: Record<string, FieldKind>): Record<string, T> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isPlainRecord(parsed)) return {};
  const out: Record<string, T> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (hasFields(entry, fields)) out[key] = entry as T;
  }
  return out;
}
