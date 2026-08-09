import type { ManagerCareer, ManagerScheduledFixture } from "./types";
import {
  getManagerOpponentMatchRating,
  getManagerOpponentPoolOptions,
} from "./managerLeagueRosters";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import {
  buildNrlMatchdayLineup,
  computeNrlLineupTeamRating,
} from "../nrl/nrlMatchdayLineup";
import { isNrlClubName } from "../nrl/nrlClubs";
import { isChampionshipClubName } from "../clubs/championship-clubs";

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
    // Championship friendlies must use the cup tier scale — never the legacy
    // stored teamRating (baseStrength×1.15) that made them SL-competitive.
    if (isChampionshipClubName(fixture.opponent)) {
      return getManagerOpponentMatchRating(
        career,
        fixture.opponent,
        career.seed,
        fixture.round
      );
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
