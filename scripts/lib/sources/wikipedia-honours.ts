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
  players: { id: string; name: string; category?: string; year?: number }[]
): string | null {
  const key = trophyWinnerNameKey(wikiName);
  const aliased = DREAM_TEAM_NAME_ALIASES[key] ?? key;

  const exact = players.find((p) => trophyWinnerNameKey(p.name) === aliased);
  if (exact) return preferCurrentId(exact.id, players, aliased);

  const parts = aliased.split(" ");
  if (parts.length < 2) return null;
  const first = parts[0]!;
  const surname = parts[parts.length - 1]!;

  // Require first+surname agreement — never surname-only (McDonald/Macdonald collisions).
  const candidates = players.filter((p) => {
    const pk = trophyWinnerNameKey(p.name);
    const pp = pk.split(" ");
    return pp[0] === first && pp[pp.length - 1] === surname;
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!.id;

  const current = candidates.filter(
    (p) => p.category === "current" || p.id.includes("-cur-")
  );
  if (current.length === 1) return current[0]!.id;
  return null;
}

/** Wikipedia / source spelling variants → canonical normalize key. */
const DREAM_TEAM_NAME_ALIASES: Record<string, string> = {
  "nene mcdonald": "nene macdonald",
};

function preferCurrentId(
  matchedId: string,
  players: { id: string; name: string; category?: string }[],
  key: string
): string {
  const sameName = players.filter((p) => trophyWinnerNameKey(p.name) === key);
  const current = sameName.find(
    (p) => p.category === "current" || p.id.includes("-cur-")
  );
  return current?.id ?? matchedId;
}
