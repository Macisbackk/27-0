"use client";

import { ClubLogoBox } from "@/components/ClubBadge";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import type { ManagerSubTabOption } from "@/components/manager/ManagerSubTabBar";
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { MANAGER_DESKTOP_NAV_TABS } from "@/lib/manager/manager-nav-config";
import {
  managerClubAccentCardClass,
  managerClubAccentCardStyle,
} from "@/lib/manager/managerSurfaces";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";

interface ManagerNavProps {
  active: ManagerView;
  club: string;
  seasonYear?: number;
  gameWeek?: number;
  onNavigate: (view: ManagerView) => void;
  disabled?: boolean;
  unreadInbox?: number;
  /** Contextual sub-tabs for the active section (e.g. Squad / Tactics). */
  contextTabs?: {
    tabs: readonly ManagerSubTabOption<string>[];
    active: string;
    onChange: (id: string) => void;
    ariaLabel?: string;
  };
}

export function ManagerNav({
  active,
  club,
  seasonYear,
  gameWeek,
  onNavigate,
  disabled,
  unreadInbox = 0,
  contextTabs,
}: ManagerNavProps) {
  const seasonMeta =
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
    <header className="space-y-1.5">
      <div
        className={`${managerClubAccentCardClass()} flex items-center gap-2 !px-2.5 !py-2 sm:gap-3 sm:!px-3 sm:!py-2.5`}
        style={managerClubAccentCardStyle(club)}
      >
        <ClubLogoBox
          club={club}
          size="xs"
          showAbbrev={false}
          className="!h-7 !w-7 shrink-0 sm:!h-8 sm:!w-8"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1
              className={`min-w-0 truncate font-display text-[length:var(--text-card-title)] font-bold uppercase tracking-wide text-white`}
              title={club}
            >
              {club}
            </h1>
            {seasonMeta && (
              <p className={`shrink-0 ${TYPO.managerBody} text-pitch-500`}>
                {seasonMeta}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="center-action-row">
        <button
          type="button"
          onClick={() => navigate("inbox")}
          disabled={disabled}
          className={`btn-press relative shrink-0 rounded-sm px-2.5 py-2 text-center font-display text-[length:var(--text-small)] font-bold uppercase tracking-wide transition sm:px-3 ${
            active === "inbox" ? BTN.tabActive : BTN.tabIdle
          } ${disabled ? "pointer-events-none opacity-40" : ""}`}
          aria-current={active === "inbox" ? "page" : undefined}
          aria-label={
            unreadInbox > 0 ? `Inbox, ${unreadInbox} unread` : "Inbox"
          }
        >
          <span className="pointer-events-none inline-flex items-center justify-center gap-1.5 leading-none">
            <span className="text-base leading-none" aria-hidden>
              ✉
            </span>
            <span>Inbox</span>
          </span>
          {unreadLabel && active !== "inbox" ? (
            <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-theme-primary px-1 text-[9px] font-bold leading-none text-[var(--theme-text-on-primary)]">
              {unreadLabel}
            </span>
          ) : null}
        </button>
      </div>

      <div className="hidden flex-col items-center gap-1.5 sm:flex">
        <nav
          className="flex w-full flex-wrap justify-center gap-1"
          aria-label="Manager sections"
        >
          {MANAGER_DESKTOP_NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.id)}
              disabled={disabled}
              className={`btn-press shrink-0 rounded-sm border-b-2 px-2.5 py-2 text-center font-display text-[length:var(--text-small)] font-bold uppercase tracking-wide transition sm:px-3 ${
                active === tab.id
                  ? `${BTN.tabActive} border-b-[var(--theme-text-on-primary)]`
                  : `${BTN.tabIdle} border-b-transparent`
              } ${disabled ? "pointer-events-none opacity-40" : ""}`}
              aria-current={active === tab.id ? "page" : undefined}
              title={tab.label}
            >
              <span className="xl:hidden">{tab.shortLabel}</span>
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Fixed sub-tab slot height so Hub↔Squad does not jump sticky nav. */}
        <div className="flex min-h-[2.75rem] w-full items-center justify-center px-1">
          {contextTabs ? (
            <ManagerSubTabBar
              tabs={contextTabs.tabs}
              active={contextTabs.active}
              onChange={contextTabs.onChange}
              ariaLabel={contextTabs.ariaLabel}
            />
          ) : null}
        </div>
      </div>

      {/* Mobile sub-tabs — only reserve height when Squad (etc.) has context tabs.
          Always reserving left a blank band under Inbox / Hub. */}
      <div
        className={`flex w-full items-center justify-center px-1 sm:hidden ${
          contextTabs ? "min-h-[2.75rem]" : ""
        }`}
      >
        {contextTabs ? (
          <ManagerSubTabBar
            tabs={contextTabs.tabs}
            active={contextTabs.active}
            onChange={contextTabs.onChange}
            ariaLabel={contextTabs.ariaLabel}
          />
        ) : null}
      </div>
    </header>
  );
}
