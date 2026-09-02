/**
 * Authoritative Manager Mode interactive tutorial state machine.
 * Persisted on the career — not localStorage.
 */
import type { ManagerCareer, ManagerView } from "./types";
import { canAdvanceMatchWeek } from "./managerMatchWeek";
import { dismissManagerOnboarding } from "./managerOnboarding";

export type ManagerTutorialStatus =
  | "not_started"
  | "active"
  | "completed"
  | "skipped";

export type ManagerTutorialStepId =
  | "welcome"
  | "hub"
  | "season-progress"
  | "fixture"
  | "squad"
  | "reserves"
  | "contracts"
  | "transfers"
  | "fixtures"
  | "stats"
  | "cup"
  | "playoffs"
  | "finish";

export type ManagerTutorialTargetId =
  | "manager-hub-root"
  | "manager-hub-season-progress"
  | "manager-hub-advance-week"
  | "manager-hub-next-fixture"
  | "manager-hub-play-game"
  | "manager-hub-simulate"
  | "manager-hub-challenge-cup"
  | "manager-nav-hub"
  | "manager-nav-squad"
  | "manager-nav-reserves"
  | "manager-nav-contracts"
  | "manager-nav-transfers"
  | "manager-nav-fixtures"
  | "manager-nav-stats"
  | "manager-nav-more"
  | "manager-section-squad"
  | "manager-section-reserves"
  | "manager-section-contracts"
  | "manager-section-transfers"
  | "manager-section-fixtures"
  | "manager-section-stats"
  | "manager-section-challenge-cup";

export interface ManagerTutorialStepDef {
  id: ManagerTutorialStepId;
  title: string;
  body: string;
  /** Optional secondary line (e.g. flow hint). */
  hint?: string;
  /** Navigate here when entering the step. */
  view?: ManagerView;
  /** Spotlight target(s). First existing element is used. */
  targets?: ManagerTutorialTargetId[];
  /** Primary CTA when not waiting on a UI action. */
  nextLabel?: string;
  /** Wait for the user to press the highlighted control. */
  requireAction?: boolean;
  /** Action id matched by ManagerSectionClient / overlay. */
  action?: "advance-week";
}

export const MANAGER_TUTORIAL_STEPS: readonly ManagerTutorialStepDef[] = [
  {
    id: "welcome",
    title: "Welcome to Manager Mode",
    body: "You are now managing your club. Build your squad, manage fixtures, make transfers and guide your team through the season.",
    nextLabel: "Next",
  },
  {
    id: "hub",
    title: "Club Hub",
    body: "This is your main hub. Use it to see what is happening at your club and what needs your attention.",
    view: "hub",
    targets: [
      "manager-hub-next-fixture",
      "manager-hub-season-progress",
      "manager-hub-root",
      "manager-nav-hub",
    ],
    nextLabel: "Next",
  },
  {
    id: "season-progress",
    title: "Season Progress",
    body: "Advance the week when there is no match to play — that moves your season forward.",
    hint: "Tap Advance Week to continue.",
    view: "hub",
    targets: ["manager-hub-advance-week", "manager-hub-season-progress"],
    nextLabel: "Next",
    requireAction: true,
    action: "advance-week",
  },
  {
    id: "fixture",
    title: "Next Fixture",
    body: "Your next match appears here. Play or simulate from this card when a fixture is due.",
    view: "hub",
    targets: [
      "manager-hub-next-fixture",
      "manager-hub-play-game",
      "manager-hub-simulate",
    ],
    nextLabel: "Next",
  },
  {
    id: "squad",
    title: "Squad",
    body: "Manage your first-team squad here. Check player ratings, contracts and squad roles.",
    view: "squad",
    targets: ["manager-section-squad", "manager-nav-squad"],
    nextLabel: "Next",
  },
  {
    id: "reserves",
    title: "Reserves",
    body: "Your reserve squad is where you develop younger and fringe players. Promote players, offer full-time contracts and call players up for matches.",
    view: "reserves",
    targets: ["manager-section-reserves", "manager-nav-reserves"],
    nextLabel: "Next",
  },
  {
    id: "contracts",
    title: "Contracts",
    body: "Keep an eye on player contracts so important players don't leave without you noticing.",
    view: "contracts",
    targets: ["manager-section-contracts", "manager-nav-contracts"],
    nextLabel: "Next",
  },
  {
    id: "transfers",
    title: "Transfers",
    body: "Use the transfer market to strengthen your squad. Sign players permanently or arrange loans where eligible.",
    hint: "Transfers → find a player → Make offer → Confirm",
    view: "transfers",
    targets: ["manager-section-transfers", "manager-nav-transfers"],
    nextLabel: "Next",
  },
  {
    id: "fixtures",
    title: "Fixtures",
    body: "This is where you can see your upcoming schedule, including league and cup matches.",
    view: "fixtures",
    targets: [
      "manager-section-fixtures",
      "manager-nav-fixtures",
      "manager-nav-more",
    ],
    nextLabel: "Next",
  },
  {
    id: "stats",
    title: "Stats",
    body: "Track your players and team throughout the season.",
    view: "stats",
    targets: ["manager-section-stats", "manager-nav-stats", "manager-nav-more"],
    nextLabel: "Next",
  },
  {
    id: "cup",
    title: "Challenge Cup",
    body: "Cup ties are separate from the league — another route to silverware when your club is involved.",
    view: "fixtures",
    targets: [
      "manager-section-challenge-cup",
      "manager-hub-challenge-cup",
      "manager-section-fixtures",
      "manager-nav-fixtures",
      "manager-nav-more",
    ],
    nextLabel: "Next",
  },
  {
    id: "playoffs",
    title: "Season & playoffs",
    body: "League position decides playoffs, the Million Pound Game, promotion or relegation.",
    view: "hub",
    targets: [
      "manager-hub-season-progress",
      "manager-hub-next-fixture",
      "manager-hub-root",
    ],
    nextLabel: "Next",
  },
  {
    id: "finish",
    title: "You're ready to manage",
    body: "Watch squad, fixtures and transfers — build your club into a Super League champion.",
    nextLabel: "Start Managing",
  },
] as const;

const STEP_INDEX = Object.fromEntries(
  MANAGER_TUTORIAL_STEPS.map((step, index) => [step.id, index])
) as Record<ManagerTutorialStepId, number>;

export function getManagerTutorialStepDef(
  stepId: ManagerTutorialStepId | null | undefined
): ManagerTutorialStepDef | null {
  if (!stepId) return null;
  return MANAGER_TUTORIAL_STEPS.find((s) => s.id === stepId) ?? null;
}

export function isManagerTutorialActive(
  career: Pick<ManagerCareer, "tutorialStatus"> | null | undefined
): boolean {
  return career?.tutorialStatus === "active";
}

export function shouldOfferManagerTutorialChoice(
  career: Pick<ManagerCareer, "tutorialStatus"> | null | undefined
): boolean {
  return career?.tutorialStatus === "not_started";
}

/** Existing saves without a field are treated as already finished. */
export function normalizeManagerTutorialState(
  career: ManagerCareer
): ManagerCareer {
  if (career.tutorialStatus != null) {
    if (
      career.tutorialStatus === "active" &&
      !getManagerTutorialStepDef(career.tutorialStep)
    ) {
      return { ...career, tutorialStep: "welcome" };
    }
    return career;
  }
  return {
    ...career,
    tutorialStatus: "completed",
    tutorialStep: undefined,
  };
}

export function startManagerTutorial(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    tutorialStatus: "active",
    tutorialStep: "welcome",
  };
}

export function skipManagerTutorial(career: ManagerCareer): ManagerCareer {
  try {
    dismissManagerOnboarding();
  } catch {
    /* ignore */
  }
  return {
    ...career,
    tutorialStatus: "skipped",
    tutorialStep: undefined,
  };
}

export function completeManagerTutorial(career: ManagerCareer): ManagerCareer {
  try {
    dismissManagerOnboarding();
  } catch {
    /* ignore */
  }
  return {
    ...career,
    tutorialStatus: "completed",
    tutorialStep: undefined,
  };
}

export function getActiveManagerTutorialStep(
  career: ManagerCareer
): ManagerTutorialStepDef | null {
  if (!isManagerTutorialActive(career)) return null;
  return getManagerTutorialStepDef(career.tutorialStep ?? "welcome");
}

function nextStepId(
  current: ManagerTutorialStepId
): ManagerTutorialStepId | "done" {
  const index = STEP_INDEX[current];
  if (index == null) return "done";
  const next = MANAGER_TUTORIAL_STEPS[index + 1];
  return next?.id ?? "done";
}

export function advanceManagerTutorial(career: ManagerCareer): ManagerCareer {
  if (!isManagerTutorialActive(career)) return career;
  const current = (career.tutorialStep ?? "welcome") as ManagerTutorialStepId;
  if (current === "finish") {
    return completeManagerTutorial(career);
  }
  const next = nextStepId(current);
  if (next === "done") {
    return completeManagerTutorial(career);
  }
  return { ...career, tutorialStep: next };
}

/**
 * Whether the season-progress step should wait for Advance Week.
 * Falls back to a plain Next button when the control is unavailable.
 */
export function tutorialCanRequireAdvanceWeek(career: ManagerCareer): boolean {
  return canAdvanceMatchWeek(career);
}

export function tutorialStepNeedsAction(
  career: ManagerCareer,
  step: ManagerTutorialStepDef | null
): boolean {
  if (!step?.requireAction || !step.action) return false;
  if (step.action === "advance-week") {
    return tutorialCanRequireAdvanceWeek(career);
  }
  return true;
}

function isTutorialTargetVisible(el: HTMLElement): boolean {
  if (el.closest("[hidden]")) return false;
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (node.classList.contains("invisible")) return false;
    node = node.parentElement;
  }
  const rect = el.getBoundingClientRect();
  return rect.width >= 2 && rect.height >= 2;
}

/**
 * Resolve the first *visible* tutorial target.
 * Prefer later DOM matches when earlier duplicates are hidden (e.g. hub Advance
 * Week card vs mobile sticky play bar).
 */
export function resolveTutorialTargetElement(
  targets: ManagerTutorialTargetId[] | undefined
): HTMLElement | null {
  if (typeof document === "undefined" || !targets?.length) return null;
  for (const id of targets) {
    const nodes = document.querySelectorAll(`[data-tutorial-id="${id}"]`);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!isTutorialTargetVisible(node)) continue;
      return node;
    }
  }
  return null;
}

/** Retry locating a target after route/view mounts. */
export async function waitForTutorialTarget(
  targets: ManagerTutorialTargetId[] | undefined,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<HTMLElement | null> {
  const timeoutMs = options?.timeoutMs ?? 1800;
  const intervalMs = options?.intervalMs ?? 50;
  const start = performance.now();
  let el = resolveTutorialTargetElement(targets);
  while (!el && performance.now() - start < timeoutMs) {
    await new Promise<void>((r) => setTimeout(r, intervalMs));
    el = resolveTutorialTargetElement(targets);
  }
  return el;
}
