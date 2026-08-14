/**
 * Pre-Season-Review summary of playoffs, MPG, and promotion/relegation.
 */
import type { PlayoffBracketState } from "../game/playoff-bracket";
import type { ManagerCareer } from "./types";
import { getChampionshipPlayoffWinner } from "./managerChampionshipPlayoffs";
import { MILLION_POUND_GAME_NAME } from "./managerMillionPoundGame";
import { resolveSeasonMembershipMoves } from "./managerSeasonTransition";

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
  let outcome = "Pending";
  if (mpg?.status === "complete" && mpg.winner && mpg.loser) {
    outcome =
      mpg.winner === mpg.champClub
        ? `${mpg.champClub} promoted · ${mpg.slClub} relegated`
        : `${mpg.slClub} stay in Super League · ${mpg.champClub} remain in the Championship`;
  }

  let userHeadline: string | null = null;
  if (moves.autoPromoted.includes(career.club)) {
    userHeadline = "Automatic Promotion";
  } else if (moves.mpgPromoted.includes(career.club)) {
    userHeadline = "Promoted to Super League";
  } else if (champWinner === career.club && mpg?.status !== "complete") {
    userHeadline = "Qualified for the Million Pound Game";
  } else if (moves.autoRelegated.includes(career.club)) {
    userHeadline = "Automatic Relegation";
  } else if (moves.mpgRelegated.includes(career.club)) {
    userHeadline = "Relegated to the Championship";
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
      outcome,
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
