import seedrandom from "seedrandom";
import {
  getClubFacilities,
  getFacilityDevelopmentMultiplier,
  getYouthIntakePotentialBonus,
  getYouthIntakePotentialFloor,
  getYouthIntakeRatingBoost,
  getYouthIntakeRollShift,
} from "./managerFacilities";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import {
  decomposeRLScore,
  pickRLScore,
  pickScorePairAllowingDraw,
  snapToRLScore,
} from "../game/rl-scores";
import type { Position } from "../types";
import { POSITION_SHORT, SQUAD_STRUCTURE } from "../positions";
import type {
  ManagerCareer,
  ManagerReservePlayer,
  ReserveFixtureResult,
} from "./types";
import {
  addReserveCallUpInboxMessage,
  addReserveReturnInboxMessage,
} from "./managerInbox";
import { createInitialPlayerState } from "./managerSquad";
import {
  computeCareerWageBill,
  generatePromotedReserveContract,
  generateReserveYouthContract,
} from "./managerReserveContracts";
import { deductTransferFee } from "./managerFinance";
import { reserveToPlayer, getManagerPlayerAge } from "./managerPlayers";
import { reconcileLeagueRosters } from "./managerLeagueRosters";
import { dispatchAchievementCheck } from "../achievements/achievementNotify";
import type { Player } from "../types";
import type { PlayerDevelopmentState } from "./types";
import {
  RESERVE_MIN_RATING,
  clampReservePlayerRating,
} from "../players/rating-floors";

const FIRST_NAMES = [
  "Jack", "Tom", "Liam", "Ethan", "Noah", "Mason", "Harvey", "Finn",
  "Callum", "Ryan", "Luke", "Ben", "Sam", "Joe", "Max", "Ollie",
  "Kai", "Tyler", "Dylan", "Connor", "Josh", "Alex", "George", "Charlie",
];

const LAST_NAMES = [
  "Ashton", "Brooks", "Carter", "Davies", "Evans", "Fletcher", "Grant",
  "Hughes", "Ingram", "Johnson", "Knight", "Lewis", "Mason", "Nolan",
  "Owen", "Price", "Quinn", "Reid", "Shaw", "Taylor", "Walsh", "Young",
];

const NATIONALITIES = ["England", "Wales", "Scotland", "Ireland", "France", "Australia"];

const FRENCH_RESERVE_CLUBS = new Set([
  "Toulouse Olympique",
  "Catalans Dragons",
]);

/** Minimum registered reserves required to *play* a reserve fixture. */
export const RESERVE_MIN_PLAYERS = 13;
/** Ideal matchday size: 13 starters + 4 interchange. */
export const RESERVE_IDEAL_PLAYERS = 17;
/** @deprecated Use RESERVE_MIN_PLAYERS — kept as alias for older call sites. */
export const RESERVE_SQUAD_MIN = RESERVE_MIN_PLAYERS;
/** Soft floor — every club keeps at least this many reserves for depth. */
export const RESERVE_DEPTH_MIN = 22;
/** Preferred reserve listing size when topping up coverage. */
export const RESERVE_DEPTH_TARGET = 26;
export const RESERVE_SQUAD_MAX = 30;
export const RESERVE_RECRUITMENT_FEE = 300_000;
export const RESERVE_WALKOVER_SCORE = 18;
export const RESERVE_WALKOVER_REASON = "Walkover — fewer than 13 reserve players";
export const GENERATED_RESERVE_MAX_RATING = 82;
export const RESERVE_RATING_BANDS = [
  { min: 65, max: 69, weight: 0.25 },
  { min: 70, max: 74, weight: 0.4 },
  { min: 75, max: 79, weight: 0.25 },
  { min: 80, max: 82, weight: 0.1 },
] as const;

/** Minimum positional coverage for a healthy reserve listing. */
export const RESERVE_POSITION_COVERAGE: { position: Position; min: number }[] = [
  { position: "FULLBACK", min: 2 },
  { position: "WING", min: 4 },
  { position: "CENTRE", min: 4 },
  { position: "STAND_OFF", min: 2 },
  { position: "SCRUM_HALF", min: 2 },
  { position: "PROP", min: 4 },
  { position: "HOOKER", min: 2 },
  { position: "SECOND_ROW", min: 4 },
  { position: "LOOSE_FORWARD", min: 2 },
];

export const RESERVE_EMERGENCY_RECRUITMENT_TITLE =
  "Academy development levy";

export const RESERVE_EMERGENCY_RECRUITMENT_EXCUSE =
  "Under RFL Operational Rules, clubs must register at least 13 players to fulfil a reserve fixture. Pay a £300k academy development levy to fast-track performance-unit graduates onto the reserve listing for the remainder of the season.";

const FRENCH_FIRST_NAMES = [
  "Lucas", "Hugo", "Nathan", "Enzo", "Louis", "Theo", "Mathis", "Jules",
  "Romain", "Maxime", "Baptiste", "Florian", "Adrien", "Kilian", "Yann",
  "Paul", "Antoine", "Clement", "Damien", "Julien", "Morgan", "Arthur",
  "Benjamin", "Valentin", "Alexandre", "Nicolas", "Guillaume", "Thomas",
  "Simon", "Corentin", "Jordan", "Anthony", "Kevin", "Sami", "Alrix",
  "Eloi", "Teiva", "Leo", "Thibault", "Quentin", "Pierre", "Yoann",
  "Gaetan", "Remi", "Cedric", "Fabien", "Sebastien", "Christophe", "Olivier",
  "Jerome", "Mickael", "Tristan", "Loic", "Axel", "Noa", "Elias", "Matteo",
  "Gabin", "Robin", "Bastien", "Gregoire", "Mathieu", "Flavien", "Dorian",
  "Lenny", "Timothee", "Victor", "William", "Xavier", "Yohan", "Zakaria",
  "Aurelien", "Brice", "Cyril", "Didier", "Etienne", "Francois", "Gauthier",
  "Herve", "Ilan", "Jean", "Kylian", "Lilian", "Marc", "Nolan", "Oscar",
  "Patrice", "Raphael", "Sylvain", "Tanguy", "Ugo", "Wesley", "Yannick",
  "Zinedine", "Arnaud", "Benoit", "Charly", "Denis",
];

const FRENCH_LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit",
  "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel",
  "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Bonnet",
  "Fontaine", "Dupont", "Mercier", "Marchand", "Girard", "Blanc", "Henry",
  "Bousquet", "Fabre", "Coste", "Sanchez", "Perez", "Romano", "Gigot",
  "Marguerite", "Bourgarel", "Viguier", "Mourgue", "Chanareille", "Da Costa",
  "Marion", "Laguerre", "Pelissier", "Salabio", "Tison", "Fages", "Julian",
  "Rives", "Barthou", "Bouchet", "Cousin", "Delmas", "Escande", "Ferrer",
  "Garrigues", "Hernandez", "Izard", "Jourdan", "Klein", "Lacombe",
  "Navarro", "Pons", "Quiles", "Rey", "Serra", "Torres", "Urbain",
  "Vidal", "Yrieix", "Ziani", "Andrieu", "Barthe", "Cabrera",
  "Ducasse", "Espinas", "Fabregas", "Galin", "Hernani", "Innocenti", "Jorda",
  "Kuntz", "Lapeyre", "Mazars", "Nouvel", "Pujol", "Riviere",
  "Sabatier", "Teixeira", "Valette", "Aussar", "Berge", "Carme",
  "Deschamps", "Escudier", "Ferrand", "Galy", "Hilaire", "Isnard",
  "Lafon", "Maurin", "Narbonne", "Ollagnier", "Peyre", "Roussel", "Sanz",
  "Taffanel", "Verdier", "Armand", "Bardy", "Cavailhes", "Dubarry", "Esteve",
  "Ferrasse", "Gorse", "Homs", "Izquierdo", "Lacoste", "Nouguier", "Ortiz",
  "Peyron", "Rigal", "Sole", "Tissier", "Villeneuve",
];

function usesFrenchReserveIdentity(club?: string): boolean {
  return club != null && FRENCH_RESERVE_CLUBS.has(club);
}

function pickReserveName(
  rng: () => number,
  club?: string
): { first: string; last: string } {
  const french = usesFrenchReserveIdentity(club);
  const firstPool = french ? FRENCH_FIRST_NAMES : FIRST_NAMES;
  const lastPool = french ? FRENCH_LAST_NAMES : LAST_NAMES;
  return {
    first: firstPool[Math.floor(rng() * firstPool.length)]!,
    last: lastPool[Math.floor(rng() * lastPool.length)]!,
  };
}

function pickReserveNationality(rng: () => number, club?: string): string {
  if (usesFrenchReserveIdentity(club)) {
    return rng() < 0.82 ? "France" : NATIONALITIES[Math.floor(rng() * NATIONALITIES.length)]!;
  }
  return NATIONALITIES[Math.floor(rng() * NATIONALITIES.length)]!;
}

export function pickPotential(
  age: number,
  rng: () => number,
  youthLevel = 0
): number {
  const shift = getYouthIntakeRollShift(youthLevel);
  const roll = Math.min(0.99, rng() - shift);
  let potential: number;
  // Reserves may have high potential while current rating stays lower (70+).
  if (roll < 0.03) potential = 88 + Math.floor(rng() * 5); // 88–92 rare
  else if (roll < 0.1) potential = 84 + Math.floor(rng() * 4); // 84–87
  else if (roll < 0.28) potential = 80 + Math.floor(rng() * 4); // 80–83
  else if (roll < 0.55) potential = 76 + Math.floor(rng() * 4); // 76–79
  else if (roll < 0.8) potential = 73 + Math.floor(rng() * 3); // 73–75
  else potential = 70 + Math.floor(rng() * 3); // 70–72
  const floor = Math.max(
    RESERVE_MIN_RATING,
    getYouthIntakePotentialFloor(youthLevel)
  );
  const bonus = getYouthIntakePotentialBonus(youthLevel);
  return Math.min(92, Math.max(floor, potential + bonus));
}

export function pickGeneratedReserveRating(
  rng: () => number,
  youthLevel = 0
): number {
  // Weighted base distribution: mean ~72.9 before facility investment.
  const roll = rng();
  let cumulative = 0;
  let selected = RESERVE_RATING_BANDS[RESERVE_RATING_BANDS.length - 1]!;
  for (const band of RESERVE_RATING_BANDS) {
    cumulative += band.weight;
    if (roll < cumulative) {
      selected = band;
      break;
    }
  }
  const base =
    selected.min + Math.floor(rng() * (selected.max - selected.min + 1));
  return Math.min(
    GENERATED_RESERVE_MAX_RATING,
    clampReservePlayerRating(base + Math.min(2, getYouthIntakeRatingBoost(youthLevel)))
  );
}

export function getPotentialTier(potential: number): string {
  if (potential >= 92) return "Elite Prospect";
  if (potential >= 88) return "High Potential";
  if (potential >= 85) return "Good Prospect";
  if (potential >= 82) return "Squad Potential";
  return "Depth Potential";
}

export function getReserveSignedRating(reserve: ManagerReservePlayer): number {
  return reserve.signedRating ?? reserve.baseRating ?? reserve.rating;
}

export function getReserveSignedGrowthDelta(
  reserve: ManagerReservePlayer
): number {
  return reserve.rating - getReserveSignedRating(reserve);
}

export function formatReserveGrowthDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function getReserveSeasonGrowthDelta(
  reserve: ManagerReservePlayer
): number {
  return reserve.rating - (reserve.baseRating ?? reserve.rating);
}

export function sortReservesBySeasonGrowth(
  reserves: ManagerReservePlayer[]
): ManagerReservePlayer[] {
  return [...reserves].sort((a, b) => {
    const delta = getReserveSeasonGrowthDelta(b) - getReserveSeasonGrowthDelta(a);
    if (delta !== 0) return delta;
    return b.rating - a.rating;
  });
}

function computeDevelopmentRateForPotential(
  potential: number,
  rng: () => number
): number {
  const normalized = Math.max(0, Math.min(1, (potential - 80) / 16));
  return 0.5 + normalized * 0.42 + rng() * 0.12;
}

export interface YouthGrowthInput {
  age: number;
  rating: number;
  potentialRating: number;
  developmentRate: number;
  playedFirstTeam?: boolean;
  playedReserve?: boolean;
  /** Youth + training facility multiplier. */
  facilityMultiplier?: number;
}

/** Chance of +1 (or rarely +2) toward potential this match week. */
export function computeYouthGrowthChance(input: YouthGrowthInput): number {
  const gap = input.potentialRating - input.rating;
  if (gap <= 0) return 0;

  let ageFactor = 1;
  if (input.age <= 20) ageFactor = 1.4;
  else if (input.age <= 22) ageFactor = 1.3;
  else if (input.age <= 24) ageFactor = 1.2;
  else if (input.age <= 26) ageFactor = 1.05;
  else if (input.age <= 27) ageFactor = 0.88;
  else if (input.age <= 29) ageFactor = 0.48;
  else ageFactor = 0.18;

  const potentialFactor = 0.82 + (input.potentialRating - 80) / 40;
  const gapFactor = 1 + Math.min(gap / 24, 0.35);

  let chance =
    input.developmentRate * 0.13 * ageFactor * potentialFactor * gapFactor;

  if (gap <= 2) chance *= 0.2;
  else if (gap <= 4) chance *= 0.45;
  else if (gap <= 7) chance *= 0.72;

  if (input.playedFirstTeam) chance *= 1.35;
  else if (input.playedReserve) chance *= 1;
  else chance *= 0.85;

  chance *= input.facilityMultiplier ?? 1;

  return Math.min(0.38, Math.max(0, chance));
}

export function rollYouthRatingGain(
  input: YouthGrowthInput,
  rng: () => number
): number {
  if (input.rating >= input.potentialRating) return input.rating;
  if (rng() >= computeYouthGrowthChance(input)) return input.rating;

  let gain = 1;
  const gap = input.potentialRating - input.rating;
  if (
    input.age <= 21 &&
    input.potentialRating >= 84 &&
    gap >= 10 &&
    rng() < 0.12
  ) {
    gain = 2;
  }

  return Math.min(input.potentialRating, input.rating + gain);
}

function createPlayerDevelopmentFromReserve(
  reserve: ManagerReservePlayer,
  seasonYear: number
): PlayerDevelopmentState {
  const seasonStartRating = reserve.baseRating ?? reserve.rating;
  return {
    rating: reserve.rating,
    peakRating: Math.max(reserve.rating, seasonStartRating),
    potential: reserve.potentialRating,
    developmentRate: reserve.developmentRate,
    seasonStartRating,
    promotedSeasonYear: seasonYear,
  };
}

export function applyYouthMatchDevelopment(
  career: ManagerCareer,
  context: { round: number; matchdayIds: Set<string> }
): ManagerCareer {
  const rng = seedrandom(`${career.seed}-youth-ft-r${context.round}`);
  const facilityMultiplier = getFacilityDevelopmentMultiplier(career);
  const playerDevelopment = { ...(career.playerDevelopment ?? {}) };
  const playerRegistry = { ...career.playerRegistry };
  let changed = false;

  for (const ps of career.squad) {
    const dev = playerDevelopment[ps.playerId];
    if (!dev || dev.rating >= dev.potential) continue;

    const registered = playerRegistry[ps.playerId];
    const age = registered
      ? getManagerPlayerAge(career, ps.playerId) ?? 25
      : 25;
    const developmentRate =
      dev.developmentRate ??
      computeDevelopmentRateForPotential(dev.potential, () => 0.1);

    const nextRating = rollYouthRatingGain(
      {
        age,
        rating: dev.rating,
        potentialRating: dev.potential,
        developmentRate,
        playedFirstTeam: context.matchdayIds.has(ps.playerId),
        facilityMultiplier,
      },
      rng
    );
    if (nextRating === dev.rating) continue;

    playerDevelopment[ps.playerId] = {
      ...dev,
      rating: nextRating,
      peakRating: Math.max(dev.peakRating, nextRating),
    };
    if (registered) {
      playerRegistry[ps.playerId] = {
        ...registered,
        peakRating: nextRating,
      };
    }
    changed = true;
  }

  const reserves = career.reserves.map((reserve) => {
    if (!context.matchdayIds.has(reserve.id)) return reserve;
    if (reserve.rating >= reserve.potentialRating) return reserve;

    const nextRating = rollYouthRatingGain(
      {
        age: reserve.age,
        rating: reserve.rating,
        potentialRating: reserve.potentialRating,
        developmentRate: reserve.developmentRate,
        playedFirstTeam: true,
        facilityMultiplier,
      },
      rng
    );
    if (nextRating === reserve.rating) return reserve;
    changed = true;
    return {
      ...reserve,
      rating: Math.max(reserve.baseRating ?? reserve.rating, nextRating),
    };
  });

  if (!changed) return career;

  return {
    ...career,
    playerDevelopment,
    playerRegistry,
    reserves,
    updatedAt: new Date().toISOString(),
  };
}

export function generateReservePlayer(
  seed: string,
  index: number,
  position: Position,
  club?: string,
  youthLevel = 0,
  seasonYear = new Date().getFullYear()
): ManagerReservePlayer {
  const rng = seedrandom(`${seed}-reserve-${index}`);
  const age = 17 + Math.floor(rng() * 6);
  const rating = pickGeneratedReserveRating(rng, youthLevel);
  const potential = Math.max(rating, pickPotential(age, rng, youthLevel));
  const { first, last } = pickReserveName(rng, club);

  return {
    id: `mgr-res-${seed}-${index}`,
    name: `${first} ${last}`,
    age,
    nationality: pickReserveNationality(rng, club),
    position,
    eligiblePositions: [position],
    rating,
    potentialRating: potential,
    developmentRate: computeDevelopmentRateForPotential(potential, rng),
    form: 50 + Math.floor(rng() * 25),
    fitness: 85 + Math.floor(rng() * 15),
    reserveAppearances: 0,
    reserveTries: 0,
    calledUpForNextMatch: false,
    baseRating: rating,
    signedRating: rating,
    signedSeasonYear: seasonYear,
    yearsAtClub: 0,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function createYouthProspect(
  seed: string,
  seasonYear: number,
  index: number,
  position: Position,
  club?: string,
  youthLevel = 0
): ManagerReservePlayer {
  const player = generateReservePlayer(
    `${seed}-y${seasonYear}`,
    index,
    position,
    club,
    youthLevel,
    seasonYear
  );
  return {
    ...player,
    id: `mgr-youth-${seasonYear}-${index}-${Math.abs(hashCode(player.name))}`,
    signedSeasonYear: seasonYear,
    yearsAtClub: 0,
  };
}

export function generateReserveSquad(
  seed: string,
  count = 24,
  club?: string,
  seasonYear = new Date().getFullYear()
): ManagerReservePlayer[] {
  const positions: Position[] = [];
  for (const { position, count: c } of SQUAD_STRUCTURE) {
    for (let i = 0; i < c; i++) positions.push(position);
  }
  const rng = seedrandom(`${seed}-reserve-pos`);
  const shuffled = [...positions].sort(() => rng() - 0.5);
  const reserves: ManagerReservePlayer[] = [];
  for (let i = 0; i < count; i++) {
    const pos = shuffled[i % shuffled.length] ?? "CENTRE";
    reserves.push(generateReservePlayer(seed, i, pos, club, 0, seasonYear));
  }
  return reserves;
}

export function getReserveOpponent(club: string, round: number, seed: string): string {
  const others = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== club);
  const rng = seedrandom(`${seed}-res-opp-r${round}`);
  return others[Math.floor(rng() * others.length)]!;
}

export function initLeagueClubReserveCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    counts[club] = RESERVE_DEPTH_TARGET;
  }
  return counts;
}

export function getClubReserveCount(
  career: ManagerCareer,
  club: string
): number {
  if (club === career.club) {
    return career.reserves.length;
  }
  const counts =
    career.leagueClubReserveCounts ?? initLeagueClubReserveCounts();
  return counts[club] ?? 24;
}

export function reconcileLeagueClubReserveCounts(
  career: ManagerCareer
): ManagerCareer {
  const counts = {
    ...(career.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
    [career.club]: career.reserves.length,
  };
  const leagueClubReserves = {
    ...(career.leagueClubReserves ?? {}),
    [career.club]: career.reserves.map((r) => ({ ...r })),
  };
  return { ...career, leagueClubReserveCounts: counts, leagueClubReserves };
}

/** Seeded reserve-list churn for AI clubs between reserve rounds. */
export function tickLeagueClubReserveCounts(
  career: ManagerCareer,
  round: number
): ManagerCareer {
  const counts = {
    ...(career.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
    [career.club]: career.reserves.length,
  };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    const rng = seedrandom(`${career.seed}-res-churn-r${round}-${club}`);
    let count = counts[club] ?? RESERVE_DEPTH_TARGET;
    // Never drop AI clubs below the depth floor (was 14 — caused walkovers).
    if (rng() < 0.07 && count > RESERVE_DEPTH_MIN) count -= 1;
    if (rng() < 0.04 && count < RESERVE_DEPTH_TARGET) count += 1;
    counts[club] = Math.max(RESERVE_DEPTH_MIN, count);
  }

  return { ...career, leagueClubReserveCounts: counts };
}

/** Youth intake bump for AI reserve listings at season start. */
export function applySeasonAiReserveIntake(
  career: ManagerCareer,
  seasonYear: number
): ManagerCareer {
  const counts = {
    ...(career.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
    [career.club]: career.reserves.length,
  };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    const rng = seedrandom(`${career.seed}-res-intake-s${seasonYear}-${club}`);
    const intake = 2 + Math.floor(rng() * 3);
    counts[club] = Math.min(
      RESERVE_SQUAD_MAX,
      Math.max(RESERVE_DEPTH_MIN, (counts[club] ?? RESERVE_DEPTH_TARGET) + intake)
    );
  }

  return { ...career, leagueClubReserveCounts: counts };
}

function countReservePositions(
  reserves: ManagerReservePlayer[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reserve of reserves) {
    counts[reserve.position] = (counts[reserve.position] ?? 0) + 1;
  }
  return counts;
}

function nextReserveCoverageGaps(
  reserves: ManagerReservePlayer[]
): Position[] {
  const counts = countReservePositions(reserves);
  const gaps: Position[] = [];
  for (const { position, min } of RESERVE_POSITION_COVERAGE) {
    const have = counts[position] ?? 0;
    for (let i = have; i < min; i++) gaps.push(position);
  }
  return gaps;
}

/**
 * Ensure a club has enough reserves (size + positional coverage).
 * User club: generates and persists real reserve players.
 * AI clubs: raises leagueClubReserveCounts floor.
 */
export function ensureClubReserveDepth(
  career: ManagerCareer,
  club: string
): ManagerCareer {
  if (club === career.club) {
    const reserves = [...(career.reserves ?? [])];
    if (
      reserves.length >= RESERVE_DEPTH_MIN &&
      nextReserveCoverageGaps(reserves).length === 0
    ) {
      return reconcileLeagueClubReserveCounts(career);
    }

    const facilities = getClubFacilities(career);
    const existingIds = new Set(reserves.map((r) => r.id));
    const reserveContracts = { ...(career.reserveContracts ?? {}) };
    const startIndex = reserves.length;
    let added = 0;

    while (
      reserves.length < RESERVE_SQUAD_MAX &&
      (reserves.length < RESERVE_DEPTH_MIN ||
        nextReserveCoverageGaps(reserves).length > 0)
    ) {
      const gaps = nextReserveCoverageGaps(reserves);
      const gapPos = gaps[0] ?? "CENTRE";
      let recruit = generateReservePlayer(
        `${career.seed}-depth-${career.seasonYear}-${club}`,
        startIndex + added,
        gapPos,
        club,
        facilities.youth
      );
      let guard = 0;
      while (existingIds.has(recruit.id) && guard < 8) {
        recruit = generateReservePlayer(
          `${career.seed}-depth-${career.seasonYear}-${club}-r${guard}`,
          startIndex + added + guard * 17,
          gapPos,
          club,
          facilities.youth
        );
        guard += 1;
      }
      if (existingIds.has(recruit.id)) break;
      existingIds.add(recruit.id);
      reserves.push(recruit);
      reserveContracts[recruit.id] = generateReserveYouthContract(recruit);
      added += 1;
      if (added > 40) break;
    }

    if (added === 0) {
      return reconcileLeagueClubReserveCounts(career);
    }

    const next: ManagerCareer = {
      ...career,
      reserves,
      reserveContracts,
      wageBill: computeCareerWageBill({
        ...career,
        reserves,
        reserveContracts,
      }),
      updatedAt: new Date().toISOString(),
    };
    return reconcileLeagueClubReserveCounts(next);
  }

  const counts = {
    ...(career.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
  };
  const current = counts[club] ?? RESERVE_DEPTH_TARGET;
  if (current >= RESERVE_DEPTH_MIN) {
    return career;
  }
  counts[club] = RESERVE_DEPTH_TARGET;
  return { ...career, leagueClubReserveCounts: counts };
}

/** Ensure every Super League club meets reserve depth floors. */
export function ensureAllClubReserveDepth(career: ManagerCareer): ManagerCareer {
  let next = career;
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    next = ensureClubReserveDepth(next, club);
  }
  return next;
}

function createReserveWalkoverResult(
  round: number,
  opponentClub: string,
  userWon: boolean
): ReserveFixtureResult {
  return {
    round,
    opponent: `${opponentClub} Reserves`,
    opponentClub,
    userScore: userWon ? RESERVE_WALKOVER_SCORE : 0,
    oppScore: userWon ? 0 : RESERVE_WALKOVER_SCORE,
    userWon,
    userTries: userWon ? 3 : 0,
    walkover: true,
    walkoverReason: RESERVE_WALKOVER_REASON,
  };
}

function generateEmergencyReserveRecruits(
  career: ManagerCareer,
  count: number
): ManagerReservePlayer[] {
  const positions: Position[] = [];
  for (const { position, count: slotCount } of SQUAD_STRUCTURE) {
    for (let i = 0; i < slotCount; i++) positions.push(position);
  }
  const rng = seedrandom(`${career.seed}-emergency-res-${career.gameWeek}`);
  const shuffled = [...positions].sort(() => rng() - 0.5);
  const startIndex = career.reserves.length;

  const facilities = getClubFacilities(career);
  const recruits: ManagerReservePlayer[] = [];
  for (let i = 0; i < count; i++) {
    const pos = shuffled[(startIndex + i) % shuffled.length] ?? "CENTRE";
    recruits.push(
      generateReservePlayer(
        `${career.seed}-emergency-${career.seasonYear}`,
        startIndex + i,
        pos,
        career.club,
        facilities.youth
      )
    );
  }
  return recruits;
}

export function fillReserveSquadMinimum(
  career: ManagerCareer
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const shortfall = RESERVE_MIN_PLAYERS - career.reserves.length;
  if (shortfall <= 0) {
    return {
      ok: false,
      error: "Reserve squad already meets the 13-player matchday minimum",
    };
  }
  if (career.reserves.length + shortfall > RESERVE_SQUAD_MAX) {
    return { ok: false, error: "Reserve squad is full" };
  }

  const transferBudget =
    career.managerFinance?.transferBudget ?? career.budget;
  if (transferBudget < RESERVE_RECRUITMENT_FEE) {
    return {
      ok: false,
      error: `Need £${(RESERVE_RECRUITMENT_FEE / 1000).toFixed(0)}k transfer budget`,
    };
  }

  const recruits = generateEmergencyReserveRecruits(career, shortfall);
  const reserveContracts = { ...(career.reserveContracts ?? {}) };
  for (const recruit of recruits) {
    reserveContracts[recruit.id] = generateReserveYouthContract(recruit);
  }

  let next: ManagerCareer = {
    ...career,
    reserves: [...career.reserves, ...recruits],
    reserveContracts,
    updatedAt: new Date().toISOString(),
  };
  next = deductTransferFee(next, RESERVE_RECRUITMENT_FEE);
  next = reconcileLeagueClubReserveCounts({
    ...next,
    wageBill: computeCareerWageBill(next),
  });

  return { ok: true, career: next };
}

export function simulateReserveFixture(
  career: ManagerCareer,
  round: number,
  opponentClub: string
): ReserveFixtureResult {
  const userCount = getClubReserveCount(career, career.club);
  const oppCount = getClubReserveCount(career, opponentClub);

  if (userCount < RESERVE_MIN_PLAYERS) {
    return createReserveWalkoverResult(round, opponentClub, false);
  }
  if (oppCount < RESERVE_MIN_PLAYERS) {
    return createReserveWalkoverResult(round, opponentClub, true);
  }

  const rng = seedrandom(`${career.seed}-res-fix-r${round}`);
  const squadRating =
    career.reserves.reduce((sum, r) => sum + r.rating, 0) /
    Math.max(1, career.reserves.length);
  const oppRating = 64 + rng() * 12;
  const diff = squadRating - oppRating + (rng() - 0.5) * 6;
  const userWins = rng() < 1 / (1 + Math.exp(-diff / 4));

  let userScore: number;
  let oppScore: number;
  const { winner, loser, isDraw } = pickScorePairAllowingDraw(
    14,
    32,
    0,
    20,
    rng
  );
  if (isDraw) {
    userScore = winner;
    oppScore = loser;
  } else if (userWins) {
    userScore = winner;
    oppScore = loser;
  } else {
    userScore = loser;
    oppScore = winner;
  }

  const userTries = decomposeRLScore(userScore).tries;
  const tryScorer =
    career.reserves.length > 0
      ? [...career.reserves].sort((a, b) => b.rating - a.rating)[0]!.name
      : undefined;

  return {
    round,
    opponent: `${opponentClub} Reserves`,
    opponentClub,
    userScore,
    oppScore,
    userWon: !isDraw && userWins,
    isDraw,
    topPerformer: tryScorer,
    userTries,
  };
}

export function applyReserveMatchDevelopment(
  career: ManagerCareer,
  result: ReserveFixtureResult
): ManagerCareer {
  if (result.walkover) {
    return {
      ...career,
      reserveResults: [...career.reserveResults, result],
      lastReserveResult: result,
    };
  }

  const rng = seedrandom(`${career.seed}-res-dev-r${result.round}`);
  const facilityMultiplier = getFacilityDevelopmentMultiplier(career);
  const reserves = career.reserves.map((r) => {
    let next = { ...r };
    if (result.userWon) next.form = Math.min(99, next.form + 2);
    else if (result.isDraw) next.form = Math.max(1, Math.min(99, next.form));
    else next.form = Math.max(1, next.form - 1);

    const played = rng() < 0.35 + result.userTries * 0.05;
    if (played) {
      next.reserveAppearances++;
      if (rng() < 0.08 + next.rating / 500) {
        next.reserveTries++;
      }
    }

    if (next.rating < next.potentialRating) {
      next.rating = rollYouthRatingGain(
        {
          age: next.age,
          rating: next.rating,
          potentialRating: next.potentialRating,
          developmentRate: next.developmentRate,
          playedReserve: played,
          facilityMultiplier,
        },
        rng
      );
    }
    next.rating = Math.max(next.baseRating ?? next.rating, next.rating);

    return next;
  });

  return {
    ...career,
    reserves,
    reserveResults: [...career.reserveResults, result],
    lastReserveResult: result,
  };
}

export function callUpReserveForNextMatch(
  career: ManagerCareer,
  reserveId: string
): ManagerCareer {
  const reserve = career.reserves.find((r) => r.id === reserveId);
  if (!reserve) return career;

  const alreadyCalled = career.calledUpReserveIds.includes(reserveId);

  const interchange = [...career.matchdayInterchange];
  if (!interchange.includes(reserveId)) {
    const emptyIdx = interchange.findIndex((id) => !id);
    if (emptyIdx >= 0) interchange[emptyIdx] = reserveId;
    else if (interchange.length < 4) interchange.push(reserveId);
  }

  const reserves = career.reserves.map((r) =>
    r.id === reserveId ? { ...r, calledUpForNextMatch: true } : r
  );

  let next: ManagerCareer = {
    ...career,
    reserves,
    matchdayInterchange: interchange,
    calledUpReserveIds: [...new Set([...career.calledUpReserveIds, reserveId])],
  };

  if (!alreadyCalled) {
    next = addReserveCallUpInboxMessage(
      next,
      reserve.id,
      reserve.name,
      POSITION_SHORT[reserve.position]
    );
    dispatchAchievementCheck({ trigger: "reserve-called-up", reserveCalledUp: true });
  }

  return next;
}

export function clearReserveCallUps(career: ManagerCareer): ManagerCareer {
  const reserveIds = new Set(career.reserves.map((r) => r.id));
  const returned = career.reserves
    .filter((r) =>
      career.matchdayXiii.includes(r.id) ||
      career.matchdayInterchange.includes(r.id)
    )
    .map((r) => ({ id: r.id, name: r.name }));

  if (returned.length === 0 && career.calledUpReserveIds.length === 0) {
    return career;
  }

  let next: ManagerCareer = {
    ...career,
    calledUpReserveIds: [],
    matchdayXiii: career.matchdayXiii.map((id) =>
      reserveIds.has(id) ? "" : id
    ),
    matchdayInterchange: career.matchdayInterchange.map((id) =>
      reserveIds.has(id) ? "" : id
    ),
    reserves: career.reserves.map((r) => ({
      ...r,
      calledUpForNextMatch: false,
    })),
  };

  if (returned.length > 0) {
    next = addReserveReturnInboxMessage(next, returned);
  }

  return next;
}

export function promoteReserveToSquad(
  career: ManagerCareer,
  reserveId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const reserve = career.reserves.find((r) => r.id === reserveId);
  if (!reserve) return { ok: false, error: "Reserve not found" };
  if (career.squad.some((p) => p.playerId === reserveId)) {
    return { ok: false, error: "Already in squad" };
  }
  if (career.squad.length >= 35) {
    return { ok: false, error: "Squad is full" };
  }

  const player: Player = reserveToPlayer(reserve, career.seasonYear);
  const contract = generatePromotedReserveContract(career, reserve);

  const nextReserveContracts = { ...(career.reserveContracts ?? {}) };
  delete nextReserveContracts[reserveId];
  const nextContracts = {
    ...career.contracts,
    [reserveId]: contract,
  };

  const next: ManagerCareer = reconcileLeagueRosters({
    ...career,
    playerRegistry: { ...career.playerRegistry, [reserveId]: player },
    playerDevelopment: {
      ...(career.playerDevelopment ?? {}),
      [reserveId]: createPlayerDevelopmentFromReserve(reserve, career.seasonYear),
    },
    squad: [...career.squad, createInitialPlayerState(reserveId)],
    contracts: nextContracts,
    reserveContracts: nextReserveContracts,
    wageBill: computeCareerWageBill({
      ...career,
      contracts: nextContracts,
      reserveContracts: nextReserveContracts,
    }),
    reserves: career.reserves.filter((r) => r.id !== reserveId),
    calledUpReserveIds: career.calledUpReserveIds.filter(
      (id) => id !== reserveId
    ),
    matchdayInterchange: career.matchdayInterchange.filter(
      (id) => id !== reserveId
    ),
  });
  dispatchAchievementCheck({ trigger: "reserve-promoted", reservePromoted: true });
  return { ok: true, career: reconcileLeagueClubReserveCounts(next) };
}

export function releaseReserve(
  career: ManagerCareer,
  reserveId: string
): ManagerCareer {
  const nextContracts = { ...(career.reserveContracts ?? {}) };
  delete nextContracts[reserveId];

  return reconcileLeagueClubReserveCounts({
    ...career,
    reserves: career.reserves.filter((r) => r.id !== reserveId),
    reserveContracts: nextContracts,
    calledUpReserveIds: career.calledUpReserveIds.filter(
      (id) => id !== reserveId
    ),
    matchdayInterchange: career.matchdayInterchange.filter(
      (id) => id !== reserveId
    ),
    wageBill: computeCareerWageBill({
      ...career,
      reserveContracts: nextContracts,
    }),
  });
}

export function developReserveFromFirstTeamAppearance(
  career: ManagerCareer,
  reserveId: string,
  round: number
): ManagerCareer {
  return applyYouthMatchDevelopment(career, {
    round,
    matchdayIds: new Set([reserveId]),
  });
}
