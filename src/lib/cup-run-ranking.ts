import {
  getCupWinPercentage,
  getUserRank,
  rankProfilesByCategory,
  type CupLeaderboardCategory,
} from "./cup-ranking";
import type { CupLeaderboardProfile } from "./storage/cup-leaderboard";
import type { CupPersonalBests, CupRunRankingResult } from "./types";

const RECORD_CATEGORIES: CupLeaderboardCategory[] = [
  "cupRecord",
  "cupsWon",
  "cupMatchWins",
  "winPercentage",
  "finals",
  "semiFinals",
  "quarterFinals",
  "longestCupMatchWinStreak",
  "longestTournamentWinsInRow",
];

const CATEGORY_LABELS: Record<CupLeaderboardCategory, string> = {
  cupRecord: "Total Record",
  cupsWon: "Most Challenge Cups Won",
  cupMatchWins: "Most Challenge Cup Match Wins",
  winPercentage: "Best Cup Win Percentage",
  finals: "Most Finals Reached",
  semiFinals: "Most Semi Finals Reached",
  quarterFinals: "Most Quarter Finals Reached",
  longestCupMatchWinStreak: "Most Consecutive Cup Match Wins",
  longestTournamentWinsInRow: "Most Tournament Wins In A Row",
};

export function buildCupPersonalBests(
  cupWins: number,
  cupLosses: number,
  cupsWon: number,
  bestCupFinish: string | null,
  longestCupMatchWinStreak: number,
  bestCupMatchWinsInTournament: number
): CupPersonalBests {
  return {
    mostCupMatchWins: bestCupMatchWinsInTournament,
    bestTournamentFinish: bestCupFinish,
    longestCupWinningStreak: longestCupMatchWinStreak,
    mostCupsWon: cupsWon,
    bestCupWinPercentage: getCupWinPercentage(cupWins, cupLosses),
  };
}

function improvedPersonalBests(
  before: CupPersonalBests,
  after: CupPersonalBests
): string[] {
  const improved: string[] = [];

  if (after.mostCupMatchWins > before.mostCupMatchWins) {
    improved.push("Most Cup Match Wins");
  }
  if (
    finishRank(after.bestTournamentFinish) >
    finishRank(before.bestTournamentFinish)
  ) {
    improved.push("Best Tournament Finish");
  }
  if (after.longestCupWinningStreak > before.longestCupWinningStreak) {
    improved.push("Longest Cup Winning Streak");
  }
  if (after.mostCupsWon > before.mostCupsWon) {
    improved.push("Most Cups Won");
  }
  if (after.bestCupWinPercentage > before.bestCupWinPercentage) {
    improved.push("Best Cup Win Percentage");
  }

  return improved;
}

function finishRank(finish: string | null): number {
  switch (finish) {
    case "Winners":
      return 5;
    case "Runners-Up":
      return 4;
    case "Semi Final":
      return 3;
    case "Quarter Final":
      return 2;
    case "Round of 16":
      return 1;
    default:
      return 0;
  }
}

function detectNewRecords(
  username: string,
  profilesBefore: CupLeaderboardProfile[],
  profilesAfter: CupLeaderboardProfile[]
): string[] {
  const records: string[] = [];

  for (const category of RECORD_CATEGORIES) {
    const beforeSorted = rankProfilesByCategory(profilesBefore, category);
    const afterSorted = rankProfilesByCategory(profilesAfter, category);
    const beforeLeader = beforeSorted[0];
    const afterLeader = afterSorted[0];

    if (
      afterLeader?.username === username &&
      (beforeLeader?.username !== username ||
        leaderValue(beforeLeader, category) < leaderValue(afterLeader, category))
    ) {
      records.push(CATEGORY_LABELS[category]);
    }
  }

  return records;
}

function leaderValue(
  profile: CupLeaderboardProfile,
  category: CupLeaderboardCategory
): number {
  switch (category) {
    case "cupsWon":
      return profile.cupsWon;
    case "cupMatchWins":
      return profile.cupMatchWins;
    case "winPercentage":
      return getCupWinPercentage(profile.cupMatchWins, profile.cupMatchLosses);
    case "finals":
      return profile.cupFinals;
    case "semiFinals":
      return profile.cupSemiFinals;
    case "quarterFinals":
      return profile.cupQuarterFinals;
    case "longestCupMatchWinStreak":
      return profile.longestCupMatchWinStreak;
    case "longestTournamentWinsInRow":
      return profile.longestTournamentWinsInRow;
    default:
      return 0;
  }
}

export function computeCupRunRankingResult(
  username: string,
  beforeBests: CupPersonalBests,
  afterBests: CupPersonalBests,
  profilesBefore: CupLeaderboardProfile[],
  profilesAfter: CupLeaderboardProfile[]
): CupRunRankingResult {
  return {
    cupWinsRank: getUserRank(profilesAfter, username, "cupMatchWins"),
    newPersonalBests: improvedPersonalBests(beforeBests, afterBests),
    newRecords: detectNewRecords(username, profilesBefore, profilesAfter),
  };
}
