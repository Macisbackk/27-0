import { STORAGE_KEYS } from "../storage/keys";

const KEY = STORAGE_KEYS.managerOnboarding;

export interface ManagerOnboardingState {
  /** Permanently hide guide (all steps done or skip). */
  dismissedHubGuide: boolean;
  /** Modal closed for now — sticky hub strip still shown. */
  modalDismissed: boolean;
  completedSteps: string[];
}

const DEFAULT: ManagerOnboardingState = {
  dismissedHubGuide: false,
  modalDismissed: false,
  completedSteps: [],
};

export const MANAGER_ONBOARDING_STEPS = [
  {
    id: "lineup",
    title: "Set your matchday XIII",
    body: "Open Squad, fill starters and interchange, and save your tactics.",
    view: "squad" as const,
  },
  {
    id: "friendlies",
    title: "Complete pre-season friendlies",
    body: "Pick opponents on the hub to sharpen form before Round 1.",
    view: "hub" as const,
  },
  {
    id: "finances",
    title: "Check wages & transfer fund",
    body: "Contracts and Transfers share one wage budget — plan signings carefully.",
    view: "contracts" as const,
  },
  {
    id: "first-match",
    title: "Play or simulate Round 1",
    body: "Use Play Game for live tactics or Simulate Game for a quick result.",
    view: "hub" as const,
  },
] as const;

function load(): ManagerOnboardingState {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

function save(state: ManagerOnboardingState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function isFirstSeasonCareer(career: {
  seasonHistory: unknown[];
  fixtures: unknown[];
}): boolean {
  if (career.seasonHistory.length > 0) return false;
  if (career.fixtures.length > 3) return false;
  return true;
}

export function isOnboardingComplete(): boolean {
  const state = load();
  if (state.dismissedHubGuide) return true;
  return MANAGER_ONBOARDING_STEPS.every((step) =>
    state.completedSteps.includes(step.id)
  );
}

export function shouldShowManagerOnboarding(career: {
  seasonHistory: unknown[];
  fixtures: unknown[];
}): boolean {
  if (!isFirstSeasonCareer(career)) return false;
  const state = load();
  if (state.dismissedHubGuide || isOnboardingComplete()) return false;
  return !state.modalDismissed;
}

export function shouldShowManagerOnboardingStrip(career: {
  seasonHistory: unknown[];
  fixtures: unknown[];
}): boolean {
  if (!isFirstSeasonCareer(career)) return false;
  const state = load();
  if (state.dismissedHubGuide || isOnboardingComplete()) return false;
  return true;
}

/** Close the modal without wiping unfinished checklist progress. */
export function dismissManagerOnboardingModal(): void {
  const state = load();
  save({ ...state, modalDismissed: true });
}

/** Permanently dismiss (Skip) or when all steps are done. */
export function dismissManagerOnboarding(): void {
  const state = load();
  save({ ...state, dismissedHubGuide: true, modalDismissed: true });
}

export function markOnboardingStepComplete(stepId: string): void {
  const state = load();
  if (state.completedSteps.includes(stepId)) return;
  const completedSteps = [...state.completedSteps, stepId];
  const allDone = MANAGER_ONBOARDING_STEPS.every((step) =>
    completedSteps.includes(step.id)
  );
  save({
    ...state,
    completedSteps,
    dismissedHubGuide: allDone ? true : state.dismissedHubGuide,
  });
}

export function getOnboardingProgress(): ManagerOnboardingState {
  return load();
}

export function reopenManagerOnboardingModal(): void {
  const state = load();
  if (state.dismissedHubGuide) return;
  save({ ...state, modalDismissed: false });
}
