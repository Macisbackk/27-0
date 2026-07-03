"use client";

import { ClubLogoBox } from "@/components/ClubBadge";
import { BTN, MANAGER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  managerClubAccentCardClass,
  managerClubAccentCardStyle,
} from "@/lib/manager/managerSurfaces";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";

const MAIN_TABS: { id: ManagerView; label: string; shortLabel: string }[] = [
  { id: "hub", label: "Hub", shortLabel: "Hub" },
  { id: "squad", label: "Squad", shortLabel: "Squad" },
  { id: "reserves", label: "Reserves", shortLabel: "Res." },
  { id: "contracts", label: "Contracts", shortLabel: "Deals" },
  { id: "transfers", label: "Transfers", shortLabel: "Market" },
  { id: "fixtures", label: "Fixtures", shortLabel: "Fixt." },
  { id: "across-league", label: "Across the League", shortLabel: "League" },
  { id: "stats", label: "Stats", shortLabel: "Stats" },
];

interface ManagerNavProps {
  active: ManagerView;
  club: string;
  seasonYear?: number;
  gameWeek?: number;
  onNavigate: (view: ManagerView) => void;
  disabled?: boolean;
  unreadInbox?: number;
}

export function ManagerNav({
  active,
  club,
  seasonYear,
  gameWeek,
  onNavigate,
  disabled,
  unreadInbox = 0,
}: ManagerNavProps) {
  const seasonMeta =
    seasonYear != null
      ? `Season ${seasonYear}${gameWeek != null ? ` · Week ${gameWeek}` : ""}`
      : gameWeek != null
        ? `Week ${gameWeek}`
        : null;

  const navigate = (tab: ManagerView) => {
    if (disabled) return;
    if (active !== tab) playTabChange();
    playUiClick();
    onNavigate(tab);
  };

  const unreadLabel =
    unreadInbox > 9 ? "9+" : unreadInbox > 0 ? String(unreadInbox) : null;

  return (
    <header className="space-y-2.5 sm:space-y-3">
      <div
        className={`${managerClubAccentCardClass()} flex items-center gap-3`}
        style={managerClubAccentCardStyle(club)}
      >
        <ClubLogoBox club={club} size="sm" className="hidden sm:flex" />
        <ClubLogoBox club={club} size="xs" className="sm:hidden" />
        <div className="min-w-0 flex-1">
          <p className={`${TYPO.sectionLabel} text-pitch-400`}>Manager Career</p>
          <h1
            className="truncate font-display text-base font-black uppercase tracking-wide text-white sm:text-xl"
            title={club}
          >
            {club}
          </h1>
          {seasonMeta && (
            <p className={`mt-0.5 ${TYPO.managerBody}`}>{seasonMeta}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate("inbox")}
          disabled={disabled}
          className={`btn-press relative shrink-0 flex min-h-[52px] min-w-[4.25rem] flex-col items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-center transition sm:min-w-[4.75rem] sm:px-3 ${
            active === "inbox"
              ? "border-theme-primary/45 bg-theme-primary/12"
              : "border-pitch-600/50 bg-pitch-900/40 hover:border-pitch-500/55"
          } ${disabled ? "pointer-events-none opacity-40" : ""}`}
          aria-current={active === "inbox" ? "page" : undefined}
          aria-label={
            unreadInbox > 0 ? `Inbox, ${unreadInbox} unread` : "Inbox"
          }
        >
          <span className="font-display text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">
            Inbox
          </span>
          {unreadLabel && active !== "inbox" ? (
            <span className="rounded-full bg-theme-primary px-1.5 py-px text-[9px] font-bold leading-none text-[var(--theme-text-on-primary)] sm:text-[10px]">
              {unreadLabel}
            </span>
          ) : (
            <span className={`${TYPO.managerBody} text-[9px] text-pitch-500 sm:text-[10px]`}>
              Mail
            </span>
          )}
        </button>
      </div>

      <nav className={MANAGER.tabGrid} aria-label="Manager sections">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.id)}
            disabled={disabled}
            className={`btn-press shrink-0 min-w-[4.25rem] flex min-h-[44px] items-center justify-center rounded-lg px-2.5 py-2.5 text-center font-display text-xs font-bold uppercase tracking-wide transition sm:min-w-0 sm:px-3 ${
              active === tab.id ? BTN.tabActive : BTN.tabIdle
            } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            aria-current={active === tab.id ? "page" : undefined}
          >
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
