import { trophyWinnerNameKey } from "./wikipedia-trophies";

const USER_AGENT =
  "27-0-player-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

function cleanWikiName(raw: string): string {
  return raw
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\s*\([^)]+\)\s*$/g, "")
    .replace(/†/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

/** Unique Lance Todd Trophy winner names from Wikipedia. */
export async function fetchLanceToddWinnerNames(): Promise<string[]> {
  const wikitext = await fetchWikitext("Lance Todd Trophy");
  if (!wikitext) return [];

  const tableStart = wikitext.indexOf("{| class=\"wikitable\"");
  const tableEnd = wikitext.indexOf("=== Awards by club ===", tableStart);
  const table = wikitext.slice(
    tableStart,
    tableEnd > tableStart ? tableEnd : tableStart + 50000
  );

  const names = new Set<string>();
  for (const match of table.matchAll(
    /\|\d{4}(?:–\d{2})?[^|\n]*\n\|\s*(?:rowspan=\d+\|)?\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
  )) {
    names.add(cleanWikiName(match[1]));
  }
  for (const match of table.matchAll(
    /\| rowspan=\d+\|\d{4}(?:–\d{2})?[^|\n]*\n\|\s*\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
  )) {
    names.add(cleanWikiName(match[1]));
  }
  return [...names].filter(Boolean).sort();
}

const CLUB_NAME_PATTERN =
  /^(Wigan Warriors|St\.? Helens|Leeds Rhinos|Bradford Bulls|Warrington Wolves|Hull FC|Hull Kingston|Castleford Tigers|Leigh (?:Leopards|Centurions)|Huddersfield Giants|London Broncos|Catalans Dragons|Wakefield Trinity|Widnes Vikings|Halifax|Sheffield Eagles|Salford|Man of Steel)/i;

/** Dream Team selections by year from Wikipedia Super League Dream Team page. */
export async function fetchDreamTeamByYear(): Promise<
  Map<number, string[]>
> {
  const wikitext = await fetchWikitext("Super League Dream Team");
  if (!wikitext) return new Map();

  const byYear = new Map<number, string[]>();
  const sections = wikitext.split(/\n==(\d{4})==\n/);

  for (let i = 1; i < sections.length; i += 2) {
    const year = Number(sections[i]);
    const body = sections[i + 1] ?? "";
    if (!Number.isFinite(year)) continue;

    const players: string[] = [];
    for (const match of body.matchAll(
      /\|\{\{flagicon[^}]*\}\}\s*\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
    )) {
      const name = cleanWikiName(match[1]);
      if (name && !CLUB_NAME_PATTERN.test(name)) {
        players.push(name);
      }
    }
    if (players.length > 0) {
      byYear.set(year, players);
    }
  }

  return byYear;
}

export function matchPlayerIdByName(
  wikiName: string,
  players: { id: string; name: string }[]
): string | null {
  const key = trophyWinnerNameKey(wikiName);
  const exact = players.find((p) => trophyWinnerNameKey(p.name) === key);
  if (exact) return exact.id;

  const parts = key.split(" ");
  const surname = parts[parts.length - 1];
  const candidates = players.filter((p) =>
    trophyWinnerNameKey(p.name).includes(surname)
  );
  if (candidates.length === 1) return candidates[0].id;
  return null;
}
