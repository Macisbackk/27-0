"use client";

import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerView } from "@/lib/manager/types";
import { countUnreadInbox } from "@/lib/manager/managerInbox";
import { playTabChange, playUiClick } from "@/lib/sound";

const TABS: { id: ManagerView; label: string }[] = [
  { id: "hub", label: "Hub" },
  { id: "squad", label: "Squad" },
  { id: "contracts", label: "Contracts" },
  { id: "reserves", label: "Reserves" },
  { id: "inbox", label: "Inbox" },
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

export function ManagerNav({ active, club, onNavigate, disabled, unreadInbox = 0 }: ManagerNavProps) {
  return (
    <header className="space-y-3">
      <div>
        <p className={TYPO.sectionLabel}>Manager Mode</p>
        <h1 className={`${TYPO.pageTitle} text-xl sm:text-2xl`}>{club}</h1>
      </div>

      <nav className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {TABS.map((tab) => (
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
              className={`btn-press shrink-0 min-h-[40px] rounded-lg px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition sm:px-4 sm:text-sm ${
                active === tab.id ? BTN.tabActive : BTN.tabIdle
              } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            >
              {tab.label}
              {tab.id === "inbox" && unreadInbox > 0 && (
                <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent-gold px-1 text-[10px] font-bold text-pitch-950">
                  {unreadInbox > 9 ? "9+" : unreadInbox}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
