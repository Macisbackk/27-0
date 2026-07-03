import type { ManagerView } from "./types";

/** Views exposed as /manager/:section path segments. */
export const MANAGER_ROUTE_SECTIONS: Partial<Record<ManagerView, string>> = {
  hub: "",
  inbox: "inbox",
  squad: "squad",
  reserves: "reserves",
  contracts: "contracts",
  transfers: "transfers",
  fixtures: "fixtures",
  "across-league": "across-league",
  stats: "stats",
  "club-select": "new",
};

const SECTION_TO_VIEW = Object.fromEntries(
  Object.entries(MANAGER_ROUTE_SECTIONS).map(([view, section]) => [
    section || "hub",
    view,
  ])
) as Record<string, ManagerView>;

export const MANAGER_NAV_VIEWS: ManagerView[] = [
  "hub",
  "inbox",
  "squad",
  "reserves",
  "contracts",
  "transfers",
  "fixtures",
  "across-league",
  "stats",
];

export function managerPathForView(view: ManagerView): string {
  if (view === "landing") return "/manager";
  const section = MANAGER_ROUTE_SECTIONS[view];
  if (section === undefined) return "/manager";
  if (section === "") return "/manager";
  return `/manager/${section}`;
}

/** Map /manager, /manager/squad, etc. to a nav view (null if not a nav section). */
export function managerViewFromPathname(pathname: string): ManagerView | null {
  const normalized = pathname.replace(/\/+$/, "") || "/manager";
  if (normalized === "/manager") return "hub";
  const match = normalized.match(/^\/manager\/([^/]+)$/);
  if (!match) return null;
  return SECTION_TO_VIEW[match[1]!] ?? null;
}

/** Legacy ?view=squad query support → path. */
export function managerPathFromLegacyViewParam(view: string | null): string | null {
  if (!view) return null;
  if (!MANAGER_NAV_VIEWS.includes(view as ManagerView) && view !== "club-select") {
    return null;
  }
  return managerPathForView(view as ManagerView);
}

export function isManagerNavView(view: ManagerView): boolean {
  return MANAGER_NAV_VIEWS.includes(view);
}
