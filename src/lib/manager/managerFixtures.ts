import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getMatchClubStrength } from "../game/opponent-squad-strength";
import { getLeagueClubInjuryPenalty } from "./managerLeagueState";
import type { LeagueClubStates } from "./managerLeagueState";
import {
  decomposeRLScore,
  pickRLScore,
  snapToRLScore,
} from "../game/rl-scores";
import { MANAGER_SEASON_GAMES } from "./types";
import type {
  ManagerLeagueRow,
  ManagerRoundMatch,
  ManagerScheduledFixture,
  ManagerCareer,
} from "./types";
import { getManagerOpponentPoolOptions } from "./managerLeagueRosters";
import { countLeagueFixturesPlayed } from "./managerChallengeCup";

export function buildManagerSchedule(
  club: string,
  seed: string
): ManagerScheduledFixture[] {
  const opponents = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== club);
  const fixtures: Omit<
    ManagerScheduledFixture,
    "round" | "id" | "competition" | "label"
  >[] = [];

  for (const opp of opponents) {
    fixtures.push({ opponent: opp, isHome: true });
  }
  for (const opp of opponents) {
    fixtures.push({ opponent: opp, isHome: false });
  }

  const rng = seedrandom(`${seed}-extra-fixture`);
  const extraOpp = opponents[Math.floor(rng() * opponents.length)]!;
  fixtures.push({ opponent: extraOpp, isHome: rng() < 0.5 });

  const shuffleRng = seedrandom(`${seed}-schedule-shuffle`);
  const shuffled = [...fixtures].sort(() => shuffleRng() - 0.5);

  return shuffled.slice(0, MANAGER_SEASON_GAMES).map((f, i) => ({
    ...f,
    id: `league-r${i + 1}-${seed}`,
    round: i + 1,
    competition: "league" as const,
    label: `Round ${i + 1} — League`,
  }));
}

function pairTeamsForRound(
  teams: string[],
  round: number,
  seed: string
): [string, string][] {
  const rng = seedrandom(`${seed}-mgr-pair-r${round}`);
  const shuffled = [...teams].sort(() => rng() - 0.5);
  const pairs: [string, string][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) pairs.push([shuffled[i]!, shuffled[i + 1]!]);
  }
  return pairs;
}

function simulateClubFixture(
  home: string,
  away: string,
  round: number,
  seed: string,
  leagueClubStates?: LeagueClubStates,
  career?: ManagerCareer
): { homeScore: number; awayScore: number; homeTries: number; awayTries: number } {
  const rng = seedrandom(`${seed}-mgr-club-r${round}-${home}-${away}`);
  const homePool = career
    ? getManagerOpponentPoolOptions(career, home)
    : { currentSeasonOnly: true as const };
  const awayPool = career
    ? getManagerOpponentPoolOptions(career, away)
    : { currentSeasonOnly: true as const };
  const homeStr =
    getMatchClubStrength(home, seed, round, true, homePool) -
    getLeagueClubInjuryPenalty(leagueClubStates, home);
  const awayStr =
    getMatchClubStrength(away, seed, round, false, awayPool) -
    getLeagueClubInjuryPenalty(leagueClubStates, away);
  const diff = homeStr - awayStr + (rng() - 0.5) * 8;
  const homeWins = rng() < 1 / (1 + Math.exp(-diff / 4.2));

  const winnerMin = 14;
  const winnerMax = 36;
  const loserMin = 0;
  const loserMax = 24;

  let homeScore: number;
  let awayScore: number;

  if (homeWins) {
    homeScore = snapToRLScore(
      pickRLScore(winnerMin, winnerMax, rng, { allowDropGoal: true }),
      true
    );
    awayScore = snapToRLScore(
      pickRLScore(loserMin, loserMax, rng, { allowDropGoal: false }),
      false
    );
    if (homeScore <= awayScore) homeScore = awayScore + 2;
  } else {
    awayScore = snapToRLScore(
      pickRLScore(winnerMin, winnerMax, rng, { allowDropGoal: true }),
      true
    );
    homeScore = snapToRLScore(
      pickRLScore(loserMin, loserMax, rng, { allowDropGoal: false }),
      false
    );
    if (awayScore <= homeScore) awayScore = homeScore + 2;
  }

  return {
    homeScore,
    awayScore,
    homeTries: decomposeRLScore(homeScore).tries,
    awayTries: decomposeRLScore(awayScore).tries,
  };
}

export function simulateRoundOtherMatches(
  userClub: string,
  userOpponent: string,
  round: number,
  seed: string,
  userMatch: ManagerRoundMatch,
  leagueClubStates?: LeagueClubStates,
  career?: ManagerCareer
): ManagerRoundMatch[] {
  const allClubs = [...CURRENT_PLAYABLE_CLUBS];
  const resting = allClubs.filter(
    (t) => t !== userClub && t !== userOpponent
  );
  const pairs = pairTeamsForRound(resting, round, seed);
  const results: ManagerRoundMatch[] = [userMatch];

  for (const [home, away] of pairs) {
    const sim = simulateClubFixture(
      home,
      away,
      round,
      seed,
      leagueClubStates,
      career
    );
    results.push({
      round,
      homeTeam: home,
      awayTeam: away,
      homeScore: sim.homeScore,
      awayScore: sim.awayScore,
      homeTries: sim.homeTries,
      awayTries: sim.awayTries,
    });
  }
  return results;
}

export function buildLeagueTableFromMatches(
  matches: ManagerRoundMatch[],
  userClub: string
): ManagerLeagueRow[] {
  const acc = new Map<
    string,
    {
      played: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  >();

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    acc.set(club, {
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const m of matches) {
    const home = acc.get(m.homeTeam);
    const away = acc.get(m.awayTeam);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.pointsFor += m.homeScore;
    home.pointsAgainst += m.awayScore;
    away.pointsFor += m.awayScore;
    away.pointsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }
  }

  const rows: ManagerLeagueRow[] = CURRENT_PLAYABLE_CLUBS.map((team) => {
    const s = acc.get(team)!;
    return {
      team,
      position: 0,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointsDifference: s.pointsFor - s.pointsAgainst,
      leaguePoints: s.wins * 2,
      isUserTeam: team === userClub,
    };
  });

  rows.sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.pointsDifference !== a.pointsDifference) {
      return b.pointsDifference - a.pointsDifference;
    }
    return b.pointsFor - a.pointsFor;
  });

  return rows.map((row, i) => ({ ...row, position: i + 1 }));
}

/** Authoritative league table — rebuild from round results when they cover the season played. */
export function getManagerLeagueTable(career: ManagerCareer): ManagerLeagueRow[] {
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const roundCount = new Set(career.roundMatches?.map((m) => m.round) ?? []).size;
  const roundMatchesAuthoritative =
    Boolean(career.roundMatches?.length) && roundCount >= leaguePlayed;

  if (roundMatchesAuthoritative) {
    return buildLeagueTableFromMatches(career.roundMatches, career.club);
  }

  if (career.leagueTable?.length) {
    return career.leagueTable.map((row) => ({
      ...row,
      isUserTeam: row.isUserTeam ?? row.team === career.club,
    }));
  }

  if (career.roundMatches?.length) {
    return buildLeagueTableFromMatches(career.roundMatches, career.club);
  }

  return buildLeagueTableFromMatches([], career.club);
}

export function syncManagerLeagueTable(career: ManagerCareer): ManagerCareer {
  return { ...career, leagueTable: getManagerLeagueTable(career) };
}

/** Backfill round results when fixtures outpace saved roundMatches. */
export function reconcileRoundMatches(career: ManagerCareer): ManagerCareer {
  const leagueFixtures = career.fixtures
    .filter((f) => (f.competition ?? "league") === "league")
    .sort((a, b) => a.round - b.round);
  if (leagueFixtures.length === 0) return career;

  const roundsPresent = new Set(career.roundMatches?.map((m) => m.round) ?? []);
  let roundMatches = [...(career.roundMatches ?? [])];
  let working = career;

  for (const f of leagueFixtures) {
    if (roundsPresent.has(f.round)) continue;
    const userMatch: ManagerRoundMatch = {
      round: f.round,
      homeTeam: f.isHome ? career.club : f.opponent,
      awayTeam: f.isHome ? f.opponent : career.club,
      homeScore: f.isHome ? f.pointsFor : f.pointsAgainst,
      awayScore: f.isHome ? f.pointsAgainst : f.pointsFor,
      homeTries: f.isHome ? f.triesFor : f.triesAgainst,
      awayTries: f.isHome ? f.triesAgainst : f.triesFor,
    };
    const others = simulateRoundOtherMatches(
      career.club,
      f.opponent,
      f.round,
      career.seed,
      userMatch,
      working.leagueClubStates,
      working
    );
    roundMatches = [...roundMatches, ...others];
    roundsPresent.add(f.round);
  }

  if (roundMatches.length === (career.roundMatches?.length ?? 0)) return career;
  return { ...career, roundMatches };
}

export function getUserLeaguePosition(
  table: ManagerLeagueRow[],
  userClub: string
): number {
  return table.find((r) => r.team === userClub)?.position ?? 14;
}
