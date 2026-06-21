/**
 * Temporary: parse Wikipedia era cache files for priority seasons.
 * Run: npx tsx scripts/tmp-parse-wikipedia-squads.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { normalizePlayer } from "../src/lib/players/normalize";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";
import { SQUAD_STRUCTURE } from "../src/lib/positions";
import type { Player, Position } from "../src/lib/types";
import {
  getPlayerNameLookupKeys,
  parseSquadFromWikitext,
  type WikipediaSquadMember,
} from "./lib/sources/wikipedia-era-squad";

const CACHE_DIR = join(__dirname, "lib", "wikipedia-era-cache");

const SEASONS: {
  cacheFile: string;
  club: string;
  year: number;
}[] = [
  { cacheFile: "2018-bradford-bulls-season.json", club: "Bradford Bulls", year: 2018 },
  { cacheFile: "2020-bradford-bulls-season.json", club: "Bradford Bulls", year: 2020 },
  { cacheFile: "2008-catalans-dragons-season.json", club: "Catalans Dragons", year: 2008 },
  { cacheFile: "2015-leeds-rhinos-season.json", club: "Leeds Rhinos", year: 2015 },
  { cacheFile: "2018-london-broncos-season.json", club: "London Broncos", year: 2018 },
  { cacheFile: "2015-salford-red-devils-season.json", club: "Salford Red Devils", year: 2015 },
  {
    cacheFile: "2009-wakefield-trinity-wildcats-season.json",
    club: "Wakefield Trinity",
    year: 2009,
  },
  { cacheFile: "2006-wigan-warriors-season.json", club: "Wigan Warriors", year: 2006 },
  { cacheFile: "2008-wigan-warriors-season.json", club: "Wigan Warriors", year: 2008 },
];

type SeasonReport = {
  cacheFile: string;
  club: string;
  year: number;
  pageTitle: string | null;
  cacheExists: boolean;
  totalWithMappedPositions: number;
  uniquePlayers: number;
  positionCounts: Record<Position, number>;
  missingForFullXiii: { position: Position; required: number; have: number; short: number }[];
  notInDatabase: string[];
  suggestedLineup: {
    position: Position;
    wikiName: string;
    dbName: string | null;
    dbId: string | null;
    inDatabase: boolean;
  }[];
  dbMappedCount: number;
  squadSample: { name: string; position: string; mappedPosition: Position | null; points: number }[];
};

function loadAllPlayers(): Player[] {
  return [
    ...(currentSquads as Record<string, unknown>[]),
    ...(historicPlayers as Record<string, unknown>[]),
    ...(legends as Record<string, unknown>[]),
  ]
    .map(normalizePlayer)
    .filter((p) => p.availableInGame !== false);
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

function scoreWikiMember(member: WikipediaSquadMember, player: Player | null): number {
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

function countPositions(squad: WikipediaSquadMember[]): Record<Position, number> {
  const counts = Object.fromEntries(
    SQUAD_STRUCTURE.map(({ position }) => [position, 0])
  ) as Record<Position, number>;
  for (const member of squad) {
    if (member.mappedPosition) counts[member.mappedPosition]++;
  }
  return counts;
}

function missingPositions(counts: Record<Position, number>) {
  return SQUAD_STRUCTURE.flatMap(({ position, count }) => {
    const have = counts[position] ?? 0;
    if (have >= count) return [];
    return [{ position, required: count, have, short: count - have }];
  });
}

function selectBestThirteen(
  squad: WikipediaSquadMember[],
  index: Map<string, Player[]>
): SeasonReport["suggestedLineup"] {
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

  const lineup: SeasonReport["suggestedLineup"] = [];
  const usedIds = new Set<string>();
  const usedWikiNames = new Set<string>();

  for (const { position, count } of SQUAD_STRUCTURE) {
    const candidates = byPosition.get(position) ?? [];
    let picked = 0;

    for (const member of candidates) {
      if (picked >= count) break;
      const player = findPlayerForWikiName(member.name, index);
      if (player && usedIds.has(player.id)) continue;
      if (usedWikiNames.has(member.name.toLowerCase())) continue;

      if (player) usedIds.add(player.id);
      usedWikiNames.add(member.name.toLowerCase());
      lineup.push({
        position,
        wikiName: member.name,
        dbName: player?.name ?? null,
        dbId: player?.id ?? null,
        inDatabase: !!player,
      });
      picked++;
    }

    while (picked < count) {
      lineup.push({
        position,
        wikiName: "(none available)",
        dbName: null,
        dbId: null,
        inDatabase: false,
      });
      picked++;
    }
  }

  return lineup;
}

function loadCacheWikitext(cacheFile: string): { title: string; wikitext: string } | null {
  const path = join(CACHE_DIR, cacheFile);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as {
      title?: string;
      wikitext?: string;
    };
    if (!data.wikitext) return null;
    return { title: data.title ?? cacheFile.replace(/\.json$/, ""), wikitext: data.wikitext };
  } catch {
    return null;
  }
}

function analyzeSeason(
  spec: (typeof SEASONS)[number],
  index: Map<string, Player[]>
): SeasonReport {
  const cached = loadCacheWikitext(spec.cacheFile);
  if (!cached) {
    return {
      cacheFile: spec.cacheFile,
      club: spec.club,
      year: spec.year,
      pageTitle: null,
      cacheExists: false,
      totalWithMappedPositions: 0,
      uniquePlayers: 0,
      positionCounts: countPositions([]),
      missingForFullXiii: SQUAD_STRUCTURE.map(({ position, count }) => ({
        position,
        required: count,
        have: 0,
        short: count,
      })),
      notInDatabase: [],
      suggestedLineup: SQUAD_STRUCTURE.flatMap(({ position, count }) =>
        Array.from({ length: count }, () => ({
          position,
          wikiName: "(cache missing)",
          dbName: null,
          dbId: null,
          inDatabase: false,
        }))
      ),
      dbMappedCount: 0,
      squadSample: [],
    };
  }

  const squad = parseSquadFromWikitext(cached.wikitext, spec.year, cached.title);
  const mapped = squad.filter((m) => m.mappedPosition);
  const uniqueNames = new Set(mapped.map((m) => m.name.toLowerCase()));
  const positionCounts = countPositions(mapped);

  const notInDatabase = [...new Set(mapped.map((m) => m.name))].filter(
    (name) => !findPlayerForWikiName(name, index)
  );

  const suggestedLineup = selectBestThirteen(mapped, index);
  const dbMappedCount = suggestedLineup.filter((s) => s.inDatabase).length;

  return {
    cacheFile: spec.cacheFile,
    club: spec.club,
    year: spec.year,
    pageTitle: cached.title,
    cacheExists: true,
    totalWithMappedPositions: mapped.length,
    uniquePlayers: uniqueNames.size,
    positionCounts,
    missingForFullXiii: missingPositions(positionCounts),
    notInDatabase: notInDatabase.sort((a, b) => a.localeCompare(b)),
    suggestedLineup,
    dbMappedCount,
    squadSample: mapped.slice(0, 5).map((m) => ({
      name: m.name,
      position: m.position,
      mappedPosition: m.mappedPosition,
      points: m.points,
    })),
  };
}

function main(): void {
  const players = loadAllPlayers();
  const index = buildPlayerIndex(players);
  const reports = SEASONS.map((spec) => analyzeSeason(spec, index));

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
}

main();
