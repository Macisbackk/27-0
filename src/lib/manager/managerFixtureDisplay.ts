import type {
  CupRoundKey,
  ManagerCareer,
  ManagerCompetition,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "./types";
import { CUP_ROUND_LABELS } from "./types";
import { isMagicWeekendFixture } from "./managerMagicWeekend";
import { isChallengeCupFinalFixture } from "./managerChallengeCup";

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

export function getManagerScheduledFixtureVenueLabel(
  sched: Pick<ManagerScheduledFixture, "isHome" | "isNeutral" | "venue">
): string {
  if (sched.isNeutral && sched.venue) return `Neutral · ${sched.venue}`;
  if (sched.isNeutral) return "Neutral";
  return sched.isHome ? "Home" : "Away";
}

export function getManagerScheduledFixtureHeadline(
  sched: Pick<
    ManagerScheduledFixture,
    "competition" | "cupRound" | "label" | "round"
  >
): string {
  if (sched.competition === "challenge_cup") {
    if (isChallengeCupFinalFixture(sched)) {
      return sched.label ?? "Challenge Cup Final";
    }
    return sched.label ?? getManagerCupRoundLabel(sched.cupRound);
  }
  if (isMagicWeekendFixture(sched)) {
    return sched.label ?? "Magic Weekend";
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
    "competition" | "round" | "meta" | "isNeutral"
  >
): string {
  if (fixture.competition === "challenge_cup") {
    return getManagerCupRoundLabel(fixture.meta?.cupRound);
  }
  if (fixture.competition === "playoffs") return "Play-Offs";
  if (fixture.competition === "friendly") return "Friendly";
  if (fixture.competition === "league" && fixture.isNeutral) return "Magic Weekend";
  return `Round ${fixture.round} — League`;
}

/** Stable id for match-review / inbox links (includes competition when possible). */
export function managerFixtureDisplayId(
  fixture: Pick<ManagerFixtureRecord, "fixtureId" | "round" | "competition">
): string {
  if (fixture.fixtureId) return fixture.fixtureId;
  const competition = fixture.competition ?? "league";
  return `round-${fixture.round}-${competition}`;
}

/** Resolve a played fixture record from a review link id. */
export function resolveManagerFixtureRecord(
  career: ManagerCareer,
  fixtureId: string
): ManagerFixtureRecord | undefined {
  const byId = career.fixtures.find((f) => f.fixtureId === fixtureId);
  if (byId) return byId;

  const last = career.lastMatchFixture;
  if (
    last &&
    (last.fixtureId === fixtureId ||
      managerFixtureDisplayId(last) === fixtureId ||
      `round-${last.round}` === fixtureId)
  ) {
    return last;
  }

  const legacyRound = fixtureId.match(/^round-(\d+)(?:-(.+))?$/);
  if (legacyRound) {
    const round = Number(legacyRound[1]);
    const competition = legacyRound[2];
    const roundMatches = career.fixtures.filter((f) => f.round === round);
    if (competition) {
      const match = roundMatches.find(
        (f) => (f.competition ?? "league") === competition
      );
      if (match) return match;
    }
    if (roundMatches.length === 1) return roundMatches[0];
  }

  return undefined;
}
