/**
 * Authoritative Manager Mode interactive tutorial state machine.
 * Persisted on the career — not localStorage.
 *
 * Mobile vs desktop: same step IDs; interaction phases adapt to whether a
 * destination lives in the bottom bar or inside the More sheet.
 */
import type { ManagerCareer, ManagerView } from "./types";
import { canAdvanceMatchWeek } from "./managerMatchWeek";
import { dismissManagerOnboarding } from "./managerOnboarding";
import { isManagerMobileMoreNavView } from "./manager-nav-config";

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
  | "more"
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

export type ManagerTutorialAction =
  | "advance-week"
  | "open-more"
  | "nav";

export interface ManagerTutorialStepDef {
  id: ManagerTutorialStepId;
  title: string;
  body: string;
  /** Optional secondary line (e.g. flow hint). */
  hint?: string;
  /**
   * Soft navigate here when entering a non-interactive / content phase.
   * Interactive nav steps omit this so the player uses the real tab.
   */
  view?: ManagerView;
  /** Spotlight while waiting for a required action. */
  targets?: ManagerTutorialTargetId[];
  /** After a nav action succeeds, spotlight section content with Next. */
  contentTargets?: ManagerTutorialTargetId[];
  /** Primary CTA when not waiting on a UI action. */
  nextLabel?: string;
  /** Wait for the user to press the highlighted control. */
  requireAction?: boolean;
  action?: ManagerTutorialAction;
  /** When action is nav, which view completes the tap. */
  navView?: ManagerView;
  /** Skip on desktop (≥ sm). */
  mobileOnly?: boolean;
  /** Copy overrides while More must be opened first (mobile). */
  moreHint?: string;
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
    body: "Manage your first-team players here — ratings, roles and selection.",
    hint: "Tap Squad in the bottom bar.",
    targets: ["manager-nav-squad"],
    contentTargets: ["manager-section-squad", "manager-nav-squad"],
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "squad",
  },
  {
    id: "reserves",
    title: "Reserves",
    body: "Develop younger and fringe players here. Promote, contract and call up as needed.",
    hint: "Tap Reserves in the bottom bar.",
    targets: ["manager-nav-reserves"],
    contentTargets: ["manager-section-reserves", "manager-nav-reserves"],
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "reserves",
  },
  {
    id: "contracts",
    title: "Contracts",
    body: "Watch expiring deals so important players don't leave unnoticed.",
    hint: "Tap Contracts in the bottom bar.",
    targets: ["manager-nav-contracts"],
    contentTargets: ["manager-section-contracts", "manager-nav-contracts"],
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "contracts",
  },
  {
    id: "transfers",
    title: "Transfers",
    body: "Find players, make offers and manage market activity here.",
    hint: "Tap Transfers in the bottom bar.",
    targets: ["manager-nav-transfers"],
    contentTargets: ["manager-section-transfers", "manager-nav-transfers"],
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "transfers",
  },
  {
    id: "more",
    title: "More Manager Tools",
    body: "Some Manager Mode sections live inside More. Tap More to see them.",
    hint: "Tap ⋯ More in the bottom bar.",
    targets: ["manager-nav-more"],
    nextLabel: "Next",
    requireAction: true,
    action: "open-more",
    mobileOnly: true,
  },
  {
    id: "fixtures",
    title: "Fixtures",
    body: "Your upcoming schedule, including league and cup matches.",
    hint: "Tap Fixtures to open your schedule.",
    moreHint: "Fixtures is inside More. Tap Fixtures.",
    targets: ["manager-nav-fixtures"],
    contentTargets: ["manager-section-fixtures", "manager-nav-fixtures"],
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "fixtures",
  },
  {
    id: "stats",
    title: "Stats",
    body: "Track player and team performances throughout the season.",
    hint: "Tap Stats to open your performance view.",
    moreHint: "Stats is inside More. Tap Stats.",
    targets: ["manager-nav-stats"],
    contentTargets: ["manager-section-stats", "manager-nav-stats"],
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "stats",
  },
  {
    id: "cup",
    title: "Challenge Cup",
    body: "Cup ties are separate from the league — another route to silverware.",
    view: "fixtures",
    targets: [
      "manager-section-challenge-cup",
      "manager-section-fixtures",
      "manager-hub-challenge-cup",
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

export function isTutorialCompactViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(max-width: 639px)").matches;
}

function nextStepId(
  current: ManagerTutorialStepId,
  opts?: { compact?: boolean }
): ManagerTutorialStepId | "done" {
  const compact = opts?.compact ?? isTutorialCompactViewport();
  let index = STEP_INDEX[current];
  if (index == null) return "done";
  while (index + 1 < MANAGER_TUTORIAL_STEPS.length) {
    const next = MANAGER_TUTORIAL_STEPS[index + 1]!;
    if (next.mobileOnly && !compact) {
      index += 1;
      continue;
    }
    return next.id;
  }
  return "done";
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

export type TutorialInteractionPhase =
  | "open-more"
  | "action"
  | "content"
  | "next";

export function resolveTutorialInteractionPhase(
  step: ManagerTutorialStepDef,
  opts: {
    compact: boolean;
    moreOpen: boolean;
    currentView: ManagerView | null | undefined;
  }
): TutorialInteractionPhase {
  if (!step.requireAction || !step.action) {
    return "next";
  }

  if (step.action === "advance-week") {
    return "action";
  }

  if (step.action === "open-more") {
    return opts.moreOpen ? "next" : "action";
  }

  if (step.action === "nav" && step.navView) {
    if (opts.currentView === step.navView) {
      return step.contentTargets?.length ? "content" : "next";
    }
    const needsMore =
      opts.compact && isManagerMobileMoreNavView(step.navView);
    if (needsMore && !opts.moreOpen) {
      return "open-more";
    }
    return "action";
  }

  return "next";
}

export function resolveTutorialPhaseTargets(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase
): ManagerTutorialTargetId[] | undefined {
  if (phase === "open-more") return ["manager-nav-more"];
  if (phase === "action") return step.targets;
  if (phase === "content") return step.contentTargets ?? step.targets;
  return step.contentTargets ?? step.targets;
}

export function tutorialPhaseNeedsTap(
  phase: TutorialInteractionPhase
): boolean {
  return phase === "open-more" || phase === "action";
}

export function tutorialLockTargetForPhase(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase
): "more" | ManagerView | null {
  if (phase === "open-more" || step.action === "open-more") return "more";
  if (phase === "action" && step.action === "nav" && step.navView) {
    return step.navView;
  }
  return null;
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
    // Prefer the last visible match so mobile More sheet items win over
    // hidden desktop duplicates when both exist.
    let found: HTMLElement | null = null;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!isTutorialTargetVisible(node)) continue;
      found = node;
    }
    if (found) return found;
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

export function getManagerTutorialStepIndex(
  stepId: ManagerTutorialStepId
): number {
  return STEP_INDEX[stepId] ?? 0;
}

export function getManagerTutorialStepCount(compact = true): number {
  return MANAGER_TUTORIAL_STEPS.filter((s) => !(s.mobileOnly && !compact))
    .length;
}
