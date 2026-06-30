"use client";

import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerView } from "@/lib/manager/types";
import { playTabChange, playUiClick } from "@/lib/sound";

const TABS: { id: ManagerView; label: string }[] = [
  { id: "hub", label: "Hub" },
  { id: "squad", label: "Squad" },
  { id: "contracts", label: "Contracts" },
  { id: "reserves", label: "Reserves" },
  { id: "transfers", label: "Transfers" },
  { id: "fixtures", label: "Fixtures" },
  { id: "stats", label: "Stats" },
];

interface ManagerNavProps {
  active: ManagerView;
  club: string;
  onNavigate: (view: ManagerView) => void;
}

export function ManagerNav({ active, club, onNavigate }: ManagerNavProps) {
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
                if (active !== tab.id) playTabChange();
                playUiClick();
                onNavigate(tab.id);
              }}
              className={`btn-press shrink-0 min-h-[40px] rounded-lg px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition sm:px-4 sm:text-sm ${
                active === tab.id ? BTN.tabActive : BTN.tabIdle
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
