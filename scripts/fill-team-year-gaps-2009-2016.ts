/**
 * Fill missing Normal Mode team-year XIII pools for Super League 2009 & 2016.
 *
 * - Remaps Castleford/Salford 2009 leaked current IDs → historic year-cards
 * - For club-years with no Wikipedia XIII, derives jersey 1–13 from
 *   era-starting-17s.json and ensures matching historic year-cards exist
 * - Writes into era-wikipedia-squads.json + historic-players.json
 *
 * Run: npx tsx scripts/fill-team-year-gaps-2009-2016.ts
 * Then: npm run build:team-year-rosters && npm run validate:team-years
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import eraStarting17s from "../data/era-starting-17s.json";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { expandNameLookupKeys } from "../src/lib/players/player-name-resolve";
import { buildPlayerTeamYearId } from "../src/lib/players/year-card";
import { parsePlayerId } from "../src/lib/players/prime-year";
import { normalizePlayer } from "../src/lib/players/normalize";
import { playerBelongsToTeamYear } from "../src/lib/players/team-year-membership";
import type { EraStarting17Entry } from "../src/lib/players/era-starting-17s";
import type { Position } from "../src/lib/types";

const DATA_DIR = join(process.cwd(), "data");
const WIKI_PATH = join(DATA_DIR, "era-wikipedia-squads.json");
const HISTORIC_PATH = join(DATA_DIR, "historic-players.json");
const REPORT_PATH = join(DATA_DIR, "fill-team-year-gaps-2009-2016-report.json");

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
  "London Broncos": "london",
  "Salford Red Devils": "salford",
  "St Helens": "st-helens",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Wigan Warriors": "wigan",
};

/** Club-years that need a full Wikipedia XIII derived from starting-17s. */
const MISSING_CLUB_YEARS: Array<{ club: string; year: number }> = [
  { club: "Huddersfield Giants", year: 2009 },
  { club: "Hull KR", year: 2009 },
  { club: "London Broncos", year: 2009 },
  { club: "St Helens", year: 2009 },
  { club: "Warrington Wolves", year: 2009 },
  { club: "Wigan Warriors", year: 2009 },
  { club: "Huddersfield Giants", year: 2016 },
  { club: "Hull FC", year: 2016 },
  { club: "Salford Red Devils", year: 2016 },
  { club: "St Helens", year: 2016 },
  { club: "Wakefield Trinity", year: 2016 },
];

/** Leaked current IDs → existing historic year-cards. */
const ID_REMAPS: Array<{
  club: string;
  year: string;
  from: string;
  to: string;
}> = [
  {
    club: "Castleford Tigers",
    year: "2009",
    from: "york-cur-jordan-thompson",
    to: "castleford-cur-jordan-thompson-2009",
  },
  {
    club: "Castleford Tigers",
    year: "2009",
    from: "castleford-cur-joe-westerman",
    to: "castleford-cur-joe-westerman-2009",
  },
  {
    club: "Salford Red Devils",
    year: "2009",
    from: "st-helens-hist-jordan-turner",
    to: "salford-cur-jordan-turner-2009",
  },
];

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
};

type WikiSquad = {
  playerIds: string[];
  positions: string[];
  source: string;
  wikipediaPlayers: string[];
  verifiedAt: string;
};

type WikiFile = Record<string, Record<string, WikiSquad>>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapPosition(code: string): Position {
  return STARTING_17_POSITION_MAP[code.trim().toUpperCase()] ?? "LOOSE_FORWARD";
}

function loadAllRaw(): RawPlayer[] {
  return [
    ...(currentSquads as RawPlayer[]),
    ...(historicPlayers as RawPlayer[]),
    ...(legends as RawPlayer[]),
  ];
}

function buildNameIndex(players: RawPlayer[]): Map<string, RawPlayer[]> {
  const index = new Map<string, RawPlayer[]>();
  for (const player of players) {
    for (const key of expandNameLookupKeys(player.name)) {
      const list = index.get(key) ?? [];
      list.push(player);
      index.set(key, list);
    }
  }
  return index;
}

function candidatesByName(
  name: string,
  index: Map<string, RawPlayer[]>
): RawPlayer[] {
  const seen = new Set<string>();
  const out: RawPlayer[] = [];
  for (const key of expandNameLookupKeys(name)) {
    for (const player of index.get(key) ?? []) {
      if (seen.has(player.id)) continue;
      seen.add(player.id);
      out.push(player);
    }
  }
  return out;
}

function findBelongingYearCard(
  name: string,
  club: string,
  year: number,
  index: Map<string, RawPlayer[]>,
  byId: Map<string, RawPlayer>
): RawPlayer | null {
  const yearStr = String(year);
  for (const raw of candidatesByName(name, index)) {
    const player = normalizePlayer(raw);
    if (playerBelongsToTeamYear(player, club, yearStr)) {
      return byId.get(player.id) ?? raw;
    }
  }
  // Prefer an exact *-YYYY id for this club even if normalize hasn't run yet.
  const suffix = `-${year}`;
  for (const raw of candidatesByName(name, index)) {
    if (!raw.id.endsWith(suffix)) continue;
    if (raw.club === club || String(raw.cardYear) === yearStr) {
      return raw;
    }
  }
  return null;
}

function pickBaseForClone(
  name: string,
  club: string,
  index: Map<string, RawPlayer[]>
): RawPlayer | null {
  const candidates = candidatesByName(name, index);
  if (candidates.length === 0) return null;

  const sameClub = candidates.filter((p) => p.club === club);
  const historic =
    sameClub.find((p) => p.category !== "current") ??
    candidates.find((p) => p.category !== "current") ??
    sameClub[0] ??
    candidates[0]!;

  return historic;
}

function yearCardId(club: string, name: string, year: number, existing: Set<string>): string {
  const prefix = CLUB_ID_PREFIX[club] ?? slugify(club);
  let base = `${prefix}-hist-${slugify(name)}-${year}`;
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base.replace(/-\d{4}$/, "")}-${i}-${year}`)) i++;
  return `${prefix}-hist-${slugify(name)}-${i}-${year}`;
}

function cloneYearCard(
  base: RawPlayer,
  club: string,
  year: number,
  position: Position,
  existingIds: Set<string>
): RawPlayer {
  const baseId = parsePlayerId(base.id).baseId;
  const id = yearCardId(club, String(base.name), year, existingIds);
  const rating =
    (typeof base.peakRating === "number" ? base.peakRating : null) ??
    (typeof base.rating === "number" ? base.rating : null) ??
    80;

  const card: RawPlayer = {
    ...base,
    id,
    name: base.name,
    club,
    position,
    primaryPosition: position,
    category: "historic",
    status: "Historic",
    era: "MODERN_ERA",
    yearsActive: `${year}–${year}`,
    cardYear: year,
    year,
    teamYearId: buildPlayerTeamYearId(club, year),
    basePlayerId: baseId,
    peakRating: rating,
    rating,
    value: Math.round(rating * rating * 500),
    availableInGame: true,
    source: `era-starting-17s-${year}-fill`,
  };

  delete card.clubLegend;
  delete card.hallOfFame;
  delete card.needsReview;

  return card;
}

function createFreshYearCard(
  name: string,
  club: string,
  year: number,
  position: Position,
  existingIds: Set<string>
): RawPlayer {
  const id = yearCardId(club, name, year, existingIds);
  const rating = 80;
  return {
    id,
    name,
    club,
    position,
    primaryPosition: position,
    nationality: "England",
    era: "MODERN_ERA",
    yearsActive: `${year}–${year}`,
    cardYear: year,
    year,
    category: "historic",
    status: "Historic",
    teamYearId: buildPlayerTeamYearId(club, year),
    peakRating: rating,
    rating,
    value: Math.round(rating * rating * 500),
    appearances: 0,
    tries: 0,
    availableInGame: true,
    source: `era-starting-17s-${year}-fill`,
  };
}

function getStarting13(
  club: string,
  year: number
): Array<{ name: string; position: Position; number: number }> {
  const entry = (eraStarting17s as EraStarting17Entry[]).find(
    (e) => e.club === club && e.year === year
  );
  if (!entry) {
    throw new Error(`No era-starting-17s entry for ${club} ${year}`);
  }
  return [...entry.squad]
    .filter((m) => m.number >= 1 && m.number <= 13)
    .sort((a, b) => a.number - b.number)
    .map((m) => ({
      name: m.name,
      position: mapPosition(m.position),
      number: m.number,
    }));
}

function main(): void {
  const wiki = JSON.parse(readFileSync(WIKI_PATH, "utf8")) as WikiFile;
  const historic = [...(historicPlayers as RawPlayer[])];
  let allRaw = loadAllRaw();
  let byId = new Map(allRaw.map((p) => [p.id, p]));
  let nameIndex = buildNameIndex(allRaw);
  const existingIds = new Set(allRaw.map((p) => p.id));

  const report = {
    generatedAt: new Date().toISOString(),
    remapped: [] as string[],
    yearCardsCreated: [] as string[],
    squadsWritten: [] as string[],
    unresolved: [] as string[],
  };

  // 1) Remap leaked current IDs on existing wiki XIII entries.
  for (const remap of ID_REMAPS) {
    const squad = wiki[remap.club]?.[remap.year];
    if (!squad?.playerIds) {
      report.unresolved.push(
        `remap missing squad: ${remap.club} ${remap.year}`
      );
      continue;
    }
    if (!byId.has(remap.to)) {
      report.unresolved.push(`remap target missing: ${remap.to}`);
      continue;
    }
    const idx = squad.playerIds.indexOf(remap.from);
    if (idx < 0) {
      // Already remapped or different id — skip quietly if `to` already present.
      if (squad.playerIds.includes(remap.to)) continue;
      report.unresolved.push(
        `remap source not in squad: ${remap.from} (${remap.club} ${remap.year})`
      );
      continue;
    }
    squad.playerIds[idx] = remap.to;
    report.remapped.push(`${remap.club} ${remap.year}: ${remap.from} → ${remap.to}`);
  }

  // 2) Build missing XIII from starting-17s + year-cards.
  for (const { club, year } of MISSING_CLUB_YEARS) {
    if (wiki[club]?.[String(year)]?.playerIds?.length === 13) {
      // Already present — leave alone unless we want to overwrite. Skip.
      continue;
    }

    const starters = getStarting13(club, year);
    if (starters.length !== 13) {
      report.unresolved.push(
        `${club} ${year}: starting-17 jersey 1–13 count ${starters.length}`
      );
      continue;
    }

    const playerIds: string[] = [];
    const positions: string[] = [];
    const wikipediaPlayers: string[] = [];

    for (const starter of starters) {
      let card = findBelongingYearCard(
        starter.name,
        club,
        year,
        nameIndex,
        byId
      );

      if (!card) {
        const base = pickBaseForClone(starter.name, club, nameIndex);
        card = base
          ? cloneYearCard(base, club, year, starter.position, existingIds)
          : createFreshYearCard(
              starter.name,
              club,
              year,
              starter.position,
              existingIds
            );
        historic.push(card);
        existingIds.add(card.id);
        byId.set(card.id, card);
        allRaw.push(card);
        // Refresh name index entry for this card.
        for (const key of expandNameLookupKeys(card.name)) {
          const list = nameIndex.get(key) ?? [];
          list.push(card);
          nameIndex.set(key, list);
        }
        report.yearCardsCreated.push(card.id);
      }

      playerIds.push(card.id);
      positions.push(starter.position);
      wikipediaPlayers.push(starter.name);
    }

    if (!wiki[club]) wiki[club] = {};
    wiki[club][String(year)] = {
      playerIds,
      positions,
      source: `era-starting-17s.json (${club} ${year} jersey 1–13)`,
      wikipediaPlayers,
      verifiedAt: new Date().toISOString().slice(0, 10),
    };
    report.squadsWritten.push(`${club} ${year}`);
  }

  writeFileSync(WIKI_PATH, `${JSON.stringify(wiki, null, 2)}\n`, "utf8");
  writeFileSync(HISTORIC_PATH, `${JSON.stringify(historic, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Remapped: ${report.remapped.length}`);
  for (const line of report.remapped) console.log(`  ${line}`);
  console.log(`Year cards created: ${report.yearCardsCreated.length}`);
  console.log(`Squads written: ${report.squadsWritten.length}`);
  for (const line of report.squadsWritten) console.log(`  ${line}`);
  if (report.unresolved.length) {
    console.log(`Unresolved: ${report.unresolved.length}`);
    for (const line of report.unresolved) console.log(`  ! ${line}`);
  }
  console.log(`Report: ${REPORT_PATH}`);
}

main();
