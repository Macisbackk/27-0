"use client";

import { useEffect, useRef, useState } from "react";
import { ClubLogoBox } from "@/components/ClubBadge";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import type { ManagerSubTabOption } from "@/components/manager/ManagerSubTabBar";
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  MANAGER_MORE_NAV_TABS,
  MANAGER_PRIMARY_NAV_TABS,
  isManagerMoreNavView,
} from "@/lib/manager/manager-nav-config";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = isManagerMoreNavView(active);

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
    setMoreOpen(false);
  };

  const unreadLabel =
    unreadInbox > 9 ? "9+" : unreadInbox > 0 ? String(unreadInbox) : null;

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [moreOpen]);

  return (
    <header className="space-y-1.5">
      <div
        className={`${managerClubAccentCardClass()} flex items-center gap-2 !border-l-[3px] !px-2.5 !py-2 sm:gap-3 sm:!px-3 sm:!py-2.5`}
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
              className="min-w-0 truncate font-display text-sm font-bold uppercase tracking-wide text-white sm:text-base"
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
        <button
          type="button"
          onClick={() => navigate("inbox")}
          disabled={disabled}
          className={`btn-press relative flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 transition sm:min-h-[40px] sm:px-2.5 ${
            active === "inbox"
              ? "border-theme-primary/45 bg-theme-primary/12"
              : "border-pitch-600/50 bg-pitch-900/40 hover:border-pitch-500/55"
          } ${disabled ? "pointer-events-none opacity-40" : ""}`}
          aria-current={active === "inbox" ? "page" : undefined}
          aria-label={
            unreadInbox > 0 ? `Inbox, ${unreadInbox} unread` : "Inbox"
          }
        >
          <span className="text-base leading-none" aria-hidden>
            ✉
          </span>
          <span className="hidden font-display text-[10px] font-bold uppercase tracking-wide text-white sm:inline">
            Inbox
          </span>
          {unreadLabel && active !== "inbox" ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-theme-primary px-1.5 py-px text-[9px] font-bold leading-none text-[var(--theme-text-on-primary)] sm:static sm:px-1.5 sm:text-[10px]">
              {unreadLabel}
            </span>
          ) : null}
        </button>
      </div>

      <div className="hidden flex-col gap-1.5 sm:flex">
        <div className="flex items-center gap-2">
          <nav
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Manager sections"
          >
            {MANAGER_PRIMARY_NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.id)}
                disabled={disabled}
                className={`btn-press shrink-0 rounded-lg px-2.5 py-2 text-center font-display text-[11px] font-bold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
                  active === tab.id ? BTN.tabActive : BTN.tabIdle
                } ${disabled ? "pointer-events-none opacity-40" : ""}`}
                aria-current={active === tab.id ? "page" : undefined}
              >
                {tab.label}
              </button>
            ))}
            <div className="relative shrink-0" ref={moreRef}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  playUiClick();
                  setMoreOpen((open) => !open);
                }}
                className={`btn-press rounded-lg px-2.5 py-2 text-center font-display text-[11px] font-bold uppercase tracking-wide transition sm:px-3 sm:text-xs ${
                  moreActive || moreOpen ? BTN.tabActive : BTN.tabIdle
                } ${disabled ? "pointer-events-none opacity-40" : ""}`}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                More
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1 min-w-[11rem] rounded-xl border border-pitch-600/60 bg-pitch-950/98 p-1 shadow-xl backdrop-blur-md"
                >
                  {MANAGER_MORE_NAV_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="menuitem"
                      onClick={() => navigate(tab.id)}
                      className={`btn-press flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-display text-xs font-bold uppercase tracking-wide transition ${
                        active === tab.id
                          ? "bg-theme-primary/15 text-white"
                          : "text-pitch-200 hover:bg-pitch-800/80 hover:text-white"
                      }`}
                    >
                      <span aria-hidden>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {contextTabs ? (
            <div className="hidden shrink-0 lg:block">
              <ManagerSubTabBar
                tabs={contextTabs.tabs}
                active={contextTabs.active}
                onChange={contextTabs.onChange}
                ariaLabel={contextTabs.ariaLabel}
                inline
              />
            </div>
          ) : null}
        </div>

        {contextTabs ? (
          <div className="flex justify-center lg:hidden">
            <ManagerSubTabBar
              tabs={contextTabs.tabs}
              active={contextTabs.active}
              onChange={contextTabs.onChange}
              ariaLabel={contextTabs.ariaLabel}
              inline
            />
          </div>
        ) : null}
      </div>

      {contextTabs ? (
        <div className="flex justify-center sm:hidden">
          <ManagerSubTabBar
            tabs={contextTabs.tabs}
            active={contextTabs.active}
            onChange={contextTabs.onChange}
            ariaLabel={contextTabs.ariaLabel}
            inline
          />
        </div>
      ) : null}
    </header>
  );
}
