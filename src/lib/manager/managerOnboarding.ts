import { STORAGE_KEYS } from "../storage/keys";

const KEY = STORAGE_KEYS.managerOnboarding;

export interface ManagerOnboardingState {
  dismissedHubGuide: boolean;
  completedSteps: string[];
}

const DEFAULT: ManagerOnboardingState = {
  dismissedHubGuide: false,
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
    body: "Use Play Match for live tactics or Simulate for a quick result.",
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

export function shouldShowManagerOnboarding(career: {
  seasonHistory: unknown[];
  fixtures: unknown[];
}): boolean {
  if (career.seasonHistory.length > 0) return false;
  if (career.fixtures.length > 3) return false;
  return !load().dismissedHubGuide;
}

export function dismissManagerOnboarding(): void {
  const state = load();
  save({ ...state, dismissedHubGuide: true });
}

export function markOnboardingStepComplete(stepId: string): void {
  const state = load();
  if (state.completedSteps.includes(stepId)) return;
  save({
    ...state,
    completedSteps: [...state.completedSteps, stepId],
  });
}

export function getOnboardingProgress(): ManagerOnboardingState {
  return load();
}
