import corrections from "../../../data/years-active-corrections.json";

const OVERRIDE_MAP = new Map(
  Object.entries(corrections as Record<string, string>)
);

function currentCalendarYear(): number {
  return new Date().getFullYear();
}

function normalizeSeparators(years: string): string {
  return years.replace(/-/g, "–").replace(/present/gi, "Present");
}

/** Sanitize career span — no future end years unless marked Present. */
function sanitizeYearsActiveSpan(years: string): string {
  const normalized = normalizeSeparators(years.trim());
  if (!normalized) return normalized;

  if (/present/i.test(normalized)) {
    const startMatch = normalized.match(/(\d{4})/);
    return startMatch ? `${startMatch[1]}–Present` : "Present";
  }

  const yearMatches = [...normalized.matchAll(/(\d{4})/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  if (yearMatches.length === 0) return normalized;

  const start = yearMatches[0];
  const end =
    yearMatches.length > 1 ? yearMatches[yearMatches.length - 1] : undefined;
  const now = currentCalendarYear();

  if (end !== undefined && end > now) {
    return `${start}–Unknown`;
  }

  if (end !== undefined && end !== start) {
    return `${start}–${end}`;
  }

  return String(start);
}

/** Apply verified career span overrides and sanitize impossible future ranges. */
export function resolveYearsActive(id: string, raw: string): string {
  const override = OVERRIDE_MAP.get(id);
  const source = override ?? raw ?? "";
  return sanitizeYearsActiveSpan(source);
}
