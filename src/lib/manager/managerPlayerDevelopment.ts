import seedrandom from "seedrandom";
import { PLAYER_POTENTIAL_OVERRIDES } from "../../../data/player-potential-overrides";
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
import {
  getPlayerSeasonImpact,
  computePlayerSeasonImpact,
  impactDevelopmentDelta,
  isPoorSeasonImpact,
  rollImpactRegression,
} from "./managerPlayerImpact";

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

function resolvePlayerPotential(
  playerId: string,
  peakRating: number,
  age: number,
  existing?: number
): number {
  const override = PLAYER_POTENTIAL_OVERRIDES[playerId];
  if (override !== undefined) return override;
  if (existing !== undefined) return existing;
  return computePotential(peakRating, age);
}

function hadGoodSeason(extras?: {
  appearances?: number;
  tries?: number;
  form?: number;
  impact?: number;
}): boolean {
  if (extras?.impact != null && isPoorSeasonImpact(extras.impact)) return false;
  if (!extras) return false;
  const appearances = extras.appearances ?? 0;
  const tries = extras.tries ?? 0;
  const form = extras.form ?? 50;
  const impact = extras.impact ?? 50;

  if (appearances < MIN_APPEARANCES_FOR_INCREASE) return false;

  if (impact >= 58) return true;
  if (impact >= 52 && appearances >= 10) return true;
  if (form >= 68 && appearances >= 10 && impact >= 48) return true;
  if (tries >= 8 && appearances >= 10 && impact >= 50) return true;
  return false;
}

function isVeteranWithGoodSeason(
  age: number,
  extras?: { appearances?: number; tries?: number; form?: number; impact?: number }
): boolean {
  return age >= VETERAN_AGE && hadGoodSeason(extras);
}

function developOnePlayer(
  playerId: string,
  career: ManagerCareer,
  playerDevelopment: Record<string, PlayerDevelopmentState>,
  extras?: { appearances?: number; tries?: number; form?: number; impact?: number },
  rng?: () => number
): PlayerDevelopmentState | null {
  const base = getPlayerById(playerId) ?? getManagerPlayer(career, playerId);
  if (!base) return null;

  const age = getManagerPlayerAge(career, playerId) ?? 25;
  const existing = playerDevelopment[playerId];
  const baseline = getManagerModePlayerRating(
    playerId,
    base.name,
    base.peakRating
  );
  const before = existing?.rating ?? baseline;
  const potential = resolvePlayerPotential(
    playerId,
    baseline,
    age,
    existing?.potential
  );
  const veteranGoodSeason = isVeteranWithGoodSeason(age, extras);
  const appearances = extras?.appearances ?? 0;
  const tries = extras?.tries ?? 0;
  const form = extras?.form ?? 50;
  const impact = extras?.impact ?? 50;
  const poorIndividualSeason = isPoorSeasonImpact(impact);
  const protectFromDecline = veteranGoodSeason && !poorIndividualSeason;

  const playedEnoughForIncrease =
    !extras || appearances >= MIN_APPEARANCES_FOR_INCREASE;

  let delta = 0;
  if (before < potential) {
    if (playedEnoughForIncrease) {
      if (age <= 21) delta += 1.5;
      else if (age <= 24) delta += 1;
      else if (age <= 27) delta += 0.5;
      else if (!protectFromDecline) {
        if (age >= 33) delta -= 1;
        else if (age >= 30) delta -= 0.5;
      }

      const potentialGap = potential - before;
      if (age <= 24 && potentialGap >= 10) delta += 0.5;
      else if (age <= 27 && potentialGap >= 6) delta += 0.25;
    } else if (!protectFromDecline) {
      if (age >= 33) delta -= 1;
      else if (age >= 30) delta -= 0.5;
    }
  } else if (!protectFromDecline) {
    if (age >= 33) delta -= 1;
    else if (age >= 30) delta -= 0.5;
  }

  if (playedEnoughForIncrease) {
    const performanceFactor =
      impact >= 58
        ? 1
        : impact >= 52
          ? 0.75
          : impact >= 45
            ? 0.35
            : impact < 42
              ? 0
              : 0.15;

    if (performanceFactor > 0) {
      if (appearances >= 18) delta += 1.5 * performanceFactor;
      else if (appearances >= 10) delta += 0.5 * performanceFactor;
    }

    if (tries >= 12) delta += 1;
    else if (tries >= 6) delta += 0.5;

    if (form >= 70) delta += 1;
    else if (form >= 58) delta += 0.5;
    else if (form < 42 && extras) delta -= 0.5;

    if (appearances >= 14 && poorIndividualSeason) {
      delta -= 0.35;
    }
  } else if (appearances < 4 && extras) {
    delta -= 0.5;
  }

  delta += impactDevelopmentDelta(impact, appearances);

  if (protectFromDecline) {
    delta = Math.max(0, delta);
  }

  let finalDelta = Math.round(delta);
  if (!playedEnoughForIncrease && finalDelta > 0) {
    finalDelta = 0;
  }
  if (rng) {
    finalDelta += rollImpactRegression(impact, appearances, rng);
  }
  if (!playedEnoughForIncrease && finalDelta > 0) {
    finalDelta = 0;
  }
  if (
    veteranGoodSeason &&
    !poorIndividualSeason &&
    playedEnoughForIncrease &&
    finalDelta <= 0 &&
    rng &&
    rng() < VETERAN_UPSIDE_CHANCE
  ) {
    finalDelta = 1;
  }

  const ratingCap =
    veteranGoodSeason && !poorIndividualSeason && finalDelta > 0
      ? Math.max(potential, before + finalDelta)
      : potential;
  let after = Math.max(55, Math.min(ratingCap, before + finalDelta));
  if (protectFromDecline) {
    after = Math.max(before, after);
  }
  const newPeak = Math.max(existing?.peakRating ?? baseline, after, baseline);

  return {
    rating: after,
    peakRating: newPeak,
    potential,
  };
}

function simulateLeaguePlayerSeason(
  career: ManagerCareer,
  rating: number,
  rng: () => number
): { appearances: number; tries: number; form: number; impact: number } {
  const teamGames = Math.max(
    22,
    career.fixtures.filter((f) => (f.competition ?? "league") !== "friendly")
      .length
  );
  const quality = Math.min(1, Math.max(0, (rating - 68) / 28));
  const isRegular = rng() < 0.25 + quality * 0.5;

  let appearances = 0;
  if (isRegular) {
    appearances = Math.round(
      teamGames * (0.5 + quality * 0.35 + rng() * 0.12)
    );
  } else {
    appearances = Math.round(rng() * teamGames * 0.28);
  }
  appearances = Math.min(teamGames, Math.max(0, appearances));

  const tries = Math.round(
    appearances * (0.02 + quality * 0.1 + rng() * 0.06)
  );
  const form = Math.round(
    Math.max(32, Math.min(78, 46 + quality * 18 + (rng() - 0.5) * 16))
  );
  const impact = computePlayerSeasonImpact({
    appearances,
    tries,
    form,
    teamGamesPlayed: teamGames,
  });

  return { appearances, tries, form, impact };
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
    const rosterIds = getLeagueClubRosterIds(career, club);
    for (const playerId of rosterIds) {
      const player = getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
      if (!player) continue;
      if (userIds.has(player.id)) continue;

      const rating = player.peakRating;
      const season = simulateLeaguePlayerSeason(career, rating, rng);
      const developed = developOnePlayer(
        player.id,
        career,
        next,
        season,
        seedrandom(`${career.seed}-league-dev-${career.seasonYear}-${player.id}`)
      );
      if (!developed) continue;

      next[player.id] = {
        ...next[player.id],
        ...developed,
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
      base.peakRating
    );
    const existing = next[ps.playerId];
    const current = existing?.rating ?? baseline;

    next[ps.playerId] = {
      rating: current,
      peakRating: existing?.peakRating ?? current,
      potential: resolvePlayerPotential(
        ps.playerId,
        baseline,
        age,
        existing?.potential
      ),
      developmentRate: existing?.developmentRate,
      seasonStartRating: current,
      promotedSeasonYear: undefined,
    };
  }

  return next;
}

const UNDERPERFORMER_IMPACT_THRESHOLD = 42;
const UNDERPERFORMER_MIN_APPEARANCES = 5;

function isTeamGoodSeason(career: ManagerCareer): boolean {
  const { played, wins } = career.teamSeasonStats;
  if (played < 10) return false;
  const winRate = wins / played;
  const position =
    career.leagueTable.find((row) => row.isUserTeam)?.position ?? 14;
  return winRate >= 0.52 || position <= 6;
}

function applyGoodSeasonUnderperformerDowngrades(
  career: ManagerCareer,
  playerDevelopment: Record<string, PlayerDevelopmentState>,
  changes: PlayerDevelopmentChange[]
): void {
  if (!isTeamGoodSeason(career)) return;

  const rng = seedrandom(
    `${career.seed}-underperformer-${career.seasonYear}`
  );

  const candidates = career.squad
    .map((ps) => {
      const base = getPlayerById(ps.playerId);
      if (!base) return null;

      const impact = getPlayerSeasonImpact(career, ps.playerId);
      if (impact >= UNDERPERFORMER_IMPACT_THRESHOLD) return null;
      if ((ps.seasonAppearances ?? 0) < UNDERPERFORMER_MIN_APPEARANCES) {
        return null;
      }

      const existingChange = changes.find((c) => c.playerId === ps.playerId);
      if (existingChange && existingChange.delta < 0) return null;

      const devState = playerDevelopment[ps.playerId];
      const reviewBefore =
        devState?.seasonStartRating ?? devState?.rating ?? base.peakRating;
      const currentAfter =
        existingChange?.after ?? devState?.rating ?? reviewBefore;
      if (currentAfter <= reviewBefore - 1) return null;

      return {
        ps,
        base,
        impact,
        reviewBefore,
        currentAfter,
        existingChange,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => a.impact - b.impact || a.currentAfter - b.currentAfter);

  if (candidates.length === 0) return;

  const downgradeCount = Math.min(
    candidates.length,
    1 + Math.floor(rng() * Math.min(3, candidates.length))
  );

  for (let i = 0; i < downgradeCount; i++) {
    const { ps, base, impact, reviewBefore, currentAfter, existingChange } =
      candidates[i]!;
    const after = Math.max(55, currentAfter - 1);
    if (after >= currentAfter) continue;

    const devState = playerDevelopment[ps.playerId];
    playerDevelopment[ps.playerId] = {
      ...devState,
      rating: after,
      peakRating: Math.max(devState?.peakRating ?? after, after),
    };

    const newDelta = after - reviewBefore;
    if (existingChange) {
      existingChange.after = after;
      existingChange.delta = newDelta;
    } else {
      changes.push({
        playerId: ps.playerId,
        playerName: base.name,
        before: reviewBefore,
        after,
        potential: devState?.potential ?? 80,
        delta: newDelta,
        seasonStartRating: devState?.seasonStartRating,
        seasonImpact: impact,
      });
    }
  }
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
      base.peakRating
    );
    const devState = playerDevelopment[ps.playerId];
    const reviewBefore =
      devState?.seasonStartRating ?? devState?.rating ?? baseline;

    const impact = getPlayerSeasonImpact(career, ps.playerId);

    const developed = developOnePlayer(
      ps.playerId,
      career,
      playerDevelopment,
      {
        appearances: ps.seasonAppearances,
        tries: ps.seasonTries,
        form: ps.form,
        impact,
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
        seasonImpact: impact,
      });
    }
  }

  applyGoodSeasonUnderperformerDowngrades(career, playerDevelopment, changes);

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
  const player = getManagerPlayer(career, playerId);
  if (!player && !dev) return null;
  const baseline = player
    ? getManagerModePlayerRating(playerId, player.name, player.peakRating)
    : (dev?.peakRating ?? dev?.rating ?? 0);
  return resolvePlayerPotential(
    playerId,
    baseline,
    getManagerPlayerAge(career, playerId) ?? 25,
    dev?.potential
  );
}
