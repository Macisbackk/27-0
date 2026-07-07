"use client";

import { useState } from "react";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  MANAGER_MOBILE_MORE_NAV_TABS,
  MANAGER_PRIMARY_NAV_TABS,
  isManagerMobileMoreNavView,
} from "@/lib/manager/manager-nav-config";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";
import { useModalA11y } from "@/hooks/useModalA11y";

interface ManagerMobileBottomNavProps {
  active: ManagerView;
  onNavigate: (view: ManagerView) => void;
  disabled?: boolean;
}

export function ManagerMobileBottomNav({
  active,
  onNavigate,
  disabled,
}: ManagerMobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isManagerMobileMoreNavView(active);
  const panelRef = useModalA11y(moreOpen, () => setMoreOpen(false));

  const navigate = (view: ManagerView) => {
    if (disabled) return;
    if (active !== view) playTabChange();
    playUiClick();
    onNavigate(view);
    setMoreOpen(false);
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-pitch-700/50 bg-pitch-950/98 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md sm:hidden"
        aria-label="Manager mobile navigation"
      >
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-0.5 px-1.5 pt-2">
          {MANAGER_PRIMARY_NAV_TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => navigate(tab.id)}
                className={`btn-press flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-0.5 py-2 text-center transition ${
                  isActive
                    ? BTN.tabActive
                    : "border-transparent bg-pitch-900/50 text-pitch-300 hover:bg-pitch-800/60 hover:text-white"
                } ${disabled ? "pointer-events-none opacity-40" : ""}`}
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
            disabled={disabled}
            onClick={() => {
              playUiClick();
              setMoreOpen((open) => !open);
            }}
            className={`btn-press relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-0.5 py-2 text-center transition ${
              moreActive || moreOpen
                ? BTN.tabActive
                : "border-transparent bg-pitch-900/50 text-pitch-300 hover:bg-pitch-800/60 hover:text-white"
            } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <span className="text-lg leading-none" aria-hidden>
              ⋯
            </span>
            <span className="font-display text-[10px] font-bold uppercase tracking-wide leading-tight">
              More
            </span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:hidden"
          onClick={() => setMoreOpen(false)}
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
            <p className={`${TYPO.sectionLabel} text-pitch-300`}>More sections</p>
            <div className={`mt-3 flex flex-col gap-2 ${SPACING.stackSm}`}>
              {MANAGER_MOBILE_MORE_NAV_TABS.map((item) => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`btn-press flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-theme-primary/55 bg-theme-primary/15 text-white ring-2 ring-theme-primary/35"
                        : "border-pitch-600/55 bg-pitch-900/70 text-pitch-100 hover:border-pitch-500/60 hover:bg-pitch-800/70"
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pitch-950/60 text-lg"
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="font-display text-sm font-bold uppercase tracking-wide">
                      {item.label}
                    </span>
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
