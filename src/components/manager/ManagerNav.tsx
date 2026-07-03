"use client";

import { ClubLogoBox } from "@/components/ClubBadge";
import { BTN, CARD, MANAGER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubIndicatorColor } from "@/lib/clubs";
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
  const clubAccent = getClubIndicatorColor(club);
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

  const inboxLabel =
    unreadInbox > 0
      ? `Inbox (${unreadInbox > 9 ? "9+" : unreadInbox})`
      : "Inbox";

  return (
    <header className="space-y-2.5 sm:space-y-3">
      <div
        className={`${CARD.elevated} ${SPACING.cardPaddingMobile} flex items-center gap-3 border-l-4`}
        style={{ borderLeftColor: clubAccent }}
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
      </div>

      <button
        type="button"
        onClick={() => navigate("inbox")}
        disabled={disabled}
        className={`btn-press flex min-h-[44px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition ${
          active === "inbox"
            ? "border-theme-primary/50 bg-theme-primary/15"
            : "border-pitch-700/50 bg-pitch-900/40 hover:border-pitch-500/60"
        } ${disabled ? "pointer-events-none opacity-40" : ""}`}
        aria-current={active === "inbox" ? "page" : undefined}
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-xs font-bold uppercase tracking-wide text-white">
            {inboxLabel}
          </span>
          <span className={`${TYPO.managerBody} text-pitch-500`}>
            Messages & transfer offers
          </span>
        </span>
        {unreadInbox > 0 && active !== "inbox" && (
          <span className="rounded-full bg-theme-primary px-2 py-0.5 text-[10px] font-bold text-[var(--theme-text-on-primary)]">
            {unreadInbox > 9 ? "9+" : unreadInbox}
          </span>
        )}
      </button>

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
