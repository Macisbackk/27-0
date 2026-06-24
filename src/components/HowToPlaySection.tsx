"use client";

import { useState } from "react";
import { BTN, FILTER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

type HowToPlayMode =
  | "normal-current"
  | "normal-era"
  | "cup-current"
  | "cup-era";

const MODE_TABS: { id: HowToPlayMode; label: string; era?: boolean }[] = [
  { id: "normal-current", label: "Normal Current" },
  { id: "normal-era", label: "Normal Era", era: true },
  { id: "cup-current", label: "Challenge Cup" },
  { id: "cup-era", label: "Era Challenge Cup", era: true },
];

const MODE_COPY: Record<HowToPlayMode, string> = {
  "normal-current":
    "Pick a position, spin for a 2026 Super League club, then choose your player. Build your team and simulate the season. The goal is simple: go 27-0.",
  "normal-era":
    "Pick a position, spin for a historic Super League team-year, then choose from that exact squad. Build an era dream team and chase a perfect 27-0 season.",
  "cup-current":
    "Choose or randomise a 2026 Super League team. Set your squad, play through the bracket and try to lift the Challenge Cup.",
  "cup-era":
    "Choose a historic Super League team-year. Set your matchday squad, make position-accurate substitutions, then take that era team into the cup.",
};

export function HowToPlaySection() {
  const [mode, setMode] = useState<HowToPlayMode>("normal-current");

  return (
    <div>
      <h3 className={TYPO.sectionTitle}>How To Play</h3>

      <div className={`${FILTER.tabGroup} mt-4 flex flex-wrap gap-1`}>
        {MODE_TABS.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`${BTN.tabGroupInner} flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wide transition sm:text-sm ${
                active
                  ? tab.era
                    ? "border-2 border-accent-gold/75 bg-accent-gold text-pitch-950 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                    : "border-2 border-accent-green/75 bg-accent-green text-pitch-950 shadow-[0_0_20px_rgba(34,197,94,0.35)]"
                  : "text-gray-400 hover:border-pitch-500/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className={`mt-5 ${TYPO.bodySm} text-gray-400`}>{MODE_COPY[mode]}</p>
    </div>
  );
}
