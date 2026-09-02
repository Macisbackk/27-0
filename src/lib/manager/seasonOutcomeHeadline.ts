/**
 * Single source for end-of-season outcome headlines.
 * Prefer resolved membership moves + MPG status over screen-local copy.
 */
import type { ManagerCareer } from "./types";
import { isUserInChampionship } from "./leagueMembership";
import { getChampionshipPlayoffWinner } from "./managerChampionshipPlayoffs";
import { MILLION_POUND_GAME_NAME } from "./managerMillionPoundGame";
import { resolveSeasonMembershipMoves } from "./managerSeasonTransition";
import { getUserLeagueTablePosition } from "./managerFixtures";
import {
  getAutoRelegateTablePosition,
  getMillionPoundGameTablePosition,
} from "./managerLeagues";
import { getUserLeagueClubs } from "./leagueMembership";
import { userQualifiedForManagerPlayoffs } from "./managerPlayoffs";

export type SeasonOutcomeTone = "gold" | "primary" | "amber" | "red" | "default";

export type SeasonOutcomeSummary = {
  /** Short ordinal finish e.g. "3rd". */
  positionLabel: string;
  /** One-line club outcome for Season Review hero. */
  headline: string;
  tone: SeasonOutcomeTone;
  /** Compact pathway label (no rulebook). */
  pathwayLabel: string;
  pathwayTone: SeasonOutcomeTone;
  /** Playoff section — null when not involved. */
  playoffLabel: string | null;
  mpgLabel: string | null;
};

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function getSeasonOutcomeSummary(
  career: ManagerCareer
): SeasonOutcomeSummary {
  const position = getUserLeagueTablePosition(career);
  const positionLabel = ordinal(position);
  const moves = resolveSeasonMembershipMoves(career);
  const inChamp = isUserInChampionship(career);
  const leagueSize = getUserLeagueClubs(career).length;
  const mpg = career.millionPoundGame;
  const champPoWinner =
    getChampionshipPlayoffWinner(career.championshipPlayoffs) === career.club;
  const mpgComplete = mpg?.status === "complete";
  const mpgWon = mpg?.winner === career.club;
  const mpgLost = mpg?.loser === career.club;

  let headline = `${positionLabel} — League finish`;
  let tone: SeasonOutcomeTone = "default";
  let pathwayLabel = "Season complete";
  let pathwayTone: SeasonOutcomeTone = "default";
  let playoffLabel: string | null = null;
  let mpgLabel: string | null = null;

  if (inChamp) {
    if (moves.autoPromoted.includes(career.club) || position === 1) {
      headline = `${positionLabel} — Championship Champions`;
      tone = "gold";
      pathwayLabel = "Automatic promotion to Super League";
      pathwayTone = "gold";
    } else if (moves.mpgPromoted.includes(career.club) || mpgWon) {
      headline = `${positionLabel} — Promoted via ${MILLION_POUND_GAME_NAME}`;
      tone = "gold";
      pathwayLabel = `${MILLION_POUND_GAME_NAME} winners`;
      pathwayTone = "gold";
      mpgLabel = `${mpg?.winner} beat ${mpg?.loser}`;
    } else if (mpgLost && champPoWinner) {
      headline = `${positionLabel} — ${MILLION_POUND_GAME_NAME} defeat`;
      tone = "red";
      pathwayLabel = "Promotion denied — remain in Championship";
      pathwayTone = "red";
      mpgLabel = `${mpg?.winner} beat ${mpg?.loser}`;
      playoffLabel = "Championship play-off winners";
    } else if (champPoWinner && !mpgComplete) {
      headline = `${positionLabel} — Qualified for ${MILLION_POUND_GAME_NAME}`;
      tone = "amber";
      pathwayLabel = `Play-off won — ${MILLION_POUND_GAME_NAME} next`;
      pathwayTone = "amber";
      playoffLabel = "Championship play-off winners";
    } else if (position >= 2 && position <= 5) {
      headline = `${positionLabel} — Championship play-offs`;
      tone = "amber";
      pathwayLabel = career.championshipPlayoffs?.tournamentComplete
        ? "Play-off campaign complete"
        : "Play-off places";
      pathwayTone = "amber";
      playoffLabel = career.championshipPlayoffs?.finish ?? "Championship play-offs";
    } else {
      headline = `${positionLabel} — Championship finish`;
      tone = position >= 18 ? "red" : "default";
      pathwayLabel = position >= 18 ? "Below expectations" : "Mid-table finish";
      pathwayTone = position >= 18 ? "red" : "default";
    }
  } else {
    const autoRelPos = getAutoRelegateTablePosition("super-league", leagueSize);
    const mpgPos = getMillionPoundGameTablePosition("super-league", leagueSize);
    const playoffFinish = career.playoffs?.finish ?? null;

    if (playoffFinish === "Super League Champions") {
      headline = `${positionLabel} — Super League Champions`;
      tone = "gold";
      pathwayLabel = "Grand Final winners";
      pathwayTone = "gold";
      playoffLabel = playoffFinish;
    } else if (playoffFinish === "Grand Final Runner-Up") {
      headline = `${positionLabel} — Grand Final runners-up`;
      tone = "amber";
      pathwayLabel = "Grand Final defeat";
      pathwayTone = "amber";
      playoffLabel = playoffFinish;
    } else if (moves.autoRelegated.includes(career.club) || position === autoRelPos) {
      headline = `${positionLabel} — Relegated`;
      tone = "red";
      pathwayLabel = "Automatic relegation to Championship";
      pathwayTone = "red";
    } else if (moves.mpgRelegated.includes(career.club) || mpgLost) {
      headline = `${positionLabel} — Relegated via ${MILLION_POUND_GAME_NAME}`;
      tone = "red";
      pathwayLabel = `${MILLION_POUND_GAME_NAME} defeat`;
      pathwayTone = "red";
      mpgLabel = `${mpg?.winner} beat ${mpg?.loser}`;
    } else if (mpgWon) {
      headline = `${positionLabel} — Survived ${MILLION_POUND_GAME_NAME}`;
      tone = "primary";
      pathwayLabel = "Stay in Super League";
      pathwayTone = "primary";
      mpgLabel = `${mpg?.winner} beat ${mpg?.loser}`;
    } else if (position === mpgPos) {
      headline = `${positionLabel} — ${MILLION_POUND_GAME_NAME}`;
      tone = "amber";
      pathwayLabel = mpgComplete
        ? mpgLabel ?? MILLION_POUND_GAME_NAME
        : `Entered ${MILLION_POUND_GAME_NAME}`;
      pathwayTone = "amber";
      if (mpgComplete && mpg?.winner) {
        mpgLabel = `${mpg.winner} beat ${mpg.loser}`;
      }
    } else if (userQualifiedForManagerPlayoffs(career) || playoffFinish) {
      headline = `${positionLabel} — Playoff qualified`;
      tone = "amber";
      pathwayLabel = playoffFinish ?? "Playoff campaign";
      pathwayTone = "amber";
      playoffLabel = playoffFinish ?? "Playoffs";
    } else if (position <= 6) {
      headline = `${positionLabel} — Playoff places`;
      tone = "amber";
      pathwayLabel = "Top-six finish";
      pathwayTone = "amber";
    } else {
      headline = `${positionLabel} — League finish`;
      tone = "default";
      pathwayLabel = "Safe mid-table";
      pathwayTone = "default";
    }
  }

  return {
    positionLabel,
    headline,
    tone,
    pathwayLabel,
    pathwayTone,
    playoffLabel,
    mpgLabel,
  };
}
