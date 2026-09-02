/**
 * Pre-Season-Review summary of playoffs, MPG, and promotion/relegation.
 */
import type { PlayoffBracketState } from "../game/playoff-bracket";
import type { ManagerCareer } from "./types";
import { getChampionshipPlayoffWinner } from "./managerChampionshipPlayoffs";
import { MILLION_POUND_GAME_NAME } from "./managerMillionPoundGame";
import { resolveSeasonMembershipMoves } from "./managerSeasonTransition";
import { getSeasonOutcomeSummary } from "./seasonOutcomeHeadline";

export type SeasonTransitionPreview = {
  slPlayoffWinner: string | null;
  slPlayoffMatches: { id: string; home: string | null; away: string | null; winner: string | null }[];
  champPlayoffWinner: string | null;
  champPlayoffMatches: { id: string; home: string | null; away: string | null; winner: string | null }[];
  mpg: {
    slClub: string | null;
    champClub: string | null;
    winner: string | null;
    loser: string | null;
    outcome: string;
  };
  autoPromoted: string[];
  mpgPromoted: string[];
  autoRelegated: string[];
  mpgRelegated: string[];
  userHeadline: string | null;
};

function bracketRows(bracket?: PlayoffBracketState) {
  return (bracket?.matches ?? []).map((m) => ({
    id: m.id,
    home: m.homeTeam,
    away: m.awayTeam,
    winner: m.winner,
  }));
}

function slPlayoffWinner(career: ManagerCareer): string | null {
  const gf = career.playoffs?.matches.find((m) => m.id === "gf" || m.round === 3);
  if (gf?.winner) return gf.winner;
  if (career.playoffs?.finish === "Super League Champions") return career.club;
  return null;
}

export function buildSeasonTransitionPreview(
  career: ManagerCareer
): SeasonTransitionPreview {
  const moves = resolveSeasonMembershipMoves(career);
  const mpg = career.millionPoundGame;
  const champWinner = getChampionshipPlayoffWinner(career.championshipPlayoffs);
  let mpgOutcome = "Pending";
  if (mpg?.status === "complete" && mpg.winner && mpg.loser) {
    mpgOutcome =
      mpg.winner === mpg.champClub
        ? `${mpg.champClub} promoted · ${mpg.slClub} relegated`
        : `${mpg.slClub} stay in Super League · ${mpg.champClub} remain in the Championship`;
  }

  let userHeadline: string | null = null;
  const seasonOutcome = getSeasonOutcomeSummary(career);
  if (
    moves.autoPromoted.includes(career.club) ||
    moves.mpgPromoted.includes(career.club) ||
    moves.autoRelegated.includes(career.club) ||
    moves.mpgRelegated.includes(career.club) ||
    champWinner === career.club ||
    mpg?.slClub === career.club ||
    mpg?.champClub === career.club ||
    seasonOutcome.tone === "gold" ||
    seasonOutcome.tone === "red" ||
    seasonOutcome.tone === "amber"
  ) {
    userHeadline = seasonOutcome.headline;
  }

  return {
    slPlayoffWinner: slPlayoffWinner(career),
    slPlayoffMatches: bracketRows(career.playoffs),
    champPlayoffWinner: champWinner,
    champPlayoffMatches: bracketRows(career.championshipPlayoffs),
    mpg: {
      slClub: mpg?.slClub ?? null,
      champClub: mpg?.champClub ?? null,
      winner: mpg?.winner ?? null,
      loser: mpg?.loser ?? null,
      outcome: mpgOutcome,
    },
    autoPromoted: moves.autoPromoted,
    mpgPromoted: moves.mpgPromoted,
    autoRelegated: moves.autoRelegated,
    mpgRelegated: moves.mpgRelegated,
    userHeadline,
  };
}

export function shouldShowSeasonTransitionPreview(
  career: ManagerCareer
): boolean {
  if (career.seasonTransitionPreviewShown) return false;
  return Boolean(career.isSeasonComplete);
}

export function acknowledgeSeasonTransitionPreview(
  career: ManagerCareer
): ManagerCareer {
  return {
    ...career,
    seasonTransitionPreviewShown: true,
    promotionCelebrationShown: true,
    updatedAt: new Date().toISOString(),
  };
}

export { MILLION_POUND_GAME_NAME };
