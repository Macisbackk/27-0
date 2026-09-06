import type { ManagerView } from "./types";

export interface ManagerNavTab {
  id: ManagerView;
  label: string;
  shortLabel: string;
  icon: string;
}

/**
 * Mobile bottom bar — only the addictive loop.
 * Hub | Squad | Transfers | Fixtures | More
 */
export const MANAGER_PRIMARY_NAV_TABS: ManagerNavTab[] = [
  { id: "hub", label: "Hub", shortLabel: "Hub", icon: "🏠" },
  { id: "squad", label: "Squad", shortLabel: "Squad", icon: "👥" },
  { id: "transfers", label: "Transfers", shortLabel: "Market", icon: "💷" },
  { id: "fixtures", label: "Fixtures", shortLabel: "Play", icon: "🏉" },
];

/** Desktop tab bar — all management sections visible. Inbox stays in the header. */
export const MANAGER_DESKTOP_NAV_TABS: ManagerNavTab[] = [
  { id: "hub", label: "Hub", shortLabel: "Hub", icon: "🏠" },
  { id: "squad", label: "Squad", shortLabel: "Squad", icon: "👥" },
  { id: "reserves", label: "Reserves", shortLabel: "Res.", icon: "📋" },
  { id: "contracts", label: "Contracts", shortLabel: "Deals", icon: "📝" },
  { id: "transfers", label: "Transfers", shortLabel: "Market", icon: "💷" },
  { id: "club", label: "Club", shortLabel: "Club", icon: "🏟️" },
  { id: "fixtures", label: "Fixtures", shortLabel: "Fixt.", icon: "📅" },
  { id: "across-league", label: "Across the League", shortLabel: "League", icon: "🏉" },
  { id: "stats", label: "Stats", shortLabel: "Stats", icon: "📊" },
];

/** Mobile More sheet — secondary management, one tap each. */
export const MANAGER_MOBILE_MORE_NAV_TABS: ManagerNavTab[] = [
  { id: "inbox", label: "Inbox", shortLabel: "Inbox", icon: "✉" },
  { id: "reserves", label: "Reserves", shortLabel: "Res.", icon: "📋" },
  { id: "contracts", label: "Contracts", shortLabel: "Deals", icon: "📝" },
  { id: "club", label: "Club", shortLabel: "Club", icon: "🏟️" },
  { id: "across-league", label: "League", shortLabel: "League", icon: "📊" },
  { id: "stats", label: "Stats", shortLabel: "Stats", icon: "📈" },
  { id: "settings", label: "Settings", shortLabel: "Settings", icon: "⚙" },
];

/** @deprecated Alias — desktop no longer mirrors the mobile primary row. */
export const MANAGER_MORE_NAV_TABS: ManagerNavTab[] = MANAGER_MOBILE_MORE_NAV_TABS.filter(
  (tab) => tab.id !== "inbox" && tab.id !== "settings"
);

export function isManagerMobileMoreNavView(view: ManagerView): boolean {
  return MANAGER_MOBILE_MORE_NAV_TABS.some((tab) => tab.id === view);
}
