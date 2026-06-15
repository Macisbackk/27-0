/**
 * Enrich player birth years from Wikipedia ONLY.
 * Run: npm run enrich:wikipedia-birth
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import eraSquads from "../data/era-wikipedia-squads.json";
import { normalizePlayer } from "../src/lib/players/normalize";
import { resolveBirthYear, getPlayerAge } from "../src/lib/players/player-age";
import { getPlayerById } from "../src/lib/players";
import {
  DELAY_MS,
  fetchPageExtract,
  fetchWikitext,
  mentionsRugbyLeague,
  namesLikelyMatch,
  normalizeForMatch,
  searchWikipediaTitles,
  sleep,
  writeCache,
} from "./lib/wikipedia-api";

const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const CACHE_DIR = join(__dirname, "wikipedia-cache");
const BIRTH_YEARS_PATH = join(DATA_DIR, "birth-years.json");
const AUDIT_PATH = join(DATA_DIR, "wikipedia-birth-audit-report.json");

type RawPlayer = Record<string, unknown> & { id: string; name: string };
type BirthAuditEntry = {
  playerId: string;
  name: string;
  status: "found" | "not_found" | "ambiguous" | "skipped";
  sourceUrl: string | null;
  birthYear?: number;
  dateOfBirth?: string;
  note?: string;
};

type BirthParse = { birthYear: number; dateOfBirth?: string };

function isBirthPlausible(raw: RawPlayer, birth: BirthParse): boolean {
  const player = normalizePlayer(raw);
  const testPlayer = {
    ...player,
    birthYear: birth.birthYear,
    dateOfBirth: birth.dateOfBirth ?? player.dateOfBirth,
  };
  const age = getPlayerAge(testPlayer);
  if (age === undefined) return true;
  if (age < 0) return false;
  if (player.category === "current") return age <= 50;
  if (age < 15 || age > 45) return false;
  return true;
}

function loadBirthYears(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(BIRTH_YEARS_PATH, "utf-8")) as Record<string, number>;
  } catch {
    return {};
  }
}

function hasBirthData(
  raw: RawPlayer,
  overrides: Record<string, number>
): boolean {
  const id = raw.id;
  const baseId = id.replace(/-\d{4}$/, "");
  if (raw.birthYear !== undefined || raw.dateOfBirth) return true;
  if (overrides[id] !== undefined || overrides[baseId] !== undefined) return true;
  return false;
}

function buildTargetList(overrides: Record<string, number>): RawPlayer[] {
  const legendIds = new Set(
    (legends as RawPlayer[]).map((p) => p.id)
  );
  const seen = new Set<string>();
  const targets: RawPlayer[] = [];

  const add = (raw: RawPlayer) => {
    const baseId = raw.id.replace(/-\d{4}$/, "");
    if (seen.has(baseId)) return;
    if (hasBirthData(raw, overrides)) return;
    seen.add(baseId);
    targets.push(raw);
  };

  for (const p of legends as RawPlayer[]) add(p);
  for (const p of historicPlayers as RawPlayer[]) {
    if (!legendIds.has(p.id)) add(p);
  }
  for (const p of currentSquads as RawPlayer[]) add(p);

  const eraIds = new Set<string>();
  for (const clubYears of Object.values(eraSquads as Record<string, Record<string, { playerIds: string[] }>>)) {
    for (const entry of Object.values(clubYears)) {
      for (const id of entry.playerIds ?? []) eraIds.add(id);
    }
  }
  for (const id of eraIds) {
    const player = getPlayerById(id);
    if (!player) continue;
    const raw: RawPlayer = { id: player.id, name: player.name };
    add(raw);
  }

  return targets;
}

function parseBirthFromWikitext(wikitext: string): BirthParse | null {
  const patterns: RegExp[] = [
    /\{\{birth date and age\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\{\{Birth date and age\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\{\{birth date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\{\{Birth date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\{\{bda\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\|birth_date\s*=\s*\{\{birth date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\|dateofbirth\s*=\s*\{\{birth date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\|date_of_birth\s*=\s*\{\{birth date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
    /\|birth_date\s*=\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    /\|dateofbirth\s*=\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    /\(born\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\)/i,
    /born\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    /\{\{birth year and age\|(\d{4})/i,
    /\{\{bya\|(\d{4})/i,
    /\(born\s+(\d{4})\)/i,
    /born\s+(\d{4})\b/i,
  ];

  const monthMap: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  for (const pattern of patterns) {
    const match = wikitext.match(pattern);
    if (!match) continue;

    if (match.length >= 4 && monthMap[match[2].toLowerCase()]) {
      const day = Number.parseInt(match[1], 10);
      const month = monthMap[match[2].toLowerCase()];
      const year = Number.parseInt(match[3], 10);
      if (year >= 1900 && year <= new Date().getFullYear()) {
        const dateOfBirth = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { birthYear: year, dateOfBirth };
      }
    }

    const year = Number.parseInt(match[1], 10);
    if (year >= 1900 && year <= new Date().getFullYear()) {
      if (match.length >= 4 && !monthMap[match[2]?.toLowerCase() ?? ""]) {
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const dateOfBirth = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return { birthYear: year, dateOfBirth };
        }
      }
      return { birthYear: year };
    }
  }

  return null;
}

function parseBirthFromExtract(extract: string): BirthParse | null {
  return parseBirthFromWikitext(extract);
}

async function resolveBirthForPlayer(name: string): Promise<{
  status: "found" | "not_found" | "ambiguous";
  sourceUrl: string | null;
  birth?: BirthParse;
}> {
  const queries = [name, `${name} rugby league`];
  const titleCandidates = new Set<string>();

  for (const query of queries) {
    const titles = await searchWikipediaTitles(query);
    for (const t of titles) titleCandidates.add(t);
    await sleep(DELAY_MS);
  }

  const matches: Array<{ title: string; birth: BirthParse }> = [];

  for (const title of titleCandidates) {
    if (!namesLikelyMatch(title, name)) continue;

    const extractPage = await fetchPageExtract(title, CACHE_DIR);
    const extractText = `${extractPage?.description ?? ""} ${extractPage?.extract ?? ""}`;
    if (!mentionsRugbyLeague(extractText) && !mentionsRugbyLeague(title)) continue;

    const wikitext = await fetchWikitext(title, CACHE_DIR);
    const birth =
      (wikitext ? parseBirthFromWikitext(wikitext.slice(0, 8000)) : null) ??
      (extractPage?.extract ? parseBirthFromExtract(extractPage.extract) : null);

    if (birth) matches.push({ title, birth });
  }

  if (matches.length === 0) return { status: "not_found", sourceUrl: null };

  const birthYears = new Set(matches.map((m) => m.birth.birthYear));
  if (birthYears.size > 1) {
    return {
      status: "ambiguous",
      sourceUrl: `https://en.wikipedia.org/wiki/${matches[0].title.replace(/ /g, "_")}`,
      birth: matches[0].birth,
    };
  }

  const best = matches[0];
  return {
    status: "found",
    sourceUrl: `https://en.wikipedia.org/wiki/${best.title.replace(/ /g, "_")}`,
    birth: best.birth,
  };
}

function updateRawPlayerFiles(
  playerId: string,
  birth: BirthParse,
  fileMaps: { legends: RawPlayer[]; historic: RawPlayer[]; current: RawPlayer[] }
): boolean {
  const baseId = playerId.replace(/-\d{4}$/, "");
  let changed = false;

  const updateList = (list: RawPlayer[]) => {
    for (const p of list) {
      if (p.id !== playerId && p.id !== baseId && !p.id.startsWith(`${baseId}-`)) continue;
      if (birth.dateOfBirth) p.dateOfBirth = birth.dateOfBirth;
      p.birthYear = birth.birthYear;
      changed = true;
    }
  };

  updateList(fileMaps.legends);
  updateList(fileMaps.historic);
  updateList(fileMaps.current);
  return changed;
}

async function main(): Promise<void> {
  const overrides = loadBirthYears();
  const targets = buildTargetList(overrides);
  const audit: BirthAuditEntry[] = [];
  let found = 0;
  let notFound = 0;
  let ambiguous = 0;

  const fileMaps = {
    legends: [...(legends as RawPlayer[])],
    historic: [...(historicPlayers as RawPlayer[])],
    current: [...(currentSquads as RawPlayer[])],
  };

  console.log(`[birth-wiki] ${targets.length} players without birth data`);

  for (let i = 0; i < targets.length; i++) {
    const raw = targets[i];
    const baseId = raw.id.replace(/-\d{4}$/, "");

    const result = await resolveBirthForPlayer(raw.name);

    if (result.status === "found" && result.birth) {
      if (!isBirthPlausible(raw, result.birth)) {
        notFound++;
        audit.push({
          playerId: baseId,
          name: raw.name,
          status: "not_found",
          sourceUrl: result.sourceUrl,
          birthYear: result.birth.birthYear,
          note: "Rejected implausible birth year for player category/reference year",
        });
        continue;
      }
      overrides[baseId] = result.birth.birthYear;
      updateRawPlayerFiles(raw.id, result.birth, fileMaps);
      found++;
      audit.push({
        playerId: baseId,
        name: raw.name,
        status: "found",
        sourceUrl: result.sourceUrl,
        birthYear: result.birth.birthYear,
        dateOfBirth: result.birth.dateOfBirth,
      });
    } else if (result.status === "ambiguous") {
      ambiguous++;
      audit.push({
        playerId: baseId,
        name: raw.name,
        status: "ambiguous",
        sourceUrl: result.sourceUrl,
        birthYear: result.birth?.birthYear,
        dateOfBirth: result.birth?.dateOfBirth,
        note: "Multiple Wikipedia pages with conflicting birth years",
      });
      if (result.birth) overrides[baseId] = result.birth.birthYear;
    } else {
      notFound++;
      audit.push({
        playerId: baseId,
        name: raw.name,
        status: "not_found",
        sourceUrl: null,
      });
    }

    if ((i + 1) % 25 === 0) {
      writeFileSync(BIRTH_YEARS_PATH, `${JSON.stringify(overrides, null, 2)}\n`);
      writeCache(CACHE_DIR, "audit-progress", { processed: i + 1, found, notFound });
      console.log(`  Processed ${i + 1}/${targets.length} — found ${found}`);
    }
  }

  writeFileSync(BIRTH_YEARS_PATH, `${JSON.stringify(overrides, null, 2)}\n`);
  writeFileSync(join(DATA_DIR, "legends.json"), `${JSON.stringify(fileMaps.legends, null, 2)}\n`);
  writeFileSync(join(DATA_DIR, "historic-players.json"), `${JSON.stringify(fileMaps.historic, null, 2)}\n`);
  writeFileSync(join(DATA_DIR, "current-squads.json"), `${JSON.stringify(fileMaps.current, null, 2)}\n`);

  const allRaw = [...fileMaps.legends, ...fileMaps.historic, ...fileMaps.current];
  const withBirth = allRaw.filter((p) => {
    const n = normalizePlayer(p);
    return resolveBirthYear(n.birthYear, n.dateOfBirth) !== undefined;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    source: "Wikipedia only",
    summary: {
      targets: targets.length,
      found,
      notFound,
      ambiguous,
      totalPlayers: allRaw.length,
      withBirthData: withBirth.length,
      withoutBirthData: allRaw.length - withBirth.length,
    },
    entries: audit,
  };

  writeFileSync(AUDIT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n[birth-wiki] Done: found ${found}, not found ${notFound}, ambiguous ${ambiguous}`);
  console.log(`[birth-wiki] Birth coverage: ${withBirth.length}/${allRaw.length}`);
}

void main();
