import type { ManagerView } from "./types";

/** Views exposed as /manager/:section path segments. */
export const MANAGER_ROUTE_SECTIONS: Partial<Record<ManagerView, string>> = {
  hub: "hub",
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
    section,
    view,
  ])
) as Record<string, ManagerView>;

/** Squad page sub-tabs — reflected in the URL (/manager/squad/tactics). */
export const SQUAD_SUB_TABS = ["squad", "tactics"] as const;
export type SquadSubTab = (typeof SQUAD_SUB_TABS)[number];

export const SQUAD_SUB_TAB_OPTIONS: { id: SquadSubTab; label: string }[] = [
  { id: "squad", label: "Squad" },
  { id: "tactics", label: "Tactics" },
];

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

export interface ParsedManagerPath {
  view: ManagerView | null;
  squadSubTab: SquadSubTab | null;
}

export function parseManagerPathname(pathname: string): ParsedManagerPath {
  const normalized = pathname.replace(/\/+$/, "") || "/manager";
  if (normalized === "/manager") {
    return { view: null, squadSubTab: null };
  }

  const squadMatch = normalized.match(/^\/manager\/squad(?:\/(tactics))?$/);
  if (squadMatch) {
    return {
      view: "squad",
      squadSubTab: squadMatch[1] === "tactics" ? "tactics" : "squad",
    };
  }

  const singleMatch = normalized.match(/^\/manager\/([^/]+)$/);
  if (!singleMatch) {
    return { view: null, squadSubTab: null };
  }

  return {
    view: SECTION_TO_VIEW[singleMatch[1]!] ?? null,
    squadSubTab: null,
  };
}

export function managerPathForView(view: ManagerView): string {
  if (view === "landing") return "/manager";
  if (view === "tactics") return managerPathForSquadTab("tactics");
  const section = MANAGER_ROUTE_SECTIONS[view];
  if (section === undefined) return "/manager";
  return `/manager/${section}`;
}

export function managerPathForSquadTab(tab: SquadSubTab = "squad"): string {
  if (tab === "tactics") return "/manager/squad/tactics";
  return "/manager/squad";
}

/** Map /manager/hub, /manager/squad, /manager/squad/tactics, etc. to a nav view. */
export function managerViewFromPathname(pathname: string): ManagerView | null {
  return parseManagerPathname(pathname).view;
}

export function managerSquadSubTabFromPathname(pathname: string): SquadSubTab {
  return parseManagerPathname(pathname).squadSubTab ?? "squad";
}

/** Legacy ?view=squad query support → path. */
export function managerPathFromLegacyViewParam(view: string | null): string | null {
  if (!view) return null;
  if (view === "tactics") return managerPathForSquadTab("tactics");
  if (!MANAGER_NAV_VIEWS.includes(view as ManagerView) && view !== "club-select") {
    return null;
  }
  return managerPathForView(view as ManagerView);
}

export function isManagerNavView(view: ManagerView): boolean {
  return MANAGER_NAV_VIEWS.includes(view);
}

/** Full-screen flows that are not reflected in the URL. */
export const MANAGER_OVERLAY_VIEWS: ManagerView[] = [
  "match-review",
  "season-review",
  "development-review",
  "season-rewards",
  "landing",
  "club-select",
];

export function isManagerOverlayView(view: ManagerView): boolean {
  return MANAGER_OVERLAY_VIEWS.includes(view);
}

/** Overlays driven by React state only — not reflected in the URL. */
export const MANAGER_STATE_OVERLAY_VIEWS: ManagerView[] = [
  "match-review",
  "season-review",
  "development-review",
  "season-rewards",
];

export function isManagerStateOverlayView(view: ManagerView): boolean {
  return MANAGER_STATE_OVERLAY_VIEWS.includes(view);
}

/** Map pathname to a routable manager screen (landing, club-select, or nav tab). */
export function resolveManagerScreenFromPathname(pathname: string): ManagerView | null {
  const fromPath = managerViewFromPathname(pathname);
  if (fromPath === "club-select") return "club-select";
  const normalized = pathname.replace(/\/+$/, "") || "/manager";
  if (normalized === "/manager") return "landing";
  if (fromPath && isManagerNavView(fromPath)) return fromPath;
  return null;
}

/** Single render-time view: overlays first; URL is source of truth for tabs. */
export function resolveManagerDisplayView(
  pathname: string,
  stateView: ManagerView
): ManagerView {
  if (isManagerStateOverlayView(stateView)) {
    return stateView;
  }

  const fromUrl = resolveManagerScreenFromPathname(pathname);
  if (fromUrl) {
    return fromUrl;
  }

  if (isManagerNavView(stateView)) {
    return stateView;
  }
  return stateView;
}

export function resolveSquadSubTabDisplay(pathname: string): SquadSubTab {
  return managerSquadSubTabFromPathname(pathname);
}
