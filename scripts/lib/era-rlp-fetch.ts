/**
 * Rugby League Project helpers for Era starting-17 second-pass import.
 */

import { isSuperLeagueSeason } from "../../src/lib/players/super-league-club-years";

export const RLP_BASE = "https://www.rugbyleagueproject.org";

export const JERSEY_POSITIONS: Record<number, string> = {
  1: "FB",
  2: "W",
  3: "C",
  4: "C",
  5: "W",
  6: "FE",
  7: "HB",
  8: "FR",
  9: "HK",
  10: "FR",
  11: "2R",
  12: "2R",
  13: "L",
  14: "B",
  15: "B",
  16: "B",
  17: "B",
};

export type EraStarting17Member = {
  number: number;
  position: string;
  name: string;
};

export type EraStarting17Entry = {
  club: string;
  year: number;
  source: string;
  squad: EraStarting17Member[];
};

export type MissingReason =
  | "not found on Rugby League Project"
  | "not a Super League season for that club"
  | "page found but no complete 1–17"
  | "parsing failed";

export type FetchReportRow = {
  club: string;
  year: number;
  status: "success" | "skipped_existing" | "skipped_not_sl" | "failed";
  reason?: MissingReason;
  detail?: string;
  teamUrl?: string;
  playersFound?: number;
};

const CLUB_MATCH_KEYS: Record<string, string[]> = {
  "Bradford Bulls": ["bradfordbulls", "bradford"],
  "Castleford Tigers": ["castlefordtigers", "castleford"],
  "Catalans Dragons": ["catalansdragons", "catalans", "catalan", "dragons"],
  "Huddersfield Giants": ["huddersfieldgiants", "huddersfield"],
  "Hull FC": ["hullfc", "hullsharks", "hull"],
  "Hull KR": ["hullkr", "hullkingstonrovers", "hullkingston"],
  "Leeds Rhinos": ["leedsrhinos", "leeds"],
  "Leigh Leopards": ["leighleopards", "leighcenturions", "leigh"],
  "London Broncos": [
    "londonbroncos",
    "london",
    "harlequinsrl",
    "harlequins",
    "quins",
  ],
  "Salford Red Devils": [
    "salfordreddevils",
    "salfordcityreds",
    "salfordreds",
    "salford",
  ],
  "St Helens": ["sthelens", "saints"],
  "Wakefield Trinity": [
    "wakefieldtrinity",
    "wakefieldtrinitywildcats",
    "wakefield",
  ],
  "Warrington Wolves": ["warringtonwolves", "warrington"],
  "Widnes Vikings": ["widnesvikings", "widnes"],
  "Wigan Warriors": ["wiganwarriors", "wigan"],
  "Toulouse Olympique": ["toulouseolympique", "toulouse"],
};

function normClub(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function clubMatchKeys(club: string): string[] {
  const keys = new Set<string>();
  keys.add(normClub(club));
  for (const alias of CLUB_MATCH_KEYS[club] ?? []) {
    keys.add(normClub(alias));
  }
  return [...keys];
}

export function seasonSlugForYear(year: number): string {
  if (year === 1997) return "super-league-ii-1997";
  return `super-league-${year}`;
}

export function formatRlpCapsName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.includes("'")) {
        return part
          .split("'")
          .map(
            (piece, i) =>
              (i === 0 ? piece.charAt(0).toUpperCase() : piece.charAt(0)) +
              piece.slice(1).toLowerCase()
          )
          .join("'");
      }
      if (part.includes("-")) {
        return part
          .split("-")
          .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase())
          .join("-");
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function parseUnresolvedLine(line: string): { club: string; year: number } | null {
  const match = line.trim().match(/^(.+?)\s+(\d{4}):\s*NOT_FOUND\b/i);
  if (!match) return null;
  return { club: match[1].trim(), year: Number.parseInt(match[2], 10) };
}

export function isCompleteSquad(squad: EraStarting17Member[]): boolean {
  if (squad.length !== 17) return false;
  const numbers = squad.map((m) => m.number).sort((a, b) => a - b);
  return numbers.every((n, i) => n === i + 1);
}

export function parseStarting17FromDetailHtml(
  html: string
): EraStarting17Member[] | null {
  const marker = "Season Player Summary";
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const section = html.slice(start, start + 200_000);
  const byNumber = new Map<number, string>();

  for (const row of section.split("<tr>")) {
    const header = row.match(
      /<td>\s*(\d{1,2})\.\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>/i
    );
    if (!header) continue;

    const number = Number.parseInt(header[1], 10);
    if (number < 1 || number > 17) continue;
    if (byNumber.has(number)) continue;

    const name = formatRlpCapsName(header[2]);
    if (!name) continue;
    byNumber.set(number, name);
  }

  if (byNumber.size === 0) return null;

  const squad: EraStarting17Member[] = [];
  for (let n = 1; n <= 17; n++) {
    const name = byNumber.get(n);
    if (!name) continue;
    squad.push({
      number: n,
      position: JERSEY_POSITIONS[n],
      name,
    });
  }

  return isCompleteSquad(squad) ? squad : null;
}

export type SeasonTeamLink = {
  slug: string;
  summaryPath: string;
  label: string;
};

export function extractSeasonTeamLinks(
  html: string,
  seasonSlug: string
): SeasonTeamLink[] {
  const prefix = `/seasons/${seasonSlug}/`;
  const links = new Map<string, SeasonTeamLink>();

  for (const match of html.matchAll(
    new RegExp(`href="(${prefix}[^"/]+/summary\\.html)"[^>]*>([^<]*)<`, "gi")
  )) {
    const summaryPath = match[1];
    const slug = summaryPath.slice(prefix.length).replace(/\/summary\.html$/, "");
    const label = match[2]?.trim() || slug;
    links.set(summaryPath, { slug, summaryPath, label });
  }

  return [...links.values()];
}

export function matchClubToTeamLink(
  club: string,
  teams: SeasonTeamLink[]
): SeasonTeamLink | null {
  const keys = clubMatchKeys(club);
  let best: SeasonTeamLink | null = null;
  let bestScore = 0;

  for (const team of teams) {
    const candidates = [
      normClub(team.slug),
      normClub(team.label),
      ...team.slug.split("-").map(normClub),
    ];

    for (const key of keys) {
      for (const candidate of candidates) {
        if (candidate === key) {
          return team;
        }
        if (candidate.includes(key) || key.includes(candidate)) {
          const score = Math.min(candidate.length, key.length);
          if (score > bestScore) {
            bestScore = score;
            best = team;
          }
        }
      }
    }
  }

  return bestScore >= 6 ? best : null;
}

export async function fetchRlpHtml(pathOrUrl: string): Promise<string | null> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${RLP_BASE}${pathOrUrl}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (27-0 era starting-17 fetcher)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (/could not be found/i.test(html)) return null;
    return html;
  } catch {
    return null;
  }
}

export function detailUrlFromSummary(summaryPath: string): string {
  return `${summaryPath.replace(/\/summary\.html$/, "/detail.html")}?order=pos`;
}

export function shouldIncludeClubYear(club: string, year: number): boolean {
  return isSuperLeagueSeason(club, year);
}
