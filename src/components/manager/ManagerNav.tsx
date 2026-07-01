"use client";

import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
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
  onNavigate: (view: ManagerView) => void;
  disabled?: boolean;
  unreadInbox?: number;
}

export function ManagerNav({
  active,
  club,
  onNavigate,
  disabled,
  unreadInbox = 0,
}: ManagerNavProps) {
  return (
    <header className="space-y-3">
      <div>
        <p className={TYPO.sectionLabel}>Manager Mode</p>
        <h1 className={`${TYPO.pageTitle} text-xl sm:text-2xl`}>{club}</h1>
      </div>

      <nav className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2">
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
                className={`btn-press min-h-[36px] rounded-lg px-1.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide transition sm:min-h-[40px] sm:px-3 sm:text-xs ${
                  active === tab.id ? BTN.tabActive : BTN.tabIdle
                } ${disabled ? "pointer-events-none opacity-40" : ""}`}
              >
                {label}
              </button>
            );
          })}
      </nav>
    </header>
  );
}
