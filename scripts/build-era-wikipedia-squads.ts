/**
 * Build Wikipedia-verified Era Challenge Cup starting 13s.
 * Source: Wikipedia season pages, club pages, squad templates (Wikipedia only).
 *
 * Run: npm run build:era-wikipedia-squads
 * Report: data/era-wikipedia-audit-report.json
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { ERA_CHALLENGE_CLUBS } from "../src/lib/players/era-teams";
import { SQUAD_STRUCTURE } from "../src/lib/positions";
import type { Player, Position } from "../src/lib/types";
import { normalizePlayer } from "../src/lib/players/normalize";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";
import {
  fetchWikipediaEraSquadMultiSource,
  getPlayerNameLookupKeys,
  squadQualityScore,
  type WikipediaSquadMember,
} from "./lib/sources/wikipedia-era-squad";

const DATA_DIR = join(process.cwd(), "data");
const DELAY_MS = 1100;
const MIN_YEAR = 1996;
const MAX_YEAR = new Date().getFullYear() + 1;

const CLUB_FILTER = process.argv
  .find((a) => a.startsWith("--clubs="))
  ?.slice("--clubs=".length)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Iconic years to process first per club. */
const PRIORITY_YEARS: Record<string, number[]> = {
  "Bradford Bulls": [2001, 2003, 2005],
  "Wigan Warriors": [2010, 2013, 2014, 2018],
  "Leeds Rhinos": [2004, 2007, 2009, 2011, 2015],
  "St Helens": [2000, 2002, 2006, 2014, 2019, 2021],
  "Catalans Dragons": [2018, 2021],
  "Hull KR": [2024],
};

type AuditEntry = {
  club: string;
  year: string;
  status: "complete" | "removed";
  complete: boolean;
  removed: boolean;
  source: string | null;
  wikipediaPages: string[];
  qualityScore: number;
  playersKept: string[];
  playersRemoved: string[];
  playersAdded: string[];
  wikipediaPlayers: string[];
  missingFromDatabase: string[];
  reason?: string;
};

type SquadStore = Record<
  string,
  Record<
    string,
    {
      playerIds: string[];
      positions: Position[];
      source: string;
      wikipediaPlayers: string[];
      verifiedAt: string;
    }
  >
>;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadAllPlayers(): Player[] {
  const legendIds = new Set(
    (legends as Record<string, unknown>[]).map((p) => p.id as string)
  );
  return [
    ...(currentSquads as Record<string, unknown>[]),
    ...(historicPlayers as Record<string, unknown>[]),
    ...(legends as Record<string, unknown>[]),
  ]
    .filter((p) => !legendIds.has(p.id as string) || true)
    .map(normalizePlayer)
    .filter((p) => p.availableInGame !== false);
}

function findPlayerForWikiName(
  wikiName: string,
  index: Map<string, Player[]>
): Player | null {
  for (const key of getPlayerNameLookupKeys(wikiName)) {
    const candidates = index.get(key) ?? [];
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => (b.peakRating ?? 0) - (a.peakRating ?? 0));
    return candidates[0] ?? null;
  }
  return null;
}

function buildPlayerIndex(players: Player[]): Map<string, Player[]> {
  const index = new Map<string, Player[]>();
  for (const player of players) {
    const key = normalizePlayerNameKey(player.name);
    const list = index.get(key) ?? [];
    list.push(player);
    index.set(key, list);
  }
  return index;
}

function scoreWikiMember(
  member: WikipediaSquadMember,
  player: Player | null
): number {
  let score = member.points * 10 + member.tries * 5 + member.appearances;
  if (!player) return score;

  score += (player.peakRating ?? 0) * 100;
  score += (player.intlCaps ?? 0) * 50;
  if (player.category === "legend") score += 500;
  if (player.manOfSteel) score += 300;
  if (player.clubLegend) score += 200;
  if ((player.dreamTeamYears?.length ?? 0) > 0) score += 150;
  if ((player.goldenBootYears?.length ?? 0) > 0) score += 150;
  return score;
}

function selectBestThirteen(
  squad: WikipediaSquadMember[],
  index: Map<string, Player[]>
): {
  playerIds: string[];
  positions: Position[];
  wikipediaPlayers: string[];
  missingFromDatabase: string[];
} {
  const byPosition = new Map<Position, WikipediaSquadMember[]>();

  for (const member of squad) {
    if (!member.mappedPosition) continue;
    const list = byPosition.get(member.mappedPosition) ?? [];
    list.push(member);
    byPosition.set(member.mappedPosition, list);
  }

  for (const [position, list] of byPosition.entries()) {
    list.sort((a, b) => {
      const playerA = findPlayerForWikiName(a.name, index);
      const playerB = findPlayerForWikiName(b.name, index);
      return scoreWikiMember(b, playerB) - scoreWikiMember(a, playerA);
    });
    byPosition.set(position, list);
  }

  const playerIds: string[] = [];
  const positions: Position[] = [];
  const wikipediaPlayers: string[] = [];
  const missingFromDatabase: string[] = [];
  const usedIds = new Set<string>();

  for (const { position, count } of SQUAD_STRUCTURE) {
    const candidates = byPosition.get(position) ?? [];
    let picked = 0;

    for (const member of candidates) {
      if (picked >= count) break;
      const player = findPlayerForWikiName(member.name, index);
      if (!player || usedIds.has(player.id)) continue;
      usedIds.add(player.id);
      playerIds.push(player.id);
      positions.push(position);
      wikipediaPlayers.push(member.name);
      picked++;
    }

    if (picked < count) {
      for (const member of candidates) {
        if (picked >= count) break;
        if (wikipediaPlayers.includes(member.name)) continue;
        missingFromDatabase.push(member.name);
      }
    }
  }

  return { playerIds, positions, wikipediaPlayers, missingFromDatabase };
}

function getYearsForClub(club: string): number[] {
  const allYears: number[] = [];
  for (let y = MAX_YEAR; y >= MIN_YEAR; y--) allYears.push(y);

  const priority = PRIORITY_YEARS[club] ?? [];
  const prioritySet = new Set(priority);
  const rest = allYears.filter((y) => !prioritySet.has(y));
  return [...priority, ...rest];
}

function loadExistingStore(): SquadStore {
  const path = join(DATA_DIR, "era-wikipedia-squads.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SquadStore;
  } catch {
    return {};
  }
}

function countCompleteTeams(store: SquadStore): number {
  let total = 0;
  for (const years of Object.values(store)) {
    total += Object.keys(years).length;
  }
  return total;
}

function loadPreviousAuditEntries(): AuditEntry[] {
  const path = join(DATA_DIR, "era-wikipedia-audit-report.json");
  if (!existsSync(path)) return [];
  try {
    const report = JSON.parse(readFileSync(path, "utf-8")) as {
      entries?: AuditEntry[];
    };
    return report.entries ?? [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  console.log(`[era-wiki] Starting build${CLUB_FILTER ? ` (clubs: ${CLUB_FILTER.join(", ")})` : ""}`);
  const players = loadAllPlayers();
  const index = buildPlayerIndex(players);
  const store: SquadStore = loadExistingStore();
  const audit: AuditEntry[] = [];

  let checked = 0;
  let complete = 0;

  for (const club of ERA_CHALLENGE_CLUBS) {
    if (CLUB_FILTER && !CLUB_FILTER.includes(club)) continue;
    const years = getYearsForClub(club);

    for (const year of years) {
      const yearStr = String(year);
      checked++;

      const wiki = await fetchWikipediaEraSquadMultiSource(club, year);
      await sleep(DELAY_MS);

      if (!wiki) {
        audit.push({
          club,
          year: yearStr,
          status: "removed",
          complete: false,
          removed: true,
          source: null,
          wikipediaPages: [],
          qualityScore: 0,
          playersKept: [],
          playersRemoved: [],
          playersAdded: [],
          wikipediaPlayers: [],
          missingFromDatabase: [],
          reason: "No credible Wikipedia squad data for 13 positions",
        });
        continue;
      }

      const selection = selectBestThirteen(wiki.squad, index);
      const previousIds = store[club]?.[yearStr]?.playerIds ?? [];
      const qualityScore = squadQualityScore(wiki.squad);

      if (selection.playerIds.length !== 13) {
        audit.push({
          club,
          year: yearStr,
          status: "removed",
          complete: false,
          removed: true,
          source: wiki.sourceUrl,
          wikipediaPages: wiki.pageTitles,
          qualityScore,
          playersKept: selection.playerIds.map(
            (id) => players.find((p) => p.id === id)?.name ?? id
          ),
          playersRemoved: [],
          playersAdded: [],
          wikipediaPlayers: selection.wikipediaPlayers,
          missingFromDatabase: selection.missingFromDatabase,
          reason: `Could not map 13 database players (${selection.playerIds.length}/13)`,
        });
        continue;
      }

      if (!store[club]) store[club] = {};
      store[club][yearStr] = {
        playerIds: selection.playerIds,
        positions: selection.positions,
        source: wiki.sourceUrl,
        wikipediaPlayers: selection.wikipediaPlayers,
        verifiedAt: new Date().toISOString().slice(0, 10),
      };

      const keptNames = selection.playerIds.map(
        (id) => players.find((p) => p.id === id)?.name ?? id
      );
      const removedNames = previousIds
        .filter((id) => !selection.playerIds.includes(id))
        .map((id) => players.find((p) => p.id === id)?.name ?? id);
      const addedNames = selection.playerIds
        .filter((id) => !previousIds.includes(id))
        .map((id) => players.find((p) => p.id === id)?.name ?? id);

      audit.push({
        club,
        year: yearStr,
        status: "complete",
        complete: true,
        removed: false,
        source: wiki.sourceUrl,
        wikipediaPages: wiki.pageTitles,
        qualityScore,
        playersKept: keptNames,
        playersRemoved: removedNames,
        playersAdded: addedNames,
        wikipediaPlayers: selection.wikipediaPlayers,
        missingFromDatabase: selection.missingFromDatabase,
      });
      complete++;
      process.stdout.write(
        `\r[era-wiki] ${club} ${yearStr} ✓ (${complete} complete / ${checked} checked)`
      );
    }
  }

  const totalCompleteInStore = countCompleteTeams(store);
  console.log(
    `\n[era-wiki] This run: ${complete} complete / ${checked} checked`
  );
  console.log(`[era-wiki] Total complete teams in store: ${totalCompleteInStore}`);

  writeFileSync(
    join(DATA_DIR, "era-wikipedia-squads.json"),
    `${JSON.stringify(store, null, 2)}\n`
  );

  const runKeys = new Set(audit.map((e) => `${e.club}\0${e.year}`));
  const preservedEntries = CLUB_FILTER
    ? loadPreviousAuditEntries().filter(
        (e) =>
          !CLUB_FILTER.includes(e.club) &&
          !runKeys.has(`${e.club}\0${e.year}`)
      )
    : [];
  const mergedEntries = [...audit, ...preservedEntries];

  const report = {
    generatedAt: new Date().toISOString(),
    source: "Wikipedia only — season pages, club pages, squad templates",
    summary: {
      checkedThisRun: checked,
      completeThisRun: complete,
      removedThisRun: checked - complete,
      totalCompleteInStore,
      clubFilter: CLUB_FILTER ?? null,
    },
    entries: mergedEntries.sort(
      (a, b) =>
        a.club.localeCompare(b.club) || Number(b.year) - Number(a.year)
    ),
  };

  writeFileSync(
    join(DATA_DIR, "era-wikipedia-audit-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );

  const mdLines = [
    "# Era Wikipedia Squad Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Source: Wikipedia only — season pages, club pages, squad templates`,
    "",
    `**${totalCompleteInStore}** complete teams in store`,
    "",
    `This run: **${complete}** complete / **${checked}** checked / **${checked - complete}** removed`,
    "",
    "## Complete Teams",
    "",
    "| Club | Year | Quality | Source | Players |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const entry of mergedEntries.filter((e) => e.complete)) {
    mdLines.push(
      `| ${entry.club} | ${entry.year} | ${entry.qualityScore} | [Wikipedia](${entry.source}) | ${entry.playersKept.join(", ")} |`
    );
  }

  mdLines.push("", "## Removed Teams", "", "| Club | Year | Reason |", "| --- | --- | --- |");
  for (const entry of mergedEntries.filter((e) => !e.complete)) {
    mdLines.push(
      `| ${entry.club} | ${entry.year} | ${entry.reason ?? "Incomplete"} |`
    );
  }

  writeFileSync(join(DATA_DIR, "era-wikipedia-audit-report.md"), `${mdLines.join("\n")}\n`);
  console.log("[era-wiki] Wrote era-wikipedia-squads.json and audit report");
}

void main();
