import seedrandom from "seedrandom";
import {
  CHAMPIONSHIP_CLUBS,
  CHAMPIONSHIP_CLUB_NAMES,
  getChampionshipClubByName,
  type ChampionshipClub,
} from "../../clubs/championship-clubs";
import { decomposeRLScore, pickScorePairAllowingDraw } from "../../game/rl-scores";
import type { ManagerLeagueRow, ManagerRoundMatch } from "../types";
import type { ChampionshipSquadState } from "./championshipSquads";
import {
  buildChampionshipMatchDetail,
  type ChampionshipMatchDetail,
} from "./championshipMatchDetail";

export const CHAMPIONSHIP_COMPETITION_VERSION = 1;
export const CHAMPIONSHIP_ROUNDS = 19; // 20 clubs → 19 rounds single round-robin

export interface ChampionshipFixture {
  id: string;
  round: number;
  homeClubId: string;
  awayClubId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  homeTries?: number;
  awayTries?: number;
  matchDetail?: ChampionshipMatchDetail;
  played: boolean;
}

export interface ChampionshipCompetitionState {
  id: "championship";
  name: "Championship";
  shortName: "Champ";
  version: number;
  clubIds: string[];
  fixtures: ChampionshipFixture[];
  standings: ManagerLeagueRow[];
  currentRound: number;
  completed: boolean;
  /** Rounds already processed for weekly advance. */
  lastProcessedRound: number;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function resolveChampionshipClubList(
  clubNames?: readonly string[]
): ChampionshipClub[] {
  if (!clubNames?.length) return [...CHAMPIONSHIP_CLUBS];
  const resolved: ChampionshipClub[] = [];
  for (const name of clubNames) {
    const known = getChampionshipClubByName(name);
    if (known) {
      resolved.push(known);
      continue;
    }
    // Relegated Super League clubs may not be in the static Champ registry.
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    resolved.push({
      id: slug || `club-${resolved.length}`,
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      abbreviation: name.slice(0, 3).toUpperCase(),
      country: "England",
      competitionTier2026: "championship",
      primaryColor: "#334155",
      secondaryColor: "#94a3b8",
      challengeCupEligible: true,
      managerSelectable: true,
      generatedSquad: false,
      baseStrength: 68,
    });
  }
  return resolved;
}

/** Circle method single round-robin for 20 clubs → 19 rounds × 10 fixtures. */
export function generateChampionshipSchedule(
  seed: string,
  seasonYear: number,
  clubNames?: readonly string[]
): ChampionshipFixture[] {
  const rng = seedrandom(`${seed}-champ-schedule-${seasonYear}`);
  const clubs = shuffle(resolveChampionshipClubList(clubNames), rng);
  const n = clubs.length;
  if (n % 2 !== 0) {
    throw new Error("Championship requires an even number of clubs");
  }
  const rounds = n - 1;
  const half = n / 2;
  const rotation = clubs.map((c) => c);
  const fixtures: ChampionshipFixture[] = [];

  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      const homeFirst = (round + i) % 2 === 0;
      const h = homeFirst ? home : away;
      const a = homeFirst ? away : home;
      fixtures.push({
        id: `champ-${seasonYear}-r${round}-${h.id}-${a.id}`,
        round,
        homeClubId: h.id,
        awayClubId: a.id,
        homeTeam: h.name,
        awayTeam: a.name,
        played: false,
      });
    }
    // Rotate all but first
    const fixed = rotation[0]!;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }
  return fixtures;
}

export function buildChampionshipTable(
  fixtures: ChampionshipFixture[],
  userClub?: string,
  clubNames?: readonly string[]
): ManagerLeagueRow[] {
  const names =
    clubNames && clubNames.length > 0
      ? [...clubNames]
      : [...CHAMPIONSHIP_CLUB_NAMES];
  for (const f of fixtures) {
    if (!names.includes(f.homeTeam)) names.push(f.homeTeam);
    if (!names.includes(f.awayTeam)) names.push(f.awayTeam);
  }

  const acc = new Map<
    string,
    {
      played: number;
      wins: number;
      draws: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  >();

  for (const name of names) {
    acc.set(name, {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const f of fixtures) {
    if (!f.played || f.homeScore == null || f.awayScore == null) continue;
    const home = acc.get(f.homeTeam);
    const away = acc.get(f.awayTeam);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.pointsFor += f.homeScore;
    home.pointsAgainst += f.awayScore;
    away.pointsFor += f.awayScore;
    away.pointsAgainst += f.homeScore;
    if (f.homeScore > f.awayScore) {
      home.wins++;
      away.losses++;
    } else if (f.awayScore > f.homeScore) {
      away.wins++;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
    }
  }

  const rows: ManagerLeagueRow[] = names.map((team) => {
    const s = acc.get(team)!;
    return {
      team,
      position: 0,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointsDifference: s.pointsFor - s.pointsAgainst,
      leaguePoints: s.wins * 2 + s.draws,
      isUserTeam: userClub != null && team === userClub,
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

function clubStrength(
  clubName: string,
  squads?: ChampionshipSquadState
): number {
  const club = getChampionshipClubByName(clubName);
  if (!club) return 58;
  if (!squads) return club.baseStrength;
  const roster = squads.rosterByClub[club.id] ?? [];
  if (roster.length === 0) return club.baseStrength;
  const ratings = roster
    .map((id) => squads.players[id]?.peakRating ?? 0)
    .filter((r) => r > 0)
    .sort((a, b) => b - a)
    .slice(0, 13);
  if (ratings.length === 0) return club.baseStrength;
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  // Blend matchday quality with club reputation so weak sides stay below SL depth.
  return Math.round(avg * 0.92 + club.baseStrength * 0.08);
}

export function simulateChampionshipFixtureScores(
  homeTeam: string,
  awayTeam: string,
  seed: string,
  fixtureId: string,
  squads?: ChampionshipSquadState
): { homeScore: number; awayScore: number; homeTries: number; awayTries: number } {
  const rng = seedrandom(`${seed}-${fixtureId}`);
  const homeStr = clubStrength(homeTeam, squads) + 1.2; // slight home edge
  const awayStr = clubStrength(awayTeam, squads);
  const diff = homeStr - awayStr;
  const homeWinChance = 0.5 + Math.max(-0.3, Math.min(0.3, diff / 50));
  const homeWins = rng() < homeWinChance;
  const pair = pickScorePairAllowingDraw(12, 42, 2, 24, rng);
  const homeScore = homeWins ? pair.winner : pair.loser;
  const awayScore = homeWins ? pair.loser : pair.winner;
  return {
    homeScore,
    awayScore,
    homeTries: decomposeRLScore(homeScore).tries,
    awayTries: decomposeRLScore(awayScore).tries,
  };
}

export function createChampionshipCompetition(
  seed: string,
  seasonYear: number,
  options?: { startRound?: number; clubNames?: readonly string[] }
): ChampionshipCompetitionState {
  const clubList = resolveChampionshipClubList(options?.clubNames);
  const clubNames = clubList.map((c) => c.name);
  const fixtures = generateChampionshipSchedule(seed, seasonYear, clubNames);
  const startRound = options?.startRound ?? 0;
  // Mark prior rounds as already processed (migration mid-season) without scores
  // Actual scores for aligned rounds are simulated once during weekly advance.
  return {
    id: "championship",
    name: "Championship",
    shortName: "Champ",
    version: CHAMPIONSHIP_COMPETITION_VERSION,
    clubIds: clubList.map((c) => c.id),
    fixtures,
    standings: buildChampionshipTable(fixtures, undefined, clubNames),
    currentRound: Math.max(0, startRound),
    completed: false,
    lastProcessedRound: Math.max(0, startRound),
  };
}

/**
 * Simulate the next Championship round(s) to keep pace with Super League weeks.
 * Maps SL game week → Championship round (1 round per week, capped at 19).
 */
export function advanceChampionshipToGameWeek(
  state: ChampionshipCompetitionState,
  gameWeek: number,
  seed: string,
  squads?: ChampionshipSquadState
): ChampionshipCompetitionState {
  const targetRound = Math.min(CHAMPIONSHIP_ROUNDS, Math.max(0, gameWeek));
  if (targetRound <= state.lastProcessedRound) return state;

  let fixtures = state.fixtures.map((f) => ({ ...f }));
  for (let round = state.lastProcessedRound + 1; round <= targetRound; round++) {
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i]!;
      if (f.round !== round || f.played) continue;
      const score = simulateChampionshipFixtureScores(
        f.homeTeam,
        f.awayTeam,
        seed,
        f.id,
        squads
      );
      const matchDetail = buildChampionshipMatchDetail(
        f.homeTeam,
        f.awayTeam,
        score.homeScore,
        score.awayScore,
        seed,
        f.id,
        squads
      );
      fixtures[i] = {
        ...f,
        played: true,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        homeTries: matchDetail.homeTries,
        awayTries: matchDetail.awayTries,
        matchDetail,
      };
    }
  }

  const clubNames = [
    ...new Set(fixtures.flatMap((f) => [f.homeTeam, f.awayTeam])),
  ];
  const standings = buildChampionshipTable(fixtures, undefined, clubNames);
  const completed = fixtures.every((f) => f.played);
  return {
    ...state,
    fixtures,
    standings,
    currentRound: targetRound,
    lastProcessedRound: targetRound,
    completed,
  };
}

/** Record a played result onto the matching Championship fixture (by round + teams). */
export function markChampionshipUserFixtureResult(
  state: ChampionshipCompetitionState,
  round: number,
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  homeTries?: number,
  awayTries?: number,
  userClub?: string
): ChampionshipCompetitionState {
  const fixtures = state.fixtures.map((f) => {
    if (f.round !== round) return f;
    const sameWay = f.homeTeam === homeTeam && f.awayTeam === awayTeam;
    const swapped = f.homeTeam === awayTeam && f.awayTeam === homeTeam;
    if (!sameWay && !swapped) return f;
    if (sameWay) {
      return {
        ...f,
        played: true,
        homeScore,
        awayScore,
        homeTries,
        awayTries,
      };
    }
    return {
      ...f,
      played: true,
      homeScore: awayScore,
      awayScore: homeScore,
      homeTries: awayTries,
      awayTries: homeTries,
    };
  });

  const clubNames = [
    ...new Set(fixtures.flatMap((f) => [f.homeTeam, f.awayTeam])),
  ];
  return {
    ...state,
    fixtures,
    standings: buildChampionshipTable(fixtures, userClub, clubNames),
  };
}

export function championshipFixturesToRoundMatches(
  fixtures: ChampionshipFixture[]
): ManagerRoundMatch[] {
  return fixtures
    .filter((f) => f.played && f.homeScore != null && f.awayScore != null)
    .map((f) => ({
      round: f.round,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      homeScore: f.homeScore!,
      awayScore: f.awayScore!,
      homeTries:
        f.homeTries ??
        f.matchDetail?.homeTries ??
        decomposeRLScore(f.homeScore!).tries,
      awayTries:
        f.awayTries ??
        f.matchDetail?.awayTries ??
        decomposeRLScore(f.awayScore!).tries,
    }));
}
