import type {
  BracketMatch,
  ChallengeCupBracketState,
} from "../game/challenge-cup-bracket";
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

export const CHALLENGE_CUP_FINAL_VENUE = "Wembley Stadium";
export const CHALLENGE_CUP_FINAL_ATTENDANCE_MIN = 72_000;
export const CHALLENGE_CUP_FINAL_ATTENDANCE_MAX = 85_000;

export function isChallengeCupFinalFixture(
  fixture: Pick<
    ManagerScheduledFixture,
    "competition" | "cupRound" | "isNeutral"
  >
): boolean {
  return (
    fixture.competition === "challenge_cup" &&
    (fixture.cupRound === "final" || fixture.isNeutral === true)
  );
}

function decorateCupFinalNeutral<
  T extends {
    opponent: string;
    label?: string;
    isHome?: boolean;
  },
>(
  fixture: T,
  bracketHome: string,
  bracketAway: string
): T & {
  isHome: false;
  isNeutral: true;
  venue: string;
  listedHome: string;
  listedAway: string;
  label: string;
} {
  return {
    ...fixture,
    isHome: false,
    isNeutral: true,
    venue: CHALLENGE_CUP_FINAL_VENUE,
    listedHome: bracketHome,
    listedAway: bracketAway,
    label: `Challenge Cup Final at ${CHALLENGE_CUP_FINAL_VENUE}`,
  };
}

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

function cupBracketSnapshotsEqual(
  a: ChallengeCupBracketState,
  b: ChallengeCupBracketState
): boolean {
  if (
    a.userEliminated !== b.userEliminated ||
    a.tournamentComplete !== b.tournamentComplete ||
    a.userWon !== b.userWon ||
    a.matches.length !== b.matches.length
  ) {
    return false;
  }

  return a.matches.every((match, index) => {
    const other = b.matches[index]!;
    return (
      match.id === other.id &&
      match.status === other.status &&
      match.homeTeam === other.homeTeam &&
      match.awayTeam === other.awayTeam &&
      match.homeScore === other.homeScore &&
      match.awayScore === other.awayScore &&
      match.winner === other.winner &&
      match.loser === other.loser
    );
  });
}

export function ensureCupBracketReady(career: ManagerCareer): ManagerCareer {
  const pending = getPendingCupBracketRound(career);
  const cup = career.challengeCup;
  if (pending === null || !cup) return career;

  const snapshotBefore = clipCupBracketToUserProgress(career);
  const prepared = prepareCupRound(career);
  const clipped = clipCupBracketToUserProgress({
    ...career,
    challengeCup: prepared,
  });

  if (
    cupBracketSnapshotsEqual(snapshotBefore, clipped) &&
    cupBracketSnapshotsEqual(cup, clipped)
  ) {
    return career;
  }

  return { ...career, challengeCup: clipped };
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

function findReadyAiMatch(
  bracket: ChallengeCupBracketState
): BracketMatch | undefined {
  return bracket.matches
    .filter((m) => m.status === "ready" && !m.isUserMatch)
    .sort((a, b) => a.round - b.round || a.slot - b.slot)[0];
}

/** Simulate ready AI ties up to `maxRound` (inclusive). */
function simulateReadyAiCupMatches(
  bracket: ChallengeCupBracketState,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>,
  maxRound = 4,
  maxSteps = 48
): ChallengeCupBracketState {
  let next = bracket;
  for (let step = 0; step < maxSteps; step++) {
    if (next.userEliminated || next.tournamentComplete) break;
    const aiReady = findReadyAiMatch(next);
    if (!aiReady || aiReady.round > maxRound) break;
    next = simulateBracketMatch(next, aiReady.id, squad);
  }
  return next;
}

function simulateAiUntilUserReady(
  bracket: ChallengeCupBracketState,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>
): ChallengeCupBracketState {
  const userMatch = getUserCupMatch(bracket);
  if (userMatch) {
    return simulateReadyAiCupMatches(bracket, squad, userMatch.round);
  }

  let next = bracket;
  for (let round = 1; round <= 4; round++) {
    next = simulateReadyAiCupMatches(next, squad, round);
    if (getUserCupMatch(next)) return next;
    if (next.userEliminated || next.tournamentComplete) return next;
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
    career.xiiiSlotPositions,
    career
  );
  return simulateAiUntilUserReady(career.challengeCup, squad);
}

/** After the user plays a cup tie, resolve other ready AI games so the bracket can progress. */
export function advanceCupBracketAfterUserMatch(
  career: ManagerCareer
): ChallengeCupBracketState {
  const cup = career.challengeCup;
  if (!cup || cup.userEliminated || cup.tournamentComplete) return cup;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  return simulateAiUntilUserReady(cup, squad);
}

/** Repair cup bracket flags or empty bracket from saved cup fixtures. */
export function reconcileChallengeCupFromFixtures(
  career: ManagerCareer
): ChallengeCupBracketState {
  const cupPlayed = countCupFixturesPlayed(career);
  let cup =
    career.challengeCup?.matches?.length
      ? career.challengeCup
      : createManagerChallengeCup(career.seed, career.club);

  const cupFixtures = career.fixtures.filter(
    (f) => f.competition === "challenge_cup"
  );

  if (!career.challengeCup?.matches?.length && cupFixtures.length > 0) {
    cup = createManagerChallengeCup(career.seed, career.club);
    let working = { ...career, challengeCup: cup };
    for (const fixture of cupFixtures) {
      const cupKey = fixture.meta?.cupRound;
      if (!cupKey) continue;
      const bracketRound = cupRoundKeyToBracketRound(cupKey);
      const match = cup.matches.find(
        (m) => m.isUserMatch && m.round === bracketRound
      );
      if (!match) continue;
      const updated = applyCupMatchToBracket(working, match.id, fixture);
      if (updated) {
        cup = updated;
        working = { ...working, challengeCup: cup };
      }
    }
  }

  cup = syncCupOutcomeFlagsFromFixtures(cup, cupFixtures);

  return clipCupBracketToUserProgress({ ...career, challengeCup: cup });
}

function syncCupOutcomeFlagsFromFixtures(
  cup: ChallengeCupBracketState,
  cupFixtures: ManagerCareer["fixtures"]
): ChallengeCupBracketState {
  if (cupFixtures.length === 0) return cup;

  let next = cup;
  if (cupFixtures.some((f) => f.result === "L") && !next.userEliminated) {
    next = {
      ...next,
      userEliminated: true,
      tournamentComplete: true,
    };
  }

  if (
    cupFixtures.length >= CUP_TRIGGERS_LEAGUE_GAMES.length &&
    !next.tournamentComplete &&
    !next.userEliminated
  ) {
    const last = cupFixtures[cupFixtures.length - 1]!;
    const wonFinal =
      last.result === "W" && last.meta?.cupRound === "final";
    next = {
      ...next,
      tournamentComplete: true,
      userEliminated: last.result === "L",
      userWon: wonFinal,
    };
  }

  return next;
}

/** Prepare cup bracket and locate the user's next tie, simulating AI if needed. */
export function resolveCupBracketForScheduling(career: ManagerCareer): {
  career: ManagerCareer;
  pendingRound: number | null;
  userMatch: ReturnType<typeof getUserCupMatch>;
} {
  const challengeCup = reconcileChallengeCupFromFixtures(career);
  const synced = { ...career, challengeCup };
  const pendingRound = getPendingCupBracketRound(synced);
  if (pendingRound === null) {
    return { career: synced, pendingRound: null, userMatch: null };
  }

  let prepared = prepareCupRound(synced);
  let userMatch = getUserCupMatch(prepared, pendingRound);
  if (
    !userMatch &&
    !prepared.userEliminated &&
    !prepared.tournamentComplete
  ) {
    const squad = buildSquadSlotsFromMatchday(
      career.matchdayXiii,
      career.xiiiSlotPositions,
      career
    );
    prepared = simulateAiUntilUserReady(prepared, squad);
    userMatch = getUserCupMatch(prepared, pendingRound);
  }

  return {
    career: { ...synced, challengeCup: prepared },
    pendingRound,
    userMatch,
  };
}

export function getUserCupMatch(
  bracket: ChallengeCupBracketState,
  preferredRound?: number
): { matchId: string; opponent: string; isHome: boolean; round: number; bracketHome: string; bracketAway: string } | null {
  if (bracket.userEliminated || bracket.tournamentComplete) return null;

  const roundsToSearch =
    preferredRound !== undefined
      ? [preferredRound, 1, 2, 3, 4].filter(
          (round, index, all) => all.indexOf(round) === index
        )
      : [getActiveRound(bracket)];

  for (const round of roundsToSearch) {
    const match = getMatchesForRound(bracket, round).find(
      (m) => m.isUserMatch && m.status === "ready"
    );
    if (!match || !match.homeTeam || !match.awayTeam) continue;
    const isHome = match.homeTeam === bracket.userClub;
    const opponent = isHome ? match.awayTeam : match.homeTeam;
    return {
      matchId: match.id,
      opponent,
      isHome,
      round,
      bracketHome: match.homeTeam,
      bracketAway: match.awayTeam,
    };
  }
  return null;
}

export function buildCupScheduledFixture(
  career: ManagerCareer,
  cupMatch: NonNullable<ReturnType<typeof getUserCupMatch>>
): ManagerScheduledFixture {
  const cupKey = BRACKET_ROUND_TO_KEY[cupMatch.round] ?? "round_one";
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const base = {
    id: `cup-${cupMatch.matchId}`,
    round: leaguePlayed + 1,
    opponent: cupMatch.opponent,
    competition: "challenge_cup" as const,
    cupRound: cupKey,
    cupMatchId: cupMatch.matchId,
  };

  if (cupKey === "final") {
    return decorateCupFinalNeutral(
      base,
      cupMatch.bracketHome,
      cupMatch.bracketAway
    );
  }

  return {
    ...base,
    isHome: cupMatch.isHome,
    label: CUP_ROUND_LABELS[cupKey],
  };
}

export function isLeagueAndCupPhaseComplete(career: ManagerCareer): boolean {
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const leagueDone =
    leaguePlayed >= 27 ||
    career.currentFixtureIndex >= career.schedule.length;
  if (!leagueDone) return false;

  if (!career.challengeCup) return true;

  const { pendingRound, userMatch, career: cupCareer } =
    resolveCupBracketForScheduling(career);
  const prepared = cupCareer.challengeCup;
  if (!prepared) return true;

  if (prepared.tournamentComplete || prepared.userEliminated) return true;

  if (pendingRound === null) {
    return countCupFixturesPlayed(career) >= CUP_TRIGGERS_LEAGUE_GAMES.length;
  }

  if (userMatch) return false;
  if (prepared.userEliminated || prepared.tournamentComplete) return true;

  if (countCupFixturesPlayed(career) >= CUP_TRIGGERS_LEAGUE_GAMES.length) {
    return true;
  }

  return career.fixtures.some(
    (f) => f.competition === "challenge_cup" && f.result === "L"
  );
}

export function getNextLeagueOrCupFixture(
  career: ManagerCareer
): ManagerScheduledFixture | null {
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

  const cupResolved = resolveCupBracketForScheduling(career);
  if (cupResolved.pendingRound !== null && cupResolved.userMatch) {
    return buildCupScheduledFixture(
      cupResolved.career,
      cupResolved.userMatch
    );
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

export function shouldShowChallengeCupCelebration(
  career: ManagerCareer
): boolean {
  if (career.challengeCupCelebrationShown) return false;
  const cup = career.challengeCup;
  if (!cup) return false;
  return cup.userWon || deriveCupOutcomeFromBracket(cup).isWinner;
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
      return `Challenge Cup: ${getCupRoundLabel(match.round)} vs ${match.opponent}`;
    }
  }

  const active = getActiveRound(cup);
  return `Challenge Cup: ${getCupRoundLabel(active)}`;
}

export function isCupMatchReadyForResult(
  career: ManagerCareer,
  cupMatchId: string
): boolean {
  const bracket = career.challengeCup;
  if (!bracket) return false;
  const match = getMatchById(bracket, cupMatchId);
  return !!(
    match &&
    match.status === "ready" &&
    match.homeTeam &&
    match.awayTeam
  );
}

export function applyCupMatchToBracket(
  career: ManagerCareer,
  cupMatchId: string,
  fixture: MatchFixture
): ChallengeCupBracketState | null {
  const bracket = career.challengeCup;
  const match = getMatchById(bracket, cupMatchId);
  if (!match || match.status !== "ready" || !match.homeTeam || !match.awayTeam) {
    return null;
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
    const base = {
      id: played.fixtureId ?? `cup-played-${cupKey}`,
      round: played.round,
      opponent: played.opponent,
      competition: "challenge_cup" as const,
      cupRound: cupKey,
      label: `${CUP_ROUND_LABELS[cupKey]} vs ${played.opponent}`,
    };
    if (cupKey === "final") {
      const bracketHome = played.isHome ? career.club : played.opponent;
      const bracketAway = played.isHome ? played.opponent : career.club;
      return decorateCupFinalNeutral(base, bracketHome, bracketAway);
    }
    return { ...base, isHome: played.isHome };
  }

  const bracketRound = CUP_KEY_TO_BRACKET_ROUND[cupKey];
  const pending = getPendingCupBracketRound(career);
  if (pending === bracketRound) {
    const prepared = prepareCupRound(career);
    const match = getUserCupMatch(prepared, pending);
    if (match) {
      const base = {
        id: `cup-${match.matchId}`,
        round,
        opponent: match.opponent,
        competition: "challenge_cup" as const,
        cupRound: cupKey,
        cupMatchId: match.matchId,
        label: `${CUP_ROUND_LABELS[cupKey]} vs ${match.opponent}`,
      };
      if (cupKey === "final") {
        return decorateCupFinalNeutral(
          base,
          match.bracketHome,
          match.bracketAway
        );
      }
      return { ...base, isHome: match.isHome };
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
    const base = {
      id: `cup-slot-${cupKey}`,
      round,
      opponent,
      competition: "challenge_cup" as const,
      cupRound: cupKey,
      cupMatchId: cupMatch.id,
      label: `${CUP_ROUND_LABELS[cupKey]} vs ${opponent}`,
    };
    if (cupKey === "final") {
      return decorateCupFinalNeutral(
        base,
        cupMatch.homeTeam,
        cupMatch.awayTeam
      );
    }
    return { ...base, isHome };
  }

  const tbcBase = {
    id: `cup-slot-${cupKey}`,
    round,
    opponent: "TBC",
    competition: "challenge_cup" as const,
    cupRound: cupKey,
    label: CUP_ROUND_LABELS[cupKey],
  };
  if (cupKey === "final") {
    return {
      ...tbcBase,
      isHome: false,
      isNeutral: true,
      venue: CHALLENGE_CUP_FINAL_VENUE,
      label: `Challenge Cup Final at ${CHALLENGE_CUP_FINAL_VENUE}`,
    };
  }
  return { ...tbcBase, isHome: true };
}

export function cupRoundKeyToBracketRound(key: CupRoundKey): number {
  return CUP_KEY_TO_BRACKET_ROUND[key];
}

/** Furthest cup round the user has reached — used to hide later-round AI results. */
export function getCupBracketDisplayRound(career: ManagerCareer): number {
  const cup = career.challengeCup;
  if (!cup) return 1;
  if (cup.userEliminated || cup.tournamentComplete) return 4;

  const pending = getPendingCupBracketRound(career);
  if (pending !== null) return pending;

  const cupPlayed = countCupFixturesPlayed(career);
  if (cupPlayed === 0) return 1;
  return Math.min(4, cupPlayed + 1);
}

/** Bracket view for UI — hides results from rounds the user has not reached. */
export function getCupBracketForDisplay(
  career: ManagerCareer
): ChallengeCupBracketState | undefined {
  const cup = career.challengeCup;
  if (!cup) return undefined;
  return snapshotCupBracketAtRound(cup, getCupBracketDisplayRound(career));
}

/** Repair over-simulated AI results ahead of the user's current cup round. */
export function clipCupBracketToUserProgress(
  career: ManagerCareer
): ChallengeCupBracketState {
  const cup =
    career.challengeCup?.matches?.length
      ? career.challengeCup
      : createManagerChallengeCup(career.seed, career.club);
  return snapshotCupBracketAtRound(cup, getCupBracketDisplayRound(career));
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
