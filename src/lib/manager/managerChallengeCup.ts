import type {
  BracketMatch,
  ChallengeCupBracketState,
} from "../game/challenge-cup-bracket";
import {
  deriveCupOutcomeFromBracket,
  getActiveRound,
  getCupRoundLabel,
  getMatchById,
  getMatchesForRound,
  simulateBracketMatch,
} from "../game/challenge-cup-bracket";
import {
  createExpandedChallengeCupBracket,
  getExpandedCupRoundLabel,
  isExpandedChallengeCup,
  type CupSeedingStanding,
} from "./championship/championshipChallengeCup";
import type { MatchFixture } from "../game/season-simulation";
import { buildSquadSlotsFromMatchday } from "./managerSquad";
import type {
  CupRoundKey,
  ManagerCareer,
  ManagerScheduledFixture,
} from "./types";
import { CUP_ROUND_LABELS, MANAGER_SEASON_GAMES } from "./types";
import {
  getChallengeCupRoundLabel,
  isChallengeCupFinalRound,
} from "./challengeCupRounds";
import {
  needsPreSeasonFriendlies,
} from "./managerFriendlies";

/** Cup rounds unlock after N Super League games — expanded 6-round format. */
const CUP_TRIGGERS_LEAGUE_GAMES = [3, 7, 12, 17, 22, 26];
const CUP_KEY_TO_BRACKET_ROUND: Record<CupRoundKey, number> = {
  round_one: 1,
  round_two: 2,
  last_sixteen: 3,
  quarter_final: 4,
  semi_final: 5,
  final: 6,
};
const BRACKET_ROUND_TO_KEY: Record<number, CupRoundKey> = {
  1: "round_one",
  2: "round_two",
  3: "last_sixteen",
  4: "quarter_final",
  5: "semi_final",
  6: "final",
};

export function getCupBracketMaxRound(
  cup: ChallengeCupBracketState | undefined
): number {
  if (!cup?.matches?.length) return 4;
  return Math.max(4, ...cup.matches.map((m) => m.round));
}

/** Round label for manager cup UI (expanded 6-round or legacy 4-round). */
export function getManagerBracketRoundLabel(
  cup: ChallengeCupBracketState | undefined,
  round: number
): string {
  if (cup && isExpandedChallengeCup(cup)) {
    const key = BRACKET_ROUND_TO_KEY[round];
    if (key) return getChallengeCupRoundLabel(key);
    const short = getExpandedCupRoundLabel(round);
    return short.startsWith("Challenge Cup")
      ? short
      : `Challenge Cup ${short}`;
  }
  const legacy = getCupRoundLabel(round);
  if (/^final$/i.test(legacy)) return getChallengeCupRoundLabel("final");
  return legacy.startsWith("Challenge Cup")
    ? legacy
    : `Challenge Cup ${legacy}`;
}

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
    isChallengeCupFinalRound(fixture.cupRound)
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
  userClub: string,
  seedingInput?: {
    previousSeasonLeagueTable?: CupSeedingStanding[] | null;
    previousSeasonChampionshipTable?: CupSeedingStanding[] | null;
  }
): ChallengeCupBracketState {
  return createExpandedChallengeCupBracket(`${seed}-cup`, userClub, seedingInput);
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
  maxRound?: number,
  maxSteps = 64
): ChallengeCupBracketState {
  const roundCap =
    maxRound ?? getCupBracketMaxRound(bracket);
  let next = bracket;
  for (let step = 0; step < maxSteps; step++) {
    if (next.userEliminated || next.tournamentComplete) break;
    const aiReady = findReadyAiMatch(next);
    if (!aiReady || aiReady.round > roundCap) break;
    next = simulateBracketMatch(next, aiReady.id, squad);
  }
  return next;
}

function simulateAiUntilUserReady(
  bracket: ChallengeCupBracketState,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>
): ChallengeCupBracketState {
  const maxRound = getCupBracketMaxRound(bracket);
  const userMatch = getUserCupMatch(bracket);
  if (userMatch) {
    return simulateReadyAiCupMatches(bracket, squad, userMatch.round);
  }

  let next = bracket;
  for (let round = 1; round <= maxRound; round++) {
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
  const revived = reviveFilledUserEntryMatch(career.challengeCup);
  return simulateAiUntilUserReady(revived, squad);
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
      ? [
          preferredRound,
          ...Array.from({ length: getCupBracketMaxRound(bracket) }, (_, i) => i + 1),
        ].filter((round, index, all) => all.indexOf(round) === index)
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
  /*
   * An empty or unbuilt schedule is not a finished season. Hydration falls back
   * to `schedule: []`, so `currentFixtureIndex >= schedule.length` was 0 >= 0
   * and marked untouched careers as league-complete — which then awarded
   * League Leaders to whoever topped the all-zero table on the tie-break.
   */
  const scheduleExhausted =
    career.schedule.length > 0 &&
    career.currentFixtureIndex >= career.schedule.length;
  const leagueDone =
    leaguePlayed >= MANAGER_SEASON_GAMES ||
    (scheduleExhausted && leaguePlayed > 0);
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
  // Active cup window without a ready user tie yet — do not schedule a league
  // match over the Challenge Cup (Hub still shows the compact bracket).
  if (
    cupResolved.pendingRound !== null &&
    !cupResolved.career.challengeCup?.userEliminated &&
    !cupResolved.career.challengeCup?.tournamentComplete
  ) {
    return null;
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
      return `Challenge Cup: ${getManagerBracketRoundLabel(prepared, match.round)} vs ${match.opponent}`;
    }
  }

  const active = getActiveRound(cup);
  return `Challenge Cup: ${getManagerBracketRoundLabel(cup, active)}`;
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
  const maxRound = getCupBracketMaxRound(bracket);
  const userWonFinal = match.round === maxRound && fixture.result === "W";

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
    { afterIndex: 2, key: "round_one" },
    { afterIndex: 6, key: "round_two" },
    { afterIndex: 11, key: "last_sixteen" },
    { afterIndex: 16, key: "quarter_final" },
    { afterIndex: 21, key: "semi_final" },
    { afterIndex: 25, key: "final" },
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
  const maxRound = getCupBracketMaxRound(cup);
  if (cup.userEliminated || cup.tournamentComplete) return maxRound;

  // Bye clubs enter after the calendar trigger round (e.g. pending=1, first
  // user tie in round 2). Clip/display must include that entry round or
  // ensureCupBracketReady demotes a prepared ready tie back to pending and
  // Sim-to-Date / Matchday get stuck with no fixture.
  const userEntryRound = cup.matches
    .filter((m) => m.isUserMatch && m.status !== "complete")
    .sort((a, b) => a.round - b.round)[0]?.round;

  const pending = getPendingCupBracketRound(career);
  if (pending !== null) {
    return Math.min(
      maxRound,
      Math.max(pending, userEntryRound ?? pending)
    );
  }

  const cupPlayed = countCupFixturesPlayed(career);
  if (cupPlayed === 0) {
    return Math.min(maxRound, userEntryRound ?? 1);
  }
  return Math.min(maxRound, Math.max(cupPlayed + 1, userEntryRound ?? 0));
}

/** Re-ready a bye-entry user tie that still has both teams after a bad clip. */
function reviveFilledUserEntryMatch(
  bracket: ChallengeCupBracketState
): ChallengeCupBracketState {
  const entry = bracket.matches
    .filter((m) => m.isUserMatch && m.status !== "complete")
    .sort((a, b) => a.round - b.round)[0];
  if (!entry || entry.status !== "pending") return bracket;
  if (!entry.homeTeam || !entry.awayTeam) return bracket;
  return {
    ...bracket,
    matches: bracket.matches.map((m) =>
      m.id === entry.id ? { ...m, status: "ready" as const } : m
    ),
  };
}

/** Whether Hub should show the Challenge Cup bracket instead of the league table. */
export function shouldShowChallengeCupBracketOnHub(
  career: ManagerCareer,
  nextFixture: ManagerScheduledFixture | null
): boolean {
  if (!career.challengeCup?.matches?.length) return false;

  // Eliminated / tournament done: never keep the Hub on the cup bracket for
  // later AI-only rounds.
  if (
    career.challengeCup.userEliminated ||
    career.challengeCup.tournamentComplete
  ) {
    return false;
  }

  // User's next match is a Challenge Cup tie — show the compact bracket.
  if (nextFixture?.competition === "challenge_cup") return true;

  // Cup week is unlocked (pending round) even if the user tie is still preparing.
  // Do NOT fall back to the league table during an active cup window.
  const pending = getPendingCupBracketRound(career);
  if (pending !== null) return true;

  // Just finished a cup tie — keep the bracket visible until week advance.
  const last =
    career.lastMatchFixture ??
    career.fixtures[career.fixtures.length - 1] ??
    null;
  return (
    career.matchWeekPhase === "awaiting_advance" &&
    last?.competition === "challenge_cup"
  );
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
