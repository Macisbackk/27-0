/**
 * Fetch and parse era squad lists from Wikipedia (season pages, club pages, squad templates).
 */
import { join } from "path";
import type { Position } from "../../../src/lib/types";
import { normalizePlayerNameKey } from "../../../src/lib/player-name-normalize";
import {
  fetchWikitext,
  wikiGet,
} from "../wikipedia-api";

const ERA_CACHE_DIR = join(__dirname, "..", "wikipedia-era-cache");

export interface WikipediaSquadMember {
  name: string;
  position: string;
  mappedPosition: Position | null;
  tries: number;
  goals: number;
  dropGoals: number;
  points: number;
  appearances: number;
  sourcePage?: string;
}

export interface WikipediaEraSquadResult {
  pageTitle: string;
  sourceUrl: string;
  squad: WikipediaSquadMember[];
  /** All Wikipedia pages consulted. */
  pageTitles: string[];
}

const POSITION_MAP: Record<string, Position> = {
  fullback: "FULLBACK",
  "full back": "FULLBACK",
  "full-back": "FULLBACK",
  fb: "FULLBACK",
  wing: "WING",
  winger: "WING",
  wings: "WING",
  centre: "CENTRE",
  center: "CENTRE",
  centres: "CENTRE",
  "stand off": "STAND_OFF",
  "stand-off": "STAND_OFF",
  fiveeighth: "STAND_OFF",
  "five-eighth": "STAND_OFF",
  "five eighth": "STAND_OFF",
  "scrum half": "SCRUM_HALF",
  "scrum-half": "SCRUM_HALF",
  halfback: "SCRUM_HALF",
  "half back": "SCRUM_HALF",
  prop: "PROP",
  props: "PROP",
  hooker: "HOOKER",
  "second row": "SECOND_ROW",
  "second-row": "SECOND_ROW",
  lock: "SECOND_ROW",
  "loose forward": "LOOSE_FORWARD",
  "loose-forward": "LOOSE_FORWARD",
  loose: "LOOSE_FORWARD",
  "back row": "LOOSE_FORWARD",
  utility: "CENTRE",
};

const SQUAD_TEMPLATE_POS: Record<string, Position> = {
  fb: "FULLBACK",
  fullback: "FULLBACK",
  wing1: "WING",
  wing2: "WING",
  wing: "WING",
  ce1: "CENTRE",
  ce2: "CENTRE",
  centre: "CENTRE",
  ce: "CENTRE",
  so: "STAND_OFF",
  standoff: "STAND_OFF",
  "stand-off": "STAND_OFF",
  sh: "SCRUM_HALF",
  halfback: "SCRUM_HALF",
  prop1: "PROP",
  prop2: "PROP",
  prop: "PROP",
  hk: "HOOKER",
  hooker: "HOOKER",
  sr1: "SECOND_ROW",
  sr2: "SECOND_ROW",
  "second row": "SECOND_ROW",
  lf: "LOOSE_FORWARD",
  lock: "LOOSE_FORWARD",
  "loose forward": "LOOSE_FORWARD",
};

const WIKI_NAME_ALIASES: Record<string, string> = {
  "robbie hunter paul": "robbie hunterpaul",
  "robbie hunterpaul": "robbie hunter paul",
  "robbie paul": "robbie hunterpaul",
  "leslie vainikolo": "lesley vainikolo",
  "lesley vainikolo": "leslie vainikolo",
  "denis moran": "dennis moran",
  "dennis moran": "denis moran",
  "jamie jones buchanan": "jamie jones-buchanan",
  "jamie jones-buchanan": "jamie jones buchanan",
  "ian thornley": "iain thornley",
  "iain thornley": "ian thornley",
  "stephen snitch": "steve snitch",
  "stephen steve snitch": "steve snitch",
};

export function getPlayerNameLookupKeys(wikiName: string): string[] {
  const base = normalizeWikiName(wikiName);
  const keys = new Set<string>([base, base.replace(/-/g, " ")]);
  const visited = new Set<string>();
  let alias: string | undefined = WIKI_NAME_ALIASES[base];
  while (alias && !visited.has(alias)) {
    visited.add(alias);
    keys.add(alias);
    keys.add(alias.replace(/-/g, " "));
    alias = WIKI_NAME_ALIASES[alias];
  }
  return [...keys];
}

export function getWikiClubNameCandidates(club: string, year: number): string[] {
  const names = new Set<string>();

  switch (club) {
    case "Leigh Leopards":
      names.add(year >= 2022 ? "Leigh Leopards" : "Leigh Centurions");
      break;
    case "Wakefield Trinity":
      names.add(year >= 2019 ? "Wakefield Trinity" : "Wakefield Trinity Wildcats");
      break;
    case "Salford Red Devils":
      names.add(year >= 2014 ? "Salford Red Devils" : "Salford City Reds");
      break;
    case "Hull FC":
      names.add("Hull FC");
      names.add("Hull F.C.");
      break;
    case "St Helens":
      names.add("St Helens");
      names.add("St Helens RLFC");
      break;
    case "Catalans Dragons":
      names.add("Catalans Dragons");
      names.add("Catalans");
      break;
    case "Widnes Vikings":
      names.add("Widnes Vikings");
      break;
    case "London Broncos":
      names.add("London Broncos");
      break;
    case "York Knights":
      names.add("York Knights");
      names.add("York City Knights");
      break;
    case "Toulouse Olympique":
      names.add("Toulouse Olympique");
      break;
    default:
      names.add(club);
  }

  return [...names];
}

export function getClubPageTitleCandidates(club: string): string[] {
  const titles = new Set<string>();
  for (const name of getWikiClubNameCandidates(club, 2020)) {
    titles.add(name);
  }
  return [...titles];
}

export function getSeasonPageTitleCandidates(
  club: string,
  year: number
): string[] {
  const titles = new Set<string>();
  for (const wikiClub of getWikiClubNameCandidates(club, year)) {
    titles.add(`${year} ${wikiClub} season`);
  }
  return [...titles];
}

function stripWikiLinkArtifacts(name: string): string {
  return name
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\[\[([^|\]#]+)(?:\|([^\]]+))?\]\]/g, (_, link, label) => label ?? link)
    .replace(/^\[\[/, "")
    .replace(/\]\]?$/, "")
    .replace(/\([^)]*rugby league[^)]*\)/gi, "")
    .replace(/[‡†]+/g, "")
    .replace(/\d+$/g, "")
    .replace(/"[^"]*"/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeWikiName(name: string): string {
  const key = normalizePlayerNameKey(stripWikiLinkArtifacts(name));
  return WIKI_NAME_ALIASES[key] ?? key;
}

function mapWikiPosition(raw: string): Position | null {
  const key = raw
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return POSITION_MAP[key] ?? SQUAD_TEMPLATE_POS[key.replace(/\s+/g, "")] ?? null;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function cleanCell(value: string): string {
  return stripWikiLinkArtifacts(
    value.replace(/align\s*=\s*(?:center|centre|left|right)\s*\|/gi, "").replace(/'/g, "")
  );
}

function extractWikiLinkName(raw: string): string {
  const pipe = raw.match(/\[\[([^|\]]+)\|([^\]]+)\]\]/);
  if (pipe) return cleanCell(pipe[2]);
  const simple = raw.match(/\[\[([^\]]+)\]\]/);
  if (simple) return cleanCell(simple[1]);
  return cleanCell(raw);
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    joined.includes("player") &&
    (joined.includes("position") || joined.includes("tries"))
  );
}

function extractPositionLabel(raw: string): string {
  const linkMatch = raw.match(/\[\[[^\]]*#([^|\]]+)\|([^\]]+)\]\]/i);
  if (linkMatch) return linkMatch[2];
  const simpleLink = raw.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/);
  if (simpleLink) {
    const value = simpleLink[1];
    const hash = value.match(/#(.+)$/);
    return hash ? hash[1].replace(/_/g, " ") : value;
  }
  return cleanCell(raw);
}

function makeMember(
  name: string,
  position: string,
  mappedPosition: Position,
  stats: Partial<WikipediaSquadMember> = {},
  sourcePage?: string
): WikipediaSquadMember {
  const tries = stats.tries ?? 0;
  const goals = stats.goals ?? 0;
  const dropGoals = stats.dropGoals ?? 0;
  const points = stats.points ?? tries * 4 + goals * 2 + dropGoals;
  return {
    name,
    position,
    mappedPosition,
    tries,
    goals,
    dropGoals,
    points,
    appearances: stats.appearances ?? tries + goals + dropGoals,
    sourcePage,
  };
}

function parseWikitableRows(section: string, sourcePage?: string): WikipediaSquadMember[] {
  const members: WikipediaSquadMember[] = [];
  const chunks = section.split(/\n\|-[^\n]*\n/);

  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|") && !line.startsWith("|-") && !line.startsWith("|}"));

    if (lines.length < 3) continue;

    const rawCells = lines.map((line) => line.replace(/^\|/, "").trim());
    const cleaned = rawCells.map((cell) => cleanCell(cell));
    if (isHeaderRow(cleaned)) continue;

    let name = "";
    let position = "";
    let tries = 0;
    let goals = 0;
    let dropGoals = 0;
    let points = 0;

    if (/^\d+$/.test(cleaned[0]) && cleaned[1] && rawCells[2]) {
      name = cleaned[1];
      position = extractPositionLabel(rawCells[2]);
      tries = parseNumber(cleaned[3]);
      goals = parseNumber(cleaned[4]);
      dropGoals = parseNumber(cleaned[5]);
      points = parseNumber(cleaned[6]);
    } else if (cleaned[0] && extractPositionLabel(rawCells[1] ?? rawCells[2] ?? "")) {
      name = cleaned[0];
      position = extractPositionLabel(rawCells[1] ?? rawCells[2] ?? "");
      tries = parseNumber(cleaned[2] ?? cleaned[3]);
      goals = parseNumber(cleaned[3] ?? cleaned[4]);
      dropGoals = parseNumber(cleaned[4] ?? cleaned[5]);
      points = parseNumber(cleaned[5] ?? cleaned[6]);
    } else {
      // Single-cell-per-line wikitable rows (Nat / No / Player / Position / stats…)
      for (let i = 0; i < rawCells.length; i++) {
        const posLabel = extractPositionLabel(rawCells[i]);
        if (!mapWikiPosition(posLabel)) continue;

        position = posLabel;
        name = cleanCell(rawCells[i - 1] ?? "");
        const nameCell = rawCells[i - 1] ?? "";
        if (!name || /^\d+$/.test(name)) {
          name = cleanCell(rawCells[i - 2] ?? "");
        }
        if (!name || /^\d+$/.test(name) || /flagicon/i.test(nameCell)) {
          for (let j = i - 1; j >= 0; j--) {
            const candidate = cleanCell(rawCells[j]);
            if (
              candidate &&
              !/^\d+$/.test(candidate) &&
              !/flagicon/i.test(rawCells[j]) &&
              candidate.includes("[[") ||
              /^[A-Za-z]/.test(candidate)
            ) {
              name = candidate;
              break;
            }
          }
        }
        tries = parseNumber(cleaned[i + 1]);
        goals = parseNumber(cleaned[i + 2]);
        dropGoals = parseNumber(cleaned[i + 3]);
        points = parseNumber(cleaned[i + 4]);
        break;
      }
    }

    if (!name || /squad|coach|staff|updated|source|width|align/i.test(name)) continue;

    const mappedPosition = mapWikiPosition(position);
    if (!mappedPosition) continue;

    name = name.replace(/\s*\(C\)\s*$/i, "").trim();

    members.push(makeMember(name, position, mappedPosition, {
      tries, goals, dropGoals, points,
    }, sourcePage));
  }

  return members;
}

function parseSquadTableRows(wikitext: string, sourcePage?: string): WikipediaSquadMember[] {
  const wikitableMembers = parseWikitableRows(wikitext, sourcePage);
  if (wikitableMembers.length >= 13) return wikitableMembers;

  const members: WikipediaSquadMember[] = [];
  const lines = wikitext.split("\n");

  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (line.includes("|-") || line.includes("!")) continue;

    const cells = line
      .split("||")
      .map((cell) => cleanCell(cell.replace(/^\|/, "")))
      .filter((cell) => cell.length > 0);

    if (cells.length < 3) continue;
    if (isHeaderRow(cells)) continue;

    let name = "";
    let position = "";
    let tries = 0;
    let goals = 0;
    let dropGoals = 0;
    let points = 0;

    const first = cells[0];
    const second = cells[1] ?? "";
    const third = cells[2] ?? "";

    if (/^\d+$/.test(first) && second && third) {
      name = second;
      position = extractPositionLabel(third);
      tries = parseNumber(cells[3]);
      goals = parseNumber(cells[4]);
      dropGoals = parseNumber(cells[5]);
      points = parseNumber(cells[6]);
    } else if (third && mapWikiPosition(extractPositionLabel(third))) {
      name = first;
      position = extractPositionLabel(third);
      tries = parseNumber(cells[4]);
      goals = parseNumber(cells[5]);
      dropGoals = parseNumber(cells[6]);
      points = parseNumber(cells[7]);
    } else if (mapWikiPosition(extractPositionLabel(second))) {
      name = first;
      position = extractPositionLabel(second);
      tries = parseNumber(cells[2]);
      goals = parseNumber(cells[3]);
      dropGoals = parseNumber(cells[4]);
      points = parseNumber(cells[5]);
    } else {
      continue;
    }

    if (!name || name.toLowerCase() === "player") continue;
    if (/^\d+$/.test(name)) continue;
    if (/squad|coach|staff|updated|source/i.test(name)) continue;

    const mappedPosition = mapWikiPosition(position);
    if (!mappedPosition) continue;

    members.push(makeMember(name, position, mappedPosition, {
      tries, goals, dropGoals, points,
    }, sourcePage));
  }

  return members.length >= 13 ? members : wikitableMembers;
}

function parseRugbyLeagueSquadTemplate(wikitext: string, sourcePage?: string): WikipediaSquadMember[] {
  const members: WikipediaSquadMember[] = [];
  const templateMatch = wikitext.match(
    /\{\{[\s\S]*?rugby\s+league\s+squad[\s\S]*?\}\}/i
  );
  if (!templateMatch) return members;

  const body = templateMatch[0];
  const lines = body.split("\n");

  for (const line of lines) {
    const param = line.match(/^\|([^=]+)=\s*(.+)$/);
    if (!param) continue;
    const key = param[1].trim().toLowerCase().replace(/\s+/g, "");
    const value = param[2].trim();
    const mapped = SQUAD_TEMPLATE_POS[key];
    if (!mapped) continue;

    const names = value
      .split(/[,;]/)
      .map((n) => extractWikiLinkName(n))
      .filter((n) => n.length > 1 && !/coach|manager|staff/i.test(n));

    for (const name of names) {
      members.push(makeMember(name, key, mapped, {}, sourcePage));
    }
  }

  return members;
}

function parseSquadBulletLists(section: string, sourcePage?: string): WikipediaSquadMember[] {
  const members: WikipediaSquadMember[] = [];
  const lines = section.split("\n");

  for (const line of lines) {
    const bullet = line.match(/^\*+\s*(?:'''([^']+)''':?|([^:]+):)\s*(.+)$/i);
    if (!bullet) continue;

    const posLabel = (bullet[1] ?? bullet[2] ?? "").trim();
    const mapped = mapWikiPosition(posLabel);
    if (!mapped) continue;

    const namesPart = bullet[3];
    const names = namesPart
      .split(/[,;]/)
      .map((n) => extractWikiLinkName(n))
      .filter((n) => n.length > 1);

    for (const name of names) {
      members.push(makeMember(name, posLabel, mapped, {}, sourcePage));
    }
  }

  return members;
}

function parsePlayerListTemplates(wikitext: string, sourcePage?: string): WikipediaSquadMember[] {
  const members: WikipediaSquadMember[] = [];
  const regex = /\{\{rugby\s+league\s+squad\s+player[^}]*\}\}/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(wikitext)) !== null) {
    const body = match[0];
    const nameMatch = body.match(/\|name\s*=\s*([^\n|]+)/i);
    const posMatch = body.match(/\|pos\s*=\s*([^\n|]+)/i);
    if (!nameMatch || !posMatch) continue;

    const name = extractWikiLinkName(nameMatch[1]);
    const mapped = mapWikiPosition(posMatch[1].trim());
    if (!name || !mapped) continue;
    members.push(makeMember(name, posMatch[1].trim(), mapped, {}, sourcePage));
  }

  return members;
}

export function parseSquadFromWikitext(
  wikitext: string,
  year: number,
  sourcePage?: string
): WikipediaSquadMember[] {
  const section = extractSquadSection(wikitext, year);
  const fromTable = parseSquadTableRows(section, sourcePage);
  const fromTemplate = parseRugbyLeagueSquadTemplate(wikitext, sourcePage);
  const fromBullets = parseSquadBulletLists(section, sourcePage);
  const fromPlayerTemplates = parsePlayerListTemplates(wikitext, sourcePage);
  return mergeSquadMembers([fromTable, fromTemplate, fromBullets, fromPlayerTemplates]);
}

function extractSquadSection(wikitext: string, year: number): string {
  const yearStr = String(year);
  const markers = [
    new RegExp(`==\\s*${yearStr}\\s+squad\\s*statistics\\s*==`, "i"),
    new RegExp(`==\\s*${yearStr}\\s+squad\\s*==`, "i"),
    /==\s*\d{4}\s+squad\s+statistics\s*==/i,
    /==\s*squad\s+statistics\s*==/i,
    new RegExp(`==\\s*${yearStr}\\s+.*squad\\s*==`, "i"),
    /==\s*Squad\s*==/i,
    /==\s*Current\s+squad\s*==/i,
    /==\s*First-team\s+squad\s*==/i,
    /==\s*Players\s*==/i,
  ];

  for (const marker of markers) {
    const match = wikitext.match(marker);
    if (!match || match.index === undefined) continue;
    const start = match.index;
    const rest = wikitext.slice(start);
    const endMatch = rest.slice(match[0].length).match(/\n==[^=]/);
    const end = endMatch?.index
      ? start + match[0].length + endMatch.index
      : start + 15000;
    return wikitext.slice(start, end);
  }

  return wikitext;
}

function extractYearSection(wikitext: string, year: number): string {
  const yearStr = String(year);
  const marker = new RegExp(`==\\s*${yearStr}\\s*==`, "i");
  const match = wikitext.match(marker);
  if (!match || match.index === undefined) return wikitext;

  const start = match.index;
  const rest = wikitext.slice(start);
  const endMatch = rest.slice(match[0].length).match(/\n==[^=]/);
  const end = endMatch?.index
    ? start + match[0].length + endMatch.index
    : start + 15000;
  return wikitext.slice(start, end);
}

export function mergeSquadMembers(
  lists: WikipediaSquadMember[][]
): WikipediaSquadMember[] {
  const byKey = new Map<string, WikipediaSquadMember>();

  for (const list of lists) {
    for (const member of list) {
      const key = `${normalizeWikiName(member.name)}|${member.mappedPosition}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, member);
        continue;
      }
      if (
        member.points > existing.points ||
        member.tries > existing.tries ||
        member.appearances > existing.appearances
      ) {
        byKey.set(key, { ...member, sourcePage: member.sourcePage ?? existing.sourcePage });
      }
    }
  }

  return [...byKey.values()];
}

async function fetchWikitextCached(title: string): Promise<string | null> {
  return fetchWikitext(title, ERA_CACHE_DIR);
}

async function pageExists(title: string): Promise<boolean> {
  type QueryResult = {
    query?: { pages?: Record<string, { missing?: string }> };
  };
  const data = await wikiGet<QueryResult>({
    action: "query",
    titles: title,
    redirects: "1",
  });
  if (!data?.query?.pages) return false;
  return Object.values(data.query.pages).some((p) => !p.missing);
}

export async function fetchWikipediaEraSquadMultiSource(
  club: string,
  year: number
): Promise<WikipediaEraSquadResult | null> {
  const pageTitles: string[] = [];
  const seasonTitles = getSeasonPageTitleCandidates(club, year);
  const clubTitles = getClubPageTitleCandidates(club);

  // Prefer season-page squad data when it yields 13+ positioned players.
  for (const title of seasonTitles) {
    if (!await pageExists(title)) continue;
    const wikitext = await fetchWikitextCached(title);
    if (!wikitext) continue;

    pageTitles.push(title);
    const squad = parseSquadFromWikitext(wikitext, year, title);
    if (squad.length >= 13) {
      return {
        pageTitle: title,
        sourceUrl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, "_")}`,
        squad,
        pageTitles: [title],
      };
    }
  }

  const allMembers: WikipediaSquadMember[] = [];

  for (const title of [...seasonTitles, ...clubTitles]) {
    if (pageTitles.includes(title)) {
      const wikitext = await fetchWikitextCached(title);
      if (wikitext) {
        const fromSeason = parseSquadFromWikitext(wikitext, year, title);
        const fromYearSection = parseSquadFromWikitext(
          extractYearSection(wikitext, year),
          year,
          title
        );
        const fromFull = [
          ...parseRugbyLeagueSquadTemplate(wikitext, title),
          ...parseSquadBulletLists(wikitext, title),
          ...parsePlayerListTemplates(wikitext, title),
        ];
        allMembers.push(...mergeSquadMembers([fromSeason, fromYearSection, fromFull]));
      }
      continue;
    }

    if (!await pageExists(title)) continue;

    const wikitext = await fetchWikitextCached(title);
    if (!wikitext) continue;

    pageTitles.push(title);

    const fromSeason = parseSquadFromWikitext(wikitext, year, title);
    const fromYearSection = parseSquadFromWikitext(
      extractYearSection(wikitext, year),
      year,
      title
    );
    const fromFull = [
      ...parseRugbyLeagueSquadTemplate(wikitext, title),
      ...parseSquadBulletLists(wikitext, title),
      ...parsePlayerListTemplates(wikitext, title),
    ];

    allMembers.push(...mergeSquadMembers([fromSeason, fromYearSection, fromFull]));
  }

  const squad = mergeSquadMembers([allMembers]);
  if (squad.length < 13) return null;

  const primaryTitle = pageTitles[0] ?? seasonTitles[0];
  return {
    pageTitle: primaryTitle,
    sourceUrl: `https://en.wikipedia.org/wiki/${primaryTitle.replace(/ /g, "_")}`,
    squad,
    pageTitles,
  };
}

export async function fetchWikipediaEraSquad(
  club: string,
  year: number
): Promise<WikipediaEraSquadResult | null> {
  return fetchWikipediaEraSquadMultiSource(club, year);
}

export function normalizeWikipediaPlayerName(name: string): string {
  return normalizeWikiName(name);
}

export function countMappedPositions(squad: WikipediaSquadMember[]): number {
  const positions = new Set(squad.map((m) => m.mappedPosition).filter(Boolean));
  return positions.size;
}

export function squadQualityScore(squad: WikipediaSquadMember[]): number {
  return squad.reduce(
    (sum, m) => sum + m.points + m.tries * 2 + m.appearances,
    0
  );
}
