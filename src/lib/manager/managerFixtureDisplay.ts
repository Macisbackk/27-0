import type {
  CupRoundKey,
  ManagerCompetition,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "./types";
import { CUP_ROUND_LABELS } from "./types";

export function isChallengeCupFixture(
  competition?: ManagerCompetition
): boolean {
  return competition === "challenge_cup";
}

export function getManagerCupRoundLabel(cupRound?: CupRoundKey): string {
  if (!cupRound) return "Challenge Cup";
  return CUP_ROUND_LABELS[cupRound] ?? "Challenge Cup";
}

export function getManagerCompetitionLabel(
  competition: ManagerCompetition,
  cupRound?: CupRoundKey
): string {
  if (competition === "challenge_cup") {
    return getManagerCupRoundLabel(cupRound);
  }
  if (competition === "playoffs") return "Play-Offs";
  if (competition === "friendly") return "Friendly";
  return "League";
}

export function getManagerScheduledFixtureHeadline(
  sched: Pick<
    ManagerScheduledFixture,
    "competition" | "cupRound" | "label" | "round"
  >
): string {
  if (sched.competition === "challenge_cup") {
    return sched.label ?? getManagerCupRoundLabel(sched.cupRound);
  }
  if (sched.label) return sched.label;
  if (sched.competition === "playoffs") return "Play-Offs";
  if (sched.competition === "friendly") return "Friendly";
  return `Round ${sched.round} — League`;
}

/** Label for a completed manager fixture row. */
export function getManagerPlayedFixtureLabel(
  fixture: Pick<
    ManagerFixtureRecord,
    "competition" | "round" | "meta"
  >
): string {
  if (fixture.competition === "challenge_cup") {
    return getManagerCupRoundLabel(fixture.meta?.cupRound);
  }
  if (fixture.competition === "playoffs") return "Play-Offs";
  if (fixture.competition === "friendly") return "Friendly";
  return `Round ${fixture.round} — League`;
}
