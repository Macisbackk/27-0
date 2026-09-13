/**
 * Manager Mode first-run tutorial / onboarding persistence.
 */

import { STORAGE_KEYS } from "@/lib/storage/keys";

/** Bump when tutorial content changes enough that returning users should see it again. */
export const MANAGER_TUTORIAL_VERSION = 1;

export interface ManagerOnboardingState {
  version: number;
  completed: boolean;
  completedAt?: string;
}

function readRaw(): ManagerOnboardingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.managerOnboarding);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManagerOnboardingState;
    if (typeof parsed?.version !== "number" || typeof parsed?.completed !== "boolean") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(next: ManagerOnboardingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.managerOnboarding, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

/** True when the current tutorial version has been completed (or skipped). */
export function hasCompletedManagerTutorial(): boolean {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem("managerTutorialDebug") === "1") {
        return false;
      }
    } catch {
      /* ignore */
    }
  }
  const state = readRaw();
  return !!state && state.completed && state.version >= MANAGER_TUTORIAL_VERSION;
}

export function markManagerTutorialCompleted(): void {
  writeRaw({
    version: MANAGER_TUTORIAL_VERSION,
    completed: true,
    completedAt: new Date().toISOString(),
  });
}

export function clearManagerTutorialProgress(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.managerOnboarding);
  } catch {
    /* ignore */
  }
}

export interface ManagerTutorialStep {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  /** Optional tab to jump to when finishing on this step's primary CTA */
  tabHint?: "tactics" | "transfers" | "contracts" | "inbox" | "dashboard";
}

export const MANAGER_TUTORIAL_STEPS: ManagerTutorialStep[] = [
  {
    id: "welcome",
    eyebrow: "Manager Mode",
    title: "You're in charge",
    body: "Run a Super League or Championship club week by week — pick your lineup, stay under the salary cap, and chase promotion or silverware.",
    bullets: [
      "One career save across seasons",
      "Board confidence rises and falls with results",
      "Use the tabs below the header to manage every department",
    ],
  },
  {
    id: "continue",
    eyebrow: "The weekly loop",
    title: "Press Continue to play",
    body: "The Continue button (and Play / Advance on the Dashboard) simulates the current week: fixtures, wages, recovery, and the transfer market.",
    bullets: [
      "Only unplayed fixtures for this week are simmed",
      "After your match you'll get key moments and a review",
      "Inbox messages arrive with board notes and transfer news",
    ],
  },
  {
    id: "lineup",
    eyebrow: "Matchday rule",
    title: "Name a full 17",
    body: "You cannot play a match week without 13 starters and 4 interchange. Empty or injured slots don't count.",
    bullets: [
      "Open Tactics to fill every slot",
      "Auto Pick Optimal 17 fills from your best available players",
      "AI clubs are auto-safeguarded — yours is not",
    ],
    tabHint: "tactics",
  },
  {
    id: "money",
    eyebrow: "Finances",
    title: "Watch the salary cap",
    body: "Every signing and renewal must fit your weekly cap room. Cash comes from gates and commercial income — Championship clubs earn less than Super League sides.",
    bullets: [
      "Cap room is shown in the header",
      "Marquee and young homegrown deals ease cap pressure",
      "Don't blow the budget on elites you can't retain",
    ],
  },
  {
    id: "market",
    eyebrow: "Squad building",
    title: "Transfers, loans & contracts",
    body: "Bid for players, loan for depth, and renew deals before they hit free agency. Summer (weeks 1–8) and winter (weeks 18–22) transfer windows apply — recently signed players are protected for 8 weeks.",
    bullets: [
      "Transfers — market bids and free agents",
      "Loans — short-term cover without a permanent fee",
      "Contracts — renewals, releases, and Academy / Reserves renew-all",
    ],
    tabHint: "transfers",
  },
  {
    id: "ready",
    eyebrow: "Ready",
    title: "Build your first matchday 17",
    body: "Check your Inbox for board mail, set tactics, then hit Continue when the squad is ready. Replay this guide any time from Settings.",
    bullets: [
      "Dashboard — next fixture and quick actions",
      "League / Fixtures — table and calendar",
      "Club — facilities, stadium, and finances",
    ],
    tabHint: "tactics",
  },
];
