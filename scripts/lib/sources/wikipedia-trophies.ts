import { normalizePlayerNameKey } from "../../../src/lib/player-name-normalize";

const USER_AGENT =
  "27-0-player-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

export interface TrophyWinnerCache {
  builtAt: string;
  sources: string[];
  superLeagueWinners: string[];
  challengeCupWinners: string[];
  superLeaguePages: string[];
  challengeCupPages: string[];
  parseFailures: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function stripDisambiguator(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/g, "").trim();
}

function cleanWikiName(raw: string): string {
  const name = raw
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\[\[[^\]]*$/g, "")
    .replace(/\s*\([^)]*$/g, "")
    .replace(/\(c\)/gi, "")
    .replace(/\(captain\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripDisambiguator(name);
}

export function trophyWinnerNameKey(name: string): string {
  return normalizePlayerNameKey(stripDisambiguator(name));
}

function toTemplatePage(title: string): string {
  const base = title.replace(/^Template:/i, "").trim();
  return `Template:${base.replace(/[ –—]/g, "_")}`;
}

export function extractSquadNavboxPlayers(wikitext: string): string[] {
  const players: string[] = [];
  for (const match of wikitext.matchAll(
    /\|\s*p(?:\d+|_\d+)\s*=\s*([^\n|]+)/gi
  )) {
    const name = cleanWikiName(match[1]);
    if (name && !/coach/i.test(name)) players.push(name);
  }
  for (const match of wikitext.matchAll(
    /\*\s*\d+\.\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  )) {
    const name = cleanWikiName(match[1]);
    if (name) players.push(name);
  }
  return [...new Set(players)];
}

export function parsePlayerTrophyHonours(wikitext: string): {
  superLeague: boolean;
  challengeCup: boolean;
} {
  const lower = wikitext.toLowerCase();
  const hasSlMedal =
    /\{\{medalcompetition\|\[\[super league\]\]\}\}/i.test(wikitext) ||
    /\{\{medalgold\|\[\[\d{4} super league/i.test(wikitext);
  const hasCcMedal =
    /\{\{medalcompetition\|\[\[challenge cup\]\]\}\}/i.test(wikitext) ||
    /\{\{medalgold\|\[\[\d{4} challenge cup/i.test(wikitext);

  const slHonours =
    hasSlMedal ||
    /super league[^.\n]{0,40}\b(champions?|winners?)\b/i.test(wikitext) ||
    /super league grand final victory/i.test(lower) ||
    /super league ix champions/i.test(lower) ||
    /super league championship/i.test(lower);

  const ccHonours =
    hasCcMedal ||
    /challenge cup[^.\n]{0,40}\b(winners?|victory)\b/i.test(wikitext) ||
    /challenge cup final victory/i.test(lower);

  return {
    superLeague: slHonours,
    challengeCup: ccHonours,
  };
}

async function wikiGet<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries({ format: "json", origin: "*", ...params })) {
    url.searchParams.set(k, v);
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (res.status === 429) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  }
  return null;
}

export async function fetchWikipediaWikitext(
  page: string
): Promise<string | null> {
  type ParseResult = {
    parse?: { wikitext?: { "*": string } };
    error?: { code: string };
  };
  const data = await wikiGet<ParseResult>({
    action: "parse",
    page,
    prop: "wikitext",
  });
  return data?.parse?.wikitext?.["*"] ?? null;
}

export async function pageExists(page: string): Promise<boolean> {
  type QueryResult = {
    query?: { pages?: Record<string, { missing?: string }> };
  };
  const data = await wikiGet<QueryResult>({
    action: "query",
    titles: page,
  });
  const pg = Object.values(data?.query?.pages ?? {})[0];
  return Boolean(pg && !pg.missing);
}

function findWinnerNavboxTitle(wikitext: string, pattern: RegExp): string | null {
  const match = wikitext.match(pattern);
  if (!match) return null;
  return match[0].replace(/^\{\{|\}\}$/g, "").trim();
}

export async function extractWinnersFromFinalPage(
  page: string,
  trophy: "superLeague" | "challengeCup"
): Promise<string[]> {
  const wikitext = await fetchWikipediaWikitext(page);
  if (!wikitext) return [];

  if (/^template:/i.test(page) || /Navbox rugby league squad/i.test(wikitext)) {
    const squad = extractSquadNavboxPlayers(wikitext);
    if (squad.length > 0) return squad;
  }

  const navPatterns =
    trophy === "superLeague"
      ? [
          /\{\{[^}\n]*Super League Grand Final winners[^}\n]*\}\}/i,
          /\{\{[^}\n]*Super League winners[^}\n]*\}\}/i,
        ]
      : [
          /\{\{[^}\n]*Challenge Cup(?: Final)? winners[^}\n]*\}\}/i,
        ];

  for (const navPattern of navPatterns) {
    const navTitle = findWinnerNavboxTitle(wikitext, navPattern);
    if (!navTitle) continue;
    const navWikitext = await fetchWikipediaWikitext(toTemplatePage(navTitle));
    if (navWikitext) {
      const squad = extractSquadNavboxPlayers(navWikitext);
      if (squad.length > 0) return squad;
    }
  }

  return extractSquadNavboxPlayers(wikitext);
}

export async function buildTrophyWinnerCache(options?: {
  delayMs?: number;
  ccStartYear?: number;
  ccEndYear?: number;
}): Promise<TrophyWinnerCache> {
  const delayMs = options?.delayMs ?? 1100;
  const ccStartYear = options?.ccStartYear ?? 1960;
  const ccEndYear = options?.ccEndYear ?? 2026;

  const slSets = new Map<string, string>();
  const ccSets = new Map<string, string>();
  const slPages: string[] = [];
  const ccPages: string[] = [];
  const parseFailures: string[] = [];

  const slPagesToFetch = [
    ...Array.from({ length: 2025 - 1998 + 1 }, (_, i) => {
      const year = 1998 + i;
      return `${year} Super League Grand Final`;
    }),
  ];

  for (const page of slPagesToFetch) {
    await sleep(delayMs);
    const players = await extractWinnersFromFinalPage(
      page,
      "superLeague"
    );
    if (players.length === 0) {
      parseFailures.push(page);
      continue;
    }
    slPages.push(page);
    for (const name of players) {
      slSets.set(trophyWinnerNameKey(name), stripDisambiguator(name));
    }
    console.log(`  SL: ${page} → ${players.length} players`);
  }

  for (let year = ccStartYear; year <= ccEndYear; year++) {
    const candidates = [
      `${year} Challenge Cup final`,
      `${year} Challenge Cup Final`,
    ];
    let page: string | null = null;
    for (const candidate of candidates) {
      await sleep(200);
      if (await pageExists(candidate)) {
        page = candidate;
        break;
      }
    }
    if (!page) continue;

    await sleep(delayMs);
    const players = await extractWinnersFromFinalPage(page, "challengeCup");
    if (players.length === 0) {
      parseFailures.push(page);
      continue;
    }
    ccPages.push(page);
    for (const name of players) {
      ccSets.set(trophyWinnerNameKey(name), stripDisambiguator(name));
    }
    console.log(`  CC: ${page} → ${players.length} players`);
  }

  return {
    builtAt: new Date().toISOString(),
    sources: ["Wikipedia", "Official Super League website"],
    superLeagueWinners: [...slSets.values()].sort(),
    challengeCupWinners: [...ccSets.values()].sort(),
    superLeaguePages: slPages,
    challengeCupPages: ccPages,
    parseFailures,
  };
}

export function playerMatchesWinnerSet(
  playerName: string,
  winnerNames: string[]
): boolean {
  const key = trophyWinnerNameKey(playerName);
  const keys = new Set(winnerNames.map((n) => trophyWinnerNameKey(n)));
  return keys.has(key);
}
