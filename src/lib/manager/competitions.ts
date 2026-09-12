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
  season: number
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
    // Regular season runs from Week 3 to Week 28 (weeks 1 and 2 are pre-season friendlies)
    const startWeek = 3;
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
    // Challenge cup knockout rounds seeded at specific weeks
    // Round 1 (Last 16): Week 8
    // Quarter Finals: Week 16
    // Semi Finals: Week 24
    // Final: Week 30 (Wembley)
    // We shuffle available clubs and pair them for Round 1
    const shuffled = [...clubIds].sort(() => Math.random() - 0.5);
    const round1Clubs = shuffled.slice(0, 16); // Top 16 clubs enter
    for (let i = 0; i < round1Clubs.length; i += 2) {
      if (round1Clubs[i] && round1Clubs[i + 1]) {
        fixtures.push({
          id: `cc_${season}_r1_${round1Clubs[i]}_${round1Clubs[i + 1]}`,
          competitionId: "challenge-cup",
          season,
          week: 8,
          roundName: "Challenge Cup Round 5",
          homeClubId: round1Clubs[i],
          awayClubId: round1Clubs[i + 1],
          isPlayed: false,
        });
      }
    }
  } else if (compId === "friendlies") {
    // 2 pre-season friendlies at Week 1 and Week 2
    const userClub = clubIds[0] || "leeds-rhinos";
    // Pick 2 attractive opponents
    const opp1 = userClub === "wigan-warriors" ? "st-helens" : "wigan-warriors";
    const opp2 = userClub === "bradford-bulls" ? "leeds-rhinos" : "bradford-bulls";

    fixtures.push({
      id: `friendly_${season}_w1_${userClub}_${opp1}`,
      competitionId: "friendlies",
      season,
      week: 1,
      roundName: "Pre-Season Friendly 1",
      homeClubId: userClub,
      awayClubId: opp1,
      isPlayed: false,
    });

    fixtures.push({
      id: `friendly_${season}_w2_${opp2}_${userClub}`,
      competitionId: "friendlies",
      season,
      week: 2,
      roundName: "Pre-Season Friendly 2",
      homeClubId: opp2,
      awayClubId: userClub,
      isPlayed: false,
    });
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
  return (fixture.homeScore || 0) > (fixture.awayScore || 0)
    ? fixture.homeClubId
    : fixture.awayClubId;
}

function getClubRankIndex(standings: LeagueTableRow[], clubId: string): number {
  const idx = standings.findIndex((r) => r.clubId === clubId);
  return idx >= 0 ? idx : 999;
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
    const hasW16 = ccComp.fixtures.some((f) => f.week === 16);
    if (!hasW16) {
      const r5Played = ccComp.fixtures.filter((f) => f.week === 8 && f.isPlayed);
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
    const hasW24 = ccComp.fixtures.some((f) => f.week === 24);
    if (!hasW24) {
      const qfPlayed = ccComp.fixtures.filter((f) => f.week === 16 && f.isPlayed);
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
    const hasW28 = ccComp.fixtures.some((f) => f.week === 28);
    if (!hasW28) {
      const sfPlayed = ccComp.fixtures.filter((f) => f.week === 24 && f.isPlayed);
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
    const slHasW29 = slComp.fixtures.some((f) => f.week === 29);
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

    const champHasW29 = champComp.fixtures.some((f) => f.week === 29);
    if (!champHasW29 && champStandings.length >= 6) {
      // Championship Playoff Format:
      // 1st place is Champion & automatically promoted to Super League!
      // 2nd place receives a bye to semi-finals.
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
      const slRelegatedName = state.clubs[slStandings[13]?.clubId]?.name || "14th placed Super League club";
      const slMpgName = state.clubs[slStandings[12]?.clubId]?.name || "13th placed Super League club";

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
    const slHasW30 = slComp.fixtures.some((f) => f.week === 30);
    if (!slHasW30) {
      const slElims = slComp.fixtures.filter(
        (f) => f.week === 29 && f.roundName.includes("Eliminator") && f.isPlayed
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

    const champHasW30 = champComp.fixtures.some((f) => f.week === 30);
    if (!champHasW30) {
      const champElims = champComp.fixtures.filter(
        (f) => f.week === 29 && f.roundName.includes("Eliminator") && f.isPlayed
      );
      if (champElims.length >= 2 && champStandings.length >= 2) {
        const cw1 = getMatchWinnerId(champElims[0]);
        const cw2 = getMatchWinnerId(champElims[1]);
        const [higherSeed, lowerSeed] =
          getClubRankIndex(champStandings, cw1) < getClubRankIndex(champStandings, cw2)
            ? [cw1, cw2]
            : [cw2, cw1];

        champComp.fixtures = [
          ...champComp.fixtures,
          {
            id: `champ_${season}_w30_sf1`,
            competitionId: "championship",
            season,
            week: 30,
            roundName: "Championship Semi-Final 1",
            homeClubId: champStandings[1].clubId,
            awayClubId: lowerSeed,
            isPlayed: false,
          },
          {
            id: `champ_${season}_w30_sf2`,
            competitionId: "championship",
            season,
            week: 30,
            roundName: "Championship Semi-Final 2",
            homeClubId: higherSeed,
            awayClubId: lowerSeed === cw1 ? cw2 : cw1,
            isPlayed: false,
          },
        ];
      }
    }
  }

  // 4. FINALS (WEEK 31)
  if (targetWeek === 31) {
    const slHasW31 = slComp.fixtures.some((f) => f.week === 31);
    if (!slHasW31) {
      const slSfs = slComp.fixtures.filter(
        (f) => f.week === 30 && f.roundName.includes("Semi-Final") && f.isPlayed
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

    const champHasW31 = champComp.fixtures.some((f) => f.week === 31);
    if (!champHasW31) {
      const champSfs = champComp.fixtures.filter(
        (f) => f.week === 30 && f.roundName.includes("Semi-Final") && f.isPlayed
      );
      if (champSfs.length >= 2) {
        const cw1 = getMatchWinnerId(champSfs[0]);
        const cw2 = getMatchWinnerId(champSfs[1]);
        const [homeClub, awayClub] =
          getClubRankIndex(champStandings, cw1) <= getClubRankIndex(champStandings, cw2)
            ? [cw1, cw2]
            : [cw2, cw1];

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

  // 5. THE MILLION POUND GAME (WEEK 32)
  if (targetWeek === 32) {
    const slHasMpg = slComp.fixtures.some((f) => f.roundName === "The Million Pound Game");
    if (!slHasMpg) {
      const champFinal = champComp.fixtures.find(
        (f) => f.week === 31 && f.roundName.includes("Playoff Final") && f.isPlayed
      );
      const champWinnerId = champFinal
        ? getMatchWinnerId(champFinal)
        : (champStandings[1]?.clubId || "toulouse-olympique");

      // 13th place in Super League regular season (second bottom)
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

  // 6. POST-MPG BULLETIN (WEEK 33)
  if (targetWeek === 33) {
    const mpgFixture = slComp.fixtures.find(
      (f) => f.roundName === "The Million Pound Game" && f.isPlayed
    );
    if (mpgFixture) {
      const homeWon = (mpgFixture.homeScore || 0) > (mpgFixture.awayScore || 0);
      const slClubName = state.clubs[mpgFixture.homeClubId]?.name || mpgFixture.homeClubId;
      const champClubName = state.clubs[mpgFixture.awayClubId]?.name || mpgFixture.awayClubId;

      if (!homeWon) {
        newMessages.push(
          createPostSeasonInboxMessage(
            state,
            `MILLION POUND GAME: ${champClubName} PROMOTED TO SUPER LEAGUE!`,
            `${champClubName} have triumphed in The Million Pound Game (${mpgFixture.awayScore}-${mpgFixture.homeScore}) to earn promotion to the Betfred Super League!\n\n${slClubName} suffer relegation to the Betfred Championship.`
          )
        );
      } else {
        newMessages.push(
          createPostSeasonInboxMessage(
            state,
            `MILLION POUND GAME: ${slClubName} SURVIVE IN SUPER LEAGUE!`,
            `${slClubName} have defended their Super League status in The Million Pound Game with a ${mpgFixture.homeScore}-${mpgFixture.awayScore} victory over ${champClubName}!\n\n${slClubName} will play in Betfred Super League next season, while ${champClubName} will remain in the Betfred Championship.`
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
