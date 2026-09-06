import type { ManagerView } from "./types";

export type ManagerMoreItem =
  | {
      kind: "view";
      id: ManagerView;
      label: string;
      tutorialTarget?: string;
    }
  | { kind: "href"; href: string; label: string }
  | { kind: "action"; action: "cup" | "playoffs"; label: string };

export const MANAGER_MOBILE_MORE_GROUPS: {
  title: string;
  items: ManagerMoreItem[];
}[] = [
  {
    title: "Club",
    items: [
      {
        kind: "view",
        id: "club",
        label: "Club Office",
        tutorialTarget: "manager-nav-club",
      },
      {
        kind: "view",
        id: "contracts",
        label: "Contracts",
        tutorialTarget: "manager-nav-contracts",
      },
      {
        kind: "view",
        id: "reserves",
        label: "Reserves",
        tutorialTarget: "manager-nav-reserves",
      },
    ],
  },
  {
    title: "Competitions",
    items: [
      { kind: "view", id: "across-league", label: "League" },
      { kind: "action", action: "cup", label: "Challenge Cup" },
      { kind: "action", action: "playoffs", label: "Playoffs" },
    ],
  },
  {
    title: "Information",
    items: [
      {
        kind: "view",
        id: "stats",
        label: "Stats",
        tutorialTarget: "manager-nav-stats",
      },
      {
        kind: "view",
        id: "inbox",
        label: "Inbox",
        tutorialTarget: "manager-nav-inbox",
      },
      { kind: "href", href: "/collection", label: "Player Showcase" },
    ],
  },
  {
    title: "Game",
    items: [
      { kind: "href", href: "/store", label: "Store" },
      { kind: "view", id: "settings", label: "Settings" },
    ],
  },
];

export const MOBILE_SCREEN_TITLES: Partial<Record<ManagerView, string>> = {
  hub: "Hub",
  squad: "Squad",
  transfers: "Transfers",
  fixtures: "Fixtures",
  inbox: "Inbox",
  reserves: "Reserves",
  contracts: "Contracts",
  club: "Club",
  "across-league": "League",
  stats: "Stats",
  settings: "Settings",
};

export const PRIMARY_MOBILE_VIEWS = [
  "hub",
  "squad",
  "transfers",
  "fixtures",
] as const;

export function isPrimaryMobileView(
  view: ManagerView
): view is (typeof PRIMARY_MOBILE_VIEWS)[number] {
  return (PRIMARY_MOBILE_VIEWS as readonly string[]).includes(view);
}
