import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
import {
  createChallengeCupBracket,
  deriveCupOutcomeFromBracket,
  getActiveRound,
  getCupRoundLabel,
  getMatchById,
  getMatchesForRound,
  simulateBracketMatch,
} from "../game/challenge-cup-bracket";
import type { MatchFixture } from "../game/season-simulation";
import { buildSquadSlotsFromMatchday } from "./managerSquad";
import type {
  CupRoundKey,
  ManagerCareer,
  ManagerScheduledFixture,
} from "./types";
import { CUP_ROUND_LABELS } from "./types";
import {
  needsPreSeasonFriendlies,
} from "./managerFriendlies";

const CUP_TRIGGERS_LEAGUE_GAMES = [5, 12, 19, 24];
const CUP_KEY_TO_BRACKET_ROUND: Record<CupRoundKey, number> = {
  round_one: 1,
  quarter_final: 2,
  semi_final: 3,
  final: 4,
};
const BRACKET_ROUND_TO_KEY: Record<number, CupRoundKey> = {
  1: "round_one",
  2: "quarter_final",
  3: "semi_final",
  4: "final",
};

export function createManagerChallengeCup(
  seed: string,
  userClub: string
): ChallengeCupBracketState {
  return createChallengeCupBracket(`${seed}-cup`, userClub);
}

export function countLeagueFixturesPlayed(career: ManagerCareer): number {
  return career.fixtures.filter(
    (f) => (f.competition ?? "league") === "league"
  ).length;
}

export function countCupFixturesPlayed(career: ManagerCareer): number {
  return career.fixtures.filter((f) => f.competition === "challenge_cup")
    .length;
}

export function ensureCupBracketReady(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) return career;
  const pending = getPendingCupBracketRound(career);
  if (pending === null || !career.challengeCup) return career;

  const prepared = prepareCupRound(career);
  const userMatch = getUserCupMatch(prepared, pending);
  return { ...career, challengeCup: prepared };
}

export function getPendingCupBracketRound(
  career: ManagerCareer
): number | null {
  const cup = career.challengeCup;
  if (!cup || cup.userEliminated || cup.tournamentComplete) return null;

  const leaguePlayed = countLeagueFixturesPlayed(career);
  const cupPlayed = countCupFixturesPlayed(career);

  for (let i = cupPlayed; i < CUP_TRIGGERS_LEAGUE_GAMES.length; i++) {
    if (leaguePlayed >= CUP_TRIGGERS_LEAGUE_GAMES[i]!) {
      return i + 1;
    }
    return null;
  }
  return null;
}

function simulateAiUntilUserReady(
  bracket: ChallengeCupBracketState,
  round: number,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>
): ChallengeCupBracketState {
  let next = bracket;
  let guard = 0;
  while (guard < 20) {
    guard++;
    const userMatch = getMatchesForRound(next, round).find(
      (m) => m.isUserMatch && m.status === "ready"
    );
    if (userMatch) return next;
    if (next.userEliminated || next.tournamentComplete) return next;

    const aiReady = getMatchesForRound(next, round).find(
      (m) => m.status === "ready" && !m.isUserMatch
    );
    if (!aiReady) break;
    next = simulateBracketMatch(next, aiReady.id, squad);
  }
  return next;
}

export function prepareCupRound(
  career: ManagerCareer
): ChallengeCupBracketState {
  const bracketRound = getPendingCupBracketRound(career);
  if (!bracketRound || !career.challengeCup) return career.challengeCup;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions
  );
  return simulateAiUntilUserReady(
    career.challengeCup,
    bracketRound,
    squad
  );
}

export function getUserCupMatch(
  bracket: ChallengeCupBracketState,
  preferredRound?: number
): { matchId: string; opponent: string; isHome: boolean; round: number } | null {
  if (bracket.userEliminated || bracket.tournamentComplete) return null;
  const round = preferredRound ?? getActiveRound(bracket);
  const match = getMatchesForRound(bracket, round).find(
    (m) => m.isUserMatch && m.status === "ready"
  );
  if (!match || !match.homeTeam || !match.awayTeam) return null;
  const isHome = match.homeTeam === bracket.userClub;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  return { matchId: match.id, opponent, isHome, round };
}

export function buildCupScheduledFixture(
  career: ManagerCareer,
  cupMatch: NonNullable<ReturnType<typeof getUserCupMatch>>
): ManagerScheduledFixture {
  const cupKey = BRACKET_ROUND_TO_KEY[cupMatch.round] ?? "round_one";
  const leaguePlayed = countLeagueFixturesPlayed(career);
  return {
    id: `cup-${cupMatch.matchId}`,
    round: leaguePlayed + 1,
    opponent: cupMatch.opponent,
    isHome: cupMatch.isHome,
    competition: "challenge_cup",
    cupRound: cupKey,
    cupMatchId: cupMatch.matchId,
    label: CUP_ROUND_LABELS[cupKey],
  };
}

export function isLeagueAndCupPhaseComplete(career: ManagerCareer): boolean {
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const leagueDone =
    leaguePlayed >= 27 ||
    career.currentFixtureIndex >= career.schedule.length;
  if (!leagueDone) return false;

  const cup = career.challengeCup;
  if (!cup) return true;
  if (cup.tournamentComplete || cup.userEliminated) return true;

  const pendingRound = getPendingCupBracketRound(career);
  if (pendingRound === null) return true;

  const prepared = prepareCupRound(career);
  const cupMatch = getUserCupMatch(prepared, pendingRound);
  if (cupMatch) return false;

  if (prepared.userEliminated || prepared.tournamentComplete) return true;

  const cupPlayed = countCupFixturesPlayed(career);
  return cupPlayed >= 4;
}

export function getNextLeagueOrCupFixture(
  career: ManagerCareer
): ManagerScheduledFixture | null {
  if (career.isSeasonComplete) return null;

  if (needsPreSeasonFriendlies(career) && career.preSeason.activeFriendly) {
    const f = career.preSeason.activeFriendly;
    return {
      id: `friendly-${f.friendlyIndex}-${f.club}-${f.year}`,
      round: 0,
      opponent: f.club,
      isHome: f.isHome,
      competition: "friendly",
      label: `Friendly ${f.friendlyIndex + 1}`,
    };
  }

  if (needsPreSeasonFriendlies(career)) {
    return null;
  }

  const cupRound = getPendingCupBracketRound(career);
  if (cupRound !== null) {
    const prepared = prepareCupRound(career);
    const cupMatch = getUserCupMatch(prepared, cupRound);
    if (cupMatch) {
      return buildCupScheduledFixture(
        { ...career, challengeCup: prepared },
        cupMatch
      );
    }
    if (prepared.userEliminated || prepared.tournamentComplete) {
      // bye or already resolved — fall through
    } else {
      const squad = buildSquadSlotsFromMatchday(
        career.matchdayXiii,
        career.xiiiSlotPositions
      );
      let next = prepared;
      const roundMatches = getMatchesForRound(next, cupRound);
      for (const m of roundMatches) {
        if (m.status === "ready" && !m.isUserMatch) {
          next = simulateBracketMatch(next, m.id, squad);
        }
      }
      const retry = getUserCupMatch(next, cupRound);
      if (retry) {
        return buildCupScheduledFixture({ ...career, challengeCup: next }, retry);
      }
    }
  }

  const idx = career.currentFixtureIndex;
  const sched = career.schedule[idx];
  if (!sched) return null;
  return {
    ...sched,
    competition: sched.competition ?? "league",
    label: sched.label ?? `Round ${sched.round} — League`,
  };
}

export function getCupHubStatus(career: ManagerCareer): string {
  const cup = career.challengeCup;
  if (!cup) return "Challenge Cup: Not started";

  if (cup.userWon || deriveCupOutcomeFromBracket(cup).isWinner) {
    return "Challenge Cup: Winners";
  }
  if (cup.userEliminated) {
    const outcome = deriveCupOutcomeFromBracket(cup);
    return `Challenge Cup: Eliminated in ${outcome.label}`;
  }
  if (cup.tournamentComplete) {
    return "Challenge Cup: Complete";
  }

  const pending = getPendingCupBracketRound(career);
  if (pending !== null) {
    const prepared = prepareCupRound(career);
    const match = getUserCupMatch(prepared, pending);
    if (match) {
      return `Challenge Cup: ${getCupRoundLabel(pending)} vs ${match.opponent}`;
    }
  }

  const active = getActiveRound(cup);
  return `Challenge Cup: ${getCupRoundLabel(active)}`;
}

export function applyCupMatchToBracket(
  career: ManagerCareer,
  cupMatchId: string,
  fixture: MatchFixture
): ChallengeCupBracketState {
  const bracket = career.challengeCup;
  const match = getMatchById(bracket, cupMatchId);
  if (!match || match.status !== "ready" || !match.homeTeam || !match.awayTeam) {
    return bracket;
  }

  const userClub = bracket.userClub;
  const isHome = match.homeTeam === userClub;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const homeScore = isHome ? fixture.pointsFor : fixture.pointsAgainst;
  const awayScore = isHome ? fixture.pointsAgainst : fixture.pointsFor;
  const winner = fixture.result === "W" ? userClub : opponent;
  const loser = fixture.result === "W" ? opponent : userClub;

  const detail = fixture.scoringDetail;
  const scoringDetail = detail
    ? {
        home: isHome ? detail.dreamTeam : detail.opponent,
        away: isHome ? detail.opponent : detail.dreamTeam,
      }
    : null;

  const matches = bracket.matches.map((m) => ({ ...m }));
  const m = matches.find((x) => x.id === cupMatchId)!;
  m.homeScore = homeScore;
  m.awayScore = awayScore;
  m.winner = winner;
  m.loser = loser;
  m.status = "complete";
  m.scoringDetail = scoringDetail;
  m.userFixture = fixture;
  m.matchEvents = [`${winner} def. ${loser} ${homeScore}-${awayScore}`];

  // Rebuild child matches from winners (inline sync)
  for (const child of matches) {
    if (!child.feederIds?.length || child.status === "complete") continue;
    const feederWinners = child.feederIds.map((feederId) => {
      const feeder = matches.find((fm) => fm.id === feederId);
      return feeder?.status === "complete" ? feeder.winner : null;
    });
    if (child.feederIds.length === 1) {
      child.awayTeam = feederWinners[0] ?? null;
    } else {
      child.homeTeam = feederWinners[0] ?? null;
      child.awayTeam = feederWinners[1] ?? null;
    }
    const ready = child.homeTeam !== null && child.awayTeam !== null;
    child.status = ready ? "ready" : "pending";
    if (ready) {
      child.isUserMatch =
        child.homeTeam === userClub || child.awayTeam === userClub;
    }
  }

  const userLost = fixture.result === "L";
  const userWonFinal = match.round === 4 && fixture.result === "W";

  return {
    ...bracket,
    matches,
    userEliminated: userLost,
    tournamentComplete: userLost || userWonFinal,
    userWon: userWonFinal,
  };
}

export function buildMergedDisplaySchedule(
  career: ManagerCareer
): ManagerScheduledFixture[] {
  const league = career.schedule.map((s) => ({
    ...s,
    competition: s.competition ?? ("league" as const),
    label: s.label ?? `Round ${s.round} — League`,
  }));

  const cupSlots: { afterIndex: number; key: CupRoundKey }[] = [
    { afterIndex: 4, key: "round_one" },
    { afterIndex: 11, key: "quarter_final" },
    { afterIndex: 18, key: "semi_final" },
    { afterIndex: 23, key: "final" },
  ];

  const merged: ManagerScheduledFixture[] = [];
  let cupIdx = 0;
  for (let i = 0; i < league.length; i++) {
    merged.push(league[i]!);
    if (
      cupIdx < cupSlots.length &&
      cupSlots[cupIdx]!.afterIndex === i
    ) {
      const slot = cupSlots[cupIdx]!;
      const cupDisplay = resolveCupDisplayFixture(career, slot.key, league[i]!.round);
      merged.push(cupDisplay);
      cupIdx++;
    }
  }
  return merged;
}

function resolveCupDisplayFixture(
  career: ManagerCareer,
  cupKey: CupRoundKey,
  round: number
): ManagerScheduledFixture {
  const played = career.fixtures.find(
    (f) =>
      f.competition === "challenge_cup" && f.meta?.cupRound === cupKey
  );
  if (played) {
    return {
      id: played.fixtureId ?? `cup-played-${cupKey}`,
      round: played.round,
      opponent: played.opponent,
      isHome: played.isHome,
      competition: "challenge_cup",
      cupRound: cupKey,
      label: `${CUP_ROUND_LABELS[cupKey]} vs ${played.opponent}`,
    };
  }

  const bracketRound = CUP_KEY_TO_BRACKET_ROUND[cupKey];
  const pending = getPendingCupBracketRound(career);
  if (pending === bracketRound) {
    const prepared = prepareCupRound(career);
    const match = getUserCupMatch(prepared, pending);
    if (match) {
      return {
        id: `cup-${match.matchId}`,
        round,
        opponent: match.opponent,
        isHome: match.isHome,
        competition: "challenge_cup",
        cupRound: cupKey,
        cupMatchId: match.matchId,
        label: `${CUP_ROUND_LABELS[cupKey]} vs ${match.opponent}`,
      };
    }
  }

  const cupMatch = career.challengeCup?.matches.find(
    (m) =>
      m.round === bracketRound &&
      m.isUserMatch &&
      m.homeTeam &&
      m.awayTeam
  );
  if (cupMatch?.homeTeam && cupMatch.awayTeam) {
    const isHome = cupMatch.homeTeam === career.club;
    const opponent = isHome ? cupMatch.awayTeam : cupMatch.homeTeam;
    return {
      id: `cup-slot-${cupKey}`,
      round,
      opponent,
      isHome,
      competition: "challenge_cup",
      cupRound: cupKey,
      cupMatchId: cupMatch.id,
      label: `${CUP_ROUND_LABELS[cupKey]} vs ${opponent}`,
    };
  }

  return {
    id: `cup-slot-${cupKey}`,
    round,
    opponent: "TBC",
    isHome: true,
    competition: "challenge_cup",
    cupRound: cupKey,
    label: CUP_ROUND_LABELS[cupKey],
  };
}

export function cupRoundKeyToBracketRound(key: CupRoundKey): number {
  return CUP_KEY_TO_BRACKET_ROUND[key];
}

/** Bracket view as it stood after a given cup round (hides later-round results). */
export function snapshotCupBracketAtRound(
  bracket: ChallengeCupBracketState,
  atRound: number
): ChallengeCupBracketState {
  const matches = bracket.matches.map((m) => {
    if (m.round <= atRound) return m;
    return {
      ...m,
      status: "pending" as const,
      homeScore: null,
      awayScore: null,
      winner: null,
      loser: null,
      userFixture: null,
      scoringDetail: null,
      matchEvents: null,
    };
  });
  return { ...bracket, matches };
}
