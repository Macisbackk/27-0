/**
 * Add Era-only historic players required by era-starting-17s.json.
 * Appends to historic-players.json only — does not touch current-squads.json.
 *
 * Run: npm run apply:era-starting-17-players
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import eraStarting17s from "../data/era-starting-17s.json";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import playerAdditions from "../data/player-additions.json";
import { expandNameLookupKeys } from "../src/lib/players/player-name-resolve";
import type { EraStarting17Entry } from "../src/lib/players/era-starting-17s";
import type { Position } from "../src/lib/types";

const DATA_DIR = join(process.cwd(), "data");
const REPORT_PATH = join(DATA_DIR, "era-starting-17-players-apply-report.json");
const SECOND_PASS_PATH = join(DATA_DIR, "era-starting-17s-second-pass.json");

const STARTING_17_POSITION_MAP: Record<string, Position> = {
  FB: "FULLBACK",
  W: "WING",
  C: "CENTRE",
  FE: "STAND_OFF",
  HB: "SCRUM_HALF",
  FR: "PROP",
  HK: "HOOKER",
  "2R": "SECOND_ROW",
  L: "LOOSE_FORWARD",
  B: "LOOSE_FORWARD",
};

const CLUB_ID_PREFIX: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Castleford Tigers": "castleford",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds",
  "Leigh Leopards": "leigh",
  "London Broncos": "london",
  "Salford Red Devils": "salford",
  "St Helens": "st-helens",
  "Toulouse Olympique": "toulouse",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Widnes Vikings": "widnes",
  "Wigan Warriors": "wigan",
};

type RawPlayer = Record<string, unknown> & { id: string; name: string };

type PlayerRef = {
  name: string;
  club: string;
  years: number[];
  positions: string[];
  occurrences: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildNameIndex(players: RawPlayer[]): Map<string, RawPlayer> {
  const index = new Map<string, RawPlayer>();
  for (const player of players) {
    for (const key of expandNameLookupKeys(player.name)) {
      if (!index.has(key)) index.set(key, player);
    }
  }
  return index;
}

function findPlayerByNameIndex(
  name: string,
  index: Map<string, RawPlayer>
): RawPlayer | null {
  for (const key of expandNameLookupKeys(name)) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}

function collectPlayerRefs(entries: EraStarting17Entry[]): Map<string, PlayerRef> {
  const refs = new Map<string, PlayerRef>();
  for (const entry of entries) {
    for (const member of entry.squad) {
      const ref = refs.get(member.name) ?? {
        name: member.name,
        club: entry.club,
        years: [],
        positions: [],
        occurrences: 0,
      };
      ref.occurrences++;
      if (!ref.years.includes(entry.year)) ref.years.push(entry.year);
      if (!ref.positions.includes(member.position)) {
        ref.positions.push(member.position);
      }
      refs.set(member.name, ref);
    }
  }
  return refs;
}

function pickPrimaryPosition(positions: string[]): Position {
  for (const code of positions) {
    const mapped = STARTING_17_POSITION_MAP[code.trim().toUpperCase()];
    if (mapped && code.toUpperCase() !== "B") return mapped;
  }
  return STARTING_17_POSITION_MAP[positions[0]?.toUpperCase() ?? "B"] ?? "LOOSE_FORWARD";
}

function defaultRating(occurrences: number): number {
  if (occurrences >= 10) return 85;
  if (occurrences >= 5) return 82;
  if (occurrences >= 2) return 80;
  return 78;
}

function formatYearsActive(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b);
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const currentYear = new Date().getFullYear();
  if (end >= currentYear - 1) {
    return `${start}–Present`;
  }
  return `${start}–${end}`;
}

function buildPlayerId(club: string, name: string, existingIds: Set<string>): string {
  const prefix = CLUB_ID_PREFIX[club] ?? slugify(club);
  let base = `${prefix}-hist-era-${slugify(name)}`;
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function buildHistoricPlayer(
  ref: PlayerRef,
  existingIds: Set<string>,
  source: string
): RawPlayer {
  const position = pickPrimaryPosition(ref.positions);
  const peakRating = defaultRating(ref.occurrences);
  const id = buildPlayerId(ref.club, ref.name, existingIds);
  return {
    id,
    name: ref.name,
    position,
    club: ref.club,
    nationality: "England",
    era: "MODERN_ERA",
    yearsActive: formatYearsActive(ref.years),
    category: "historic",
    peakRating,
    rating: peakRating,
    value: peakRating >= 85 ? 450000 : peakRating >= 82 ? 350000 : 250000,
    appearances: 0,
    tries: 0,
    intlCaps: 0,
    clubLegend: false,
    needsReview: true,
    source,
    availableInGame: true,
  };
}

function cloneAdditionForEra(
  addition: RawPlayer,
  ref: PlayerRef,
  existingIds: Set<string>,
  source: string
): RawPlayer {
  const id = buildPlayerId(ref.club, ref.name, existingIds);
  return {
    ...addition,
    id,
    name: ref.name,
    club: ref.club,
    category: "historic",
    position: pickPrimaryPosition(ref.positions),
    yearsActive: formatYearsActive(ref.years),
    needsReview: true,
    source,
    availableInGame: true,
  };
}

function loadSecondPassKeys(): Set<string> {
  if (!existsSync(SECOND_PASS_PATH)) return new Set();
  const rows = JSON.parse(readFileSync(SECOND_PASS_PATH, "utf8")) as EraStarting17Entry[];
  return new Set(rows.map((entry) => `${entry.club}|${entry.year}`));
}

function buildPlayerSourceMap(entries: EraStarting17Entry[]): Map<string, string> {
  const secondPassKeys = loadSecondPassKeys();
  const sources = new Map<string, string>();

  for (const entry of entries) {
    const isSecondPass = secondPassKeys.has(`${entry.club}|${entry.year}`);
    const source = isSecondPass
      ? "era-starting-17s-second-pass"
      : "era-starting-17s.json";

    for (const member of entry.squad) {
      const existing = sources.get(member.name);
      if (!existing || existing === "era-starting-17s-second-pass") {
        sources.set(member.name, source);
      }
    }
  }

  return sources;
}

function main(): void {
  const entries = eraStarting17s as EraStarting17Entry[];
  const refs = collectPlayerRefs(entries);
  const playerSources = buildPlayerSourceMap(entries);

  const historic = [...(historicPlayers as RawPlayer[])];
  const additions = {
    ...(playerAdditions as { current: RawPlayer[]; historic: RawPlayer[]; legend?: RawPlayer[] }),
  };
  additions.historic = [...(additions.historic ?? [])];

  const livePlayers = [
    ...(currentSquads as RawPlayer[]),
    ...historic,
    ...(legends as RawPlayer[]),
  ];
  const liveIndex = buildNameIndex(livePlayers);
  const additionsIndex = buildNameIndex([
    ...additions.current,
    ...additions.historic,
    ...(additions.legend ?? []),
  ]);

  const existingIds = new Set([
    ...historic.map((p) => p.id),
    ...additions.historic.map((p) => p.id),
  ]);

  const resolvedLive: string[] = [];
  const mergedFromAdditions: RawPlayer[] = [];
  const created: RawPlayer[] = [];

  for (const [name, ref] of refs) {
    if (findPlayerByNameIndex(name, liveIndex)) {
      resolvedLive.push(name);
      continue;
    }

    const source =
      playerSources.get(name) ?? "era-starting-17s.json";

    const addition = findPlayerByNameIndex(name, additionsIndex);
    if (addition) {
      const player = cloneAdditionForEra(addition, ref, existingIds, source);
      historic.push(player);
      additions.historic.push(player);
      existingIds.add(player.id);
      for (const key of expandNameLookupKeys(player.name)) {
        liveIndex.set(key, player);
      }
      mergedFromAdditions.push(player);
      continue;
    }

    const player = buildHistoricPlayer(ref, existingIds, source);
    historic.push(player);
    additions.historic.push(player);
    existingIds.add(player.id);
    for (const key of expandNameLookupKeys(player.name)) {
      liveIndex.set(key, player);
    }
    created.push(player);
  }

  writeFileSync(
    join(DATA_DIR, "historic-players.json"),
    `${JSON.stringify(historic, null, 2)}\n`
  );
  writeFileSync(
    join(DATA_DIR, "player-additions.json"),
    `${JSON.stringify(additions, null, 2)}\n`
  );

  const stillMissing = [...refs.keys()].filter(
    (name) => !findPlayerByNameIndex(name, liveIndex)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totalUniqueNames: refs.size,
    resolvedFromLiveDatabase: resolvedLive.length,
    mergedFromPlayerAdditions: mergedFromAdditions.length,
    playersCreated: created.length,
    stillMissing,
    mergedPlayers: mergedFromAdditions.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club,
    })),
    createdPlayers: created.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club,
      position: p.position,
      peakRating: p.peakRating,
      source: p.source,
    })),
    secondPassPlayersCreated: created.filter(
      (p) => p.source === "era-starting-17s-second-pass"
    ).length,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[era-starting-17-players] Live DB matches: ${resolvedLive.length}`);
  console.log(`Merged from player-additions: ${mergedFromAdditions.length}`);
  console.log(`Created new era historic players: ${created.length}`);
  console.log(`Still missing: ${stillMissing.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main();
