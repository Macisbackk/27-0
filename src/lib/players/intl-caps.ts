import corrections from "../../../data/intl-caps-corrections.json";

const OVERRIDE_MAP = new Map(
  Object.entries(corrections as Record<string, number>)
);

export function resolveIntlCaps(id: string, raw: unknown): number {
  const override = OVERRIDE_MAP.get(id);
  if (override !== undefined) return override;

  if (raw === undefined || raw === null || raw === "") return 0;

  const value = Number(raw);
  if (Number.isNaN(value) || value < 0) return 0;
  return Math.round(value);
}
