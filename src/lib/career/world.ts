// Slim copy of data/current-squads.json (npm run build:runtime-player-data).
import currentSquads from "../players/generated/career-squads.runtime.json";
import { buildClubSeeds, type ClubSeed } from "./clubs";
import { registerOccupiedPlayerNames } from "./names";
import { SQUAD_MAX, SQUAD_TEMPLATE, autoPickLineup, generatePlayer, lineupRating, posFromData } from "./players";
import { newCareerSeed, randInt, rngFor } from "./rng";
import { startSeason } from "./season";
import type { CareerClub, CareerPlayer, CareerState, Pos } from "./types";

type SquadRow = {
  id: string;
  name: string;
  club: string;
  position?: string;
  peakRating: number;
  birthYear?: number;
  nationality?: string;
  availableInGame?: boolean;
};

export const START_YEAR = 2026;

function realPlayer(row: SquadRow, rng: () => number): CareerPlayer {
  const age = row.birthYear ? Math.max(17, START_YEAR - row.birthYear) : 26;
  const headroom = age <= 21 ? 3 + Math.floor(rng() * 6) : age <= 24 ? Math.floor(rng() * 4) : age <= 27 ? Math.floor(rng() * 2) : 0;
  return {
    id: row.id,
    name: row.name,
    pos: posFromData(row.position),
    rating: row.peakRating,
    potential: Math.min(95, row.peakRating + headroom),
    age,
    nationality: row.nationality ?? "England",
    real: true,
    apps: 0,
    tries: 0,
    careerApps: 0,
    careerTries: 0,
  };
}

/** Starting prestige: Super League 2.5–4, Championship 1–2.5, by squad strength within the division. */
function startingPrestige(seed: ClubSeed, rankInDivision: number, divisionSize: number): number {
  const share = 1 - rankInDivision / Math.max(1, divisionSize - 1);
  const raw = seed.division === "super-league" ? 2.5 + share * 1.5 : 1 + share * 1.5;
  return Math.round(raw * 2) / 2;
}

export interface ClubChoice {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  accent?: string;
  division: ClubSeed["division"];
  rating: number;
  prestige: number;
  realPlayers: number;
}

/** Build the 2026 world (clubs + squads). Used for both the club picker and new careers. */
export function buildWorld(seed: string): { clubs: Record<string, CareerClub>; players: Record<string, CareerPlayer>; choices: ClubChoice[] } {
  const rng = rngFor(seed, "world");
  const seeds = buildClubSeeds();
  const clubs: Record<string, CareerClub> = {};
  const players: Record<string, CareerPlayer> = {};
  const byDataName = new Map(seeds.map((s) => [s.dataName.toLowerCase(), s]));

  registerOccupiedPlayerNames((currentSquads as SquadRow[]).map((r) => r.name));

  for (const s of seeds) {
    clubs[s.id] = { id: s.id, name: s.name, short: s.short, primary: s.primary, secondary: s.secondary, accent: s.accent, division: s.division, squad: [] };
  }
  const realCounts: Record<string, number> = {};
  for (const row of currentSquads as SquadRow[]) {
    const seedClub = byDataName.get((row.club ?? "").toLowerCase());
    if (!seedClub) continue;
    // `availableInGame: false` hides Championship players from Classic (Super League only);
    // Manager Mode has the Championship, so only honour the flag for Super League squads.
    if (row.availableInGame === false && seedClub.division === "super-league") continue;
    const p = realPlayer(row, rng);
    players[p.id] = p;
    clubs[seedClub.id]!.squad.push(p.id);
    realCounts[seedClub.id] = (realCounts[seedClub.id] ?? 0) + 1;
  }

  // Generated depth so every club has a full, balanced 24.
  for (const s of seeds) {
    const club = clubs[s.id]!;
    const counts: Record<Pos, number> = { FB: 0, WG: 0, CE: 0, SO: 0, SH: 0, PR: 0, HK: 0, SR: 0, LF: 0 };
    for (const id of club.squad) counts[players[id]!.pos]++;
    const level = s.division === "super-league" ? 79 : s.strength;
    for (const pos of Object.keys(SQUAD_TEMPLATE) as Pos[]) {
      while (counts[pos] < SQUAD_TEMPLATE[pos]) {
        const p = generatePlayer(rng, { clubId: s.id, pos, level, age: randInt(rng, 19, 31), idPrefix: `w-${s.id}` });
        players[p.id] = p;
        club.squad.push(p.id);
        counts[pos]++;
      }
    }
    // Real 2026 squads with academy players can run past SQUAD_MAX. Start the club at the
    // limit by leaving out its lowest-rated (then youngest) real players in over-stocked positions.
    while (club.squad.length > SQUAD_MAX) {
      const spare = club.squad
        .map((id) => players[id]!)
        .filter((p) => p.real && counts[p.pos] > SQUAD_TEMPLATE[p.pos])
        .sort((a, b) => a.rating - b.rating || a.age - b.age || a.id.localeCompare(b.id))[0];
      if (!spare) break;
      club.squad = club.squad.filter((id) => id !== spare.id);
      delete players[spare.id];
      counts[spare.pos]--;
      realCounts[s.id] = (realCounts[s.id] ?? 1) - 1;
    }
  }

  const choices: ClubChoice[] = [];
  for (const division of ["super-league", "championship"] as const) {
    const inDiv = seeds
      .filter((s) => s.division === division)
      .map((s) => ({ s, rating: lineupRating(autoPickLineup(clubs[s.id]!.squad.map((id) => players[id]!)), players) }))
      .sort((a, b) => b.rating - a.rating);
    inDiv.forEach(({ s, rating }, i) =>
      choices.push({
        id: s.id,
        name: s.name,
        short: s.short,
        primary: s.primary,
        secondary: s.secondary,
        accent: s.accent,
        division,
        rating: Math.round(rating * 10) / 10,
        prestige: startingPrestige(s, i, inDiv.length),
        realPlayers: realCounts[s.id] ?? 0,
      })
    );
  }
  return { clubs, players, choices };
}

export function createCareer(opts: { clubId: string; managerName: string; seed?: string }): CareerState {
  const seed = opts.seed ?? newCareerSeed();
  const { clubs, players, choices } = buildWorld(seed);
  const choice = choices.find((c) => c.id === opts.clubId);
  if (!choice) throw new Error(`Unknown club ${opts.clubId}`);
  const state: CareerState = {
    version: 1,
    seed,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    managerName: opts.managerName.trim() || "Coach",
    userClubId: choice.id,
    startDivision: choice.division,
    year: START_YEAR,
    seasonNumber: 1,
    budget: 0,
    prestige: choice.prestige,
    tactic: "balanced",
    lineup: autoPickLineup(clubs[choice.id]!.squad.map((id) => players[id]!)),
    clubs,
    players,
    freeAgents: [],
    calendar: [],
    matchdayIndex: 0,
    tables: { "super-league": [], championship: [] },
    challenges: [],
    seasonTrack: { unbeatenRun: 0, bestUnbeatenRun: 0, biggestWinMargin: 0, academyDebutIds: [], pointsScored: 0, cupRoundReached: 0 },
    phase: "season",
    history: [],
    news: [`${opts.managerName.trim() || "Coach"} takes charge of ${choice.name}.`],
  };
  const started = startSeason(state);
  // Big squads in small leagues (e.g. London in the Championship) cost more than the board pays.
  // A new manager never starts in debt: the board covers the gap plus a little to spend.
  if (started.budget < STARTING_BUDGET_FLOOR) started.budget = STARTING_BUDGET_FLOOR;
  return started;
}

/** Minimum budget on day one of a new career. */
export const STARTING_BUDGET_FLOOR = 100_000;
