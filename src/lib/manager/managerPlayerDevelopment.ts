import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getPlayerById } from "../players";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";
import type {
  ManagerCareer,
  PlayerDevelopmentChange,
  PlayerDevelopmentState,
} from "./types";
import { getManagerModePlayerRating } from "./managerSquadRatings";
import { getLeagueClubRosterIds } from "./managerLeagueRosters";

const VETERAN_AGE = 30;
/** Chance a veteran with a good season gains +1 when performance alone wouldn't. */
const VETERAN_UPSIDE_CHANCE = 0.18;
/** Minimum appearances before a player can gain rating at season end. */
const MIN_APPEARANCES_FOR_INCREASE = 8;

function computePotential(peakRating: number, age: number): number {
  if (age <= 21) return Math.min(95, peakRating + 8);
  if (age <= 24) return Math.min(92, peakRating + 5);
  if (age <= 27) return Math.min(90, peakRating + 2);
  if (age <= 30) return peakRating;
  return Math.max(65, peakRating - 3);
}

function hadGoodSeason(extras?: {
  appearances?: number;
  tries?: number;
  form?: number;
}): boolean {
  if (!extras) return false;
  const appearances = extras.appearances ?? 0;
  const tries = extras.tries ?? 0;
  const form = extras.form ?? 50;

  if (appearances >= 18) return true;
  if (appearances >= 10 && form >= 58) return true;
  if (form >= 70 && appearances >= MIN_APPEARANCES_FOR_INCREASE) return true;
  if (tries >= 6 && appearances >= 10) return true;
  return false;
}

function isVeteranWithGoodSeason(
  age: number,
  extras?: { appearances?: number; tries?: number; form?: number }
): boolean {
  return age >= VETERAN_AGE && hadGoodSeason(extras);
}

function developOnePlayer(
  playerId: string,
  career: ManagerCareer,
  playerDevelopment: Record<string, PlayerDevelopmentState>,
  extras?: { appearances?: number; tries?: number; form?: number },
  rng?: () => number
): PlayerDevelopmentState | null {
  const base = getPlayerById(playerId) ?? getManagerPlayer(career, playerId);
  if (!base) return null;

  const age = getManagerPlayerAge(career, playerId) ?? 25;
  const existing = playerDevelopment[playerId];
  const baseline = getManagerModePlayerRating(
    playerId,
    base.name,
    base.rating ?? base.peakRating
  );
  const before = existing?.rating ?? baseline;
  const potential = existing?.potential ?? computePotential(baseline, age);
  const veteranGoodSeason = isVeteranWithGoodSeason(age, extras);

  const appearances = extras?.appearances ?? 0;
  const tries = extras?.tries ?? 0;
  const form = extras?.form ?? 50;
  const playedEnoughForIncrease =
    !extras || appearances >= MIN_APPEARANCES_FOR_INCREASE;

  let delta = 0;
  if (before < potential) {
    if (playedEnoughForIncrease) {
      if (age <= 21) delta += 1.5;
      else if (age <= 24) delta += 1;
      else if (age <= 27) delta += 0.5;
      else if (!veteranGoodSeason) {
        if (age >= 33) delta -= 1;
        else if (age >= 30) delta -= 0.5;
      }

      const potentialGap = potential - before;
      if (age <= 24 && potentialGap >= 10) delta += 0.5;
      else if (age <= 27 && potentialGap >= 6) delta += 0.25;
    } else if (!veteranGoodSeason) {
      if (age >= 33) delta -= 1;
      else if (age >= 30) delta -= 0.5;
    }
  } else if (!veteranGoodSeason) {
    if (age >= 33) delta -= 1;
    else if (age >= 30) delta -= 0.5;
  }

  if (playedEnoughForIncrease) {
    if (appearances >= 18) delta += 1.5;
    else if (appearances >= 10) delta += 0.5;

    if (tries >= 12) delta += 1;
    else if (tries >= 6) delta += 0.5;

    if (form >= 70) delta += 1;
    else if (form >= 58) delta += 0.5;
    else if (form < 42 && extras) delta -= 0.5;
  } else if (appearances < 4 && extras) {
    delta -= 0.5;
  }

  if (veteranGoodSeason) {
    delta = Math.max(0, delta);
  }

  let finalDelta = Math.round(delta);
  if (!playedEnoughForIncrease && finalDelta > 0) {
    finalDelta = 0;
  }
  if (
    veteranGoodSeason &&
    playedEnoughForIncrease &&
    finalDelta <= 0 &&
    rng &&
    rng() < VETERAN_UPSIDE_CHANCE
  ) {
    finalDelta = 1;
  }

  const ratingCap =
    veteranGoodSeason && finalDelta > 0
      ? Math.max(potential, before + finalDelta)
      : potential;
  let after = Math.max(55, Math.min(ratingCap, before + finalDelta));
  if (veteranGoodSeason) {
    after = Math.max(before, after);
  }
  const newPeak = Math.max(existing?.peakRating ?? baseline, after, baseline);

  return {
    rating: after,
    peakRating: newPeak,
    potential,
  };
}

function developLeaguePlayersAtSeasonEnd(
  career: ManagerCareer,
  playerDevelopment: Record<string, PlayerDevelopmentState>
): Record<string, PlayerDevelopmentState> {
  const rng = seedrandom(`${career.seed}-league-dev-${career.seasonYear}`);
  const userIds = new Set(career.squad.map((p) => p.playerId));
  const next = { ...playerDevelopment };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    const rosterIds = getLeagueClubRosterIds(career, club).slice(0, 22);
    for (const playerId of rosterIds) {
      const player = getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
      if (!player) continue;
      if (userIds.has(player.id)) continue;
      if (rng() > 0.55) continue;

      const age = getManagerPlayerAge(career, player.id) ?? 25;
      const baseline = getManagerModePlayerRating(
        player.id,
        player.name,
        player.rating ?? player.peakRating
      );
      const existing = next[player.id];
      const before = existing?.rating ?? baseline;
      const potential = existing?.potential ?? computePotential(baseline, age);
      let delta = 0;
      if (age <= 23) delta += rng() < 0.6 ? 1 : 0;
      else if (age >= 32) {
        if (rng() < 0.22) {
          delta += rng() < VETERAN_UPSIDE_CHANCE ? 1 : 0;
        } else {
          delta -= rng() < 0.55 ? 1 : 0;
        }
      } else delta += rng() < 0.35 ? 1 : rng() < 0.2 ? -1 : 0;

      const after = Math.max(55, Math.min(potential, before + delta));
      if (after === before) continue;

      next[player.id] = {
        ...existing,
        rating: after,
        peakRating: Math.max(existing?.peakRating ?? baseline, after, baseline),
        potential,
      };
    }
  }

  return next;
}

/** Snapshot each squad player's rating at the start of a new season. */
export function snapshotSquadSeasonStartRatings(
  career: ManagerCareer
): Record<string, PlayerDevelopmentState> {
  const next = { ...(career.playerDevelopment ?? {}) };

  for (const ps of career.squad) {
    const base = getPlayerById(ps.playerId);
    if (!base) continue;

    const age = getManagerPlayerAge(career, ps.playerId) ?? 25;
    const baseline = getManagerModePlayerRating(
      ps.playerId,
      base.name,
      base.rating ?? base.peakRating
    );
    const existing = next[ps.playerId];
    const current = existing?.rating ?? baseline;

    next[ps.playerId] = {
      rating: current,
      peakRating: existing?.peakRating ?? current,
      potential: existing?.potential ?? computePotential(baseline, age),
      developmentRate: existing?.developmentRate,
      seasonStartRating: current,
      promotedSeasonYear: undefined,
    };
  }

  return next;
}

export function developSquadAtSeasonEnd(career: ManagerCareer): {
  career: ManagerCareer;
  changes: PlayerDevelopmentChange[];
} {
  const playerDevelopment: Record<string, PlayerDevelopmentState> = {
    ...(career.playerDevelopment ?? {}),
  };
  const changes: PlayerDevelopmentChange[] = [];

  for (const ps of career.squad) {
    const base = getPlayerById(ps.playerId);
    if (!base) continue;

    const baseline = getManagerModePlayerRating(
      ps.playerId,
      base.name,
      base.rating ?? base.peakRating
    );
    const devState = playerDevelopment[ps.playerId];
    const reviewBefore =
      devState?.seasonStartRating ?? devState?.rating ?? baseline;

    const developed = developOnePlayer(
      ps.playerId,
      career,
      playerDevelopment,
      {
        appearances: ps.seasonAppearances,
        tries: ps.seasonTries,
        form: ps.form,
      },
      seedrandom(`${career.seed}-dev-${career.seasonYear}-${ps.playerId}`)
    );
    if (!developed) continue;

    playerDevelopment[ps.playerId] = {
      ...devState,
      ...developed,
    };

    const actualDelta = developed.rating - reviewBefore;
    const promotedThisSeason = devState?.promotedSeasonYear === career.seasonYear;
    if (actualDelta !== 0 || promotedThisSeason) {
      changes.push({
        playerId: ps.playerId,
        playerName: base.name,
        before: reviewBefore,
        after: developed.rating,
        potential: developed.potential,
        delta: actualDelta,
        seasonStartRating: devState?.seasonStartRating,
        promotedFromReserve: promotedThisSeason,
      });
    }
  }

  const withLeague = developLeaguePlayersAtSeasonEnd(career, playerDevelopment);

  changes.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.delta - a.delta
  );

  return {
    career: { ...career, playerDevelopment: withLeague },
    changes,
  };
}

export function ensureSeasonEndPlayerDevelopment(
  career: ManagerCareer
): ManagerCareer {
  if (!career.isSeasonComplete || career.lastSeasonDevelopmentReview) {
    return career;
  }
  const developed = developSquadAtSeasonEnd(career);
  return {
    ...developed.career,
    isSeasonComplete: true,
    lastSeasonDevelopmentReview: developed.changes,
  };
}

export function getPlayerPotential(
  career: ManagerCareer,
  playerId: string
): number | null {
  const dev = career.playerDevelopment?.[playerId];
  if (dev) return dev.potential;
  const player = getManagerPlayer(career, playerId);
  if (!player) return null;
  return computePotential(
    player.peakRating,
    getManagerPlayerAge(career, playerId) ?? 25
  );
}
