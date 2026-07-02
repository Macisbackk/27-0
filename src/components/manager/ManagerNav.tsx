"use client";

import { ClubLogoBox } from "@/components/ClubBadge";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubIndicatorColor } from "@/lib/clubs";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";

const TABS: { id: ManagerView; label: string }[] = [
  { id: "hub", label: "Hub" },
  { id: "inbox", label: "Inbox" },
  { id: "squad", label: "Squad" },
  { id: "reserves", label: "Reserves" },
  { id: "contracts", label: "Contracts" },
  { id: "transfers", label: "Transfers" },
  { id: "fixtures", label: "Fixtures" },
  { id: "stats", label: "Stats" },
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
    <header className="space-y-3">
      <div
        className={`${CARD.elevated} ${SPACING.cardPaddingSm} flex items-center gap-3 border-l-4`}
        style={{ borderLeftColor: clubAccent }}
      >
        <ClubLogoBox club={club} size="sm" className="hidden sm:flex" />
        <ClubLogoBox club={club} size="xs" className="sm:hidden" />
        <div className="min-w-0 flex-1">
          <p className={`${TYPO.sectionLabel} text-pitch-400`}>Manager Career</p>
          <h1
            className="truncate font-display text-lg font-black uppercase tracking-wide text-white sm:text-xl"
            title={club}
          >
            {club}
          </h1>
          {seasonMeta && (
            <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>{seasonMeta}</p>
          )}
        </div>
      </div>

      <nav className="manager-tab-rail -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
        {TABS.map((tab) => {
          const label =
            tab.id === "inbox" && unreadInbox > 0
              ? `Inbox (${unreadInbox > 9 ? "9+" : unreadInbox})`
              : tab.label;
          const shortLabel =
            tab.id === "contracts"
              ? "Deals"
              : tab.id === "transfers"
                ? "Market"
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
              className={`btn-press flex shrink-0 items-center justify-center text-center min-h-[38px] min-w-[4.25rem] rounded-lg px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wide transition sm:min-h-[40px] sm:w-full sm:min-w-0 sm:px-3 sm:text-xs ${
                active === tab.id ? BTN.tabActive : BTN.tabIdle
              } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
