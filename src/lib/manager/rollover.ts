/**
 * Atomic Season Rollover Engine.
 *
 * CRITICAL CONTRACT:
 * - Executes the entire season transition in a single atomic pass.
 * - Promotion & Relegation between Super League and Championship.
 * - Contract expiries & retirements.
 * - Player ageing & development/decline curves.
 * - Youth intake generation for all academies.
 * - Fresh season fixtures and financial budgets.
 */

import { generateFixturesForCompetition, sortStandings } from "./competitions";
import { createGeneratedPlayer, toClubId, ensureClubSquadDepth } from "./database";
import { generateRandomPlayerName, registerOccupiedPlayerNames } from "./names";
import { cleanAllClubLineups } from "./squad";
import { forceRetainAiExpiringContracts } from "./ai";
import {
  STARTING_POSITIONS,
  SALARY_CAP,
  CHAMPIONSHIP_ECONOMY,
  getChampionshipCarryoverSoftCap,
} from "./rules";
import type {
  BoardObjective,
  CompetitionId,
  ManagerClub,
  ManagerFixture,
  ManagerPlayer,
  ManagerState,
  SeasonHistoryRecord,
  SeasonTableSnapshotRow,
  UserClubSeasonSummary,
} from "./types";

/** True Challenge Cup Final only — not Quarter Final / Semi-Final. */
export function isChallengeCupFinalRound(roundName: string | undefined): boolean {
  if (!roundName) return false;
  return /challenge\s*cup\s*final/i.test(roundName) && !/semi|quarter/i.test(roundName);
}

export function findChallengeCupFinal(
  fixtures: ManagerFixture[] | undefined,
  season: number
): ManagerFixture | undefined {
  if (!fixtures) return undefined;
  return fixtures.find(
    (f) =>
      f.isPlayed &&
      (!f.season || f.season === season) &&
      isChallengeCupFinalRound(f.roundName)
  );
}

function knockoutWinnerId(fixture: ManagerFixture): string {
  const home = fixture.homeScore || 0;
  const away = fixture.awayScore || 0;
  if (home === away) return fixture.homeClubId; // golden point should prevent; home fallback
  return home > away ? fixture.homeClubId : fixture.awayClubId;
}

export interface SeasonAwards {
  superLeagueChampion: string;
  championshipChampion: string;
  leagueLeadersShield?: string;
  challengeCupWinner?: string;
  promotedClubIds: string[];
  relegatedClubIds: string[];
  promotedClubs: string[];
  relegatedClubs: string[];
  relegatedClub: string;
  promotedClub: string;
  autoPromotedClub: string;
  autoRelegatedClub: string;
  millionPoundGame?: {
    superLeagueTeam: string;
    championshipTeam: string;
    superLeagueScore?: number;
    championshipScore?: number;
    winner: string;
    score: string;
    superLeagueSurvived: boolean;
  } | null;
  topTryScorer: { name: string; clubName: string; tries: number } | null;
  championshipTopTryScorer?: { name: string; clubName: string; tries: number } | null;
  manOfSteel: { name: string; clubName: string; motm: number } | null;
  championshipPlayerOfYear?: { name: string; clubName: string; motm: number } | null;
}

export function calculateSeasonAwards(state: ManagerState): SeasonAwards {
  const currentSeason = state.calendar.currentSeason;
  const slStandings = sortStandings(state.competitions["super-league"].standings);
  const champStandings = sortStandings(state.competitions["championship"].standings);

  // Super League Grand Final Winner (or regular season 1st fallback)
  const slGfFixture = state.competitions["super-league"]?.fixtures.find(
    (f) =>
      /grand\s*final/i.test(f.roundName || "") &&
      f.isPlayed &&
      (!f.season || f.season === currentSeason)
  );
  let slChampId = slStandings[0]?.clubId || "wigan-warriors";
  if (slGfFixture) {
    slChampId = knockoutWinnerId(slGfFixture);
  }

  // League Leaders' Shield (1st in regular season Super League)
  const llsClubId = slStandings[0]?.clubId;
  const llsClubName = llsClubId ? state.clubs[llsClubId]?.name || llsClubId : undefined;

  // Challenge Cup Winner (true Final only — never Quarter/Semi)
  const ccFinal = findChallengeCupFinal(
    state.competitions["challenge-cup"]?.fixtures,
    currentSeason
  );
  let ccWinnerName: string | undefined;
  if (ccFinal) {
    const ccWinnerId = knockoutWinnerId(ccFinal);
    ccWinnerName = state.clubs[ccWinnerId]?.name || ccWinnerId;
  }

  // Championship Champion is 1st in regular season
  const champWinnerId = champStandings[0]?.clubId || "salford-rlfc";

  // Automatic promotion & relegation:
  // - 1st in Championship is automatically promoted
  // - Bottom (14th) in Super League is automatically relegated
  const autoPromotedId = champStandings[0]?.clubId || "salford-rlfc";
  const autoRelegatedId = slStandings[slStandings.length - 1]?.clubId || "toulouse-olympique";

  const autoPromotedClub = state.clubs[autoPromotedId]?.name || autoPromotedId;
  const autoRelegatedClub = state.clubs[autoRelegatedId]?.name || autoRelegatedId;

  const promotedClubIds: string[] = [autoPromotedId];
  const relegatedClubIds: string[] = [autoRelegatedId];

  // The Million Pound Game: 13th SL vs Championship Playoff Winner
  // Prioritize fixture matching the user's club if the user participated, then super-league, then championship
  const userClubId = state.manager.clubId;
  const userMpgFixture =
    state.competitions["championship"]?.fixtures.find(
      (f) =>
        f.roundName === "The Million Pound Game" &&
        f.isPlayed &&
        (!f.season || f.season === currentSeason) &&
        (f.homeClubId === userClubId || f.awayClubId === userClubId)
    ) ||
    state.competitions["super-league"]?.fixtures.find(
      (f) =>
        f.roundName === "The Million Pound Game" &&
        f.isPlayed &&
        (!f.season || f.season === currentSeason) &&
        (f.homeClubId === userClubId || f.awayClubId === userClubId)
    );

  const mpgFixture =
    userMpgFixture ||
    state.competitions["super-league"]?.fixtures.find(
      (f) =>
        f.roundName === "The Million Pound Game" &&
        f.isPlayed &&
        (!f.season || f.season === currentSeason)
    ) ||
    state.competitions["championship"]?.fixtures.find(
      (f) =>
        f.roundName === "The Million Pound Game" &&
        f.isPlayed &&
        (!f.season || f.season === currentSeason)
    );

  let millionPoundGameInfo: SeasonAwards["millionPoundGame"] = null;

  if (mpgFixture) {
    const homeInSL =
      slStandings.some((s) => s.clubId === mpgFixture.homeClubId) ||
      state.clubs[mpgFixture.homeClubId]?.competitionId === "super-league";
    const awayInSL =
      slStandings.some((s) => s.clubId === mpgFixture.awayClubId) ||
      state.clubs[mpgFixture.awayClubId]?.competitionId === "super-league";

    let slClubId: string;
    let champClubId: string;
    let slScore: number;
    let champScore: number;

    if (homeInSL && !awayInSL) {
      slClubId = mpgFixture.homeClubId;
      champClubId = mpgFixture.awayClubId;
      slScore = mpgFixture.homeScore || 0;
      champScore = mpgFixture.awayScore || 0;
    } else if (awayInSL && !homeInSL) {
      slClubId = mpgFixture.awayClubId;
      champClubId = mpgFixture.homeClubId;
      slScore = mpgFixture.awayScore || 0;
      champScore = mpgFixture.homeScore || 0;
    } else {
      slClubId = mpgFixture.homeClubId;
      champClubId = mpgFixture.awayClubId;
      slScore = mpgFixture.homeScore || 0;
      champScore = mpgFixture.awayScore || 0;
    }

    const slSurvived = slScore >= champScore;
    const slName = state.clubs[slClubId]?.name || slClubId;
    const champName = state.clubs[champClubId]?.name || champClubId;
    const winnerName = slSurvived ? slName : champName;
    const score = `${slScore} - ${champScore}`;

    millionPoundGameInfo = {
      superLeagueTeam: slName,
      championshipTeam: champName,
      superLeagueScore: slScore,
      championshipScore: champScore,
      winner: winnerName,
      score,
      superLeagueSurvived: slSurvived,
    };

    if (!slSurvived) {
      // Championship team won The Million Pound Game! Promoted!
      if (!promotedClubIds.includes(champClubId)) {
        promotedClubIds.push(champClubId);
      }
      // 13th SL club is relegated!
      if (!relegatedClubIds.includes(slClubId)) {
        relegatedClubIds.push(slClubId);
      }
    }
  }

  const promotedNames = promotedClubIds.map((id) => state.clubs[id]?.name || id);
  const relegatedNames = relegatedClubIds.map((id) => state.clubs[id]?.name || id);

  // Find top try scorers and Player of the Year awards (strictly separated by competition tier)
  let slTopScorer: { name: string; clubName: string; tries: number } | null = null;
  let slTopMotm: { name: string; clubName: string; motm: number } | null = null;
  let champTopScorer: { name: string; clubName: string; tries: number } | null = null;
  let champTopMotm: { name: string; clubName: string; motm: number } | null = null;

  for (const player of Object.values(state.players)) {
    if (!player.clubId) continue;
    const club = state.clubs[player.clubId];
    if (!club) continue;
    const clubName = club.name || "Unknown";
    const isSL = club.competitionId === "super-league";

    if (isSL) {
      if (!slTopScorer || player.stats.tries > slTopScorer.tries || (player.stats.tries === slTopScorer.tries && (player.stats.avgRating || 0) > ((slTopScorer as any).avgRating || 0))) {
        if (player.stats.tries > 0) {
          slTopScorer = { name: player.name, clubName, tries: player.stats.tries };
        }
      }
      if (!slTopMotm || player.stats.motm > slTopMotm.motm || (player.stats.motm === slTopMotm.motm && (player.stats.avgRating || 0) > ((slTopMotm as any).avgRating || 0))) {
        if (player.stats.motm > 0) {
          slTopMotm = { name: player.name, clubName, motm: player.stats.motm };
        }
      }
    } else {
      if (!champTopScorer || player.stats.tries > champTopScorer.tries || (player.stats.tries === champTopScorer.tries && (player.stats.avgRating || 0) > ((champTopScorer as any).avgRating || 0))) {
        if (player.stats.tries > 0) {
          champTopScorer = { name: player.name, clubName, tries: player.stats.tries };
        }
      }
      if (!champTopMotm || player.stats.motm > champTopMotm.motm || (player.stats.motm === champTopMotm.motm && (player.stats.avgRating || 0) > ((champTopMotm as any).avgRating || 0))) {
        if (player.stats.motm > 0) {
          champTopMotm = { name: player.name, clubName, motm: player.stats.motm };
        }
      }
    }
  }

  return {
    superLeagueChampion: state.clubs[slChampId]?.name || slChampId,
    championshipChampion: state.clubs[champWinnerId]?.name || champWinnerId,
    leagueLeadersShield: llsClubName,
    challengeCupWinner: ccWinnerName,
    promotedClubIds,
    relegatedClubIds,
    promotedClubs: promotedNames,
    relegatedClubs: relegatedNames,
    promotedClub: promotedNames.join(", "),
    relegatedClub: relegatedNames.join(", "),
    autoPromotedClub,
    autoRelegatedClub,
    millionPoundGame: millionPoundGameInfo,
    topTryScorer: slTopScorer,
    championshipTopTryScorer: champTopScorer,
    manOfSteel: slTopMotm,
    championshipPlayerOfYear: champTopMotm,
  };
}

/**
 * Builds the official RFL Season Review and Roll of Honour inbox bulletin.
 * Formats clean, unambiguous sections detailing Champions, Promotion & Relegation,
 * The Million Pound Game result, and Individual Honours.
 */
export function buildRflSeasonReviewEmail(
  season: number,
  awards: SeasonAwards
): { subject: string; body: string } {
  const subject = `${season} Season Review & Roll of Honour`;
  const lines: string[] = [
    `The ${season} Rugby Football League season has officially concluded. Here is the official season review, honours, and promotion / relegation bulletin from the RFL:`,
    "",
    "🏆 SILVERWARE & CHAMPIONS",
    `• Betfred Super League Champions: ${awards.superLeagueChampion}`,
    `• Betfred Championship Champions: ${awards.championshipChampion}`,
  ];

  if (awards.leagueLeadersShield) {
    lines.push(`• League Leaders' Shield: ${awards.leagueLeadersShield}`);
  }
  if (awards.challengeCupWinner) {
    lines.push(`• Betfred Challenge Cup Winners: ${awards.challengeCupWinner}`);
  }

  lines.push("");
  lines.push("⬆️ PROMOTION & RELEGATION");
  lines.push(`• Automatic Promotion to Super League: ${awards.autoPromotedClub} (Championship Champions)`);
  lines.push(`• Automatic Relegation to Championship: ${awards.autoRelegatedClub} (Super League 14th Place)`);

  if (awards.millionPoundGame) {
    const mpg = awards.millionPoundGame;
    lines.push("");
    lines.push("💰 THE MILLION POUND GAME");
    lines.push(`• Match: ${mpg.superLeagueTeam} ${mpg.score} ${mpg.championshipTeam}`);
    if (mpg.superLeagueSurvived) {
      lines.push(
        `• Outcome: 🛡️ ${mpg.superLeagueTeam} retained Super League status against ${mpg.championshipTeam}. ${mpg.championshipTeam} remain in the Championship.`
      );
    } else {
      lines.push(
        `• Outcome: ⚡ ${mpg.championshipTeam} defeated ${mpg.superLeagueTeam} to achieve promotion to Super League! ${mpg.superLeagueTeam} are relegated to the Championship.`
      );
    }
  }

  lines.push("");
  lines.push("📋 CONFIRMED FOR NEXT SEASON");
  lines.push(`• Promoted to Super League: ${awards.promotedClubs.join(", ")}`);
  lines.push(`• Relegated to Championship: ${awards.relegatedClubs.join(", ")}`);

  lines.push("");
  lines.push("⭐ INDIVIDUAL HONOURS");
  if (awards.manOfSteel) {
    lines.push(
      `• Steve Prescott Man of Steel: ${awards.manOfSteel.name} (${awards.manOfSteel.clubName}) — ${awards.manOfSteel.motm} MOTM awards`
    );
  }
  if (awards.championshipPlayerOfYear) {
    lines.push(
      `• Championship Player of the Year: ${awards.championshipPlayerOfYear.name} (${awards.championshipPlayerOfYear.clubName}) — ${awards.championshipPlayerOfYear.motm} MOTM awards`
    );
  }
  if (awards.topTryScorer) {
    lines.push(
      `• Super League Top Try Scorer: ${awards.topTryScorer.name} (${awards.topTryScorer.clubName}) — ${awards.topTryScorer.tries} tries`
    );
  }
  if (awards.championshipTopTryScorer) {
    lines.push(
      `• Championship Top Try Scorer: ${awards.championshipTopTryScorer.name} (${awards.championshipTopTryScorer.clubName}) — ${awards.championshipTopTryScorer.tries} tries`
    );
  }

  return { subject, body: lines.join("\n") };
}

/**
 * Reconstructs a formatted RFL Season Review email from an archived SeasonHistoryRecord.
 */
export function formatRflSeasonReviewFromBodyRecord(record: SeasonHistoryRecord): string {
  const autoPromoted =
    record.autoPromotedClub ||
    record.championshipChampion ||
    record.promotedClubs[0] ||
    "Championship Champions";
  const autoRelegated =
    record.autoRelegatedClub ||
    record.tables?.superLeague?.[record.tables.superLeague.length - 1]?.clubName ||
    record.relegatedClubs[0] ||
    "Super League 14th";

  const lines: string[] = [
    `The ${record.season} Rugby Football League season has officially concluded. Here is the official season review, honours, and promotion / relegation bulletin from the RFL:`,
    "",
    "🏆 SILVERWARE & CHAMPIONS",
    `• Betfred Super League Champions: ${record.superLeagueChampion}`,
    `• Betfred Championship Champions: ${record.championshipChampion}`,
  ];

  if (record.leagueLeadersShieldWinner) {
    lines.push(`• League Leaders' Shield: ${record.leagueLeadersShieldWinner}`);
  }
  if (record.challengeCupWinner) {
    lines.push(`• Betfred Challenge Cup Winners: ${record.challengeCupWinner}`);
  }

  lines.push("");
  lines.push("⬆️ PROMOTION & RELEGATION");
  lines.push(
    `• Automatic Promotion to Super League: ${autoPromoted} (Championship Champions)`
  );
  lines.push(
    `• Automatic Relegation to Championship: ${autoRelegated} (Super League 14th Place)`
  );

  if (record.millionPoundGame) {
    const mpg = record.millionPoundGame;
    lines.push("");
    lines.push("💰 THE MILLION POUND GAME");
    lines.push(`• Match: ${mpg.superLeagueTeam} ${mpg.score} ${mpg.championshipTeam}`);
    if (mpg.superLeagueSurvived) {
      lines.push(
        `• Outcome: 🛡️ ${mpg.superLeagueTeam} retained Super League status against ${mpg.championshipTeam}. ${mpg.championshipTeam} remain in the Championship.`
      );
    } else {
      lines.push(
        `• Outcome: ⚡ ${mpg.championshipTeam} defeated ${mpg.superLeagueTeam} to achieve promotion to Super League! ${mpg.superLeagueTeam} are relegated to the Championship.`
      );
    }
  }

  lines.push("");
  lines.push("📋 CONFIRMED FOR NEXT SEASON");
  lines.push(`• Promoted to Super League: ${record.promotedClubs.join(", ")}`);
  lines.push(`• Relegated to Championship: ${record.relegatedClubs.join(", ")}`);

  lines.push("");
  lines.push("⭐ INDIVIDUAL HONOURS");
  if (record.manOfSteel) {
    lines.push(
      `• Steve Prescott Man of Steel: ${record.manOfSteel.name} (${record.manOfSteel.clubName}) — ${record.manOfSteel.motm} MOTM awards`
    );
  }
  if (record.championshipPlayerOfYear) {
    lines.push(
      `• Championship Player of the Year: ${record.championshipPlayerOfYear.name} (${record.championshipPlayerOfYear.clubName}) — ${record.championshipPlayerOfYear.motm} MOTM awards`
    );
  }
  if (record.topTryScorer) {
    lines.push(
      `• Super League Top Try Scorer: ${record.topTryScorer.name} (${record.topTryScorer.clubName}) — ${record.topTryScorer.tries} tries`
    );
  }
  if (record.championshipTopTryScorer) {
    lines.push(
      `• Championship Top Try Scorer: ${record.championshipTopTryScorer.name} (${record.championshipTopTryScorer.clubName}) — ${record.championshipTopTryScorer.tries} tries`
    );
  }

  return lines.join("\n");
}

/**
 * Creates a permanent historical snapshot of the concluding season,
 * archiving standings tables, cup winners, individual honours, and user club achievements.
 */
export function createSeasonHistoryRecord(
  state: ManagerState,
  awards: SeasonAwards
): { record: SeasonHistoryRecord; newTrophiesForManager: { season: number; trophy: string; clubId: string }[] } {
  const season = state.calendar.currentSeason;
  const userClubId = state.manager.clubId;
  const userClub = state.clubs[userClubId];

  // Super League Details
  const slStandings = sortStandings(state.competitions["super-league"].standings);
  const champStandings = sortStandings(state.competitions["championship"].standings);

  const slGfFixture = state.competitions["super-league"].fixtures.find(
    (f) =>
      /grand\s*final/i.test(f.roundName || "") &&
      f.isPlayed &&
      (!f.season || f.season === season)
  );
  let slChampId = slStandings[0]?.clubId || "wigan-warriors";
  let slRunnerUpId: string | undefined;
  let slScore: string | undefined;
  if (slGfFixture) {
    slChampId = knockoutWinnerId(slGfFixture);
    slRunnerUpId =
      slChampId === slGfFixture.homeClubId
        ? slGfFixture.awayClubId
        : slGfFixture.homeClubId;
    slScore = `${slGfFixture.homeScore} - ${slGfFixture.awayScore}`;
  }

  // League Leaders Shield
  const llsClubId = slStandings[0]?.clubId;
  const llsClubName = llsClubId ? state.clubs[llsClubId]?.name || llsClubId : undefined;

  // Championship Details
  const champWinnerId = champStandings[0]?.clubId || "salford-rlfc";
  const champFinalFixture = state.competitions["championship"].fixtures.find(
    (f) =>
      f.roundName.includes("Playoff Final") &&
      f.isPlayed &&
      (!f.season || f.season === season)
  );
  let champPlayoffWinnerName: string | undefined;
  if (champFinalFixture) {
    const wid = knockoutWinnerId(champFinalFixture);
    champPlayoffWinnerName = state.clubs[wid]?.name || wid;
  }

  // Challenge Cup — true Final only
  const ccFinal = findChallengeCupFinal(
    state.competitions["challenge-cup"]?.fixtures,
    season
  );
  let ccWinnerName: string | undefined;
  let ccRunnerUpName: string | undefined;
  let ccScore: string | undefined;
  let ccWinnerClubId: string | undefined;
  if (ccFinal) {
    ccWinnerClubId = knockoutWinnerId(ccFinal);
    const runnerId =
      ccWinnerClubId === ccFinal.homeClubId ? ccFinal.awayClubId : ccFinal.homeClubId;
    ccWinnerName = state.clubs[ccWinnerClubId]?.name || ccWinnerClubId;
    ccRunnerUpName = state.clubs[runnerId]?.name || runnerId;
    ccScore = `${ccFinal.homeScore} - ${ccFinal.awayScore}`;
  }

  // Top Points Scorer
  let topPointsScorer: { name: string; clubName: string; points: number } | null = null;
  for (const player of Object.values(state.players)) {
    if (!player.clubId) continue;
    const club = state.clubs[player.clubId];
    const clubName = club?.name || "Unknown";
    if (!topPointsScorer || player.stats.points > topPointsScorer.points) {
      if (player.stats.points > 0) {
        topPointsScorer = { name: player.name, clubName, points: player.stats.points };
      }
    }
  }

  // Snapshot Tables
  const mapTable = (rows: typeof slStandings): SeasonTableSnapshotRow[] =>
    rows.map((row, idx) => ({
      position: idx + 1,
      clubId: row.clubId,
      clubName: state.clubs[row.clubId]?.name || row.clubId,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointsDifference: row.pointsDifference,
      points: row.points,
    }));

  const slTableSnapshot = mapTable(slStandings);
  const champTableSnapshot = mapTable(champStandings);

  // User Club evaluation
  const isUserSL = userClub?.competitionId === "super-league";
  const userTable = isUserSL ? slTableSnapshot : champTableSnapshot;
  const userRowIndex = userTable.findIndex((r) => r.clubId === userClubId);
  const finishPosition = userRowIndex >= 0 ? userRowIndex + 1 : 1;
  const userRow = userTable[userRowIndex] || {
    position: finishPosition,
    clubId: userClubId,
    clubName: userClub?.name || "My Club",
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDifference: 0,
    points: 0,
  };

  // Check user trophies won
  const userTrophiesThisSeason: string[] = [];
  const newTrophiesForManager: { season: number; trophy: string; clubId: string }[] = [];

  const addTrophy = (name: string) => {
    userTrophiesThisSeason.push(name);
    newTrophiesForManager.push({ season, trophy: name, clubId: userClubId });
  };

  if (slChampId === userClubId) {
    addTrophy("Super League Grand Final Trophy");
  }
  if (llsClubId === userClubId && isUserSL) {
    addTrophy("League Leaders' Shield");
  }
  if (champWinnerId === userClubId && !isUserSL) {
    addTrophy("Betfred Championship Title");
  }
  if (ccWinnerClubId === userClubId) {
    addTrophy("Betfred Challenge Cup");
  }
  if (
    awards.millionPoundGame &&
    !awards.millionPoundGame.superLeagueSurvived &&
    awards.promotedClubIds.includes(userClubId) &&
    awards.promotedClubIds.indexOf(userClubId) > 0
  ) {
    addTrophy("The Million Pound Game Promotion Trophy");
  }

  // User club top players
  const userPlayers = Object.values(state.players).filter((p) => p.clubId === userClubId);
  let clubTopScorer: { name: string; tries: number; points: number } | null = null;
  let clubBestPlayer: { name: string; rating: number; apps: number; avgMatchRating: number } | null = null;

  for (const p of userPlayers) {
    if (!clubTopScorer || p.stats.points > clubTopScorer.points) {
      if (p.stats.points > 0 || p.stats.tries > 0) {
        clubTopScorer = { name: p.name, tries: p.stats.tries, points: p.stats.points };
      }
    }
    if (!clubBestPlayer || p.rating > clubBestPlayer.rating) {
      clubBestPlayer = {
        name: p.name,
        rating: p.rating,
        apps: p.stats.apps,
        avgMatchRating: p.stats.avgRating || 7.0,
      };
    }
  }

  const userClubSummary: UserClubSeasonSummary = {
    clubId: userClubId,
    clubName: userClub?.name || "My Club",
    competitionId: isUserSL ? "super-league" : "championship",
    competitionName: isUserSL ? "Betfred Super League" : "Betfred Championship",
    finishPosition,
    totalClubs: userTable.length,
    played: userRow.played,
    won: userRow.won,
    drawn: userRow.drawn,
    lost: userRow.lost,
    points: userRow.points,
    pointsFor: userRow.pointsFor,
    pointsAgainst: userRow.pointsAgainst,
    pointsDifference: userRow.pointsDifference,
    boardConfidence: userClub?.boardConfidence || 75,
    trophiesWon: userTrophiesThisSeason,
    topScorer: clubTopScorer,
    bestPlayer: clubBestPlayer,
  };

  const record: SeasonHistoryRecord = {
    season,
    superLeagueChampion: state.clubs[slChampId]?.name || slChampId,
    superLeagueChampionId: slChampId,
    superLeagueRunnerUp: slRunnerUpId ? state.clubs[slRunnerUpId]?.name || slRunnerUpId : undefined,
    superLeagueGrandFinalScore: slScore,
    leagueLeadersShieldWinner: llsClubName,
    championshipChampion: state.clubs[champWinnerId]?.name || champWinnerId,
    championshipChampionId: champWinnerId,
    championshipPlayoffWinner: champPlayoffWinnerName,
    challengeCupWinner: ccWinnerName,
    challengeCupRunnerUp: ccRunnerUpName,
    challengeCupFinalScore: ccScore,
    autoPromotedClub: awards.autoPromotedClub,
    autoRelegatedClub: awards.autoRelegatedClub,
    millionPoundGame: awards.millionPoundGame,
    promotedClubs: awards.promotedClubs,
    relegatedClubs: awards.relegatedClubs,
    manOfSteel: awards.manOfSteel,
    championshipPlayerOfYear: awards.championshipPlayerOfYear,
    topTryScorer: awards.topTryScorer,
    championshipTopTryScorer: awards.championshipTopTryScorer,
    topPointsScorer,
    tables: {
      superLeague: slTableSnapshot,
      championship: champTableSnapshot,
    },
    userClub: userClubSummary,
  };

  return { record, newTrophiesForManager };
}

/**
 * Authoritative atomic rollover function.
 */
export function rolloverSeason(state: ManagerState): {
  state: ManagerState;
  awards: SeasonAwards;
} {
  const oldSeason = state.calendar.currentSeason;
  const newSeason = oldSeason + 1;

  const slStandings = sortStandings(state.competitions["super-league"].standings);
  const champStandings = sortStandings(state.competitions["championship"].standings);

  const awards = calculateSeasonAwards(state);
  const { promotedClubIds, relegatedClubIds } = awards;

  // 1. Update Clubs: Promotion, Relegation, Reputation adjustments, and Financial reset
  const updatedClubs: Record<string, ManagerClub> = {};

  for (const [clubId, club] of Object.entries(state.clubs)) {
    let competitionId: CompetitionId = club.competitionId;
    let reputation = club.reputation;

    if (promotedClubIds.includes(clubId)) {
      competitionId = "super-league";
      reputation = Math.min(5, reputation + 1);
    } else if (relegatedClubIds.includes(clubId)) {
      competitionId = "championship";
      reputation = Math.max(1, reputation - 1);
    }

    const isSL = competitionId === "super-league";
    let prizeMoney = 25_000;
    if (clubId === slStandings[0]?.clubId) {
      prizeMoney = 150_000;
    } else if (promotedClubIds.includes(clubId)) {
      prizeMoney = 80_000;
    } else if (!isSL) {
      prizeMoney = CHAMPIONSHIP_ECONOMY.DEFAULT_SEASON_PRIZE;
    }

    // Championship (and relegated) clubs cannot bank unlimited SL-scale war chests
    let retainedBalance = club.finances.balance;
    let levy = 0;
    if (!isSL) {
      const softCap = getChampionshipCarryoverSoftCap(reputation);
      if (retainedBalance > softCap) {
        levy = retainedBalance - softCap;
        retainedBalance = softCap;
      }
    }
    const newBalance = retainedBalance + prizeMoney;
    const weeklyWageBudget = isSL ? SALARY_CAP["super-league"].weeklyCap : SALARY_CAP["championship"].weeklyCap;

    const freshObjectives: BoardObjective[] = [
      {
        id: `${clubId}_league_target_${newSeason}`,
        title: isSL
          ? (reputation >= 4 ? "Compete for the Grand Final" : (reputation >= 3 ? "Reach the Top 6 Playoffs" : "Avoid Relegation"))
          : (reputation === 3 ? "Gain Promotion to Super League" : (reputation === 2 ? "Reach Championship Playoffs" : "Consolidate Championship Status")),
        description: `Achieve the board's seasonal expectation in ${isSL ? "Super League" : "the Championship"}.`,
        category: "league",
        targetValue: isSL ? (reputation >= 4 ? 4 : (reputation >= 3 ? 6 : 13)) : (reputation === 3 ? 1 : (reputation === 2 ? 6 : 10)),
        currentValue: 1,
        isCompleted: false,
        isFailed: false,
        importance: "high",
      },
      {
        id: `${clubId}_cup_target_${newSeason}`,
        title: "Challenge Cup Campaign",
        description: isSL ? "Reach at least the Quarter Finals" : "Reach at least Round 5",
        category: "cup",
        targetValue: isSL ? "Quarter Finals" : "Round 5",
        currentValue: "Round 1",
        isCompleted: false,
        isFailed: false,
        importance: "medium",
      },
      {
        id: `${clubId}_youth_target_${newSeason}`,
        title: "Youth Development",
        description: "Give at least 5 first-team appearances to Academy graduates.",
        category: "youth",
        targetValue: 5,
        currentValue: 0,
        isCompleted: false,
        isFailed: false,
        importance: "medium",
      },
    ];

    updatedClubs[clubId] = {
      ...club,
      competitionId,
      reputation,
      finances: {
        balance: newBalance,
        wageBudgetWeekly: weeklyWageBudget,
        transferBudget: Math.round(newBalance * (isSL ? 0.7 : 0.4)),
        seasonRevenue: 0,
        seasonExpenses: 0,
        history: [
          ...(levy > 0
            ? [
                {
                  id: `levy_${clubId}_${newSeason}`,
                  season: newSeason,
                  week: 1,
                  amount: -levy,
                  category: "misc" as const,
                  description: `Championship financial fair play levy (£${levy.toLocaleString()})`,
                },
              ]
            : []),
          {
            id: `prize_${clubId}_${newSeason}`,
            season: newSeason,
            week: 1,
            amount: prizeMoney,
            category: "prize_money",
            description: `End-of-season merit prize award (£${prizeMoney.toLocaleString()})`,
          },
          ...club.finances.history.slice(0, 30),
        ],
      },
      boardConfidence: 75,
      boardObjectives: freshObjectives,
    };
  }

  // 2. Player Updates: Ageing, Expired Contracts, Retirements, and Reset Season Stats
  // AI clubs get a final flat-renewal pass so quality talent is not dumped to free agency
  // solely because a wage bump would not fit under the cap.
  const playersForRollover = forceRetainAiExpiringContracts(state, oldSeason).players;
  const updatedPlayers: Record<string, ManagerPlayer> = {};

  for (const [pid, player] of Object.entries(playersForRollover)) {
    if (player.isRetired) {
      updatedPlayers[pid] = player;
      continue;
    }

    const nextAge = player.age + 1;
    let rating = player.rating;
    let potential = player.potential;
    let isRetired = false;
    let clubId = player.clubId;
    let squadTier = player.squadTier;
    let contract = player.contract;

    // Check Retirement (players 33+ with low ratings or high age)
    if (nextAge >= 35 || (nextAge >= 33 && rating < 68)) {
      if (Math.random() < 0.6) {
        isRetired = true;
        clubId = null;
        squadTier = null;
        contract = null;
      }
    }

    if (!isRetired) {
      // Contract Expiry: if expired in oldSeason and not renewed -> become Free Agent
      if (contract && contract.expiresSeason <= oldSeason) {
        clubId = null;
        squadTier = null;
        contract = null;
      }

      // Ageing curve
      if (nextAge >= 33) {
        rating = Math.max(50, rating - (Math.random() < 0.7 ? 1 : 2));
      } else if (nextAge <= 23 && rating < potential) {
        if (Math.random() < 0.5) {
          rating = Math.min(potential, rating + 1);
        }
      }
    }

    updatedPlayers[pid] = {
      ...player,
      age: nextAge,
      rating,
      potential,
      isRetired,
      clubId,
      squadTier,
      contract,
      loan: null, // loans reset on season boundary
      injury: null, // clean slate for pre-season
      suspension: null,
      fatigue: 0,
      fitness: 100,
      form: 7.0,
      morale: 80,
      stats: {
        apps: 0,
        tries: 0,
        goals: 0,
        dropGoals: 0,
        points: 0,
        motm: 0,
        avgRating: 7.0,
        matchRatings: [],
      },
    };
  }

  // 3. Youth Intake Generation: Generate prospects for every club's academy, enhanced by Youth Facility tier
  registerOccupiedPlayerNames(Object.values(updatedPlayers).map((p) => p.name));
  for (const [clubId, club] of Object.entries(updatedClubs)) {
    const isSL = club.competitionId === "super-league";
    const youthLevel = club.facilities?.youth || 3;
    const extraProspectChance = youthLevel >= 5 ? 0.8 : youthLevel >= 4 ? 0.4 : 0;
    const intakeCount = (Math.floor(Math.random() * 2) + 3) + (Math.random() < extraProspectChance ? 1 : 0);

    for (let i = 0; i < intakeCount; i++) {
      const pos = STARTING_POSITIONS[Math.floor(Math.random() * STARTING_POSITIONS.length)];
      const age = i < 2 ? 17 : (Math.random() < 0.6 ? 17 : 18);
      const youthBonus = Math.max(-2, (youthLevel - 3) * 2);
      const baseRating = Math.max(
        48,
        (isSL ? (58 + Math.floor(Math.random() * 8)) : (52 + Math.floor(Math.random() * 8))) + youthBonus
      );

      // Higher youth facilities unearth exceptional wonderkids
      const potentialBonus = Math.max(-3, (youthLevel - 3) * 3);
      const isGenerational = youthLevel >= 4 && Math.random() < (youthLevel >= 5 ? 0.25 : 0.12);
      const pot = isGenerational
        ? Math.min(97, Math.max(88, baseRating + 24 + Math.floor(Math.random() * 8)))
        : Math.min(95, baseRating + Math.floor(Math.random() * 18) + 10 + potentialBonus);

      const { fullName, nationality } = generateRandomPlayerName(clubId);
      const youth = createGeneratedPlayer(
        fullName,
        pos,
        age,
        baseRating,
        pot,
        clubId,
        "academy",
        club.competitionId,
        nationality
      );

      updatedPlayers[youth.id] = youth;
    }
  }

  // 4. Generate New Season Competitions & Fixtures
  const slClubIds = Object.values(updatedClubs)
    .filter((c) => c.competitionId === "super-league")
    .map((c) => c.id);
  const champClubIds = Object.values(updatedClubs)
    .filter((c) => c.competitionId === "championship")
    .map((c) => c.id);

  if (slClubIds.length !== 14 || champClubIds.length !== 14) {
    console.warn(
      `[rolloverSeason] Unexpected division sizes after promotion/relegation: Super League=${slClubIds.length}, Championship=${champClubIds.length} (expected 14/14). Promoted=[${promotedClubIds.join(", ")}] Relegated=[${relegatedClubIds.join(", ")}]`
    );
  }

  const superLeagueComp = generateFixturesForCompetition("super-league", "Super League", 1, slClubIds, newSeason);
  const championshipComp = generateFixturesForCompetition("championship", "Championship", 2, champClubIds, newSeason);
  const challengeCupComp = generateFixturesForCompetition(
    "challenge-cup",
    "Challenge Cup",
    0,
    [...slClubIds, ...champClubIds],
    newSeason
  );
  const friendliesComp = generateFixturesForCompetition(
    "friendlies",
    "Pre-Season Friendlies",
    0,
    [state.manager.clubId],
    newSeason
  );

  // 5. Clean Lineups for all clubs
  for (const clubId of Object.keys(updatedClubs)) {
    const club = updatedClubs[clubId];
    const firstTeam = Object.values(updatedPlayers).filter(
      (p) => p.clubId === clubId && p.squadTier === "first" && !p.isRetired
    );
    const starting13 = new Array(13).fill(null);
    const bench = new Array(4).fill(null);

    STARTING_POSITIONS.forEach((pos, idx) => {
      const match = firstTeam.find((p) => p.position === pos && !starting13.includes(p.id));
      if (match) starting13[idx] = match.id;
    });

    updatedClubs[clubId] = {
      ...club,
      lineup: { starting13, bench },
    };
  }

  // 6. Archive Concluding Season Historical Record & Trophies
  const { record: historyRecord, newTrophiesForManager } = createSeasonHistoryRecord(state, awards);
  const rflReviewEmail = buildRflSeasonReviewEmail(oldSeason, awards);

  // 7. Build Next State
  const nextState: ManagerState = {
    ...state,
    manager: {
      ...state.manager,
      trophiesWon: [...(state.manager.trophiesWon || []), ...newTrophiesForManager],
    },
    calendar: {
      currentSeason: newSeason,
      currentWeek: 1,
      totalWeeks: 32,
      phase: "pre_season",
      processedWeekKeys: [],
    },
    clubs: updatedClubs,
    players: updatedPlayers,
    competitions: {
      "super-league": superLeagueComp,
      "championship": championshipComp,
      "challenge-cup": challengeCupComp,
      "friendlies": friendliesComp,
    },
    transfers: {
      listedPlayerIds: [],
      activeBids: [],
      completedTransfers: [],
      activeLoans: [],
      pendingLoanOffers: [],
    },
    seasonHistory: [...(state.seasonHistory || []), historyRecord],
    inbox: {
      messages: [
        {
          id: `inbox_season_welcome_${newSeason}`,
          season: newSeason,
          week: 1,
          dateStr: `1 Feb ${newSeason}`,
          sender: "Board of Directors",
          subject: `Season ${newSeason} Has Begun`,
          body: `Welcome to the ${newSeason} season! The squad has returned for pre-season training. Our new youth academy intake has joined the club. Please review the updated board expectations and prepare for our upcoming friendlies.`,
          category: "board",
          isRead: false,
        },
        {
          id: `inbox_awards_${newSeason}`,
          season: newSeason,
          week: 1,
          dateStr: `1 Feb ${newSeason}`,
          sender: "Rugby Football League",
          subject: rflReviewEmail.subject,
          body: rflReviewEmail.body,
          category: "general",
          isRead: false,
        },
      ],
      unreadCount: 2,
    },
  };

  const depthEnsured = ensureClubSquadDepth(nextState);
  return { state: cleanAllClubLineups(depthEnsured), awards };
}
