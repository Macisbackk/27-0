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

  const seasonMetaCompact =
    seasonYear != null
      ? `S${seasonYear}${gameWeek != null ? ` · W${gameWeek}` : ""}`
      : gameWeek != null
        ? `W${gameWeek}`
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
    <header className="space-y-2 sm:space-y-3">
      <div
        className={`${managerClubAccentCardClass()} flex items-center gap-2 !border-l-[3px] !px-3 !py-2.5 sm:gap-3 sm:!border-l-4 sm:!p-6`}
        style={managerClubAccentCardStyle(club)}
      >
        <ClubLogoBox club={club} size="sm" showAbbrev={false} className="hidden sm:flex" />
        <ClubLogoBox
          club={club}
          size="xs"
          showAbbrev={false}
          className="!h-7 !w-7 shrink-0 sm:hidden"
        />
        <div className="min-w-0 flex-1">
          <p className={`${TYPO.sectionLabel} hidden text-pitch-400 sm:block`}>
            Manager Career
          </p>
          <div className="flex min-w-0 items-baseline gap-2 sm:block">
            <h1
              className="min-w-0 truncate font-display text-sm font-bold uppercase tracking-wide text-white sm:mt-0 sm:text-xl sm:font-black"
              title={club}
            >
              {club}
            </h1>
            {seasonMetaCompact && (
              <p className="shrink-0 text-[11px] text-pitch-500 sm:hidden">
                {seasonMetaCompact}
              </p>
            )}
          </div>
          {seasonMeta && (
            <p className={`mt-0.5 hidden ${TYPO.managerBody} sm:block`}>{seasonMeta}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate("inbox")}
          disabled={disabled}
          className={`btn-press relative shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border transition sm:min-h-[52px] sm:min-w-[4.75rem] sm:flex-col sm:gap-1 sm:px-3 sm:py-2 ${
            active === "inbox"
              ? "border-theme-primary/45 bg-theme-primary/12"
              : "border-pitch-600/50 bg-pitch-900/40 hover:border-pitch-500/55"
          } ${disabled ? "pointer-events-none opacity-40" : ""}`}
          aria-current={active === "inbox" ? "page" : undefined}
          aria-label={
            unreadInbox > 0 ? `Inbox, ${unreadInbox} unread` : "Inbox"
          }
        >
          <span className="text-base leading-none sm:hidden" aria-hidden>
            ✉
          </span>
          <span className="hidden font-display text-xs font-bold uppercase tracking-wide text-white sm:inline">
            Inbox
          </span>
          {unreadLabel && active !== "inbox" ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-theme-primary px-1.5 py-px text-[9px] font-bold leading-none text-[var(--theme-text-on-primary)] sm:static sm:px-1.5 sm:text-[10px]">
              {unreadLabel}
            </span>
          ) : (
            <span className={`${TYPO.managerBody} hidden text-[10px] text-pitch-500 sm:inline`}>
              Mail
            </span>
          )}
        </button>
      </div>

      <nav className={`${MANAGER.tabGrid} hidden sm:grid`} aria-label="Manager sections">
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
