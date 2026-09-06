"use client";

import { useCallback, useEffect, useState } from "react";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  MANAGER_MOBILE_MORE_NAV_TABS,
  MANAGER_PRIMARY_NAV_TABS,
  isManagerMobileMoreNavView,
} from "@/lib/manager/manager-nav-config";
import type { ManagerTutorialNavLock } from "@/lib/manager/managerTutorial";
import type { ManagerView } from "@/lib/manager/types";
import { playMenuClose, playMenuOpen, playTabChange } from "@/lib/sound";
import { useModalA11y } from "@/hooks/useModalA11y";

/** @deprecated Prefer ManagerTutorialNavLock — kept as alias for existing imports. */
export type ManagerMoreTutorialLock = ManagerTutorialNavLock;

interface ManagerMobileBottomNavProps {
  active: ManagerView;
  onNavigate: (view: ManagerView) => void;
  disabled?: boolean;
  unreadInbox?: number;
  /** Controlled More sheet (tutorial drives open/close). */
  moreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
  /**
   * While the tutorial is guiding nav, only this control stays interactive
   * and the nav / More sheet elevate above the tutorial dim layer.
   */
  tutorialLock?: ManagerMoreTutorialLock;
}

export function ManagerMobileBottomNav({
  active,
  onNavigate,
  disabled,
  moreOpen: moreOpenControlled,
  onMoreOpenChange,
  tutorialLock = null,
  unreadInbox = 0,
}: ManagerMobileBottomNavProps) {
  const [moreOpenUncontrolled, setMoreOpenUncontrolled] = useState(false);
  const controlled = typeof moreOpenControlled === "boolean";
  const moreOpen = controlled ? moreOpenControlled : moreOpenUncontrolled;

  const setMoreOpen = (open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === "function" ? open(moreOpen) : open;
    if (!controlled) setMoreOpenUncontrolled(next);
    onMoreOpenChange?.(next);
  };

  const dismissMore = useCallback(() => {
    if (tutorialLock) return;
    if (!controlled) setMoreOpenUncontrolled(false);
    onMoreOpenChange?.(false);
  }, [tutorialLock, controlled, onMoreOpenChange]);

  const moreActive = isManagerMobileMoreNavView(active);
  const panelRef = useModalA11y(moreOpen, dismissMore);

  // Close More when leaving compact layout (desktop).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => {
      if (mq.matches) setMoreOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only bind once
  }, []);

  const navigate = (view: ManagerView) => {
    if (disabled) return;
    if (tutorialLock && tutorialLock !== "more" && tutorialLock !== view) {
      return;
    }
    if (active !== view) playTabChange();
    onNavigate(view);
    setMoreOpen(false);
  };

  const tabLockedOut = (id: ManagerView | "more") => {
    if (!tutorialLock) return false;
    return tutorialLock !== id;
  };

  return (
    <>
      <nav
        data-manager-mobile-nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-pitch-700/50 bg-pitch-950 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:hidden"
        aria-label="Manager mobile navigation"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 overflow-hidden px-1.5 pt-2">
          {MANAGER_PRIMARY_NAV_TABS.map((tab) => {
            const isActive = active === tab.id;
            const locked = tabLockedOut(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled || locked}
                data-tutorial-target={`manager-nav-${tab.id}`}
                onClick={() => navigate(tab.id)}
                className={`btn-press relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-sm border-2 px-0.5 py-2 text-center transition ${
                  isActive
                    ? `${BTN.tabActive} shadow-[inset_0_-2px_0_0_var(--theme-text-on-primary)]`
                    : "border-transparent bg-pitch-900/50 text-pitch-300 hover:bg-pitch-800/60 hover:text-white"
                } ${
                  disabled || locked ? "pointer-events-none opacity-40" : ""
                } ${
                  tutorialLock === tab.id
                    ? "ring-2 ring-theme-primary"
                    : ""
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {tab.icon}
                </span>
                <span className="font-display text-[10px] font-bold uppercase tracking-wide leading-tight">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled || tabLockedOut("more")}
            data-tutorial-target="manager-more"
            onClick={() => {
              if (tutorialLock && tutorialLock !== "more") return;
              setMoreOpen((open) => {
                if (open) playMenuClose();
                else playMenuOpen();
                return !open;
              });
            }}
            className={`btn-press relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-sm border-2 px-0.5 py-2 text-center transition ${
              moreActive || moreOpen
                ? `${BTN.tabActive} shadow-[inset_0_-2px_0_0_var(--theme-text-on-primary)]`
                : "border-transparent bg-pitch-900/50 text-pitch-300 hover:bg-pitch-800/60 hover:text-white"
            } ${
              disabled || tabLockedOut("more")
                ? "pointer-events-none opacity-40"
                : ""
            } ${
              tutorialLock === "more" ? "ring-2 ring-theme-primary" : ""
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-current={moreActive ? "page" : undefined}
          >
            <span className="text-lg leading-none" aria-hidden>
              ⋯
            </span>
            <span className="font-display text-[10px] font-bold uppercase tracking-wide leading-tight">
              More
            </span>
            {unreadInbox > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-theme-primary px-1 text-[9px] font-bold leading-none text-[var(--theme-text-on-primary)]">
                {unreadInbox > 9 ? "9+" : unreadInbox}
              </span>
            ) : null}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          data-manager-more-sheet
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:hidden"
          onClick={() => {
            if (tutorialLock) return;
            setMoreOpen(false);
          }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="More manager sections"
            className={`w-full max-w-lg outline-none ${CARD.elevated} ${SPACING.cardPadding} ${SPACING.safeBottom} rounded-b-none rounded-t-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={`${TYPO.sectionLabel} text-pitch-300`}>
              More sections
            </p>
            <div className={`mt-3 flex flex-col gap-2 ${SPACING.stackSm}`}>
              {MANAGER_MOBILE_MORE_NAV_TABS.map((item) => {
                const isActive = active === item.id;
                const locked = tabLockedOut(item.id);
                const isTutorialTarget = tutorialLock === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={locked}
                    data-tutorial-target={`manager-nav-${item.id}`}
                    onClick={() => navigate(item.id)}
                    className={`btn-press flex min-h-[52px] items-center gap-3 rounded-sm border px-4 py-3 text-left transition ${
                      isActive || isTutorialTarget
                        ? "border-theme-primary/55 bg-theme-primary/15 text-white ring-2 ring-theme-primary/35"
                        : "border-pitch-600/55 bg-pitch-900/70 text-pitch-100 hover:border-pitch-500/60 hover:bg-pitch-800/70"
                    } ${locked ? "pointer-events-none opacity-35" : ""}`}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pitch-950/60 text-lg"
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 font-display text-sm font-bold uppercase tracking-wide">
                      {item.label}
                    </span>
                    {item.id === "inbox" && unreadInbox > 0 ? (
                      <span className="rounded-full bg-theme-primary px-2 py-0.5 text-[10px] font-bold text-[var(--theme-text-on-primary)]">
                        {unreadInbox > 9 ? "9+" : unreadInbox}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
