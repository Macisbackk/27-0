import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
import {
  createChallengeCupBracket,
  deriveCupOutcomeFromBracket,
  getActiveRound,
  getCupRoundLabel,
  getMatchById,
  getMatchesForRound,
  simulateBracketMatch,
  simulateAiMatch,
} from "../game/challenge-cup-bracket";
import type { MatchFixture } from "../game/season-simulation";
import { buildSquadSlotsFromMatchday } from "./managerSquad";
import type {
  CupRoundKey,
  ManagerCareer,
  ManagerScheduledFixture,
} from "./types";
import { CUP_ROUND_LABELS } from "./types";

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
    (f) => (f.competition ?? "league") !== "challenge_cup"
  ).length;
}

export function countCupFixturesPlayed(career: ManagerCareer): number {
  return career.fixtures.filter((f) => f.competition === "challenge_cup")
    .length;
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
  bracket: ChallengeCupBracketState
): { matchId: string; opponent: string; isHome: boolean; round: number } | null {
  if (bracket.userEliminated || bracket.tournamentComplete) return null;
  const round = getActiveRound(bracket);
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

export function getNextManagerFixture(
  career: ManagerCareer
): ManagerScheduledFixture | null {
  if (career.isSeasonComplete) return null;

  const cupRound = getPendingCupBracketRound(career);
  if (cupRound !== null) {
    const prepared = prepareCupRound(career);
    const cupMatch = getUserCupMatch(prepared);
    if (cupMatch) {
      return buildCupScheduledFixture(
        { ...career, challengeCup: prepared },
        cupMatch
      );
    }
    if (prepared.userEliminated || prepared.tournamentComplete) {
      // bye or already resolved — fall through to league
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
      const retry = getUserCupMatch(next);
      if (retry) return buildCupScheduledFixture({ ...career, challengeCup: next }, retry);
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
    const match = getUserCupMatch(prepared);
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
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions
  );
  let bracket = career.challengeCup;
  const match = getMatchById(bracket, cupMatchId);
  if (!match || match.status !== "ready") return bracket;

  bracket = simulateBracketMatch(bracket, cupMatchId, squad);
  const updated = getMatchById(bracket, cupMatchId);
  if (updated?.userFixture) {
    updated.userFixture = { ...fixture, ...updated.userFixture, ...fixture };
  }

  if (fixture.result === "L") {
    bracket = { ...bracket, userEliminated: true };
  }
  if (fixture.result === "W" && match.round === 4) {
    bracket = {
      ...bracket,
      tournamentComplete: true,
      userWon: true,
    };
  }

  const outcome = deriveCupOutcomeFromBracket(bracket);
  if (bracket.tournamentComplete && !outcome.isWinner && !bracket.userEliminated) {
    bracket = { ...bracket, userEliminated: true };
  }

  return bracket;
}

export function isManagerSeasonComplete(career: ManagerCareer): boolean {
  const leagueDone = countLeagueFixturesPlayed(career) >= 27;
  if (!leagueDone) return false;

  const cup = career.challengeCup;
  if (!cup) return true;
  if (cup.tournamentComplete || cup.userEliminated) return true;

  return getPendingCupBracketRound(career) === null;
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
      merged.push({
        id: `cup-slot-${cupIdx}`,
        round: league[i]!.round,
        opponent: "TBC",
        isHome: true,
        competition: "challenge_cup",
        cupRound: slot.key,
        label: CUP_ROUND_LABELS[slot.key],
      });
      cupIdx++;
    }
  }
  return merged;
}

export function cupRoundKeyToBracketRound(key: CupRoundKey): number {
  return CUP_KEY_TO_BRACKET_ROUND[key];
}
