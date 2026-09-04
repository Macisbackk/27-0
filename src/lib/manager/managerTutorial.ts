/**
 * Manager Mode tutorial — minimal guide over real UI.
 *
 * Career persists: tutorialStatus + tutorialStep.
 * Manager Mode owns tabs / More; this module only defines steps and observes.
 */
import type { ManagerCareer, ManagerView } from "./types";
import { isManagerMobileMoreNavView } from "./manager-nav-config";

export type ManagerTutorialStatus =
  | "not_started"
  | "active"
  | "completed"
  | "skipped";

export type ManagerTutorialStepId =
  | "welcome"
  | "hub"
  | "season"
  | "squad"
  | "reserves"
  | "contracts"
  | "transfers"
  | "more"
  | "fixtures"
  | "stats"
  | "club"
  | "settings"
  | "finish";

export type ManagerTutorialAction = "inspect" | "click" | "open-menu";

/** Exact DOM id on the real control (`data-tutorial-target`). */
export type ManagerTutorialTargetId =
  | "manager-hub"
  | "manager-season-progress"
  | "manager-nav-squad"
  | "manager-nav-reserves"
  | "manager-nav-contracts"
  | "manager-nav-transfers"
  | "manager-more"
  | "manager-nav-fixtures"
  | "manager-nav-stats"
  | "manager-nav-club"
  | "manager-club-settings";

export type ManagerTutorialNavLock = ManagerView | "more" | null;

export type ManagerTutorialClubTab =
  | "finances"
  | "boosts"
  | "facilities"
  | "settings";

export interface ManagerTutorialStep {
  id: ManagerTutorialStepId;
  title: string;
  description: string;
  /** Exact control the description refers to (omit for welcome/finish). */
  targetId?: ManagerTutorialTargetId;
  action: ManagerTutorialAction;
  /** Real app state that proves a click / open-menu succeeded. */
  expected?: {
    tab?: ManagerView;
    moreOpen?: boolean;
    clubTab?: ManagerTutorialClubTab;
  };
  /** Skip on desktop (More is mobile-only). */
  mobileOnly?: boolean;
  nextLabel?: string;
}

/**
 * One list. Text always names the same control as targetId.
 * Click steps advance only when expected app state matches.
 */
export const MANAGER_TUTORIAL_STEPS: readonly ManagerTutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Manager Mode",
    description:
      "You manage this club now — squad, transfers, fixtures and the season. Press Next to begin.",
    action: "inspect",
    nextLabel: "Next",
  },
  {
    id: "hub",
    title: "Club Hub",
    description:
      "This is your Club Hub — the home screen for your season. Press Next when ready.",
    targetId: "manager-hub",
    action: "inspect",
    nextLabel: "Next",
  },
  {
    id: "season",
    title: "Season Progress",
    description:
      "Season Progress tracks your week, league position and path through the season. Press Next to continue.",
    targetId: "manager-season-progress",
    action: "inspect",
    nextLabel: "Next",
  },
  {
    id: "squad",
    title: "Open Squad",
    description:
      "Open Squad to manage senior players, positions and team selection.",
    targetId: "manager-nav-squad",
    action: "click",
    expected: { tab: "squad" },
  },
  {
    id: "reserves",
    title: "Open Reserves",
    description:
      "Open Reserves to develop younger and fringe players.",
    targetId: "manager-nav-reserves",
    action: "click",
    expected: { tab: "reserves" },
  },
  {
    id: "contracts",
    title: "Open Contracts",
    description:
      "Open Contracts to watch expiring deals before important players leave.",
    targetId: "manager-nav-contracts",
    action: "click",
    expected: { tab: "contracts" },
  },
  {
    id: "transfers",
    title: "Open Transfers",
    description:
      "Open Transfers to find players and manage incoming and outgoing deals.",
    targetId: "manager-nav-transfers",
    action: "click",
    expected: { tab: "transfers" },
  },
  {
    id: "more",
    title: "Open More",
    description:
      "Open More to find the rest of your Manager Mode sections.",
    targetId: "manager-more",
    action: "open-menu",
    expected: { moreOpen: true },
    mobileOnly: true,
  },
  {
    id: "fixtures",
    title: "Open Fixtures",
    description:
      "Open Fixtures to view upcoming matches and play or simulate them.",
    targetId: "manager-nav-fixtures",
    action: "click",
    expected: { tab: "fixtures" },
  },
  {
    id: "stats",
    title: "Open Stats",
    description:
      "Open Stats to track player and team performances this season.",
    targetId: "manager-nav-stats",
    action: "click",
    expected: { tab: "stats" },
  },
  {
    id: "club",
    title: "Open Club",
    description:
      "Open Club for finances, boosts and facilities.",
    targetId: "manager-nav-club",
    action: "click",
    expected: { tab: "club" },
  },
  {
    id: "settings",
    title: "Open Settings",
    description:
      "Open Settings in Club Office to adjust gameplay preferences.",
    targetId: "manager-club-settings",
    action: "click",
    expected: { tab: "club", clubTab: "settings" },
  },
  {
    id: "finish",
    title: "You're ready to manage",
    description:
      "Use Hub, Squad, Transfers and Fixtures to build a Super League champion.",
    action: "inspect",
    nextLabel: "Start Managing",
  },
] as const;

const STEP_INDEX = Object.fromEntries(
  MANAGER_TUTORIAL_STEPS.map((step, i) => [step.id, i])
) as Record<ManagerTutorialStepId, number>;

/** Map legacy step ids from prior tutorial versions onto the new list. */
const LEGACY_STEP: Record<string, ManagerTutorialStepId> = {
  welcome: "welcome",
  hub: "hub",
  season: "season",
  "season-progress": "season",
  fixture: "season",
  squad: "squad",
  reserves: "reserves",
  contracts: "contracts",
  transfers: "transfers",
  more: "more",
  fixtures: "fixtures",
  stats: "stats",
  club: "club",
  settings: "settings",
  cup: "finish",
  playoffs: "finish",
  finish: "finish",
};

export function getManagerTutorialStep(
  id: ManagerTutorialStepId | null | undefined
): ManagerTutorialStep | null {
  if (!id) return null;
  return MANAGER_TUTORIAL_STEPS.find((s) => s.id === id) ?? null;
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
  if (career.tutorialStatus == null) {
    return {
      ...career,
      tutorialStatus: "completed",
      tutorialStep: undefined,
    };
  }
  if (career.tutorialStatus !== "active") return career;
  const mapped = LEGACY_STEP[career.tutorialStep ?? "welcome"] ?? "welcome";
  if (!getManagerTutorialStep(mapped)) {
    return { ...career, tutorialStep: "welcome" };
  }
  if (mapped !== career.tutorialStep) {
    return { ...career, tutorialStep: mapped };
  }
  return career;
}

export function startManagerTutorial(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    tutorialStatus: "active",
    tutorialStep: "welcome",
  };
}

export function skipManagerTutorial(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    tutorialStatus: "skipped",
    tutorialStep: undefined,
  };
}

export function completeManagerTutorial(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    tutorialStatus: "completed",
    tutorialStep: undefined,
  };
}

export function getActiveManagerTutorialStep(
  career: ManagerCareer
): ManagerTutorialStep | null {
  if (!isManagerTutorialActive(career)) return null;
  const id = (LEGACY_STEP[career.tutorialStep ?? "welcome"] ??
    "welcome") as ManagerTutorialStepId;
  return getManagerTutorialStep(id);
}

export function isTutorialCompactViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(max-width: 639px)").matches;
}

function nextStepId(
  current: ManagerTutorialStepId,
  compact: boolean
): ManagerTutorialStepId | "done" {
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
  const current = (LEGACY_STEP[career.tutorialStep ?? "welcome"] ??
    "welcome") as ManagerTutorialStepId;
  if (current === "finish") return completeManagerTutorial(career);
  const next = nextStepId(current, isTutorialCompactViewport());
  if (next === "done") return completeManagerTutorial(career);
  return { ...career, tutorialStep: next };
}

export type TutorialObserveOpts = {
  compact: boolean;
  moreOpen: boolean;
  currentView: ManagerView;
  clubOfficeTab?: ManagerTutorialClubTab | null;
};

function navTargetForView(view: ManagerView): ManagerTutorialTargetId | null {
  switch (view) {
    case "squad":
      return "manager-nav-squad";
    case "reserves":
      return "manager-nav-reserves";
    case "contracts":
      return "manager-nav-contracts";
    case "transfers":
      return "manager-nav-transfers";
    case "fixtures":
      return "manager-nav-fixtures";
    case "stats":
      return "manager-nav-stats";
    case "club":
      return "manager-nav-club";
    default:
      return null;
  }
}

/**
 * Which control must stay clickable (and elevated) for this step.
 * Null = inspect / finished / in-page sub-control — no nav lock.
 */
export function tutorialNavLockForStep(
  step: ManagerTutorialStep,
  opts: TutorialObserveOpts
): ManagerTutorialNavLock {
  if (step.action === "open-menu") {
    return opts.moreOpen ? null : "more";
  }
  if (step.action !== "click" || !step.expected?.tab) return null;
  if (opts.currentView === step.expected.tab) {
    // Stay on this tab while teaching an in-page Club sub-tab.
    if (
      step.expected.clubTab &&
      opts.clubOfficeTab !== step.expected.clubTab
    ) {
      return step.expected.tab;
    }
    return null;
  }
  const needsMore =
    opts.compact && isManagerMobileMoreNavView(step.expected.tab);
  if (needsMore && !opts.moreOpen) return "more";
  return step.expected.tab;
}

/**
 * Effective target for this step given real viewport + More + Club state.
 * Hidden More items are never resolved while More is closed.
 */
export function resolveStepTargetId(
  step: ManagerTutorialStep,
  opts: TutorialObserveOpts
): ManagerTutorialTargetId | null {
  if (step.action === "open-menu") {
    return opts.moreOpen ? null : "manager-more";
  }
  if (step.action === "click" && step.expected?.tab) {
    const tab = step.expected.tab;
    if (opts.currentView !== tab) {
      const needsMore =
        opts.compact && isManagerMobileMoreNavView(tab);
      if (needsMore && !opts.moreOpen) return "manager-more";
      // Reach the parent tab before any in-page sub-control.
      if (step.expected.clubTab) {
        return navTargetForView(tab);
      }
      return step.targetId ?? null;
    }
    if (step.expected.clubTab) {
      if (opts.clubOfficeTab === step.expected.clubTab) return null;
      return step.targetId ?? null;
    }
    return null;
  }
  return step.targetId ?? null;
}

export function stepNeedsUserTap(
  step: ManagerTutorialStep,
  opts: TutorialObserveOpts
): boolean {
  return resolveStepTargetId(step, opts) != null && step.action !== "inspect";
}

export function stepExpectationMet(
  step: ManagerTutorialStep,
  opts: Pick<TutorialObserveOpts, "moreOpen" | "currentView" | "clubOfficeTab">
): boolean {
  if (step.action === "inspect") return false;
  if (step.action === "open-menu") {
    return opts.moreOpen === true;
  }
  if (step.action === "click" && step.expected?.tab) {
    if (opts.currentView !== step.expected.tab) return false;
    if (step.expected.clubTab) {
      return opts.clubOfficeTab === step.expected.clubTab;
    }
    return true;
  }
  return false;
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

function isElementUsable(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
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
  const rect = el.getBoundingClientRect();
  return rect.width >= 2 && rect.height >= 2;
}

export type TutorialTargetHit = {
  el: HTMLElement | null;
  matchCount: number;
  ambiguous: boolean;
};

/** Exactly one visible match — never guess among duplicates. */
export function resolveTutorialTarget(
  targetId: ManagerTutorialTargetId | null | undefined
): TutorialTargetHit {
  if (typeof document === "undefined" || !targetId) {
    return { el: null, matchCount: 0, ambiguous: false };
  }
  const nodes = document.querySelectorAll(
    `[data-tutorial-target="${targetId}"]`
  );
  const usable: HTMLElement[] = [];
  for (const node of nodes) {
    if (node instanceof HTMLElement && isElementUsable(node)) {
      usable.push(node);
    }
  }
  if (usable.length === 1) {
    return { el: usable[0]!, matchCount: 1, ambiguous: false };
  }
  if (usable.length > 1) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(
        `[manager-tutorial] target ambiguity: ${targetId} matches=${usable.length}`
      );
    }
    return { el: null, matchCount: usable.length, ambiguous: true };
  }
  return { el: null, matchCount: 0, ambiguous: false };
}

export function isTutorialChromeElement(el: HTMLElement): boolean {
  return Boolean(
    el.closest("[data-manager-mobile-nav]") ||
      el.closest("[data-manager-more-sheet]") ||
      el.closest(".mobile-action-bar") ||
      el.closest("nav[aria-label='Manager sections']")
  );
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

/** Dev-only: audit every known target id in the DOM. */
export function auditManagerTutorialTargets(): void {
  if (typeof document === "undefined") return;
  const ids = new Set<string>();
  for (const step of MANAGER_TUTORIAL_STEPS) {
    if (step.targetId) ids.add(step.targetId);
  }
  ids.add("manager-more");
  for (const id of ids) {
    const hit = resolveTutorialTarget(id as ManagerTutorialTargetId);
    // eslint-disable-next-line no-console
    console.info(`[tutorial-audit] ${id}`, {
      found: Boolean(hit.el),
      matches: hit.matchCount,
      ambiguous: hit.ambiguous,
      size: hit.el
        ? {
            w: Math.round(hit.el.getBoundingClientRect().width),
            h: Math.round(hit.el.getBoundingClientRect().height),
          }
        : null,
    });
  }
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __auditManagerTutorialTargets?: () => void })
    .__auditManagerTutorialTargets = auditManagerTutorialTargets;
}
