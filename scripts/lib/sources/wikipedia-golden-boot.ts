import { trophyWinnerNameKey } from "./wikipedia-trophies";

const USER_AGENT =
  "27-0-player-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const GOLDEN_BOOT_PAGE = "IRL Golden Boot Award";

/** Wikipedia sortname → DB player name when they differ. */
const GOLDEN_BOOT_NAME_ALIASES: Record<string, string> = {
  "andrew farrell": "andy farrell",
};

async function fetchWikitext(page: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", page);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    parse?: { wikitext?: { "*": string } };
  };
  return data.parse?.wikitext?.["*"] ?? null;
}

function parseSortName(raw: string): string | null {
  const sortMatch = raw.match(/\{\{sortname\|([^}|]+)\|([^}|]+)/i);
  if (sortMatch) {
    return `${sortMatch[1].trim()} ${sortMatch[2].trim()}`;
  }
  const linkMatch = raw.match(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/);
  if (linkMatch) {
    return linkMatch[1].trim();
  }
  return null;
}

function parseYearFromRow(row: string): number | null {
  const yearMatch = row.match(
    /^\|\s*(?:rowspan=\d+\|)?\s*(\d{4})(?:\{\{[^}]+\}\})?/
  );
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  return Number.isFinite(year) ? year : null;
}

/** Men's IRL Golden Boot winners by year from Wikipedia (main table only). */
export async function fetchGoldenBootWinnersByYear(): Promise<
  Map<number, string[]>
> {
  const wikitext = await fetchWikitext(GOLDEN_BOOT_PAGE);
  if (!wikitext) return new Map();

  const menStart = wikitext.search(/==\s*Winners\s*-\s*Men\s*==/i);
  const tableEnd = wikitext.search(/===\s*By nationality\s*===/i);
  if (menStart < 0 || tableEnd < 0) return new Map();

  const menSection = wikitext.slice(menStart, tableEnd);
  const byYear = new Map<number, string[]>();
  let currentYear: number | null = null;

  for (const row of menSection.split("|-")) {
    const trimmed = row.trim();
    if (!trimmed || trimmed.includes("No award given")) continue;

    const year = parseYearFromRow(trimmed);
    if (year) currentYear = year;

    if (!currentYear) continue;

    const name = parseSortName(trimmed);
    if (!name) continue;

    const list = byYear.get(currentYear) ?? [];
    if (!list.includes(name)) list.push(name);
    byYear.set(currentYear, list);
  }

  return byYear;
}

/** Exact name match only — avoids false positives from surname-only fallback. */
export function matchGoldenBootPlayerId(
  wikiName: string,
  players: { id: string; name: string }[]
): string | null {
  const rawKey = trophyWinnerNameKey(wikiName);
  const key = GOLDEN_BOOT_NAME_ALIASES[rawKey] ?? rawKey;
  const exact = players.find((p) => trophyWinnerNameKey(p.name) === key);
  return exact?.id ?? null;
}
