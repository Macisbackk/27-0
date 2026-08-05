import type {
  CupRoundKey,
  ManagerCareer,
  ManagerCompetition,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "./types";
import { getChallengeCupRoundLabel } from "./challengeCupRounds";
import { isMagicWeekendFixture } from "./managerMagicWeekend";
import { isChallengeCupFinalFixture } from "./managerChallengeCup";

/** Canonical competition names — use only when cross-tier context requires them. */
export const MANAGER_COMPETITION_NAMES = {
  superLeague: "Super League",
  championship: "Championship",
} as const;

/**
 * When Manager Mode is Super League–centric, omit repeated competition names.
 * Use `cross-tier` when SL and Championship must be distinguished (e.g. Across the League).
 */
export type ManagerCompetitionLabelContext =
  | "default"
  | "manager-primary"
  | "cross-tier";

export type ManagerCompetitionLabelOptions = {
  context?: ManagerCompetitionLabelContext;
  cupRound?: CupRoundKey;
};

export function isChallengeCupFixture(
  competition?: ManagerCompetition
): boolean {
  return competition === "challenge_cup";
}

export function getManagerCupRoundLabel(cupRound?: CupRoundKey): string {
  return getChallengeCupRoundLabel(cupRound);
}

/** Short competition name, or null when context already implies it (e.g. league in Manager Hub). */
export function getManagerCompetitionName(
  competition: ManagerCompetition,
  options: ManagerCompetitionLabelOptions = {}
): string | null {
  const context = options.context ?? "default";

  if (competition === "challenge_cup") {
    return getManagerCupRoundLabel(options.cupRound);
  }
  if (competition === "playoffs") return "Play-Offs";
  if (competition === "friendly") return "Friendly";
  if (competition === "world_club_challenge") return "WCC";
  if (competition === "league") {
    if (context === "cross-tier") return MANAGER_COMPETITION_NAMES.superLeague;
    if (context === "manager-primary") return null;
    return "League";
  }
  return "League";
}

export function getManagerCompetitionLabel(
  competition: ManagerCompetition,
  cupRound?: CupRoundKey,
  context: ManagerCompetitionLabelContext = "default"
): string {
  const name = getManagerCompetitionName(competition, { context, cupRound });
  if (name) return name;
  return "League";
}

/** League round label — drops trailing "— League" when SL context is already clear. */
export function getManagerLeagueRoundLabel(
  round: number,
  context: ManagerCompetitionLabelContext = "default"
): string {
  if (context === "manager-primary" || context === "default") {
    return `Round ${round}`;
  }
  return `Round ${round} — League`;
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
  >,
  context: ManagerCompetitionLabelContext = "manager-primary"
): string {
  if (sched.competition === "challenge_cup") {
    if (isChallengeCupFinalFixture(sched)) {
      return getManagerCupRoundLabel("final");
    }
    return sched.label && !/final/i.test(sched.label)
      ? sched.label
      : getManagerCupRoundLabel(sched.cupRound);
  }
  if (isMagicWeekendFixture(sched)) {
    return sched.label ?? "Magic Weekend";
  }
  if (sched.label) return sched.label;
  if (sched.competition === "playoffs") return "Play-Offs";
  if (sched.competition === "friendly") return "Friendly";
  if (sched.competition === "world_club_challenge") {
    return "WCC";
  }
  return getManagerLeagueRoundLabel(sched.round, context);
}

/** Label for a completed manager fixture row. */
export function getManagerPlayedFixtureLabel(
  fixture: Pick<
    ManagerFixtureRecord,
    "competition" | "round" | "meta" | "isNeutral"
  >,
  context: ManagerCompetitionLabelContext = "manager-primary"
): string {
  if (fixture.competition === "challenge_cup") {
    return getManagerCupRoundLabel(fixture.meta?.cupRound);
  }
  if (fixture.competition === "playoffs") return "Play-Offs";
  if (fixture.competition === "friendly") return "Friendly";
  if (fixture.competition === "world_club_challenge") {
    return "WCC";
  }
  if (fixture.competition === "league" && fixture.isNeutral) return "Magic Weekend";
  return getManagerLeagueRoundLabel(fixture.round, context);
}

/** Section header for fixture lists (e.g. "League fixtures (12)"). */
export function getManagerFixtureSectionLabel(
  competition: ManagerCompetition,
  count: number,
  context: ManagerCompetitionLabelContext = "manager-primary"
): string {
  if (competition === "challenge_cup") {
    return `Challenge Cup (${count})`;
  }
  if (competition === "playoffs") {
    return `Play-offs (${count})`;
  }
  if (competition === "friendly") {
    return `Friendlies (${count})`;
  }
  if (competition === "world_club_challenge") {
    return `WCC (${count})`;
  }
  if (context === "cross-tier") {
    return `${MANAGER_COMPETITION_NAMES.superLeague} fixtures (${count})`;
  }
  return `League fixtures (${count})`;
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
