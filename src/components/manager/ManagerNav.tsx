"use client";

import { ClubLogoBox } from "@/components/ClubBadge";
import { BTN, CARD, MANAGER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubIndicatorColor } from "@/lib/clubs";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";

const TABS: { id: ManagerView; label: string; shortLabel: string }[] = [
  { id: "hub", label: "Hub", shortLabel: "Hub" },
  { id: "inbox", label: "Inbox", shortLabel: "Inbox" },
  { id: "squad", label: "Squad", shortLabel: "Squad" },
  { id: "reserves", label: "Reserves", shortLabel: "Res." },
  { id: "contracts", label: "Contracts", shortLabel: "Deals" },
  { id: "transfers", label: "Transfers", shortLabel: "Market" },
  { id: "fixtures", label: "Fixtures", shortLabel: "Fixt." },
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

      <nav className={MANAGER.tabGrid} aria-label="Manager navigation">
        {TABS.map((tab) => {
          const label =
            tab.id === "inbox" && unreadInbox > 0
              ? `Inbox (${unreadInbox > 9 ? "9+" : unreadInbox})`
              : tab.label;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (disabled) return;
                if (active !== tab.id) playTabChange();
                playUiClick();
                onNavigate(tab.id);
              }}
              disabled={disabled}
              className={`btn-press flex min-h-[44px] items-center justify-center rounded-lg px-2 py-2.5 text-center font-display text-[10px] font-bold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
                active === tab.id ? BTN.tabActive : BTN.tabIdle
              } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
