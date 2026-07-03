import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getLeagueClubInjuryPenalty } from "./managerLeagueState";
import type { LeagueClubStates } from "./managerLeagueState";
import {
  getLeagueClubStableRating,
} from "./managerLeagueRosters";
import { getManagerClubTeamRating } from "./managerRating";
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
import { countLeagueFixturesPlayed } from "./managerChallengeCup";
import {
  MAGIC_WEEKEND_ROUND,
  buildMagicWeekendFixture,
  getLeagueFixtureSides,
} from "./managerMagicWeekend";

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

  const magicWeekend = buildMagicWeekendFixture(club, seed);

  const shuffleRng = seedrandom(`${seed}-schedule-shuffle`);
  const shuffled = [...fixtures].sort(() => shuffleRng() - 0.5);

  const ordered = [...shuffled];
  ordered.splice(MAGIC_WEEKEND_ROUND - 1, 0, magicWeekend);

  return ordered.slice(0, MANAGER_SEASON_GAMES).map((f, i) => {
    const round = i + 1;
    const isMagic = round === MAGIC_WEEKEND_ROUND && f.isNeutral;
    return {
      ...f,
      id: `league-r${round}-${seed}`,
      round,
      competition: "league" as const,
      label: isMagic
        ? `Magic Weekend — ${f.opponent}`
        : `Round ${round} — League`,
    };
  });
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

const MANAGER_HOME_ADVANTAGE = 1.5;

function getClubMatchRating(
  club: string,
  round: number,
  seed: string,
  leagueClubStates: LeagueClubStates | undefined,
  career: ManagerCareer | undefined
): number {
  const stable = career
    ? getLeagueClubStableRating(career, club)
    : getManagerClubTeamRating(club);
  const varianceRng = seedrandom(`${seed}-mgr-club-var-r${round}-${club}`);
  const fixtureVariance = (varianceRng() - 0.5) * 2.5;
  return (
    stable + fixtureVariance - getLeagueClubInjuryPenalty(leagueClubStates, club)
  );
}

function resolveManagerClubMatchWinProbability(
  homeRating: number,
  awayRating: number,
  rng: () => number
): number {
  const ratingGap = homeRating - awayRating;
  const absGap = Math.abs(ratingGap);

  let noiseScale = 2.6;
  if (absGap >= 10) noiseScale = 2.2;
  else if (absGap >= 8) noiseScale = 2.5;
  else if (absGap >= 5) noiseScale = 3;
  else if (absGap >= 3) noiseScale = 3.5;

  const noise = (rng() - 0.5) * noiseScale;
  const diff = ratingGap + MANAGER_HOME_ADVANTAGE + noise;
  let homeWinProb = 1 / (1 + Math.exp(-diff / 3.6));

  if (ratingGap >= 12) homeWinProb = Math.max(homeWinProb, 0.94);
  else if (ratingGap >= 8) homeWinProb = Math.max(homeWinProb, 0.88);
  else if (ratingGap >= 5) homeWinProb = Math.max(homeWinProb, 0.8);
  else if (ratingGap >= 3) homeWinProb = Math.max(homeWinProb, 0.7);

  if (ratingGap <= -12) homeWinProb = Math.min(homeWinProb, 0.06);
  else if (ratingGap <= -8) homeWinProb = Math.min(homeWinProb, 0.12);
  else if (ratingGap <= -5) homeWinProb = Math.min(homeWinProb, 0.2);
  else if (ratingGap <= -3) homeWinProb = Math.min(homeWinProb, 0.3);

  return Math.max(0.04, Math.min(0.96, homeWinProb));
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
  const homeStr = getClubMatchRating(home, round, seed, leagueClubStates, career);
  const awayStr = getClubMatchRating(away, round, seed, leagueClubStates, career);
  const homeWinProb = resolveManagerClubMatchWinProbability(
    homeStr,
    awayStr,
    rng
  );
  const homeWins = rng() < homeWinProb;

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
    const sides = getLeagueFixtureSides(career.club, f);
    const userIsListedHome = sides.homeTeam === career.club;
    const userMatch: ManagerRoundMatch = {
      round: f.round,
      homeTeam: sides.homeTeam,
      awayTeam: sides.awayTeam,
      homeScore: userIsListedHome ? f.pointsFor : f.pointsAgainst,
      awayScore: userIsListedHome ? f.pointsAgainst : f.pointsFor,
      homeTries: userIsListedHome ? f.triesFor : f.triesAgainst,
      awayTries: userIsListedHome ? f.triesAgainst : f.triesFor,
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

/** Authoritative table position — prefer round-match rebuild over stale leagueTable. */
export function getUserLeagueTablePosition(career: ManagerCareer): number {
  return getUserLeaguePosition(getManagerLeagueTable(career), career.club);
}
