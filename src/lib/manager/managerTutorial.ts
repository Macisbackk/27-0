/**
 * Manager Mode tutorial — single authoritative state machine.
 * Persisted on the career (tutorialStatus / tutorialStep).
 *
 * Explicit desktop vs mobile target IDs — never score shared duplicates.
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

/** Unique per responsive surface — no shared IDs across desktop/mobile. */
export type ManagerTutorialTargetId =
  | "manager-hub-root"
  | "manager-hub-season-progress"
  | "manager-hub-next-fixture"
  | "manager-hub-advance-week-desktop"
  | "manager-hub-advance-week-mobile"
  | "manager-hub-play-game-desktop"
  | "manager-hub-play-game-mobile"
  | "manager-hub-simulate-desktop"
  | "manager-hub-simulate-mobile"
  | "manager-hub-challenge-cup"
  | "manager-nav-hub-desktop"
  | "manager-nav-hub-mobile"
  | "manager-nav-squad-desktop"
  | "manager-nav-squad-mobile"
  | "manager-nav-reserves-desktop"
  | "manager-nav-reserves-mobile"
  | "manager-nav-contracts-desktop"
  | "manager-nav-contracts-mobile"
  | "manager-nav-transfers-desktop"
  | "manager-nav-transfers-mobile"
  | "manager-nav-fixtures-desktop"
  | "manager-nav-fixtures-more"
  | "manager-nav-stats-desktop"
  | "manager-nav-stats-more"
  | "manager-nav-more"
  | "manager-section-squad"
  | "manager-section-reserves"
  | "manager-section-contracts"
  | "manager-section-transfers"
  | "manager-section-fixtures"
  | "manager-section-stats"
  | "manager-section-challenge-cup";

export type ManagerTutorialAction = "advance-week" | "open-more" | "nav";

export type TutorialInteractionPhase =
  | "open-more"
  | "action"
  | "content"
  | "next";

export interface ManagerTutorialStepDef {
  id: ManagerTutorialStepId;
  title: string;
  body: string;
  hint?: string;
  moreHint?: string;
  nextLabel?: string;
  /** Soft-navigate here for inspect / content steps (not for interactive nav taps). */
  view?: ManagerView;
  /** Explicit targets for the current viewport. */
  targets?: {
    desktop: ManagerTutorialTargetId[];
    mobile: ManagerTutorialTargetId[];
  };
  contentTargets?: {
    desktop: ManagerTutorialTargetId[];
    mobile: ManagerTutorialTargetId[];
  };
  requireAction?: boolean;
  action?: ManagerTutorialAction;
  navView?: ManagerView;
  mobileOnly?: boolean;
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
    targets: {
      desktop: [
        "manager-hub-next-fixture",
        "manager-hub-season-progress",
        "manager-hub-root",
      ],
      mobile: [
        "manager-hub-next-fixture",
        "manager-hub-season-progress",
        "manager-hub-root",
      ],
    },
    nextLabel: "Next",
  },
  {
    id: "season-progress",
    title: "Season Progress",
    body: "Advance the week when there is no match to play — that moves your season forward.",
    hint: "Tap Advance Week to continue.",
    view: "hub",
    targets: {
      desktop: ["manager-hub-advance-week-desktop", "manager-hub-season-progress"],
      mobile: [
        "manager-hub-advance-week-mobile",
        "manager-hub-advance-week-desktop",
        "manager-hub-season-progress",
      ],
    },
    nextLabel: "Next",
    requireAction: true,
    action: "advance-week",
  },
  {
    id: "fixture",
    title: "Next Fixture",
    body: "Your next match appears here. Play or simulate from this card when a fixture is due.",
    view: "hub",
    targets: {
      desktop: [
        "manager-hub-next-fixture",
        "manager-hub-play-game-desktop",
        "manager-hub-simulate-desktop",
      ],
      mobile: [
        "manager-hub-next-fixture",
        "manager-hub-play-game-mobile",
        "manager-hub-simulate-mobile",
        "manager-hub-play-game-desktop",
      ],
    },
    nextLabel: "Next",
  },
  {
    id: "squad",
    title: "Squad",
    body: "Manage your first-team players here — ratings, roles and selection.",
    hint: "Tap Squad to continue.",
    targets: {
      desktop: ["manager-nav-squad-desktop"],
      mobile: ["manager-nav-squad-mobile"],
    },
    contentTargets: {
      desktop: ["manager-section-squad"],
      mobile: ["manager-section-squad"],
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "squad",
  },
  {
    id: "reserves",
    title: "Reserves",
    body: "Develop younger and fringe players here. Promote, contract and call up as needed.",
    hint: "Tap Reserves to continue.",
    targets: {
      desktop: ["manager-nav-reserves-desktop"],
      mobile: ["manager-nav-reserves-mobile"],
    },
    contentTargets: {
      desktop: ["manager-section-reserves"],
      mobile: ["manager-section-reserves"],
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "reserves",
  },
  {
    id: "contracts",
    title: "Contracts",
    body: "Watch expiring deals so important players don't leave unnoticed.",
    hint: "Tap Contracts to continue.",
    targets: {
      desktop: ["manager-nav-contracts-desktop"],
      mobile: ["manager-nav-contracts-mobile"],
    },
    contentTargets: {
      desktop: ["manager-section-contracts"],
      mobile: ["manager-section-contracts"],
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "contracts",
  },
  {
    id: "transfers",
    title: "Transfers",
    body: "Find players, make offers and manage market activity here.",
    hint: "Tap Transfers to continue.",
    targets: {
      desktop: ["manager-nav-transfers-desktop"],
      mobile: ["manager-nav-transfers-mobile"],
    },
    contentTargets: {
      desktop: ["manager-section-transfers"],
      mobile: ["manager-section-transfers"],
    },
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
    targets: {
      desktop: ["manager-nav-more"],
      mobile: ["manager-nav-more"],
    },
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
    targets: {
      desktop: ["manager-nav-fixtures-desktop"],
      mobile: ["manager-nav-fixtures-more"],
    },
    contentTargets: {
      desktop: ["manager-section-fixtures"],
      mobile: ["manager-section-fixtures"],
    },
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
    targets: {
      desktop: ["manager-nav-stats-desktop"],
      mobile: ["manager-nav-stats-more"],
    },
    contentTargets: {
      desktop: ["manager-section-stats"],
      mobile: ["manager-section-stats"],
    },
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
    targets: {
      desktop: [
        "manager-section-challenge-cup",
        "manager-section-fixtures",
        "manager-hub-challenge-cup",
      ],
      mobile: [
        "manager-section-challenge-cup",
        "manager-section-fixtures",
        "manager-hub-challenge-cup",
      ],
    },
    nextLabel: "Next",
  },
  {
    id: "playoffs",
    title: "Season & playoffs",
    body: "League position decides playoffs, the Million Pound Game, promotion or relegation.",
    view: "hub",
    targets: {
      desktop: [
        "manager-hub-season-progress",
        "manager-hub-next-fixture",
        "manager-hub-root",
      ],
      mobile: [
        "manager-hub-season-progress",
        "manager-hub-next-fixture",
        "manager-hub-root",
      ],
    },
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

export function tutorialCanRequireAdvanceWeek(career: ManagerCareer): boolean {
  return canAdvanceMatchWeek(career);
}

export function resolveTutorialInteractionPhase(
  step: ManagerTutorialStepDef,
  opts: {
    compact: boolean;
    moreOpen: boolean;
    currentView: ManagerView | null | undefined;
  }
): TutorialInteractionPhase {
  if (!step.requireAction || !step.action) return "next";

  if (step.action === "advance-week") return "action";

  if (step.action === "open-more") {
    return opts.moreOpen ? "next" : "action";
  }

  if (step.action === "nav" && step.navView) {
    if (opts.currentView === step.navView) {
      return step.contentTargets ? "content" : "next";
    }
    const needsMore =
      opts.compact && isManagerMobileMoreNavView(step.navView);
    if (needsMore && !opts.moreOpen) return "open-more";
    return "action";
  }

  return "next";
}

export function resolveTutorialPhaseTargets(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase,
  compact: boolean
): ManagerTutorialTargetId[] | undefined {
  const pick = (bundle?: {
    desktop: ManagerTutorialTargetId[];
    mobile: ManagerTutorialTargetId[];
  }) => (compact ? bundle?.mobile : bundle?.desktop);

  if (phase === "open-more") return ["manager-nav-more"];
  if (phase === "action") return pick(step.targets);
  if (phase === "content") return pick(step.contentTargets) ?? pick(step.targets);
  return pick(step.contentTargets) ?? pick(step.targets);
}

export function tutorialPhaseNeedsTap(
  phase: TutorialInteractionPhase
): boolean {
  return phase === "open-more" || phase === "action";
}

export type ManagerTutorialNavLock =
  | "more"
  | "advance-week"
  | ManagerView
  | null;

export function tutorialLockTargetForPhase(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase
): ManagerTutorialNavLock {
  if (phase === "open-more") return "more";
  if (step.action === "open-more" && phase === "action") return "more";
  if (phase === "action" && step.action === "advance-week") {
    return "advance-week";
  }
  if (phase === "action" && step.action === "nav" && step.navView) {
    return step.navView;
  }
  return null;
}

function isTutorialTargetUsable(el: HTMLElement): boolean {
  if (el.closest("[hidden]")) return false;
  if (el.closest("[aria-hidden='true']")) return false;
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number.parseFloat(style.opacity || "1") < 0.05) return false;
    if (node.classList.contains("invisible")) return false;
    if (node.hasAttribute("inert")) return false;
    node = node.parentElement;
  }

  // Ancestors with pointer-events:none block hits unless el opts back in.
  let blocked = false;
  node = el.parentElement;
  while (node && node !== document.documentElement) {
    if (window.getComputedStyle(node).pointerEvents === "none") {
      blocked = true;
      break;
    }
    node = node.parentElement;
  }
  if (blocked && window.getComputedStyle(el).pointerEvents !== "auto") {
    return false;
  }
  if (window.getComputedStyle(el).pointerEvents === "none") return false;

  const rect = el.getBoundingClientRect();
  return rect.width >= 2 && rect.height >= 2;
}

/**
 * Resolve the first usable target from an ordered list.
 * Lists are already viewport-specific — no cross-surface scoring.
 */
export function resolveTutorialTargetElement(
  targets: ManagerTutorialTargetId[] | undefined
): HTMLElement | null {
  if (typeof document === "undefined" || !targets?.length) return null;
  for (const id of targets) {
    const nodes = document.querySelectorAll(`[data-tutorial-target="${id}"]`);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!isTutorialTargetUsable(node)) continue;
      return node;
    }
  }
  return null;
}

export async function waitForTutorialTarget(
  targets: ManagerTutorialTargetId[] | undefined,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<HTMLElement | null> {
  const timeoutMs = options?.timeoutMs ?? 2000;
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

/** Dev-only debug dump — gated by localStorage flag. */
export function isManagerTutorialDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  try {
    return window.localStorage.getItem("managerTutorialDebug") === "1";
  } catch {
    return false;
  }
}

export function tutorialDebugLog(
  event: string,
  payload?: Record<string, unknown>
): void {
  if (!isManagerTutorialDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(`[manager-tutorial] ${event}`, payload ?? "");
}
