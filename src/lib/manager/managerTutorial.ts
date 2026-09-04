/**
 * Manager Mode tutorial — one authoritative step contract.
 *
 * Every interactive step binds together:
 *   text → exact target id → clickable control → expected app state → next
 *
 * Persisted on career: tutorialStatus / tutorialStep.
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

/** Unique per responsive surface — never share desktop/mobile IDs. */
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

export type ManagerTutorialAction =
  | "advance-week"
  | "open-more"
  | "nav"
  | "observe";

export type TutorialInteractionPhase =
  | "open-more"
  | "action"
  | "content"
  | "next";

export type ManagerTutorialExpectedState = {
  view?: ManagerView;
  moreOpen?: boolean;
};

/**
 * One step = one teaching moment.
 * Interactive steps must declare exactly one desktop + one mobile target
 * for the action the copy asks for.
 */
export interface ManagerTutorialStepDef {
  id: ManagerTutorialStepId;
  title: string;
  /** Copy while waiting for the required tap / for observe+Next. */
  body: string;
  /** Copy after a nav action succeeds (content phase). */
  contentBody?: string;
  /** Short action line — must name the exact control. */
  hint?: string;
  /** Mobile More-path action line — must name the exact More item. */
  moreHint?: string;
  nextLabel?: string;
  /** Soft-navigate for observe/content steps only. */
  view?: ManagerView;
  /**
   * Exact control the action copy refers to.
   * ONE id per viewport — no fallback lists.
   */
  target?: {
    desktop: ManagerTutorialTargetId;
    mobile: ManagerTutorialTargetId;
  };
  /** Exact content surface after successful navigation. */
  contentTarget?: {
    desktop: ManagerTutorialTargetId;
    mobile: ManagerTutorialTargetId;
  };
  requireAction?: boolean;
  action?: ManagerTutorialAction;
  navView?: ManagerView;
  mobileOnly?: boolean;
  /** Real Manager Mode state that proves the action succeeded. */
  expectedState?: ManagerTutorialExpectedState;
}

export const MANAGER_TUTORIAL_STEPS: readonly ManagerTutorialStepDef[] = [
  {
    id: "welcome",
    title: "Welcome to Manager Mode",
    body: "You are now managing your club. Build your squad, manage fixtures, make transfers and guide your team through the season.",
    nextLabel: "Next",
    action: "observe",
  },
  {
    id: "hub",
    title: "Club Hub",
    body: "This is your Club Hub — the home screen for your season. Press Next when you are ready to keep exploring.",
    view: "hub",
    target: {
      desktop: "manager-hub-root",
      mobile: "manager-hub-root",
    },
    nextLabel: "Next",
    action: "observe",
    expectedState: { view: "hub" },
  },
  {
    id: "season-progress",
    title: "Advance Week",
    body: "When you have no match to play, use Advance Week to move the season forward.",
    hint: "Tap the highlighted Advance Week button.",
    view: "hub",
    target: {
      desktop: "manager-hub-advance-week-desktop",
      mobile: "manager-hub-advance-week-mobile",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "advance-week",
    expectedState: { view: "hub" },
  },
  {
    id: "fixture",
    title: "Next Fixture",
    body: "Your next match card lives here on the Hub. Press Next to continue.",
    view: "hub",
    target: {
      desktop: "manager-hub-next-fixture",
      mobile: "manager-hub-next-fixture",
    },
    nextLabel: "Next",
    action: "observe",
    expectedState: { view: "hub" },
  },
  {
    id: "squad",
    title: "Open Squad",
    body: "Open Squad to manage your first-team players, ratings and selection.",
    contentBody:
      "This is Squad — ratings, roles and selection for your first team. Press Next to continue.",
    hint: "Tap Squad.",
    target: {
      desktop: "manager-nav-squad-desktop",
      mobile: "manager-nav-squad-mobile",
    },
    contentTarget: {
      desktop: "manager-section-squad",
      mobile: "manager-section-squad",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "squad",
    expectedState: { view: "squad" },
  },
  {
    id: "reserves",
    title: "Open Reserves",
    body: "Open Reserves to develop younger and fringe players.",
    contentBody:
      "This is Reserves — promote, contract and call up players here. Press Next to continue.",
    hint: "Tap Reserves.",
    target: {
      desktop: "manager-nav-reserves-desktop",
      mobile: "manager-nav-reserves-mobile",
    },
    contentTarget: {
      desktop: "manager-section-reserves",
      mobile: "manager-section-reserves",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "reserves",
    expectedState: { view: "reserves" },
  },
  {
    id: "contracts",
    title: "Open Contracts",
    body: "Open Contracts to watch expiring deals before important players leave.",
    contentBody:
      "This is Contracts — keep an eye on expiring deals. Press Next to continue.",
    hint: "Tap Contracts.",
    target: {
      desktop: "manager-nav-contracts-desktop",
      mobile: "manager-nav-contracts-mobile",
    },
    contentTarget: {
      desktop: "manager-section-contracts",
      mobile: "manager-section-contracts",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "contracts",
    expectedState: { view: "contracts" },
  },
  {
    id: "transfers",
    title: "Open Transfers",
    body: "Open Transfers to find players, make offers and manage market activity.",
    contentBody:
      "This is Transfers — the market and your transfer activity. Press Next to continue.",
    hint: "Tap Transfers.",
    target: {
      desktop: "manager-nav-transfers-desktop",
      mobile: "manager-nav-transfers-mobile",
    },
    contentTarget: {
      desktop: "manager-section-transfers",
      mobile: "manager-section-transfers",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "transfers",
    expectedState: { view: "transfers" },
  },
  {
    id: "more",
    title: "Open More",
    body: "Some Manager Mode sections live inside More. Open More to reach them.",
    hint: "Tap ⋯ More.",
    target: {
      desktop: "manager-nav-more",
      mobile: "manager-nav-more",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "open-more",
    mobileOnly: true,
    expectedState: { moreOpen: true },
  },
  {
    id: "fixtures",
    title: "Open Fixtures",
    body: "Open Fixtures to see your upcoming league and cup schedule.",
    contentBody:
      "This is Fixtures — your schedule for league and cup matches. Press Next to continue.",
    hint: "Tap Fixtures.",
    moreHint: "Fixtures is inside More. Tap Fixtures.",
    target: {
      desktop: "manager-nav-fixtures-desktop",
      mobile: "manager-nav-fixtures-more",
    },
    contentTarget: {
      desktop: "manager-section-fixtures",
      mobile: "manager-section-fixtures",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "fixtures",
    expectedState: { view: "fixtures" },
  },
  {
    id: "stats",
    title: "Open Stats",
    body: "Open Stats to track player and team performances.",
    contentBody:
      "This is Stats — performances across your season. Press Next to continue.",
    hint: "Tap Stats.",
    moreHint: "Stats is inside More. Tap Stats.",
    target: {
      desktop: "manager-nav-stats-desktop",
      mobile: "manager-nav-stats-more",
    },
    contentTarget: {
      desktop: "manager-section-stats",
      mobile: "manager-section-stats",
    },
    nextLabel: "Next",
    requireAction: true,
    action: "nav",
    navView: "stats",
    expectedState: { view: "stats" },
  },
  {
    id: "cup",
    title: "Challenge Cup",
    body: "Cup ties live in Fixtures — another route to silverware. Press Next to continue.",
    view: "fixtures",
    target: {
      desktop: "manager-section-challenge-cup",
      mobile: "manager-section-challenge-cup",
    },
    nextLabel: "Next",
    action: "observe",
    expectedState: { view: "fixtures" },
  },
  {
    id: "playoffs",
    title: "Season & playoffs",
    body: "Season progress on the Hub tracks league position, playoffs and promotion. Press Next to continue.",
    view: "hub",
    target: {
      desktop: "manager-hub-season-progress",
      mobile: "manager-hub-season-progress",
    },
    nextLabel: "Next",
    action: "observe",
    expectedState: { view: "hub" },
  },
  {
    id: "finish",
    title: "You're ready to manage",
    body: "Watch squad, fixtures and transfers — build your club into a Super League champion.",
    nextLabel: "Start Managing",
    action: "observe",
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
      return step.contentTarget ? "content" : "next";
    }
    const needsMore =
      opts.compact && isManagerMobileMoreNavView(step.navView);
    if (needsMore && !opts.moreOpen) return "open-more";
    return "action";
  }

  return "next";
}

/** Exactly one target id for the current phase + viewport. */
export function resolveTutorialPhaseTargetId(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase,
  compact: boolean
): ManagerTutorialTargetId | null {
  if (phase === "open-more") return "manager-nav-more";
  if (phase === "action") {
    return compact ? step.target?.mobile ?? null : step.target?.desktop ?? null;
  }
  if (phase === "content") {
    return compact
      ? step.contentTarget?.mobile ?? null
      : step.contentTarget?.desktop ?? null;
  }
  // Observe / next with an optional spotlight.
  if (step.target) {
    return compact ? step.target.mobile : step.target.desktop;
  }
  return null;
}

export function resolveTutorialPhaseTargets(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase,
  compact: boolean
): ManagerTutorialTargetId[] | undefined {
  const id = resolveTutorialPhaseTargetId(step, phase, compact);
  return id ? [id] : undefined;
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

export function getTutorialStepCopy(
  step: ManagerTutorialStepDef,
  phase: TutorialInteractionPhase,
  compact: boolean
): { title: string; body: string; hint: string | null } {
  if (phase === "content" && step.contentBody) {
    return { title: step.title, body: step.contentBody, hint: null };
  }
  if (phase === "open-more") {
    return {
      title: step.title,
      body: step.body,
      hint: "Tap ⋯ More in the bottom bar.",
    };
  }
  if (phase === "action") {
    const hint =
      compact && step.moreHint && step.action === "nav"
        ? step.moreHint
        : step.hint ?? null;
    return { title: step.title, body: step.body, hint };
  }
  return { title: step.title, body: step.body, hint: null };
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

export type TutorialTargetResolveResult = {
  el: HTMLElement | null;
  id: ManagerTutorialTargetId | null;
  matchCount: number;
  ambiguous: boolean;
};

/**
 * Resolve exactly one visible target. Ambiguous matches return null
 * (never guess the first duplicate).
 */
export function resolveTutorialTargetElement(
  targets: ManagerTutorialTargetId[] | undefined
): TutorialTargetResolveResult {
  if (typeof document === "undefined" || !targets?.length) {
    return { el: null, id: null, matchCount: 0, ambiguous: false };
  }

  for (const id of targets) {
    const nodes = document.querySelectorAll(`[data-tutorial-target="${id}"]`);
    const usable: HTMLElement[] = [];
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!isTutorialTargetUsable(node)) continue;
      usable.push(node);
    }
    if (usable.length === 1) {
      return { el: usable[0]!, id, matchCount: 1, ambiguous: false };
    }
    if (usable.length > 1) {
      tutorialDebugLog("target-ambiguous", { id, matchCount: usable.length });
      return { el: null, id, matchCount: usable.length, ambiguous: true };
    }
  }
  return { el: null, id: targets[0] ?? null, matchCount: 0, ambiguous: false };
}

export async function waitForTutorialTarget(
  targets: ManagerTutorialTargetId[] | undefined,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<TutorialTargetResolveResult> {
  const timeoutMs = options?.timeoutMs ?? 2000;
  const intervalMs = options?.intervalMs ?? 50;
  const start = performance.now();
  let result = resolveTutorialTargetElement(targets);
  while (
    !result.el &&
    !result.ambiguous &&
    performance.now() - start < timeoutMs
  ) {
    await new Promise<void>((r) => setTimeout(r, intervalMs));
    result = resolveTutorialTargetElement(targets);
  }
  return result;
}

/** True when the element is Manager chrome that sits above page content. */
export function isTutorialChromeTarget(el: HTMLElement): boolean {
  return Boolean(
    el.closest("[data-manager-mobile-nav]") ||
      el.closest("[data-manager-more-sheet]") ||
      el.closest(".mobile-action-bar") ||
      el.closest("nav[aria-label='Manager sections']")
  );
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
