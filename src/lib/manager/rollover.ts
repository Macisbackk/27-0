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
import { createGeneratedPlayer, toClubId } from "./database";
import { cleanAllClubLineups } from "./squad";
import { STARTING_POSITIONS, SALARY_CAP } from "./rules";
import type {
  BoardObjective,
  CompetitionId,
  ManagerClub,
  ManagerPlayer,
  ManagerState,
} from "./types";

export interface SeasonAwards {
  superLeagueChampion: string;
  championshipChampion: string;
  relegatedClub: string;
  promotedClub: string;
  topTryScorer: { name: string; clubName: string; tries: number } | null;
  manOfSteel: { name: string; clubName: string; motm: number } | null;
}

export function calculateSeasonAwards(state: ManagerState): SeasonAwards {
  const slStandings = sortStandings(state.competitions["super-league"].standings);
  const champStandings = sortStandings(state.competitions["championship"].standings);

  const slChampId = slStandings[0]?.clubId || "wigan-warriors";
  const champWinnerId = champStandings[0]?.clubId || "salford-rlfc";
  const relegatedId = slStandings[slStandings.length - 1]?.clubId || "toulouse-olympique";
  const promotedId = champWinnerId;

  // Find top try scorer and Man of Steel across all players
  let topScorer: { name: string; clubName: string; tries: number } | null = null;
  let topMotm: { name: string; clubName: string; motm: number } | null = null;

  for (const player of Object.values(state.players)) {
    if (!player.clubId) continue;
    const club = state.clubs[player.clubId];
    const clubName = club?.name || "Unknown";

    if (!topScorer || player.stats.tries > topScorer.tries) {
      if (player.stats.tries > 0) {
        topScorer = { name: player.name, clubName, tries: player.stats.tries };
      }
    }
    if (!topMotm || player.stats.motm > topMotm.motm) {
      if (player.stats.motm > 0) {
        topMotm = { name: player.name, clubName, motm: player.stats.motm };
      }
    }
  }

  return {
    superLeagueChampion: state.clubs[slChampId]?.name || slChampId,
    championshipChampion: state.clubs[champWinnerId]?.name || champWinnerId,
    relegatedClub: state.clubs[relegatedId]?.name || relegatedId,
    promotedClub: state.clubs[promotedId]?.name || promotedId,
    topTryScorer: topScorer,
    manOfSteel: topMotm,
  };
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

  const relegatedClubId = slStandings[slStandings.length - 1]?.clubId || "toulouse-olympique";
  const promotedClubId = champStandings[0]?.clubId || "salford-rlfc";

  const awards = calculateSeasonAwards(state);

  // 1. Update Clubs: Promotion, Relegation, Reputation adjustments, and Financial reset
  const updatedClubs: Record<string, ManagerClub> = {};

  for (const [clubId, club] of Object.entries(state.clubs)) {
    let competitionId: CompetitionId = club.competitionId;
    let reputation = club.reputation;

    if (clubId === promotedClubId) {
      competitionId = "super-league";
      reputation = Math.min(5, reputation + 1);
    } else if (clubId === relegatedClubId) {
      competitionId = "championship";
      reputation = Math.max(1, reputation - 1);
    }

    const isSL = competitionId === "super-league";
    const prizeMoney = clubId === slStandings[0]?.clubId ? 150000 : (clubId === promotedClubId ? 80000 : 25000);
    const newBalance = club.finances.balance + prizeMoney;
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
        transferBudget: Math.round(newBalance * 0.7),
        seasonRevenue: 0,
        seasonExpenses: 0,
        history: [
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
  const updatedPlayers: Record<string, ManagerPlayer> = {};

  for (const [pid, player] of Object.entries(state.players)) {
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

  // 3. Youth Intake Generation: Generate 3-4 young prospects for every club's academy
  const FIRST_NAMES = ["Harry", "Jack", "Oliver", "George", "Charlie", "Sam", "Ben", "Will", "Dan", "Luke"];
  const LAST_NAMES = ["Smith", "Jones", "Taylor", "Wilson", "Davies", "Walker", "Hall", "Wood", "Clarke", "Farrell"];

  for (const [clubId, club] of Object.entries(updatedClubs)) {
    const isSL = club.competitionId === "super-league";
    const intakeCount = Math.floor(Math.random() * 2) + 3; // 3 to 4 prospects

    for (let i = 0; i < intakeCount; i++) {
      const pos = STARTING_POSITIONS[Math.floor(Math.random() * STARTING_POSITIONS.length)];
      const age = Math.random() < 0.7 ? 17 : 18;
      const baseRating = isSL ? (58 + Math.floor(Math.random() * 8)) : (52 + Math.floor(Math.random() * 8));
      const pot = Math.min(94, baseRating + Math.floor(Math.random() * 18) + 10); // high upside!

      const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const youth = createGeneratedPlayer(
        `${fn} ${ln}`,
        pos,
        age,
        baseRating,
        pot,
        clubId,
        "academy",
        club.competitionId
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

  // 6. Build Next State
  const nextState: ManagerState = {
    ...state,
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
    },
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
          subject: `${oldSeason} Season Review & Roll of Honour`,
          body: `Super League Champions: ${awards.superLeagueChampion}. Championship Champions: ${awards.championshipChampion}. Promoted: ${awards.promotedClub}. Relegated: ${awards.relegatedClub}.${awards.manOfSteel ? ` Man of Steel: ${awards.manOfSteel.name} (${awards.manOfSteel.clubName}).` : ""}`,
          category: "general",
          isRead: false,
        },
      ],
      unreadCount: 2,
    },
  };

  return { state: cleanAllClubLineups(nextState), awards };
}
