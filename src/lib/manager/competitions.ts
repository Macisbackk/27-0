/**
 * Competition fixtures, standings, playoffs, and rules.
 * Pure simulation logic.
 */

import type {
  CompetitionId,
  LeagueTableRow,
  ManagerCompetition,
  ManagerFixture,
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
  // CRITICAL: Friendlies and Cup matches must NOT affect league standings!
  if (fixture.competitionId === "friendlies" || fixture.competitionId === "challenge-cup") {
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
