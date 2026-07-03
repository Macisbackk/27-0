import seedrandom from "seedrandom";
import { getPlayersByClub } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import { getEraTeamByDisplayName, getEraTeamMatchSquad } from "../players/era-teams";
import { getFantasyPool } from "./player-pool-eligibility";
import { getClubBaseStrength } from "./club-strength";
import {
  getCurrentSeasonOpponentPool,
  type OpponentPoolOptions,
} from "./opponent-squad-strength";
import { getTeamTier } from "../team-tiers";
import type { Player, Position } from "../types";
import type {
  FixtureKicking,
  FixtureTryScorer,
  MatchFixture,
  TeamScoringDetail,
} from "./season-simulation";
import type { ScoreBreakdown } from "./rl-scores";
import { allocateMatchTries } from "./try-allocation";
import { getPlayerTryWeight } from "./try-weights";
import { FORMATION_SLOT_POSITIONS } from "../positions";

/** Opponent XIII positions for try allocation (slot index 0–12). */
export const OPPONENT_LINEUP: Position[] = [...FORMATION_SLOT_POSITIONS];

/** Weighted bands — mid-range players most common, not all-star picks. */
const OPP_BANDS: { min: number; max: number; weight: number }[] = [
  { min: 75, max: 79, weight: 35 },
  { min: 80, max: 84, weight: 30 },
  { min: 85, max: 89, weight: 20 },
  { min: 90, max: 94, weight: 10 },
  { min: 95, max: 99, weight: 5 },
];

/** Draft Mode opponents — more mid-table lineups, fewer stacked elite Xiiis. */
const DRAFT_OPP_BANDS: { min: number; max: number; weight: number }[] = [
  { min: 75, max: 79, weight: 30 },
  { min: 80, max: 84, weight: 38 },
  { min: 85, max: 89, weight: 22 },
  { min: 90, max: 94, weight: 8 },
  { min: 95, max: 99, weight: 2 },
];

function rollBand(
  rng: () => number,
  bands: { min: number; max: number; weight: number }[] = OPP_BANDS
): (typeof OPP_BANDS)[0] {
  const total = bands.reduce((s, b) => s + b.weight, 0);
  let roll = rng() * total;
  for (const band of bands) {
    roll -= band.weight;
    if (roll <= 0) return band;
  }
  return bands[0];
}

function pickWeighted(
  candidates: Player[],
  rng: () => number,
  bands: { min: number; max: number; weight: number }[] = OPP_BANDS
): Player | null {
  if (candidates.length === 0) return null;
  const band = rollBand(rng, bands);
  let inBand = candidates.filter(
    (p) => p.peakRating >= band.min && p.peakRating <= band.max
  );
  if (inBand.length === 0) {
    inBand = [...candidates].sort(
      (a, b) =>
        Math.abs(a.peakRating - (band.min + band.max) / 2) -
        Math.abs(b.peakRating - (band.min + band.max) / 2)
    );
    inBand = inBand.slice(0, Math.min(8, inBand.length));
  }
  return inBand[Math.floor(rng() * inBand.length)] ?? null;
}

export type { OpponentPoolOptions };

/**
 * Select a match-day XIII from the opponent club's database
 * using weighted randomness (mid-range favoured over elite-only).
 */
export function selectClubMatchSquad(
  club: string,
  seed: string,
  round: number,
  options?: OpponentPoolOptions & { draftMode?: boolean }
): Player[] {
  const pool =
    options?.poolOverride && options.poolOverride.length > 0
      ? options.poolOverride
      : options?.currentSeasonOnly
        ? getCurrentSeasonOpponentPool(club)
        : getPlayersByClub(club);
  if (pool.length === 0) return [];

  const rng = seedrandom(`${seed}-opp-squad-${round}-${club}`);
  const used = new Set<string>();
  const squad: Player[] = [];
  const bands = options?.draftMode ? DRAFT_OPP_BANDS : OPP_BANDS;

  for (const position of OPPONENT_LINEUP) {
    let candidates = pool.filter(
      (p) =>
        getPlayerEligiblePositions(p).includes(position) && !used.has(p.id)
    );
    if (candidates.length === 0) {
      candidates = pool.filter((p) => !used.has(p.id));
    }
    if (candidates.length === 0 && !options?.currentSeasonOnly) {
      const fallback = getFantasyPool().filter(
        (p) =>
          getPlayerEligiblePositions(p).includes(position) && !used.has(p.id)
      );
      candidates =
        fallback.length > 0
          ? fallback
          : getFantasyPool().filter((p) => !used.has(p.id));
    }
    if (candidates.length === 0) break;

    const pick = pickWeighted(candidates, rng, bands);
    if (!pick) break;
    used.add(pick.id);
    squad.push(pick);
  }

  return squad;
}

/** Build try scorers from a fixed era team roster (not random club pool). */
export function buildEraTeamScoringDetail(
  eraTeamDisplayName: string,
  tries: number,
  scoringBreakdown: ScoreBreakdown,
  seed: string,
  matchKey: string
): TeamScoringDetail {
  const eraTeam = getEraTeamByDisplayName(eraTeamDisplayName);
  if (!eraTeam) {
    return { tryScorers: [], kicking: null };
  }

  const squad = getEraTeamMatchSquad(eraTeam);
  if (squad.length === 0) {
    return { tryScorers: [], kicking: null };
  }

  const rng = seedrandom(`${seed}-era-scorers-${matchKey}`);
  const weights = squad.map((p) => getPlayerTryWeight(p));
  const alloc = allocateMatchTries(tries, weights, rng);

  const tryScorers: FixtureTryScorer[] = squad
    .map((p, i) => ({
      playerId: p.id,
      name: p.name,
      tries: alloc[i],
    }))
    .filter((s) => s.tries > 0);

  const kicker = pickKicker(squad);
  const kicking: FixtureKicking | null = kicker
    ? {
        playerId: kicker.id,
        name: kicker.name,
        conversions: scoringBreakdown.conversions,
        conversionAttempts: scoringBreakdown.tries,
        penalties: scoringBreakdown.penalties,
        dropGoals: scoringBreakdown.dropGoals,
      }
    : null;

  return { tryScorers, kicking };
}

export function getOpponentMatchRating(
  club: string,
  seed: string,
  round: number,
  options?: OpponentPoolOptions & { draftMode?: boolean }
): number {
  const squad = selectClubMatchSquad(club, seed, round, options);
  if (squad.length === 0) return getClubBaseStrength(club);
  return squad.reduce((sum, p) => sum + p.peakRating, 0) / squad.length;
}

export function getOpponentSquadValue(
  club: string,
  seed: string,
  round: number,
  options?: OpponentPoolOptions
): number {
  return selectClubMatchSquad(club, seed, round, options).reduce(
    (sum, p) => sum + p.value,
    0
  );
}

export function getOpponentTeamSummary(
  club: string,
  seed: string,
  round: number,
  options?: OpponentPoolOptions
): {
  name: string;
  totalValue: number;
  averageRating: number;
  tier: string;
} {
  const squad = selectClubMatchSquad(club, seed, round, options);
  const totalValue = squad.reduce((s, p) => s + p.value, 0);
  const averageRating =
    squad.length > 0
      ? Math.round(
          (squad.reduce((s, p) => s + p.peakRating, 0) / squad.length) * 10
        ) / 10
      : 0;
  return {
    name: club,
    totalValue,
    averageRating,
    tier: getTeamTier(averageRating),
  };
}

function pickKicker(squad: Player[]): Player | null {
  const halves = squad.filter(
    (p) => p.position === "SCRUM_HALF" || p.position === "STAND_OFF"
  );
  if (halves.length === 0) return squad[0] ?? null;
  return halves.sort((a, b) => b.peakRating - a.peakRating)[0];
}

/** Build opponent scoring from club player pool + simulated match breakdown. */
export function buildOpponentScoringDetail(
  fixture: MatchFixture,
  seed: string,
  options?: OpponentPoolOptions
): TeamScoringDetail {
  const squad = selectClubMatchSquad(
    fixture.opponent,
    seed,
    fixture.round,
    options
  );

  if (squad.length === 0) {
    return { tryScorers: [], kicking: null };
  }

  const rng = seedrandom(`${seed}-opp-scorers-${fixture.round}`);
  const weights = squad.map((p) => getPlayerTryWeight(p));
  const alloc = allocateMatchTries(fixture.triesAgainst, weights, rng);

  const tryScorers: FixtureTryScorer[] = squad
    .map((p, i) => ({
      playerId: p.id,
      name: p.name,
      tries: alloc[i],
    }))
    .filter((s) => s.tries > 0);

  const kicker = pickKicker(squad);
  const scoring = fixture.scoringAgainst;

  const kicking: FixtureKicking | null = kicker
    ? {
        playerId: kicker.id,
        name: kicker.name,
        conversions: scoring.conversions,
        conversionAttempts: scoring.tries,
        penalties: scoring.penalties,
        dropGoals: scoring.dropGoals,
      }
    : null;

  return { tryScorers, kicking };
}
