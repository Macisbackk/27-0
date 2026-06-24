/**
 * Pin every player card to an exact club + year + teamYearId.
 * Creates missing year cards for team-year roster references.
 *
 * Run: npm run migrate:player-year-cards
 * Then: npm run build:team-year-rosters && npm run validate:players
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import primeYears from "../data/prime-years.json";
import teamYearRosters from "../data/team-year-rosters.json";
import { playerBelongsToTeamYear } from "../src/lib/players/team-year-membership";
import { normalizePlayer } from "../src/lib/players/normalize";
import {
  buildPlayerTeamYearId,
  categoryToCardStatus,
  parseYearFromPlayerId,
  resolveBasePlayerId,
  resolveRawCardYear,
} from "../src/lib/players/year-card";

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  position: string;
  yearsActive: string;
  category: string;
  peakRating: number;
  value: number;
};

const DATA = join(process.cwd(), "data");
const CURRENT_YEAR = 2026;
const PRIME_YEARS = primeYears as Record<string, number>;

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clubPrefix(club: string): string {
  const map: Record<string, string> = {
    "Bradford Bulls": "bradford",
    "Leeds Rhinos": "leeds",
    "Wigan Warriors": "wigan",
    "St Helens": "st-helens",
    "Hull FC": "hull-fc",
    "Hull KR": "hull-kr",
    "Warrington Wolves": "warrington",
    "Wakefield Trinity": "wakefield",
    "Catalans Dragons": "catalans",
    "Castleford Tigers": "castleford",
    "Huddersfield Giants": "huddersfield",
    "London Broncos": "london",
    "Salford Red Devils": "salford",
    "Widnes Vikings": "widnes",
    "Leigh Leopards": "leigh",
    "Toulouse Olympique": "toulouse",
    "York Knights": "york",
  };
  return map[club] ?? slug(club);
}

function categorySegment(category: string): string {
  if (category === "current") return "cur";
  if (category === "legend") return "leg";
  return "hist";
}

function buildYearCardId(
  club: string,
  name: string,
  year: number,
  category: string
): string {
  return `${clubPrefix(club)}-${categorySegment(category)}-${slug(name)}-${year}`;
}

function pinPlayerFields(raw: RawPlayer): void {
  const year = resolveRawCardYear(raw, PRIME_YEARS);
  if (year === undefined) return;

  const club = raw.club;
  const teamYearId = buildPlayerTeamYearId(club, year);
  const basePlayerId = resolveBasePlayerId(raw.id, raw.basePlayerId as string);
  const status = categoryToCardStatus(raw.category);

  raw.year = year;
  raw.cardYear = year;
  raw.teamYearId = teamYearId;
  raw.team = club;
  raw.displayClub = club;
  raw.basePlayerId = basePlayerId;
  raw.status = status;
  raw.primaryPosition =
    (raw.primaryPosition as string | undefined) ??
    (raw.positionAbbrev as string | undefined) ??
    raw.position;

  if (!isSingleYearPinned(raw.yearsActive, year)) {
    if (raw.category === "current") {
      raw.yearsActive = `${year}–Present`;
    } else {
      raw.yearsActive = `${year}–${year}`;
    }
  }
}

function isSingleYearPinned(yearsActive: string, year: number): boolean {
  const normalized = yearsActive.replace(/-/g, "–");
  return (
    normalized === `${year}–${year}` ||
    normalized === `${year}` ||
    normalized === String(year)
  );
}

function cloneYearCard(
  base: RawPlayer,
  club: string,
  year: number,
  newId: string
): RawPlayer {
  const category =
    base.category === "legend" ? "historic" : base.category;
  const rating = Math.max(
    75,
    base.peakRating ?? (base.rating as number) ?? 80
  );

  return {
    ...base,
    id: newId,
    club,
    team: club,
    displayClub: club,
    year,
    cardYear: year,
    teamYearId: buildPlayerTeamYearId(club, year),
    basePlayerId: resolveBasePlayerId(base.id, base.basePlayerId as string),
    status: categoryToCardStatus(category),
    yearsActive: `${year}–${year}`,
    category,
    peakRating: rating,
    rating,
    primaryPosition:
      (base.primaryPosition as string | undefined) ??
      (base.positionAbbrev as string | undefined) ??
      base.position,
    availableInGame: true,
    migratedFromId: base.id,
    migratedAt: new Date().toISOString().slice(0, 10),
  };
}

function loadFiles(): {
  current: RawPlayer[];
  historic: RawPlayer[];
  legends: RawPlayer[];
} {
  return {
    current: JSON.parse(
      readFileSync(join(DATA, "current-squads.json"), "utf-8")
    ) as RawPlayer[],
    historic: JSON.parse(
      readFileSync(join(DATA, "historic-players.json"), "utf-8")
    ) as RawPlayer[],
    legends: JSON.parse(
      readFileSync(join(DATA, "legends.json"), "utf-8")
    ) as RawPlayer[],
  };
}

function buildPlayerMap(
  current: RawPlayer[],
  historic: RawPlayer[],
  legends: RawPlayer[]
): Map<string, RawPlayer> {
  const map = new Map<string, RawPlayer>();
  for (const p of [...current, ...historic, ...legends]) {
    map.set(p.id, p);
  }
  return map;
}

function findExistingYearCard(
  byId: Map<string, RawPlayer>,
  club: string,
  name: string,
  year: number,
  category: string
): RawPlayer | undefined {
  const expectedId = buildYearCardId(club, name, year, category);
  const direct = byId.get(expectedId);
  if (direct) return direct;

  for (const p of byId.values()) {
    if (p.club !== club) continue;
    if ((p.year as number | undefined) !== year && p.cardYear !== year) continue;
    if (parseYearFromPlayerId(p.id) === year && p.name === name) return p;
    if (p.name === name && p.teamYearId === buildPlayerTeamYearId(club, year)) {
      return p;
    }
  }
  return undefined;
}

function main(): void {
  const { current, historic, legends } = loadFiles();
  const beforeCount =
    current.length + historic.length + legends.length;

  const unresolved: Array<{ team: string; year: string; playerId: string; reason: string }> = [];
  const created: string[] = [];
  const rosterReplacements: Array<{
    team: string;
    year: string;
    from: string;
    to: string;
  }> = [];

  for (const p of current) {
    p.year = CURRENT_YEAR;
    p.cardYear = CURRENT_YEAR;
    if (!p.teamYearId) {
      p.teamYearId = buildPlayerTeamYearId(p.club, CURRENT_YEAR);
    }
    if (!String(p.yearsActive).includes("Present")) {
      p.yearsActive = `${CURRENT_YEAR}–Present`;
    }
    pinPlayerFields(p);
  }

  for (const p of [...historic, ...legends]) {
    pinPlayerFields(p);
  }

  const byId = buildPlayerMap(current, historic, legends);
  const rosters = teamYearRosters as Record<string, Record<string, string[]>>;
  const updatedRosters: Record<string, Record<string, string[]>> = {};

  for (const [team, years] of Object.entries(rosters)) {
    updatedRosters[team] = {};
    for (const [year, playerIds] of Object.entries(years)) {
      const nextIds: string[] = [];
      for (const playerId of playerIds) {
        let raw = byId.get(playerId);
        if (!raw) {
          unresolved.push({
            team,
            year,
            playerId,
            reason: "unknown player id",
          });
          nextIds.push(playerId);
          continue;
        }

        const normalized = normalizePlayer(raw);
        if (playerBelongsToTeamYear(normalized, team, year)) {
          pinPlayerFields(raw);
          nextIds.push(raw.id);
          continue;
        }

        const y = Number.parseInt(year, 10);
        const existing = findExistingYearCard(
          byId,
          team,
          raw.name,
          y,
          raw.category
        );

        if (existing) {
          const resolved = normalizePlayer(existing);
          if (playerBelongsToTeamYear(resolved, team, year)) {
            if (existing.id !== playerId) {
              rosterReplacements.push({
                team,
                year,
                from: playerId,
                to: existing.id,
              });
            }
            nextIds.push(existing.id);
            continue;
          }
        }

        const newId = buildYearCardId(team, raw.name, y, raw.category);
        if (!byId.has(newId)) {
          const card = cloneYearCard(raw, team, y, newId);
          historic.push(card);
          byId.set(newId, card);
          created.push(newId);
        }

        const createdCard = byId.get(newId)!;
        const resolved = normalizePlayer(createdCard);
        if (!playerBelongsToTeamYear(resolved, team, year)) {
          unresolved.push({
            team,
            year,
            playerId,
            reason: `created ${newId} still fails team-year membership`,
          });
          nextIds.push(playerId);
          continue;
        }

        if (newId !== playerId) {
          rosterReplacements.push({ team, year, from: playerId, to: newId });
        }
        nextIds.push(newId);
      }
      updatedRosters[team][year] = nextIds;
    }
  }

  const genericSuperseded = new Set<string>();
  for (const { from, to } of rosterReplacements) {
    if (from !== to) genericSuperseded.add(from);
  }

  let genericHidden = 0;
  for (const p of [...historic, ...legends]) {
    const year = resolveRawCardYear(p, PRIME_YEARS);
    if (year === undefined) {
      if (p.category !== "current") {
        p.availableInGame = false;
        genericHidden++;
      }
      unresolved.push({
        team: p.club,
        year: "?",
        playerId: p.id,
        reason: "could not derive card year",
      });
      continue;
    }

    if (p.category !== "current" && genericSuperseded.has(p.id)) {
      // Generic cards stay in DB for roster resolution; gameplay pools exclude them.
    }
  }

  writeFileSync(
    join(DATA, "current-squads.json"),
    `${JSON.stringify(current, null, 2)}\n`
  );
  writeFileSync(
    join(DATA, "historic-players.json"),
    `${JSON.stringify(historic, null, 2)}\n`
  );
  writeFileSync(
    join(DATA, "legends.json"),
    `${JSON.stringify(legends, null, 2)}\n`
  );

  const report = {
    generatedAt: new Date().toISOString(),
    playersBefore: beforeCount,
    playersAfter: current.length + historic.length + legends.length,
    cardsCreated: created.length,
    rosterIdReplacements: rosterReplacements.length,
    genericCardsHiddenFromGameplay: genericHidden,
    unresolved,
    createdCardIds: created,
    rosterReplacements,
  };

  writeFileSync(
    join(DATA, "player-year-card-migration-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );

  console.log(`Players before: ${beforeCount}`);
  console.log(`Players after: ${report.playersAfter}`);
  console.log(`Year cards created: ${created.length}`);
  console.log(`Roster ID replacements: ${rosterReplacements.length}`);
  console.log(`Generic cards hidden: ${genericHidden}`);
  console.log(`Unresolved: ${unresolved.length}`);
  console.log("Wrote data/player-year-card-migration-report.json");
  console.log("Next: npm run build:team-year-rosters && npm run validate:players");
}

main();
