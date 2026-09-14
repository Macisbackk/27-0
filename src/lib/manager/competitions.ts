/**
 * Competition fixtures, standings, playoffs, and rules.
 * Pure simulation logic.
 */

import type {
  CompetitionId,
  InboxMessage,
  LeagueTableRow,
  ManagerCompetition,
  ManagerFixture,
  ManagerState,
  PlayoffMatch,
} from "./types";

/**
 * Standard round-robin pairing algorithm using polygon rotation.
 */
function generateRoundRobinPairs(clubIds: string[]): [string, string][][] {
  const n = clubIds.length;
  const isOdd = n % 2 !== 0;
  const pool = isOdd ? [...clubIds, "BYE"] : [...clubIds];
  const totalRounds = pool.length - 1;
  const half = pool.length / 2;
  const rounds: [string, string][][] = [];

  const teams = [...pool];

  for (let r = 0; r < totalRounds; r++) {
    const roundPairs: [string, string][] = [];
    for (let i = 0; i < half; i++) {
      const home = teams[i];
      const away = teams[teams.length - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        // Alternate home/away to balance hosting
        if (r % 2 === 0) {
          roundPairs.push([home, away]);
        } else {
          roundPairs.push([away, home]);
        }
      }
    }
    rounds.push(roundPairs);

    // Rotate teams keeping index 0 fixed
    const fixed = teams[0];
    const rotated = [fixed, teams[teams.length - 1], ...teams.slice(1, teams.length - 1)];
    teams.splice(0, teams.length, ...rotated);
  }

  return rounds;
}

export function generateFixturesForCompetition(
  compId: CompetitionId,
  name: string,
  tier: number,
  clubIds: string[],
  season: number,
  /** Guaranteed entry for Challenge Cup Last 16 (typically the user's club). */
  priorityClubId?: string
): ManagerCompetition {
  const standings: LeagueTableRow[] = clubIds.map((id) => ({
    clubId: id,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDifference: 0,
    bonusPoints: 0,
    points: 0,
    form: [],
  }));

  const fixtures: ManagerFixture[] = [];

  if (compId === "super-league" || compId === "championship") {
    const roundPairs = generateRoundRobinPairs(clubIds);
    // In Super League (14 clubs = 13 rounds first half, 13 rounds reverse = 26 rounds)
    // In Championship (12 clubs = 11 rounds first half, 11 rounds reverse = 22 rounds)
    // Regular season runs from Week 4 (weeks 1–3 are the three selectable friendlies)
    const startWeek = 4;
    let currentWeek = startWeek;
    let roundNum = 1;

    // First round-robin
    for (const round of roundPairs) {
      for (const [home, away] of round) {
        fixtures.push({
          id: `${compId}_${season}_w${currentWeek}_${home}_${away}`,
          competitionId: compId,
          season,
          week: currentWeek,
          roundName: `Round ${roundNum}`,
          homeClubId: home,
          awayClubId: away,
          isPlayed: false,
        });
      }
      currentWeek++;
      roundNum++;
    }

    // Reverse round-robin (swap home and away)
    for (const round of roundPairs) {
      for (const [home, away] of round) {
        fixtures.push({
          id: `${compId}_${season}_w${currentWeek}_${away}_${home}`,
          competitionId: compId,
          season,
          week: currentWeek,
          roundName: `Round ${roundNum}`,
          homeClubId: away,
          awayClubId: home,
          isPlayed: false,
        });
      }
      currentWeek++;
      roundNum++;
    }
  } else if (compId === "challenge-cup") {
    // Challenge Cup knockout rounds seeded at specific weeks
    // Last 16: Week 8
    // Quarter Finals: Week 16
    // Semi Finals: Week 24
    // Final: Week 28 (Wembley) — matches schedulePostSeasonAndCupFixtures
    // Field all clubs when ≤16; otherwise keep priorityClubId + fill randomly to 16.
    const shuffled = [...clubIds].sort(() => Math.random() - 0.5);
    let round1Clubs: string[];
    if (shuffled.length <= 16) {
      round1Clubs = shuffled;
    } else {
      const guaranteed =
        priorityClubId && clubIds.includes(priorityClubId) ? priorityClubId : null;
      const pool = shuffled.filter((id) => id !== guaranteed);
      round1Clubs = guaranteed
        ? [guaranteed, ...pool.slice(0, 15)]
        : pool.slice(0, 16);
      round1Clubs = [...round1Clubs].sort(() => Math.random() - 0.5);
    }

    // Odd entrant count → last club receives a bye (unpaired)
    for (let i = 0; i + 1 < round1Clubs.length; i += 2) {
      fixtures.push({
        id: `cc_${season}_r1_${round1Clubs[i]}_${round1Clubs[i + 1]}`,
        competitionId: "challenge-cup",
        season,
        week: 8,
        roundName: "Challenge Cup Last 16",
        homeClubId: round1Clubs[i],
        awayClubId: round1Clubs[i + 1],
        isPlayed: false,
      });
    }
  } else if (compId === "friendlies") {
    // Fixtures are created after the manager picks 3 of 6 pending opponents
    // (see pickPendingFriendlyOpponents / confirmFriendlyOpponents).
  }

  return {
    id: compId,
    name,
    tier,
    clubIds,
    standings,
    fixtures,
    phase: "regular_season",
  };
}

/** Shuffle and pick up to 6 other clubs as friendly candidates. */
export function pickPendingFriendlyOpponents(
  allClubIds: string[],
  userClubId: string,
  count = 6
): string[] {
  const pool = allClubIds.filter((id) => id && id !== userClubId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Build 3 pre-season friendlies on weeks 1–3, alternating home/away. */
export function buildFriendlyFixtures(
  userClubId: string,
  opponentIds: string[],
  season: number
): ManagerFixture[] {
  const picked = opponentIds.slice(0, 3);
  return picked.map((oppId, idx) => {
    const week = idx + 1;
    const userHome = idx % 2 === 0;
    const homeClubId = userHome ? userClubId : oppId;
    const awayClubId = userHome ? oppId : userClubId;
    return {
      id: `friendly_${season}_w${week}_${homeClubId}_${awayClubId}`,
      competitionId: "friendlies" as const,
      season,
      week,
      roundName: `Pre-Season Friendly ${week}`,
      homeClubId,
      awayClubId,
      isPlayed: false,
    };
  });
}

/**
 * Confirm 3 selected friendly opponents: write fixtures and clear pending choices.
 */
export function confirmFriendlyOpponents(
  state: ManagerState,
  selectedOpponentIds: string[]
): { success: boolean; state: ManagerState; error?: string } {
  const pending = state.pendingFriendlyOpponents || [];
  if (state.friendlyFixturesConfirmed && !pending.length) {
    return { success: false, state, error: "Friendlies already confirmed." };
  }
  if (selectedOpponentIds.length !== 3) {
    return { success: false, state, error: "Select exactly 3 opponents." };
  }
  const pendingSet = new Set(pending);
  if (selectedOpponentIds.some((id) => !pendingSet.has(id))) {
    return { success: false, state, error: "Selection must come from the offered opponents." };
  }

  const userClubId = state.manager.clubId;
  const season = state.calendar.currentSeason;
  const fixtures = buildFriendlyFixtures(userClubId, selectedOpponentIds, season);
  const friendlies = state.competitions.friendlies;

  return {
    success: true,
    state: {
      ...state,
      pendingFriendlyOpponents: undefined,
      friendlyFixturesConfirmed: true,
      competitions: {
        ...state.competitions,
        friendlies: {
          ...friendlies,
          fixtures,
          clubIds: [userClubId, ...selectedOpponentIds],
        },
      },
    },
  };
}

/** Auto-pick the first 3 pending friendly opponents. */
export function autoPickFriendlyOpponents(state: ManagerState): {
  success: boolean;
  state: ManagerState;
  error?: string;
} {
  const pending = state.pendingFriendlyOpponents || [];
  if (pending.length < 3) {
    return { success: false, state, error: "Not enough friendly opponents available." };
  }
  return confirmFriendlyOpponents(state, pending.slice(0, 3));
}

/**
 * True when the manager still needs to pick pre-season friendlies.
 */
export function needsFriendlySelection(state: ManagerState): boolean {
  if (state.friendlyFixturesConfirmed) return false;
  const pending = state.pendingFriendlyOpponents;
  return Boolean(pending && pending.length > 0);
}

/**
 * Updates league standings after a match.
 * Strictly verifies that only regular league matches update standings!
 */
export function updateStandingsForFixture(
  standings: LeagueTableRow[],
  fixture: ManagerFixture
): LeagueTableRow[] {
  // CRITICAL: Friendlies, Cup matches, Playoffs, and Million Pound Game must NOT affect regular league standings!
  if (
    fixture.competitionId === "friendlies" ||
    fixture.competitionId === "challenge-cup" ||
    fixture.roundName.includes("Playoff") ||
    fixture.roundName.includes("Eliminator") ||
    fixture.roundName.includes("Semi-Final") ||
    fixture.roundName.includes("Grand Final") ||
    fixture.roundName.includes("Million Pound Game")
  ) {
    return standings;
  }

  const { homeClubId, awayClubId, homeScore = 0, awayScore = 0 } = fixture;

  return standings.map((row) => {
    if (row.clubId === homeClubId) {
      const won = homeScore > awayScore;
      const drawn = homeScore === awayScore;
      const lost = homeScore < awayScore;
      const points = won ? 2 : drawn ? 1 : 0;
      const formResult: "W" | "D" | "L" = won ? "W" : drawn ? "D" : "L";

      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (lost ? 1 : 0),
        pointsFor: row.pointsFor + homeScore,
        pointsAgainst: row.pointsAgainst + awayScore,
        pointsDifference: row.pointsDifference + (homeScore - awayScore),
        points: row.points + points,
        form: [formResult, ...row.form].slice(0, 5),
      };
    }

    if (row.clubId === awayClubId) {
      const won = awayScore > homeScore;
      const drawn = homeScore === awayScore;
      const lost = awayScore < homeScore;
      const points = won ? 2 : drawn ? 1 : 0;
      const formResult: "W" | "D" | "L" = won ? "W" : drawn ? "D" : "L";

      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (lost ? 1 : 0),
        pointsFor: row.pointsFor + awayScore,
        pointsAgainst: row.pointsAgainst + homeScore,
        pointsDifference: row.pointsDifference + (awayScore - homeScore),
        points: row.points + points,
        form: [formResult, ...row.form].slice(0, 5),
      };
    }

    return row;
  });
}

/**
 * Canonical sorting of league standings table:
 * 1. Points (desc)
 * 2. Points Difference (desc)
 * 3. Points For (desc)
 */
export function sortStandings(standings: LeagueTableRow[]): LeagueTableRow[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.clubId.localeCompare(b.clubId);
  });
}

/**
 * Generates Top 6 Playoffs for Super League or Championship.
 * Round 1: Eliminator A (3rd vs 6th), Eliminator B (4th vs 5th). 1st & 2nd receive bye.
 * Round 2: Semi Final A (1st vs lowest ranked winner), Semi Final B (2nd vs highest ranked winner).
 * Round 3: Grand Final (Winner SF A vs Winner SF B).
 */
export function initializeTop6Playoffs(
  sortedStandings: LeagueTableRow[],
  season: number,
  compId: CompetitionId
): PlayoffMatch[] {
  const top6 = sortedStandings.slice(0, 6).map((s) => s.clubId);
  if (top6.length < 6) return [];

  const [first, second, third, fourth, fifth, sixth] = top6;

  return [
    {
      id: `${compId}_${season}_elim_a`,
      round: "eliminator",
      homeClubId: third,
      awayClubId: sixth,
      isPlayed: false,
    },
    {
      id: `${compId}_${season}_elim_b`,
      round: "eliminator",
      homeClubId: fourth,
      awayClubId: fifth,
      isPlayed: false,
    },
    // Placeholders for Semis and Grand Final, resolved as matches complete
    {
      id: `${compId}_${season}_semi_1`,
      round: "semi_final",
      homeClubId: first,
      awayClubId: "", // resolved after eliminators
      isPlayed: false,
    },
    {
      id: `${compId}_${season}_semi_2`,
      round: "semi_final",
      homeClubId: second,
      awayClubId: "",
      isPlayed: false,
    },
    {
      id: `${compId}_${season}_grand_final`,
      round: "grand_final",
      homeClubId: "",
      awayClubId: "",
      isPlayed: false,
    },
  ];
}

function getMatchWinnerId(fixture: ManagerFixture): string {
  if (!fixture.isPlayed) return fixture.homeClubId;
  return (fixture.homeScore || 0) >= (fixture.awayScore || 0)
    ? fixture.homeClubId
    : fixture.awayClubId;
}

function getClubRankIndex(standings: LeagueTableRow[], clubId: string): number {
  const idx = standings.findIndex((r) => r.clubId === clubId);
  return idx >= 0 ? idx : 999;
}

/** Season-scoped fixture predicate (legacy fixtures without season still match). */
function isCurrentSeasonFixture(fixture: ManagerFixture, season: number): boolean {
  return !fixture.season || fixture.season === season;
}

function createPostSeasonInboxMessage(
  state: ManagerState,
  subject: string,
  body: string
): InboxMessage {
  const week = state.calendar.currentWeek;
  const season = state.calendar.currentSeason;
  return {
    id: `msg_ps_${season}_w${week}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    season,
    week,
    dateStr: `Week ${week}, ${season}`,
    sender: "Rugby Football League Operations",
    subject,
    body,
    category: "general",
    isRead: false,
  };
}

/**
 * Autonomously schedules progressive knockout cup fixtures, top 6 playoffs,
 * and The Million Pound Game at the appropriate calendar weeks.
 */
export function schedulePostSeasonAndCupFixtures(
  state: ManagerState,
  targetWeek: number
): ManagerState {
  const season = state.calendar.currentSeason;
  const newMessages: InboxMessage[] = [];

  const updatedCompetitions = { ...state.competitions };
  const ccComp = { ...updatedCompetitions["challenge-cup"] };
  const slComp = { ...updatedCompetitions["super-league"] };
  const champComp = { ...updatedCompetitions["championship"] };

  const slStandings = sortStandings(slComp.standings);
  const champStandings = sortStandings(champComp.standings);

  // 1. CHALLENGE CUP PROGRESSION
  // Week 16: Challenge Cup Quarter Finals
  if (targetWeek === 16) {
    const hasW16 = ccComp.fixtures.some((f) => f.week === 16 && isCurrentSeasonFixture(f, season));
    if (!hasW16) {
      const r5Played = ccComp.fixtures.filter(
        (f) => f.week === 8 && isCurrentSeasonFixture(f, season) && f.isPlayed
      );
      if (r5Played.length >= 8) {
        const winners = r5Played.map(getMatchWinnerId);
        const qfFixtures: ManagerFixture[] = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (winners[i] && winners[i + 1]) {
            qfFixtures.push({
              id: `cc_${season}_qf_${i / 2 + 1}`,
              competitionId: "challenge-cup",
              season,
              week: 16,
              roundName: `Challenge Cup Quarter Final ${i / 2 + 1}`,
              homeClubId: winners[i],
              awayClubId: winners[i + 1],
              isPlayed: false,
            });
          }
        }
        ccComp.fixtures = [...ccComp.fixtures, ...qfFixtures];
      }
    }
  }

  // Week 24: Challenge Cup Semi Finals
  if (targetWeek === 24) {
    const hasW24 = ccComp.fixtures.some((f) => f.week === 24 && isCurrentSeasonFixture(f, season));
    if (!hasW24) {
      const qfPlayed = ccComp.fixtures.filter(
        (f) => f.week === 16 && isCurrentSeasonFixture(f, season) && f.isPlayed
      );
      if (qfPlayed.length >= 4) {
        const winners = qfPlayed.map(getMatchWinnerId);
        const sfFixtures: ManagerFixture[] = [];
        for (let i = 0; i < 4; i += 2) {
          if (winners[i] && winners[i + 1]) {
            sfFixtures.push({
              id: `cc_${season}_sf_${i / 2 + 1}`,
              competitionId: "challenge-cup",
              season,
              week: 24,
              roundName: `Challenge Cup Semi-Final ${i / 2 + 1}`,
              homeClubId: winners[i],
              awayClubId: winners[i + 1],
              isPlayed: false,
            });
          }
        }
        ccComp.fixtures = [...ccComp.fixtures, ...sfFixtures];
      }
    }
  }

  // Week 28: Challenge Cup Final (Wembley)
  if (targetWeek === 28) {
    const hasW28 = ccComp.fixtures.some((f) => f.week === 28 && isCurrentSeasonFixture(f, season));
    if (!hasW28) {
      const sfPlayed = ccComp.fixtures.filter(
        (f) => f.week === 24 && isCurrentSeasonFixture(f, season) && f.isPlayed
      );
      if (sfPlayed.length >= 2) {
        const winners = sfPlayed.map(getMatchWinnerId);
        ccComp.fixtures = [
          ...ccComp.fixtures,
          {
            id: `cc_${season}_final`,
            competitionId: "challenge-cup",
            season,
            week: 28,
            roundName: "Challenge Cup Final",
            homeClubId: winners[0],
            awayClubId: winners[1],
            isPlayed: false,
          },
        ];
      }
    }
  }

  // 2. PLAYOFF ELIMINATORS (WEEK 29)
  if (targetWeek === 29) {
    const slHasW29 = slComp.fixtures.some((f) => f.week === 29 && isCurrentSeasonFixture(f, season));
    if (!slHasW29 && slStandings.length >= 6) {
      // Super League Eliminators: 3rd vs 6th, 4th vs 5th
      slComp.fixtures = [
        ...slComp.fixtures,
        {
          id: `sl_${season}_w29_elim1`,
          competitionId: "super-league",
          season,
          week: 29,
          roundName: "Super League Eliminator 1",
          homeClubId: slStandings[2].clubId,
          awayClubId: slStandings[5].clubId,
          isPlayed: false,
        },
        {
          id: `sl_${season}_w29_elim2`,
          competitionId: "super-league",
          season,
          week: 29,
          roundName: "Super League Eliminator 2",
          homeClubId: slStandings[3].clubId,
          awayClubId: slStandings[4].clubId,
          isPlayed: false,
        },
      ];
    }

    const champHasW29 = champComp.fixtures.some(
      (f) => f.week === 29 && isCurrentSeasonFixture(f, season)
    );
    if (!champHasW29 && champStandings.length >= 6) {
      // Championship Playoff Format:
      // 1st place is Champion & automatically promoted to Super League!
      // 2nd place receives a bye to the Semi-Final.
      // 3rd vs 6th, 4th vs 5th contest eliminators for the Million Pound Game pathway.
      champComp.fixtures = [
        ...champComp.fixtures,
        {
          id: `champ_${season}_w29_elim1`,
          competitionId: "championship",
          season,
          week: 29,
          roundName: "Championship Eliminator 1",
          homeClubId: champStandings[2].clubId,
          awayClubId: champStandings[5].clubId,
          isPlayed: false,
        },
        {
          id: `champ_${season}_w29_elim2`,
          competitionId: "championship",
          season,
          week: 29,
          roundName: "Championship Eliminator 2",
          homeClubId: champStandings[3].clubId,
          awayClubId: champStandings[4].clubId,
          isPlayed: false,
        },
      ];

      // Send official news bulletin
      const champChampName = state.clubs[champStandings[0]?.clubId]?.name || "Championship Champions";
      const slRelegatedName =
        state.clubs[slStandings[slStandings.length - 1]?.clubId]?.name ||
        "14th placed Super League club";
      const slMpgName =
        state.clubs[slStandings[12]?.clubId]?.name || "13th placed Super League club";

      newMessages.push(
        createPostSeasonInboxMessage(
          state,
          `Championship Champions: ${champChampName} Promoted to Super League!`,
          `Congratulations to ${champChampName}, who have officially finished 1st in the Betfred Championship! Under the competition rules, the top Championship team is automatically promoted to the Betfred Super League.\n\nMeanwhile, ${slRelegatedName} finish bottom (14th) in Super League and suffer automatic relegation to the Championship.\n\n${slMpgName} finish 13th in Super League and will enter The Million Pound Game against the winner of the Championship Playoffs!`
        )
      );
    }
  }

  // 3. PLAYOFF SEMI-FINALS (WEEK 30)
  if (targetWeek === 30) {
    const slHasW30 = slComp.fixtures.some((f) => f.week === 30 && isCurrentSeasonFixture(f, season));
    if (!slHasW30) {
      const slElims = slComp.fixtures.filter(
        (f) =>
          f.week === 29 &&
          isCurrentSeasonFixture(f, season) &&
          f.roundName.includes("Eliminator") &&
          f.isPlayed
      );
      if (slElims.length >= 2 && slStandings.length >= 2) {
        const w1 = getMatchWinnerId(slElims[0]);
        const w2 = getMatchWinnerId(slElims[1]);
        const [higherSeed, lowerSeed] =
          getClubRankIndex(slStandings, w1) < getClubRankIndex(slStandings, w2)
            ? [w1, w2]
            : [w2, w1];

        slComp.fixtures = [
          ...slComp.fixtures,
          {
            id: `sl_${season}_w30_sf1`,
            competitionId: "super-league",
            season,
            week: 30,
            roundName: "Super League Semi-Final 1",
            homeClubId: slStandings[0].clubId,
            awayClubId: lowerSeed,
            isPlayed: false,
          },
          {
            id: `sl_${season}_w30_sf2`,
            competitionId: "super-league",
            season,
            week: 30,
            roundName: "Super League Semi-Final 2",
            homeClubId: slStandings[1].clubId,
            awayClubId: higherSeed,
            isPlayed: false,
          },
        ];
      }
    }

    const champHasW30 = champComp.fixtures.some(
      (f) => f.week === 30 && isCurrentSeasonFixture(f, season)
    );
    if (!champHasW30) {
      const champElims = champComp.fixtures.filter(
        (f) =>
          f.week === 29 &&
          isCurrentSeasonFixture(f, season) &&
          f.roundName.includes("Eliminator") &&
          f.isPlayed
      );
      if (champElims.length >= 2 && champStandings.length >= 2) {
        const cw1 = getMatchWinnerId(champElims[0]);
        const cw2 = getMatchWinnerId(champElims[1]);
        const [higherSeed, lowerSeed] =
          getClubRankIndex(champStandings, cw1) < getClubRankIndex(champStandings, cw2)
            ? [cw1, cw2]
            : [cw2, cw1];

        // Championship playoff path (1st already auto-promoted):
        // - Semi-Final: 2nd vs lower-seeded elim winner
        // - Higher-seeded elim winner receives a bye straight to the Playoff Final
        // Never schedule a self-fixture for the bye club.
        champComp.fixtures = [
          ...champComp.fixtures,
          {
            id: `champ_${season}_w30_sf1`,
            competitionId: "championship",
            season,
            week: 30,
            roundName: "Championship Semi-Final",
            homeClubId: champStandings[1].clubId,
            awayClubId: lowerSeed,
            isPlayed: false,
          },
        ];

        const byeClubName = state.clubs[higherSeed]?.name || higherSeed;
        const sfHomeName = state.clubs[champStandings[1].clubId]?.name || champStandings[1].clubId;
        const sfAwayName = state.clubs[lowerSeed]?.name || lowerSeed;
        newMessages.push(
          createPostSeasonInboxMessage(
            state,
            `Championship Playoffs: ${byeClubName} receive Final bye`,
            `${sfHomeName} (2nd) will face ${sfAwayName} in the Championship Semi-Final.\n\n${byeClubName} (higher-seeded Eliminator winners) receive a bye to the Championship Playoff Final — winner progresses to The Million Pound Game.`
          )
        );
      }
    }
  }

  // 4. FINALS (WEEK 31)
  if (targetWeek === 31) {
    const slHasW31 = slComp.fixtures.some((f) => f.week === 31 && isCurrentSeasonFixture(f, season));
    if (!slHasW31) {
      const slSfs = slComp.fixtures.filter(
        (f) =>
          f.week === 30 &&
          isCurrentSeasonFixture(f, season) &&
          f.roundName.includes("Semi-Final") &&
          f.isPlayed
      );
      if (slSfs.length >= 2) {
        const w1 = getMatchWinnerId(slSfs[0]);
        const w2 = getMatchWinnerId(slSfs[1]);
        const [homeClub, awayClub] =
          getClubRankIndex(slStandings, w1) <= getClubRankIndex(slStandings, w2)
            ? [w1, w2]
            : [w2, w1];

        slComp.fixtures = [
          ...slComp.fixtures,
          {
            id: `sl_${season}_w31_grand_final`,
            competitionId: "super-league",
            season,
            week: 31,
            roundName: "Super League Grand Final",
            homeClubId: homeClub,
            awayClubId: awayClub,
            isPlayed: false,
          },
        ];
      }
    }

    const champHasW31 = champComp.fixtures.some(
      (f) => f.week === 31 && isCurrentSeasonFixture(f, season)
    );
    if (!champHasW31) {
      const champSf = champComp.fixtures.find(
        (f) =>
          f.week === 30 &&
          isCurrentSeasonFixture(f, season) &&
          f.roundName.includes("Semi-Final") &&
          f.isPlayed
      );
      const champElims = champComp.fixtures.filter(
        (f) =>
          f.week === 29 &&
          isCurrentSeasonFixture(f, season) &&
          f.roundName.includes("Eliminator") &&
          f.isPlayed
      );

      if (champSf && champElims.length >= 2) {
        const cw1 = getMatchWinnerId(champElims[0]);
        const cw2 = getMatchWinnerId(champElims[1]);
        const higherSeed =
          getClubRankIndex(champStandings, cw1) < getClubRankIndex(champStandings, cw2)
            ? cw1
            : cw2;
        const sfWinner = getMatchWinnerId(champSf);

        // Playoff Final: Semi-Final winner vs higher-seeded Eliminator bye
        const [homeClub, awayClub] =
          getClubRankIndex(champStandings, sfWinner) <= getClubRankIndex(champStandings, higherSeed)
            ? [sfWinner, higherSeed]
            : [higherSeed, sfWinner];

        if (homeClub !== awayClub) {
          champComp.fixtures = [
            ...champComp.fixtures,
            {
              id: `champ_${season}_w31_playoff_final`,
              competitionId: "championship",
              season,
              week: 31,
              roundName: "Championship Playoff Final",
              homeClubId: homeClub,
              awayClubId: awayClub,
              isPlayed: false,
            },
          ];
        }
      }
    }
  }

  // 5. THE MILLION POUND GAME (WEEK 32)
  if (targetWeek === 32) {
    const slHasMpg = slComp.fixtures.some(
      (f) => f.roundName === "The Million Pound Game" && isCurrentSeasonFixture(f, season)
    );
    if (!slHasMpg) {
      const champFinal = champComp.fixtures.find(
        (f) =>
          f.week === 31 &&
          isCurrentSeasonFixture(f, season) &&
          f.roundName.includes("Playoff Final") &&
          f.isPlayed
      );

      // Only schedule once the Championship Playoff Final has a real winner.
      // Never invent a playoff winner from regular-season 2nd place.
      if (champFinal) {
        const champWinnerId = getMatchWinnerId(champFinal);
        const sl13 = slStandings[12]?.clubId || "castleford-tigers";

        const mpgFixture: ManagerFixture = {
          id: `sl_${season}_w32_million_pound_game`,
          competitionId: "super-league",
          season,
          week: 32,
          roundName: "The Million Pound Game",
          homeClubId: sl13,
          awayClubId: champWinnerId,
          isPlayed: false,
        };

        slComp.fixtures = [...slComp.fixtures, mpgFixture];

        // Mirror into Championship fixtures so Championship managers see it in their fixtures list
        const champMpgFixture: ManagerFixture = {
          ...mpgFixture,
          competitionId: "championship",
        };
        champComp.fixtures = [...champComp.fixtures, champMpgFixture];

        const slClubName = state.clubs[sl13]?.name || sl13;
        const champClubName = state.clubs[champWinnerId]?.name || champWinnerId;

        newMessages.push(
          createPostSeasonInboxMessage(
            state,
            `THE MILLION POUND GAME: ${slClubName} vs ${champClubName}`,
            `The stage is set for rugby league's highest-stakes match: The Million Pound Game!\n\n${slClubName} (13th in Super League) take on Championship Playoff winners ${champClubName}.\n\nSTAKES:\n- If ${champClubName} win: They achieve promotion to the Betfred Super League, and ${slClubName} are relegated to the Championship.\n- If ${slClubName} win: They secure their Super League status, and ${champClubName} remain in the Championship.\n\nWinner takes all!`
          )
        );
      }
    }
  }

  // 6. POST-MPG BULLETIN (WEEK 33)
  if (targetWeek === 33) {
    const mpgFixture =
      slComp.fixtures.find(
        (f) =>
          f.roundName === "The Million Pound Game" &&
          isCurrentSeasonFixture(f, season) &&
          f.isPlayed
      ) ||
      champComp.fixtures.find(
        (f) =>
          f.roundName === "The Million Pound Game" &&
          isCurrentSeasonFixture(f, season) &&
          f.isPlayed
      );
    if (mpgFixture) {
      const homeInSL = slStandings.some((s) => s.clubId === mpgFixture.homeClubId);
      const awayInSL = slStandings.some((s) => s.clubId === mpgFixture.awayClubId);

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
        // Scheduled convention: home = SL 13th, away = Championship playoff winner
        slClubId = mpgFixture.homeClubId;
        champClubId = mpgFixture.awayClubId;
        slScore = mpgFixture.homeScore || 0;
        champScore = mpgFixture.awayScore || 0;
      }

      // Align with calculateSeasonAwards: SL survives on win OR draw
      const slSurvived = slScore >= champScore;
      const slClubName = state.clubs[slClubId]?.name || slClubId;
      const champClubName = state.clubs[champClubId]?.name || champClubId;

      if (!slSurvived) {
        newMessages.push(
          createPostSeasonInboxMessage(
            state,
            `MILLION POUND GAME: ${champClubName} PROMOTED TO SUPER LEAGUE!`,
            `${champClubName} have triumphed in The Million Pound Game (${slClubName} ${slScore}-${champScore} ${champClubName}) to earn promotion to the Betfred Super League!\n\n${slClubName} suffer relegation to the Betfred Championship.`
          )
        );
      } else {
        newMessages.push(
          createPostSeasonInboxMessage(
            state,
            `MILLION POUND GAME: ${slClubName} SURVIVE IN SUPER LEAGUE!`,
            `${slClubName} have defended their Super League status in The Million Pound Game (${slClubName} ${slScore}-${champScore} ${champClubName}) against ${champClubName}!\n\n${slClubName} will play in Betfred Super League next season, while ${champClubName} will remain in the Betfred Championship.`
          )
        );
      }
    }
  }

  updatedCompetitions["challenge-cup"] = ccComp;
  updatedCompetitions["super-league"] = slComp;
  updatedCompetitions["championship"] = champComp;

  const currentInbox = state.inbox || { messages: [], unreadCount: 0 };

  return {
    ...state,
    competitions: updatedCompetitions,
    inbox: {
      ...currentInbox,
      messages: [...newMessages, ...(currentInbox.messages || [])],
      unreadCount: (currentInbox.unreadCount || 0) + newMessages.length,
    },
  };
}
