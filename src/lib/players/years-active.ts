import corrections from "../../../data/years-active-corrections.json";

const OVERRIDE_MAP = new Map(
  Object.entries(corrections as Record<string, string>)
);

/** Apply verified career span overrides at load time. */
export function resolveYearsActive(id: string, raw: string): string {
  const override = OVERRIDE_MAP.get(id);
  if (override) return override;

  let years = (raw ?? "").trim();
  if (!years) return years;

  years = years.replace(/-/g, "–");
  years = years.replace(/present/i, "Present");

  if (years.includes("2026")) {
    years = years.replace("2026", "Present");
  }

  return years;
}
