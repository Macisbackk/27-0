import type { MatchFixture } from "../game/season-simulation";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { getSeasonGradeFromSquad } from "../grades";
import { getSquadValue } from "../positions";
import { getUserLeagueTablePosition } from "../manager/managerFixtures";
import { getEffectiveStadiumCapacity, ensureClubFacilities } from "../manager/managerFacilities";
import type { ManagerCareer, ManagerFixtureRecord } from "../manager/types";
import type { SquadSlot } from "../types";
import type { AchievementCheckContext } from "./achievementContext";
import { dispatchAchievementCheck } from "./achievementNotify";

function countBradfordPlayers(squad: SquadSlot[]): number {
  return squad.filter((slot) => {
    const club = slot.player?.club ?? slot.player?.displayClub ?? "";
    return club.toLowerCase().includes("bradford");
  }).length;
}

export function triggerAchievementCheck(ctx: AchievementCheckContext): void {
  dispatchAchievementCheck(ctx);
}

export function triggerQuickMatchAchievements(fixture: MatchFixture): void {
  const won = fixture.result === "W";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  triggerAchievementCheck({
    trigger: "quick-match-completed",
    matchWon: won,
    marginOfVictory: won ? margin : undefined,
  });
}

export function triggerQuickSeasonAchievements(
  squad: SquadSlot[],
  season: {
    wins: number;
    losses: number;
    leaguePosition: number;
    pointsDifference: number;
    isPerfect: boolean;
    squadStrength: number;
    fixtures: MatchFixture[];
  },
  options: {
    joeMellorMode?: boolean;
    superSamHallasMode?: boolean;
    normalEraMode?: boolean;
    madePlayoffs?: boolean;
  } = {}
): void {
  const totalValue = getSquadValue(squad);
  const gradeInfo = getSeasonGradeFromSquad(squad, season, totalValue);
  const bradfordCount = countBradfordPlayers(squad);

  for (const fixture of season.fixtures) {
    if (fixture.result === "W") {
      triggerQuickMatchAchievements(fixture);
    }
  }

  triggerAchievementCheck({
    trigger: "quick-season-completed",
    seasonWins: season.wins,
    seasonLosses: season.losses,
    isPerfectSeason: season.isPerfect,
    isUnbeatenSeason: season.losses === 0 && season.wins > 0,
    madePlayoffs: options.madePlayoffs ?? season.leaguePosition <= 6,
    lowRatedSquad: season.squadStrength < 72,
    squadGrade: gradeInfo.grade,
    bradfordPlayerCount: bradfordCount,
    winningRecord: season.wins > season.losses,
    joeMellorComplete: options.joeMellorMode === true,
    superSamComplete: options.superSamHallasMode === true,
    goatMellorWin:
      options.joeMellorMode === true &&
      season.isPerfect &&
      season.wins >= 20,
    againstTheOddsComplete: options.superSamHallasMode === true,
    bradfordChallengeComplete: options.joeMellorMode === true,
    eraCup: options.normalEraMode === true,
  });
}

export function triggerManagerMatchAchievements(
  career: ManagerCareer,
  fixture: MatchFixture
): void {
  const won = fixture.result === "W";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const record = fixture as ManagerFixtureRecord;
  const attendance = record.meta?.attendance;
  const stadiumCapacity = getEffectiveStadiumCapacity(
    career.club,
    ensureClubFacilities(career.clubFacilities)
  );
  const capacityPct =
    attendance && stadiumCapacity > 0
      ? (attendance.attendance / stadiumCapacity) * 100
      : undefined;
  const reserveCalledUp = career.calledUpReserveIds.length > 0;

  triggerAchievementCheck({
    trigger: "manager-match-completed",
    managerWin: won,
    matchWon: won,
    marginOfVictory: won ? margin : undefined,
    reserveCalledUp,
    stadiumCapacityPct: capacityPct,
    cupPlayed: record.competition === "challenge_cup",
    beatStrongerTeam: fixture.isUpset === true,
  });
}

export function triggerManagerSeasonAchievements(career: ManagerCareer): void {
  const position = getUserLeagueTablePosition(career);
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  const leagueWinner = position === 1;
  const grandFinalWinner =
    career.playoffs?.finish === "Super League Champions";
  const cupWinner = cupOutcome.isWinner;
  const doubleWinner = leagueWinner && cupWinner;

  triggerAchievementCheck({
    trigger: "manager-season-completed",
    managerSeasonComplete: true,
    managerFinishPosition: position,
    managerLeagueWinner: leagueWinner,
    managerGrandFinalWinner: grandFinalWinner,
    managerDoubleWinner: doubleWinner,
    cupWon: cupWinner,
    cupFinalReached:
      cupOutcome.isWinner || cupOutcome.finish === "Runners-Up",
    boardConfidence: career.boardConfidence,
  });
}

export function triggerClubFundsAchievements(): void {
  triggerAchievementCheck({ trigger: "club-funds-updated" });
}

export function triggerSecretButtonAchievement(): void {
  triggerAchievementCheck({
    trigger: "secret-button",
    secretButtonTriggered: true,
  });
}
