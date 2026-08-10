import type { MatchFixture } from "../game/season-simulation";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { getSeasonGradeFromSquad } from "../grades";
import { getSquadValue } from "../positions";
import { getUserLeagueTablePosition } from "../manager/managerFixtures";
import { getEffectiveStadiumCapacity, ensureClubFacilities } from "../manager/managerFacilities";
import { getManagerSeasonTrophyLabels } from "../manager/managerSeasonTrophies";
import { shouldScheduleWorldClubChallenge } from "../manager/worldClubChallenge";
import { getUserLeagueClubs } from "../manager/leagueMembership";
import type { ManagerCareer, ManagerFixtureRecord } from "../manager/types";
import type { SquadSlot } from "../types";
import type { AchievementCheckContext } from "./achievementContext";
import { dispatchAchievementCheck } from "./achievementNotify";

const MAJOR_TROPHY_LABELS = [
  "League Leaders",
  "Super League Champions",
  "Challenge Cup",
  "World Club Challenge",
] as const;

function getMajorTrophiesWon(labels: string[]): string[] {
  return labels.filter((label) =>
    (MAJOR_TROPHY_LABELS as readonly string[]).includes(label)
  );
}

function getAvailableMajorTrophies(career: ManagerCareer): string[] {
  const available: string[] = [
    "League Leaders",
    "Super League Champions",
    "Challenge Cup",
  ];
  if (shouldScheduleWorldClubChallenge(career)) {
    available.push("World Club Challenge");
  }
  return available;
}

function buildManagerTrophySeasonFlags(
  career: ManagerCareer
): Pick<
  AchievementCheckContext,
  | "managerTrebleWinner"
  | "managerQuadrupleWinner"
  | "managerCleanSweep"
  | "managerWorldClubChallengeWinner"
  | "managerPerfectTrophySeason"
> {
  const trophies = getMajorTrophiesWon(getManagerSeasonTrophyLabels(career));
  const available = getAvailableMajorTrophies(career);
  const majorCount = trophies.length;
  const cleanSweep =
    available.length > 0 && available.every((label) => trophies.includes(label));
  const unbeaten = career.losses === 0 && career.wins > 0;
  const worldClubChallengeWinner = trophies.includes("World Club Challenge");

  return {
    managerTrebleWinner: majorCount >= 3,
    managerQuadrupleWinner: majorCount >= 4,
    managerCleanSweep: cleanSweep,
    managerWorldClubChallengeWinner: worldClubChallengeWinner,
    managerPerfectTrophySeason: unbeaten && cleanSweep,
  };
}
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
    draws?: number;
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
    dailyChallengeMode?: boolean;
    madePlayoffs?: boolean;
    playoffWins?: number;
    playoffLosses?: number;
    leagueChampion?: boolean;
  } = {}
): void {
  // Daily Challenge has its own streak achievements — do not credit Normal Mode.
  if (options.dailyChallengeMode) {
    return;
  }

  // Super Sam Hallas: joke undefeated run — only the play-mode EE unlocks.
  // Do not credit Normal Mode win / perfect-season / grade achievements.
  if (options.superSamHallasMode) {
    triggerAchievementCheck({
      trigger: "quick-season-completed",
      superSamComplete: true,
      againstTheOddsComplete: true,
    });
    return;
  }

  // Joe Mellor GOAT Mode: distinct EEs only (no Normal Mode win credits).
  // goat-status = play the mode; mellor-miracle = winning season; Developer's Favourite = Bradford bias.
  if (options.joeMellorMode) {
    const bradfordCount = countBradfordPlayers(squad);
    triggerAchievementCheck({
      trigger: "quick-season-completed",
      joeMellorComplete: true,
      goatMellorWin: season.wins > season.losses,
      bradfordChallengeComplete:
        bradfordCount >= 5 && season.wins > season.losses,
    });
    return;
  }

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
    quickModeLeagueSeason: true,
    seasonWins: season.wins,
    seasonLosses: season.losses,
    seasonDraws: season.draws ?? 0,
    regularSeasonWins: season.wins,
    regularSeasonLosses: season.losses,
    playoffWins: options.playoffWins,
    playoffLosses: options.playoffLosses,
    leagueChampion: options.leagueChampion === true,
    isPerfectSeason: season.isPerfect,
    isUnbeatenSeason: season.losses === 0 && season.wins > 0,
    madePlayoffs: options.madePlayoffs ?? season.leaguePosition <= 6,
    lowRatedSquad: season.squadStrength < 72,
    squadGrade: gradeInfo.grade,
    bradfordPlayerCount: bradfordCount,
    winningRecord: season.wins > season.losses,
    eraCup: options.normalEraMode === true,
  });
}

export function triggerDailyChallengeAchievements(
  currentStreak: number,
  bestStreak: number
): void {
  triggerAchievementCheck({
    trigger: "daily-challenge-completed",
    dailyChallengeCompleted: true,
    dailyCurrentStreak: currentStreak,
    dailyBestStreak: bestStreak,
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
    // Do not set matchWon — that flag is for Quick/Normal Mode (First Win, etc.).
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
  const trophyFlags = buildManagerTrophySeasonFlags(career);

  triggerAchievementCheck({
    trigger: "manager-season-completed",
    managerSeasonComplete: true,
    managerFinishPosition: position,
    managerLeagueSize: getUserLeagueClubs(career).length,
    managerLeagueWinner: leagueWinner,
    managerGrandFinalWinner: grandFinalWinner,
    managerDoubleWinner: doubleWinner,
    cupWon: cupWinner,
    cupFinalReached:
      cupOutcome.isWinner || cupOutcome.finish === "Runners-Up",
    boardConfidence: career.boardConfidence,
    ...trophyFlags,
  });
}

export function triggerManagerWorldClubChallengeAchievements(
  career: ManagerCareer
): void {
  const trophyFlags = buildManagerTrophySeasonFlags(career);
  if (!trophyFlags.managerWorldClubChallengeWinner) return;

  triggerAchievementCheck({
    trigger: "manager-world-club-challenge-won",
    managerWorldClubChallengeWinner: true,
    ...trophyFlags,
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
