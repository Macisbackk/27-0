import type { MatchFixture } from "./season-simulation";

/**
 * Mid-season fork — Classic / Daily Challenge.
 *
 * The season sim pauses after round {@link HALFWAY_CALL_ROUND} — only while the side is still unbeaten — and the player
 * picks a plan for the run-in. Effects are deterministic for the same run seed
 * and choice: rounds 1–14 are untouched (each match has its own RNG stream), and
 * the chosen plan reshapes rounds 15–27 only.
 *
 *   rest  — Rest the stars: −1.5 rating rounds 15–18, +1.0 rounds 19–27 (net +3, same as push).
 *   push  — Push for the top two: +1.0 rating rounds 15–22, −1.0 rounds 23–27.
 *   chase — Chase the points difference: no rating change; wins score +4,
 *           losses concede +2 (points difference only — results never flip).
 *   none  — No call made (e.g. skipped straight to full time).
 */
export const HALFWAY_CALL_ROUND = 14;

export type HalfwayCallId = "rest" | "push" | "chase";
export type HalfwayCallChoice = HalfwayCallId | "none";

export interface HalfwayCallOption {
  id: HalfwayCallId;
  label: string;
  detail: string;
}

export const HALFWAY_CALL_OPTIONS: readonly HalfwayCallOption[] = [
  {
    id: "rest",
    label: "Rest the stars",
    detail: "−1.5 rating for rounds 15–18, then +1.0 for the run-in.",
  },
  {
    id: "push",
    label: "Push for the top two",
    detail: "+1.0 rating for rounds 15–22, then −1.0 as legs tire.",
  },
  {
    id: "chase",
    label: "Chase the points difference",
    detail: "Attack scores +4 in every win, but concedes +2 in every loss.",
  },
];

export const HALFWAY_CALL_LABELS: Record<HalfwayCallChoice, string> = {
  rest: "Rest the stars",
  push: "Push for the top two",
  chase: "Chase the points difference",
  none: "No change",
};

export function isHalfwayCallId(value: unknown): value is HalfwayCallId {
  return value === "rest" || value === "push" || value === "chase";
}

export function getHalfwayCallLabel(choice: HalfwayCallChoice | undefined): string {
  return HALFWAY_CALL_LABELS[choice ?? "none"];
}

/** Effective team-rating change for a round under the chosen plan. */
export function getHalfwayRatingDelta(
  choice: HalfwayCallChoice | undefined,
  round: number
): number {
  if (!choice || choice === "none" || round <= HALFWAY_CALL_ROUND) return 0;
  if (choice === "rest") return round <= 18 ? -1.5 : 1.0;
  if (choice === "push") return round <= 22 ? 1.0 : -1.0;
  return 0;
}

/**
 * "Chase the points difference": pad the attack after the fork. A win gets one
 * more unconverted try; a loss concedes one more penalty goal. Draws untouched,
 * and the result never changes.
 */
export function applyHalfwayScoreEffect(
  fixture: MatchFixture,
  choice: HalfwayCallChoice | undefined
): MatchFixture {
  if (choice !== "chase" || fixture.round <= HALFWAY_CALL_ROUND) return fixture;
  if (fixture.result === "W") {
    return {
      ...fixture,
      pointsFor: fixture.pointsFor + 4,
      triesFor: fixture.triesFor + 1,
      scoringFor: {
        ...fixture.scoringFor,
        tries: fixture.scoringFor.tries + 1,
        points: fixture.scoringFor.points + 4,
      },
    };
  }
  if (fixture.result === "L") {
    return {
      ...fixture,
      pointsAgainst: fixture.pointsAgainst + 2,
      scoringAgainst: {
        ...fixture.scoringAgainst,
        penalties: fixture.scoringAgainst.penalties + 1,
        points: fixture.scoringAgainst.points + 2,
      },
    };
  }
  return fixture;
}
