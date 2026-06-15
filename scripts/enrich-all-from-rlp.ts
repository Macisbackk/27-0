/**
 * Enrich all 27-0 players from Rugby League Project (list + summary cache).
 * Fills: nationality, yearsActive, tries, position, dateOfBirth, birthYear,
 * clubsPlayedFor, representativeTeams. Does not fill intlCaps or appearances.
 *
 * Prerequisites:
 *   scripts/rlp-players.html  (export from /players/all.html)
 *   scripts/rlp-cache/{id}.html  (run: npm run download:rlp)
 *
 * Run: npx tsx scripts/enrich-all-from-rlp.ts
 * Report: data/rlp-enrichment-report.json
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";
import yearsActiveCorrections from "../data/years-active-corrections.json";
import birthYearsData from "../data/birth-years.json";
import {
  buildRlpIdMap,
  parseRlpList,
  readCachedSummary,
  parseSummaryPage,
  parseCareerYears,
  birthYearFromDob,
  isoDateFromDob,
  GAME_POS_TO_LABEL,
  nameKey,
  type RlpListRow,
} from "./lib/rlp-parse";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const CACHE_DIR = join(__dirname, "rlp-cache");
const REPORT_PATH = join(DATA_DIR, "rlp-enrichment-report.json");
const BIRTH_YEARS_PATH = join(DATA_DIR, "birth-years.json");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;

const YEARS_ACTIVE_OVERRIDES = new Set(
  Object.keys(yearsActiveCorrections as Record<string, string>)
);
const RATING_OVERRIDE_IDS = new Set(Object.keys(PLAYER_RATING_OVERRIDES));
const EXISTING_BIRTH_YEARS = { ...(birthYearsData as Record<string, number>) };

const UTILITY_OVERRIDE_IDS = new Set(["hull-kr-hist-graeme-horne"]);

type RawPlayer = {
  id: string;
  name: string;
  club: string;
  position: string;
  primaryPosition?: string;
  nationality: string;
  yearsActive: string;
  category: "current" | "historic" | "legend";
  peakRating: number;
  value?: number;
  rating?: number;
  appearances?: number;
  tries?: number;
  intlCaps?: number;
  dateOfBirth?: string;
  birthYear?: number;
  clubsPlayedFor?: string[];
  representativeTeams?: string[];
  availableInGame?: boolean;
};

interface FieldCounts {
  nationality: number;
  yearsActive: number;
  tries: number;
  position: number;
  dateOfBirth: number;
  birthYear: number;
  clubsPlayedFor: number;
  representativeTeams: number;
  category: number;
}

interface PlayerUpdate {
  id: string;
  name: string;
  file: string;
  fields: string[];
}

function isHiddenOrArchived(player: RawPlayer): boolean {
  if (player.availableInGame === false) return true;
  if (player.id === "jm-goat-joe-mellor") return true;
  if (player.id.startsWith("ssh-sam-hallas-")) return true;
  return false;
}

function isMissingNationality(nat: string | undefined): boolean {
  return !nat || nat === "Unknown";
}

function isMissingPosition(pos: string | undefined): boolean {
  if (!pos) return true;
  const key = pos.trim().toLowerCase();
  return key === "unknown" || key === "";
}

function hasManualPosition(player: RawPlayer): boolean {
  if (player.primaryPosition) return true;
  if (UTILITY_OVERRIDE_IDS.has(player.id)) return true;
  return !isMissingPosition(player.position);
}

function needsTries(player: RawPlayer): boolean {
  return player.tries === undefined || player.tries === null;
}

function syncCategory(player: RawPlayer): boolean {
  if (player.category === "legend") return false;
  const shouldBeCurrent = player.yearsActive.includes("Present");
  const target: "current" | "historic" = shouldBeCurrent ? "current" : "historic";
  if (player.category === target) return false;
  player.category = target;
  return true;
}

function enrichPlayer(
  player: RawPlayer,
  listRow: RlpListRow | undefined,
  summaryHtml: string | null,
  file: string,
  stats: {
    fieldCounts: FieldCounts;
    updatedPlayers: PlayerUpdate[];
    unmatched: { id: string; name: string; file: string }[];
    stillMissing: { id: string; name: string; file: string; fields: string[] }[];
    duplicateNameHits: { name: string; count: number }[];
  }
): boolean {
  const key = nameKey(player.name);
  if (!listRow && !summaryHtml) {
    stats.unmatched.push({ id: player.id, name: player.name, file });
    return false;
  }

  const fields: string[] = [];
  const summary = summaryHtml ? parseSummaryPage(summaryHtml) : null;

  if (summaryHtml && summary) {
    summary.yearsActive = parseCareerYears(
      summaryHtml,
      player.category === "current" || player.yearsActive.includes("Present")
    );
  }

  if (isMissingNationality(player.nationality)) {
    const nat = summary?.nationality ?? null;
    if (nat) {
      player.nationality = nat;
      fields.push("nationality");
      stats.fieldCounts.nationality++;
    }
  }

  if (
    !YEARS_ACTIVE_OVERRIDES.has(player.id) &&
    (!player.yearsActive ||
      player.yearsActive === "Unknown" ||
      player.yearsActive.endsWith("–Unknown"))
  ) {
    const years = summary?.yearsActive ?? null;
    if (years) {
      player.yearsActive = years;
      fields.push("yearsActive");
      stats.fieldCounts.yearsActive++;
    }
  } else if (
    !YEARS_ACTIVE_OVERRIDES.has(player.id) &&
    summary?.yearsActive &&
    (player.yearsActive === "Unknown" || !player.yearsActive.includes("–"))
  ) {
    player.yearsActive = summary.yearsActive;
    fields.push("yearsActive");
    stats.fieldCounts.yearsActive++;
  }

  if (needsTries(player) && listRow && listRow.tries !== null && listRow.tries >= 0) {
    player.tries = listRow.tries;
    fields.push("tries");
    stats.fieldCounts.tries++;
  }

  if (!hasManualPosition(player) && listRow?.primaryPosition) {
    const label = GAME_POS_TO_LABEL[listRow.primaryPosition];
    if (label) {
      player.position = label;
      fields.push("position");
      stats.fieldCounts.position++;
    }
  }

  const listDob = listRow?.dob;
  const summaryDob = summary?.dateOfBirth;

  if (!player.dateOfBirth) {
    const iso =
      summaryDob ?? (listDob ? isoDateFromDob(listDob) : null);
    if (iso) {
      player.dateOfBirth = iso;
      fields.push("dateOfBirth");
      stats.fieldCounts.dateOfBirth++;
    }
  }

  if (!player.birthYear) {
    const by =
      summary?.birthYear ??
      (listDob ? birthYearFromDob(listDob) : null) ??
      (player.dateOfBirth ? birthYearFromDob(player.dateOfBirth) : null);
    if (by) {
      player.birthYear = by;
      fields.push("birthYear");
      stats.fieldCounts.birthYear++;
    }
  } else if (player.dateOfBirth && !player.birthYear) {
    const by = birthYearFromDob(player.dateOfBirth);
    if (by) {
      player.birthYear = by;
      fields.push("birthYear");
      stats.fieldCounts.birthYear++;
    }
  }

  const baseId = player.id.replace(/-\d{4}$/, "");
  if (
    EXISTING_BIRTH_YEARS[player.id] === undefined &&
    EXISTING_BIRTH_YEARS[baseId] === undefined &&
    player.birthYear
  ) {
    EXISTING_BIRTH_YEARS[player.id] = player.birthYear;
  }

  if (
    (!player.clubsPlayedFor || player.clubsPlayedFor.length === 0) &&
    summary &&
    summary.clubsPlayedFor.length > 0
  ) {
    player.clubsPlayedFor = summary.clubsPlayedFor;
    fields.push("clubsPlayedFor");
    stats.fieldCounts.clubsPlayedFor++;
  }

  if (
    (!player.representativeTeams || player.representativeTeams.length === 0) &&
    summary &&
    summary.representativeTeams.length > 0
  ) {
    player.representativeTeams = summary.representativeTeams;
    fields.push("representativeTeams");
    stats.fieldCounts.representativeTeams++;
  }

  if (syncCategory(player)) {
    fields.push("category");
    stats.fieldCounts.category++;
  }

  if (fields.length > 0) {
    stats.updatedPlayers.push({ id: player.id, name: player.name, file, fields });
    return true;
  }

  const missingFields: string[] = [];
  if (isMissingNationality(player.nationality)) missingFields.push("nationality");
  if (!player.yearsActive || player.yearsActive === "Unknown")
    missingFields.push("yearsActive");
  if (needsTries(player)) missingFields.push("tries");
  if (!player.dateOfBirth && !player.birthYear && !EXISTING_BIRTH_YEARS[player.id])
    missingFields.push("birthYear");
  if (isMissingPosition(player.position) && !player.primaryPosition)
    missingFields.push("position");

  if (missingFields.length > 0) {
    stats.stillMissing.push({
      id: player.id,
      name: player.name,
      file,
      fields: missingFields,
    });
  }

  return false;
}

function detectDuplicateDbNames(
  allPlayers: RawPlayer[]
): { name: string; ids: string[] }[] {
  const byName = new Map<string, string[]>();
  for (const p of allPlayers) {
    const key = nameKey(p.name);
    const list = byName.get(key) ?? [];
    list.push(p.id);
    byName.set(key, list);
  }
  return [...byName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, ids]) => ({ name, ids }));
}

function main() {
  if (!existsSync(HTML_PATH)) {
    console.error(`Missing ${HTML_PATH} — export from Rugby League Project first.`);
    process.exit(1);
  }

  const listHtml = readFileSync(HTML_PATH, "utf-8");
  const idMap = buildRlpIdMap(listHtml);
  const listByName = parseRlpList(listHtml);

  const stats = {
    fieldCounts: {
      nationality: 0,
      yearsActive: 0,
      tries: 0,
      position: 0,
      dateOfBirth: 0,
      birthYear: 0,
      clubsPlayedFor: 0,
      representativeTeams: 0,
      category: 0,
    } satisfies FieldCounts,
    updatedPlayers: [] as PlayerUpdate[],
    unmatched: [] as { id: string; name: string; file: string }[],
    stillMissing: [] as {
      id: string;
      name: string;
      file: string;
      fields: string[];
    }[],
    duplicateNameHits: [] as { name: string; count: number }[],
    skippedHidden: 0,
    skippedArchived: 0,
    ratingOverridesUntouched: RATING_OVERRIDE_IDS.size,
    filesChanged: [] as string[],
  };

  let processed = 0;
  let withRlpMatch = 0;
  let cacheHits = 0;
  const allEligible: RawPlayer[] = [];

  for (const file of FILES) {
    const path = join(DATA_DIR, file);
    const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];
    let fileChanged = false;

    for (const player of players) {
      if (player.id.startsWith("ssh-sam-hallas-")) {
        stats.skippedHidden++;
        continue;
      }
      if (player.id === "jm-goat-joe-mellor") {
        stats.skippedHidden++;
        continue;
      }
      if (player.availableInGame === false) {
        stats.skippedArchived++;
        continue;
      }

      allEligible.push(player);
      processed++;
      const key = nameKey(player.name);
      const rlpId = idMap.get(key);
      const listRow = listByName.get(key);
      if (rlpId || listRow) withRlpMatch++;

      const summaryHtml = rlpId ? readCachedSummary(CACHE_DIR, rlpId) : null;
      if (summaryHtml) cacheHits++;

      if (enrichPlayer(player, listRow, summaryHtml, file, stats)) {
        fileChanged = true;
      } else if (!rlpId && !listRow) {
        /* already recorded unmatched */
      }
    }

    if (fileChanged) {
      writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
      stats.filesChanged.push(file);
    }
    console.log(`${file}: ${fileChanged ? "updated" : "unchanged"}`);
  }

  const sortedBirthYears = Object.fromEntries(
    Object.entries(EXISTING_BIRTH_YEARS).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(BIRTH_YEARS_PATH, `${JSON.stringify(sortedBirthYears, null, 2)}\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    source: "rugbyleagueproject.org",
    processed,
    withRlpMatch,
    cacheHits,
    skippedHidden: stats.skippedHidden,
    skippedArchived: stats.skippedArchived,
    ratingOverridesUntouched: stats.ratingOverridesUntouched,
    fieldCounts: stats.fieldCounts,
    playersUpdated: stats.updatedPlayers.length,
    updatedPlayers: stats.updatedPlayers,
    stillMissingCount: stats.stillMissing.length,
    stillMissing: stats.stillMissing.slice(0, 200),
    unmatchedCount: stats.unmatched.length,
    unmatched: stats.unmatched.slice(0, 100),
    duplicateIssues: detectDuplicateDbNames(allEligible),
    filesChanged: stats.filesChanged,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\nRLP enrichment complete:");
  console.log(`  Players processed: ${processed}`);
  console.log(`  RLP name matches: ${withRlpMatch}`);
  console.log(`  Summary cache hits: ${cacheHits}`);
  console.log(`  Players updated: ${stats.updatedPlayers.length}`);
  console.log(`  Field fills:`, stats.fieldCounts);
  console.log(`  Still missing data: ${stats.stillMissing.length}`);
  console.log(`  No RLP match: ${stats.unmatched.length}`);
  console.log(`  Report: ${REPORT_PATH}`);
}

main();
