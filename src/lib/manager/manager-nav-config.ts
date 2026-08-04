import type { ManagerView } from "./types";

export interface ManagerNavTab {
  id: ManagerView;
  label: string;
  shortLabel: string;
  icon: string;
}

/** Always-visible manager sections — one row on desktop; mirrors mobile bottom nav. */
export const MANAGER_PRIMARY_NAV_TABS: ManagerNavTab[] = [
  { id: "hub", label: "Hub", shortLabel: "Hub", icon: "🏠" },
  { id: "squad", label: "Squad", shortLabel: "Squad", icon: "👥" },
  { id: "reserves", label: "Reserves", shortLabel: "Res.", icon: "📋" },
  { id: "contracts", label: "Contracts", shortLabel: "Deals", icon: "📝" },
  { id: "transfers", label: "Transfers", shortLabel: "Market", icon: "💷" },
];

/** Secondary sections — mobile More sheet (inbox stays in the header on desktop). */
export const MANAGER_MORE_NAV_TABS: ManagerNavTab[] = [
  { id: "club", label: "Club", shortLabel: "Club", icon: "🏟️" },
  { id: "fixtures", label: "Fixtures", shortLabel: "Fixt.", icon: "📅" },
  { id: "across-league", label: "Across the League", shortLabel: "League", icon: "🏉" },
  { id: "stats", label: "Stats", shortLabel: "Stats", icon: "📊" },
];

/** Full desktop tab bar — all sections visible (inbox remains in the header). */
export const MANAGER_DESKTOP_NAV_TABS: ManagerNavTab[] = [
  ...MANAGER_PRIMARY_NAV_TABS,
  ...MANAGER_MORE_NAV_TABS,
];

/** Mobile More sheet — includes inbox (no header inbox on small screens). */
export const MANAGER_MOBILE_MORE_NAV_TABS: ManagerNavTab[] = [
  { id: "club", label: "Club", shortLabel: "Club", icon: "🏟️" },
  { id: "inbox", label: "Inbox", shortLabel: "Inbox", icon: "✉" },
  { id: "fixtures", label: "Fixtures", shortLabel: "Fixt.", icon: "📅" },
  { id: "across-league", label: "League", shortLabel: "League", icon: "🏉" },
  { id: "stats", label: "Stats", shortLabel: "Stats", icon: "📊" },
];

export function isManagerMobileMoreNavView(view: ManagerView): boolean {
  return MANAGER_MOBILE_MORE_NAV_TABS.some((tab) => tab.id === view);
}
