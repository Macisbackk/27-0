/**
 * Apply Super League era verified squads + year-specific player cards.
 * Sources: Wikipedia season squad tables (sl-era-verified-squads.json).
 *
 * Run: npx tsx scripts/apply-sl-era-year-cards.ts && npm run merge:players
 *      npm run build:team-year-rosters
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import verifiedSquads from "../data/sl-era-verified-squads.json";
import type { Position } from "../src/lib/types";
import {
  YEAR_CARD_OVERRIDES,
  type YearCardOverride,
} from "./lib/year-card-overrides";

type RawPlayer = Record<string, unknown> & { id: string };
type VerifiedSquads = Record<
  string,
  Record<
    string,
    {
      source: string;
      playerIds: string[];
      positions: Position[];
      wikipediaPlayers: string[];
    }
  >
>;

const DATA_DIR = join(process.cwd(), "data");
const ADDITIONS_PATH = join(DATA_DIR, "player-additions.json");
const ERA_SQUADS_PATH = join(DATA_DIR, "era-wikipedia-squads.json");
const REPORT_PATH = join(DATA_DIR, "sl-era-fill-report.json");

/** @deprecated Import YEAR_CARD_OVERRIDES from ./lib/year-card-overrides */
const CARD_OVERRIDES = YEAR_CARD_OVERRIDES;
type CardOverride = YearCardOverride;

const NEW_PLAYERS: RawPlayer[] = [
  {
    id: "london-hist-api-pewhairangi-2018",
    name: "Api Pewhairangi",
    position: "STAND_OFF",
    club: "London Broncos",
    nationality: "New Zealand",
    era: "MODERN_ERA",
    yearsActive: "2018–2018",
    cardYear: 2018,
    category: "historic",
    peakRating: 80,
    rating: 80,
    value: 350000,
    appearances: 24,
    tries: 8,
    sourceUrl: "https://en.wikipedia.org/wiki/2018_London_Broncos_season",
  },
  {
    id: "wakefield-hist-matthew-petersen-2009",
    name: "Matthew Petersen",
    position: "LOOSE_FORWARD",
    club: "Wakefield Trinity",
    nationality: "Australia",
    era: "MODERN_ERA",
    yearsActive: "2009–2009",
    cardYear: 2009,
    category: "historic",
    peakRating: 77,
    rating: 77,
    value: 200000,
    appearances: 18,
    tries: 2,
    sourceUrl: "https://en.wikipedia.org/wiki/2009_Wakefield_Trinity_Wildcats_season",
  },
];

function loadAllPlayers(): Map<string, RawPlayer> {
  const map = new Map<string, RawPlayer>();
  for (const p of [
    ...(currentSquads as RawPlayer[]),
    ...(historicPlayers as RawPlayer[]),
    ...(legends as RawPlayer[]),
  ]) {
    map.set(p.id, p);
  }
  return map;
}

function buildYearCard(id: string, override: CardOverride, base: RawPlayer): RawPlayer {
  const yearMatch = id.match(/-(\d{4})$/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  if (!year) throw new Error(`Year card id must end with -YYYY: ${id}`);

  const rating = override.rating ?? (base.peakRating as number) ?? (base.rating as number) ?? 80;
  const category =
    base.category === "legend" ? "historic" : ((base.category as string) ?? "historic");

  const card: RawPlayer = {
    ...base,
    id,
    club: override.club,
    position: override.position,
    yearsActive: `${year}–${year}`,
    cardYear: year,
    category,
    peakRating: rating,
    rating,
    value: Math.round(rating * rating * 500),
    era: "MODERN_ERA",
  };

  if (override.nationality) card.nationality = override.nationality;
  if (override.appearances !== undefined) card.appearances = override.appearances;
  if (override.tries !== undefined) card.tries = override.tries;
  if (override.superLeagueWinner) card.superLeagueWinner = true;
  if (override.challengeCupWinner) card.challengeCupWinner = true;
  if (override.manOfSteel) card.manOfSteel = true;
  if (override.dreamTeamYears) card.dreamTeamYears = override.dreamTeamYears;

  delete card.clubLegend;
  delete card.hallOfFame;

  return card;
}

function main(): void {
  const allPlayers = loadAllPlayers();
  const squads = verifiedSquads as VerifiedSquads;
  const additions = JSON.parse(readFileSync(ADDITIONS_PATH, "utf-8")) as {
    current: RawPlayer[];
    historic: RawPlayer[];
    legend: RawPlayer[];
  };
  if (!additions.historic) additions.historic = [];

  const existingIds = new Set([
    ...additions.historic.map((p) => p.id),
    ...additions.current.map((p) => p.id),
    ...(additions.legend ?? []).map((p) => p.id),
    ...allPlayers.keys(),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    teamsCompleted: [] as string[],
    playersAdded: [] as string[],
    playersUpdated: [] as string[],
    positionsCorrected: [] as string[],
    teamsSkippedNotSuperLeague: ["Bradford Bulls 2018", "Bradford Bulls 2020"],
    teamsStillIncomplete: [] as string[],
    sourcesUsed: [] as string[],
  };

  const neededIds = new Set<string>();
  for (const [club, years] of Object.entries(squads)) {
    for (const [year, entry] of Object.entries(years)) {
      for (const id of entry.playerIds) neededIds.add(id);
      report.sourcesUsed.push(`${club} ${year}: ${entry.source}`);
    }
  }

  for (const player of NEW_PLAYERS) {
    if (!existingIds.has(player.id)) {
      additions.historic.push(player);
      existingIds.add(player.id);
      allPlayers.set(player.id, player);
      report.playersAdded.push(player.id);
    }
  }

  for (const id of neededIds) {
    if (existingIds.has(id)) continue;
    const override = CARD_OVERRIDES[id];
    if (!override) {
      report.teamsStillIncomplete.push(`Missing card definition for ${id}`);
      continue;
    }
    const base = allPlayers.get(override.baseId);
    if (!base) {
      report.teamsStillIncomplete.push(`Missing base player ${override.baseId} for ${id}`);
      continue;
    }
    const card = buildYearCard(id, override, base);
    additions.historic.push(card);
    existingIds.add(id);
    allPlayers.set(id, card);
    report.playersAdded.push(id);
    if (override.position !== base.position) {
      report.positionsCorrected.push(`${id}: ${String(base.position)} → ${override.position}`);
    }
  }

  writeFileSync(ADDITIONS_PATH, `${JSON.stringify(additions, null, 2)}\n`);

  const eraStore = existsSync(ERA_SQUADS_PATH)
    ? (JSON.parse(readFileSync(ERA_SQUADS_PATH, "utf-8")) as Record<string, Record<string, unknown>>)
    : {};

  for (const [club, years] of Object.entries(squads)) {
    if (!eraStore[club]) eraStore[club] = {};
    for (const [year, entry] of Object.entries(years)) {
      const missing = entry.playerIds.filter((id) => !allPlayers.has(id) && !existingIds.has(id));
      if (missing.length > 0) {
        report.teamsStillIncomplete.push(`${club} ${year}: missing ids ${missing.join(", ")}`);
        continue;
      }
      eraStore[club][year] = {
        playerIds: entry.playerIds,
        positions: entry.positions,
        source: entry.source,
        wikipediaPlayers: entry.wikipediaPlayers,
        verifiedAt: new Date().toISOString().slice(0, 10),
      };
      report.teamsCompleted.push(`${club} ${year}`);
    }
  }

  writeFileSync(ERA_SQUADS_PATH, `${JSON.stringify(eraStore, null, 2)}\n`);
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Added ${report.playersAdded.length} year-specific / new players`);
  console.log(`Completed ${report.teamsCompleted.length} verified Super League squads`);
  console.log(`Skipped (not Super League): ${report.teamsSkippedNotSuperLeague.join(", ")}`);
  if (report.teamsStillIncomplete.length) {
    console.log(`Incomplete: ${report.teamsStillIncomplete.length}`);
    for (const line of report.teamsStillIncomplete) console.log(`  - ${line}`);
  }
  console.log(`Report: ${REPORT_PATH}`);
}

main();
