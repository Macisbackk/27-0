/**
 * Gauntlet — draft a Classic or Era Classic 13, then instead of a league season play ten of the
 * greatest Super League sides in a row, weakest first. One defeat ends the run; the score is the
 * number of sides beaten (10 = a clean sweep).
 *
 * The great sides come from the data, not a hand-picked list: every Grand Final winner
 * (data/quiz/facts.ts GRAND_FINALS) whose season is in the spin pools, rated by its actual best
 * XIII (the highest-rated eligible card for each slot from that team-year, the same squad rating
 * the game shows for yours). At most GAUNTLET_MAX_PER_CLUB seasons per club so it isn't five
 * Saints sides in a row; the ten strongest go in, ordered weakest → strongest.
 *
 * Each tie uses the 27-0 formula's curve unchanged (sim-formula.ts winProbability):
 *   your strength      S = getTeamStrength(your squad, "classic-spin" or Era ladder, chemistry —
 *                          Classic only; it has no effect in Era). The Gauntlet keeps the club
 *                          spin on 2026 cards too, so it reads the club-spin Classic ladder.
 *   their strength     T = getTeamStrength(their best-XIII rating, Era ladder — "classic-spin"
 *                          for a 2026 side) − GAUNTLET_FIELD_OFFSET
 *   win chance         p = winProbability(S − T)   (neutral venue: no home advantage)
 * Champions' best XIIIs sit above even a perfect draft on the raw ladder (q ≈ 1.7–2.4), so the
 * whole field is shifted down by one calibrated constant (scripts/sim-one-club-gauntlet.ts):
 * order and gaps between the ten sides are their real ratings, only the baseline moves.
 * Seeded + deterministic: tie i is won if seedrandom(`${seed}-gauntlet-${i}`)() < p.
 */
import seedrandom from "seedrandom";
import { GRAND_FINALS } from "../../../data/quiz/facts";
import type { SquadSlot } from "../types";
import { createEmptySquad, RECRUIT_SLOT_ORDER } from "../positions";
import { getAverageSquadRating } from "../squad-analysis";
import { getPlayerRatingForPosition } from "../players/player-positions";
import { formatEraDisplayName } from "../players/era-teams";
import { CURRENT_SEASON_YEAR } from "../players/current-season";
import { computeChemistry } from "./chemistry";
import { getSpinTeamYearPoolsCached } from "./player-pool-eligibility";
import { buildSlotRevealTarget } from "./recruitment-slot-reveal";
import { eligiblePlayersForSlot, placeSlotRecruitPlayerAtSlot } from "./slot-team-year-pick";
import { pickDecisiveScorePair } from "./rl-scores";
import {
  getTeamStrength,
  modeUsesChemistry,
  winProbability,
  type SimFormulaMode,
} from "./sim-formula";

export const GAUNTLET_LENGTH = 10;
export const GAUNTLET_MAX_PER_CLUB = 3;
/**
 * Strength points taken off every great side so a near-perfect draft has roughly the same
 * clean-sweep odds as its 27-0 odds in Classic (~25%). Calibrated by
 * scripts/sim-one-club-gauntlet.ts — see the numbers there.
 */
export const GAUNTLET_FIELD_OFFSET = 21;

export interface GauntletOpponent {
  club: string;
  year: number;
  /** "Leeds Rhinos '08". */
  label: string;
  /** Average rating of the side's best XIII (what the game would show as its squad rating). */
  squadRating: number;
  /** Which ladder the rating is read on (2026 sides are current cards). */
  ladder: SimFormulaMode;
  /** League-scale strength used in the tie (after GAUNTLET_FIELD_OFFSET). */
  strength: number;
  /** Grand Final result for the blurb, e.g. "Beat St Helens 24-16 in the Grand Final". */
  honour: string;
}

/** Best XIII from one team-year: the top-rated eligible card for each slot, in recruit order. */
export function getTeamYearBestXiii(team: string, year: string): SquadSlot[] {
  const pool = getSpinTeamYearPoolsCached("all").find((p) => p.team === team && p.year === year);
  let squad = createEmptySquad();
  if (!pool) return squad;
  const target = buildSlotRevealTarget(team, year);
  for (const slotIndex of RECRUIT_SLOT_ORDER) {
    const used = new Set(squad.filter((s) => s.player).map((s) => s.player!.id));
    const slot = squad.find((s) => s.slotIndex === slotIndex)!;
    const best = eligiblePlayersForSlot(pool, used, squad, slotIndex).sort(
      (a, b) =>
        getPlayerRatingForPosition(b, slot.position) - getPlayerRatingForPosition(a, slot.position) ||
        a.id.localeCompare(b.id)
    )[0];
    if (best) squad = placeSlotRecruitPlayerAtSlot(squad, best, target, slotIndex) ?? squad;
  }
  return squad;
}

let cachedOpponents: GauntletOpponent[] | null = null;

/** Every Grand Final winner with a season in the pools, rated — strongest first (before capping). */
export function getGauntletCandidates(): GauntletOpponent[] {
  const pools = getSpinTeamYearPoolsCached("all");
  const out: GauntletOpponent[] = [];
  for (const final of GRAND_FINALS) {
    const year = String(final.year);
    if (!pools.some((p) => p.team === final.winnerName && p.year === year)) continue;
    const squad = getTeamYearBestXiii(final.winnerName, year);
    if (squad.filter((s) => s.player).length < 11) continue; // too thin to be "their side"
    const squadRating = getAverageSquadRating(squad);
    const ladder: SimFormulaMode = final.year === CURRENT_SEASON_YEAR ? "classic-spin" : "era";
    out.push({
      club: final.winnerName,
      year: final.year,
      label: formatEraDisplayName(final.winnerName, year),
      squadRating,
      ladder,
      strength: getTeamStrength({ avgRating: squadRating, mode: ladder }) - GAUNTLET_FIELD_OFFSET,
      honour: `Beat ${final.runnerUpName} ${final.score ?? ""} in the ${final.year} Grand Final`.replace("  ", " "),
    });
  }
  return out.sort((a, b) => b.strength - a.strength || a.year - b.year);
}

/** The ten sides, weakest first. Same for everyone (pure function of the data). */
export function getGauntletOpponents(): GauntletOpponent[] {
  if (cachedOpponents) return cachedOpponents;
  const perClub = new Map<string, number>();
  const picked: GauntletOpponent[] = [];
  for (const side of getGauntletCandidates()) {
    const n = perClub.get(side.club) ?? 0;
    if (n >= GAUNTLET_MAX_PER_CLUB) continue;
    perClub.set(side.club, n + 1);
    picked.push(side);
    if (picked.length === GAUNTLET_LENGTH) break;
  }
  cachedOpponents = picked.sort((a, b) => a.strength - b.strength || a.year - b.year);
  return cachedOpponents;
}

export interface GauntletTie {
  index: number;
  opponent: GauntletOpponent;
  /** Tests/calibration only — never shown. */
  winProbability: number;
  won: boolean;
  pointsFor: number;
  pointsAgainst: number;
}

export interface GauntletResult {
  /** Ties actually played (stops at the first defeat). */
  ties: GauntletTie[];
  /** Sides beaten — the score. */
  beaten: number;
  /** All ten beaten. */
  perfect: boolean;
  /** Your strength on the league scale (internal). */
  teamStrength: number;
}

/** Your team strength for the Gauntlet: the normal formula strength for your draft's ladder. */
export function getGauntletTeamStrength(squad: SquadSlot[], mode: SimFormulaMode): number {
  return getTeamStrength({
    avgRating: getAverageSquadRating(squad),
    mode,
    // Era: chemistry has no effect (v1.40).
    chemistry: modeUsesChemistry(mode) ? computeChemistry(squad).bonus : 0,
  });
}

/** Win chance for every tie (whether or not it is reached). */
export function getGauntletChances(squad: SquadSlot[], mode: SimFormulaMode): number[] {
  const s = getGauntletTeamStrength(squad, mode);
  return getGauntletOpponents().map((o) => winProbability(s - o.strength));
}

/** Clean-sweep chance (product of the ten tie chances). Tests/calibration only. */
export function gauntletSweepChance(squad: SquadSlot[], mode: SimFormulaMode): number {
  return getGauntletChances(squad, mode).reduce((p, x) => p * x, 1);
}

/** Fast record for calibration: sides beaten for a seed. Same draws as runGauntlet. */
export function gauntletScoreForChances(chances: readonly number[], seed: string): number {
  let beaten = 0;
  for (let i = 0; i < chances.length; i++) {
    if (seedrandom(`${seed}-gauntlet-${i}`)() < chances[i]!) beaten++;
    else break;
  }
  return beaten;
}

/** Play the Gauntlet: deterministic for the same squad, ladder and seed. */
export function runGauntlet(squad: SquadSlot[], seed: string, mode: SimFormulaMode): GauntletResult {
  const teamStrength = getGauntletTeamStrength(squad, mode);
  const ties: GauntletTie[] = [];
  let beaten = 0;
  for (const [index, opponent] of getGauntletOpponents().entries()) {
    const p = winProbability(teamStrength - opponent.strength);
    const won = seedrandom(`${seed}-gauntlet-${index}`)() < p;
    const scoreRng = seedrandom(`${seed}-gauntlet-score-${index}`);
    const pair = pickDecisiveScorePair(14, 36, 0, 24, scoreRng);
    ties.push({
      index,
      opponent,
      winProbability: p,
      won,
      pointsFor: won ? pair.winner : pair.loser,
      pointsAgainst: won ? pair.loser : pair.winner,
    });
    if (!won) break;
    beaten++;
  }
  return { ties, beaten, perfect: beaten === GAUNTLET_LENGTH, teamStrength };
}
