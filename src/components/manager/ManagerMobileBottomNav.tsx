"use client";

import { useCallback, useEffect, useState } from "react";
import { SPACING } from "@/lib/ui/design-system";
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/5 bg-[#070b0a] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden"
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
                className={`btn-press relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-none border-0 bg-transparent px-0.5 py-1.5 text-center transition ${
                  isActive
                    ? "text-theme-primary"
                    : "text-pitch-400 hover:text-white"
                } ${
                  disabled || locked ? "pointer-events-none opacity-40" : ""
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {tab.icon}
                </span>
                <span className="text-[11px] font-medium leading-tight">
                  {tab.shortLabel}
                </span>
                {isActive ? (
                  <span className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-theme-primary" />
                ) : null}
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
            className={`btn-press relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-none border-0 bg-transparent px-0.5 py-1.5 text-center transition ${
              moreActive || moreOpen
                ? "text-theme-primary"
                : "text-pitch-400 hover:text-white"
            } ${
              disabled || tabLockedOut("more")
                ? "pointer-events-none opacity-40"
                : ""
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-current={moreActive ? "page" : undefined}
          >
            <span className="text-lg leading-none" aria-hidden>
              ⋯
            </span>
            <span className="text-[11px] font-medium leading-tight">
              More
            </span>
            {moreActive || moreOpen ? (
              <span className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-theme-primary" />
            ) : null}
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
            className={`w-full max-w-lg outline-none bg-[#0c1210] px-4 pt-4 ${SPACING.safeBottom} rounded-t-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-medium text-pitch-500">
              More
            </p>
            <div className="mt-2 flex flex-col">
              {MANAGER_MOBILE_MORE_NAV_TABS.map((item) => {
                const isActive = active === item.id;
                const locked = tabLockedOut(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={locked}
                    data-tutorial-target={`manager-nav-${item.id}`}
                    onClick={() => navigate(item.id)}
                    className={`btn-press flex min-h-[52px] items-center gap-3 border-b border-white/5 px-1 py-3 text-left transition ${
                      isActive
                        ? "text-theme-primary"
                        : "text-white"
                    } ${locked ? "pointer-events-none opacity-35" : ""}`}
                  >
                    <span
                      className="w-6 shrink-0 text-center text-base"
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium">
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
