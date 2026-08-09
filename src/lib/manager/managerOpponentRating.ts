import type { ManagerCareer, ManagerScheduledFixture } from "./types";
import {
  getManagerOpponentMatchRating,
  getManagerOpponentPoolOptions,
  getLeagueClubPlayerPool,
} from "./managerLeagueRosters";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import {
  buildNrlMatchdayLineup,
  computeNrlLineupTeamRating,
} from "../nrl/nrlMatchdayLineup";
import { isNrlClubName } from "../nrl/nrlClubs";
import {
  getChampionshipClubByName,
  isChampionshipClubName,
} from "../clubs/championship-clubs";
import { championshipFriendlySimRating } from "./managerFriendlies";
import { isUserInChampionship } from "./leagueMembership";

/**
 * Squad-scale Championship team rating for display (peakRating XIII band).
 * Falls back to raw baseStrength when squads are missing.
 */
export function getChampionshipDisplayTeamRating(
  career: ManagerCareer,
  club: string
): number {
  const pool = getLeagueClubPlayerPool(career, club);
  if (pool.length >= 13) {
    const ranked = [...pool].sort((a, b) => b.peakRating - a.peakRating);
    const sample = ranked.slice(0, 17);
    return Math.round(
      sample.reduce((sum, p) => sum + p.peakRating, 0) / sample.length
    );
  }
  return getChampionshipClubByName(club)?.baseStrength ?? 62;
}

/**
 * Displayed opponent team rating for Hub / Play / predictions.
 * Must use the same underlying squad strength as match simulation for WCC/NRL.
 */
export function getDisplayedOpponentTeamRating(
  career: ManagerCareer,
  fixture: Pick<
    ManagerScheduledFixture,
    "opponent" | "round" | "competition" | "id"
  >
): number {
  if (fixture.competition === "friendly") {
    if (isChampionshipClubName(fixture.opponent)) {
      // Prefer the stored friendly card rating (squad / baseStrength scale).
      if (career.preSeason.activeFriendly?.club === fixture.opponent) {
        const stored = career.preSeason.activeFriendly.teamRating;
        // Legacy cup-tier saves (~40–62) — rematerialise on the display scale.
        if (stored >= 65) return stored;
      }
      return getChampionshipDisplayTeamRating(career, fixture.opponent);
    }
    if (career.preSeason.activeFriendly?.club === fixture.opponent) {
      return career.preSeason.activeFriendly.teamRating;
    }
  }

  if (
    fixture.competition === "world_club_challenge" ||
    isNrlClubName(fixture.opponent)
  ) {
    return getWccOpponentTeamRating(career, fixture.opponent);
  }

  return getManagerOpponentMatchRating(
    career,
    fixture.opponent,
    career.seed,
    fixture.round
  );
}

/**
 * Match-sim opponent rating for friendlies.
 * Super League users still face Champ sides on the cup-tier scale so a full
 * SL XIII does not treat them as Super League peers; Champ users see true squad ratings.
 */
export function getFriendlyMatchOpponentRating(
  career: ManagerCareer,
  opponent: string,
  round: number,
  fixtureId: string
): number {
  if (isChampionshipClubName(opponent) && !isUserInChampionship(career)) {
    return championshipFriendlySimRating(opponent);
  }
  return getDisplayedOpponentTeamRating(career, {
    opponent,
    round,
    competition: "friendly",
    id: fixtureId,
  });
}

/** Shared WCC / NRL strength: weighted average of the generated matchday lineup. */
export function getWccOpponentTeamRating(
  career: ManagerCareer,
  opponentName: string
): number {
  const stored = career.worldClubChallenge?.currentFixture;
  const championRating =
    stored && stored.nrlChampionName === opponentName
      ? stored.nrlChampionRating
      : undefined;

  const lineup = buildNrlMatchdayLineup({
    seed: career.seed,
    teamName: opponentName,
    teamRating: championRating,
    seasonYear: career.seasonYear,
  });

  if (lineup.players.length < 13) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[WCC] Incomplete NRL lineup for ${opponentName}: ${lineup.players.length}/17 players. Using champion rating fallback.`
      );
    }
    return championRating ?? lineup.teamRating;
  }

  return computeNrlLineupTeamRating(lineup);
}

/** Hub helper replacing Super League pool math for every opponent. */
export function getHubOpponentRating(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture
): number {
  if (
    fixture.competition === "world_club_challenge" ||
    fixture.competition === "friendly" ||
    isNrlClubName(fixture.opponent)
  ) {
    return getDisplayedOpponentTeamRating(career, fixture);
  }

  return Math.round(
    getOpponentMatchRating(
      fixture.opponent,
      career.seed,
      fixture.round,
      getManagerOpponentPoolOptions(career, fixture.opponent)
    )
  );
}
