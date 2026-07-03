"use client";

import { useState } from "react";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";
import { useModalA11y } from "@/hooks/useModalA11y";

const PRIMARY_TABS: {
  id: ManagerView;
  label: string;
  icon: string;
}[] = [
  { id: "hub", label: "Hub", icon: "🏠" },
  { id: "squad", label: "Squad", icon: "👥" },
  { id: "transfers", label: "Market", icon: "💷" },
  { id: "fixtures", label: "Fixtures", icon: "📅" },
];

const MORE_ITEMS: { id: ManagerView; label: string }[] = [
  { id: "reserves", label: "Reserves" },
  { id: "contracts", label: "Contracts" },
  { id: "across-league", label: "Across the League" },
  { id: "stats", label: "Stats" },
];

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
  const moreActive = MORE_ITEMS.some((item) => item.id === active);
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-pitch-700/60 bg-pitch-950/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
        aria-label="Manager mobile navigation"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pt-1.5">
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={disabled}
              onClick={() => navigate(tab.id)}
              className={`btn-press flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition ${
                active === tab.id ? BTN.tabActive : "text-pitch-400"
              } ${disabled ? "pointer-events-none opacity-40" : ""}`}
              aria-current={active === tab.id ? "page" : undefined}
            >
              <span className="text-base leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span className="font-display text-[10px] font-bold uppercase tracking-wide">
                {tab.label}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              playUiClick();
              setMoreOpen((open) => !open);
            }}
            className={`btn-press relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition ${
              moreActive || moreOpen ? BTN.tabActive : "text-pitch-400"
            } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <span className="text-base leading-none" aria-hidden>
              ⋯
            </span>
            <span className="font-display text-[10px] font-bold uppercase tracking-wide">
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
            <p className={TYPO.sectionLabel}>More sections</p>
            <div className={`mt-3 grid grid-cols-2 gap-2 ${SPACING.stackSm}`}>
              {MORE_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`btn-press rounded-lg border px-3 py-3 text-left text-sm font-semibold transition min-h-[44px] ${
                    active === item.id
                      ? "border-theme-primary/45 bg-theme-primary/12 text-white"
                      : "border-pitch-700/50 bg-pitch-900/40 text-pitch-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
