"use client";

import { playTabChange } from "@/lib/sound";

export type LeaderboardTabAccent = "theme" | "gold" | "green" | "sky" | "amber";

export type LeaderboardTabTier = "playStyle" | "mode" | "category" | "period";

export interface LeaderboardTabOption<T extends string> {
  id: T;
  label: string;
  accent?: LeaderboardTabAccent;
}

interface LeaderboardTabBarProps<T extends string> {
  tier: LeaderboardTabTier;
  tabs: readonly LeaderboardTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  /** @deprecated Category tabs always wrap and centre; kept for call-site compat. */
  scrollable?: boolean;
}

/* The pitch look (see src/styles/pitch.css): a dark track, the active tab white; Manager / gold
   tabs take the Era parchment so the mode still reads at a glance. */
const ACTIVE_WHITE = "border-transparent bg-white text-pitch-950";
const ACCENT_ACTIVE: Record<LeaderboardTabAccent, string> = {
  theme: ACTIVE_WHITE,
  gold: "border-transparent bg-mode-era text-pitch-950",
  green: ACTIVE_WHITE,
  sky: ACTIVE_WHITE,
  amber: ACTIVE_WHITE,
};

const IDLE_IN_TRACK = "border-transparent bg-transparent text-white/70 hover:text-white";
const ACCENT_IDLE: Record<LeaderboardTabAccent, string> = {
  theme: IDLE_IN_TRACK,
  gold: IDLE_IN_TRACK,
  green: IDLE_IN_TRACK,
  sky: IDLE_IN_TRACK,
  amber: IDLE_IN_TRACK,
};

/** Category chips sit on the page, not in a track: idle chips are raised tiles. */
const CHIP_IDLE = "border-transparent bg-pitch-900 text-white hover:bg-pitch-800";

/** The dark well tab groups sit in. */
const TRACK = "rounded-control bg-black/40 p-1 shadow-[inset_0_0_0_1px_var(--fl-line)]";

const PLAY_STYLE_DEFAULT_ACCENT: Record<string, LeaderboardTabAccent> = {
  manager: "gold",
  quick: "green",
};

const MODE_BUTTON_BASE =
  "btn-press box-border flex min-h-[44px] w-full items-center justify-center rounded-[10px] border-2 px-3 py-2 text-center font-cond text-[16px] font-bold transition";

const CHIP_BUTTON_BASE =
  "btn-press shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition min-h-[44px]";

function resolveAccent<T extends string>(
  tab: LeaderboardTabOption<T>,
  tier: LeaderboardTabTier
): LeaderboardTabAccent {
  if (tab.accent) return tab.accent;
  if (tier === "playStyle") {
    return PLAY_STYLE_DEFAULT_ACCENT[tab.id] ?? "theme";
  }
  return "theme";
}

function modeButtonClass(active: boolean, accent: LeaderboardTabAccent): string {
  // One row on a 375px phone: tighter padding and a smaller label below `sm`.
  return `${MODE_BUTTON_BASE} max-sm:px-1 max-sm:text-[15px] ${
    active ? ACCENT_ACTIVE[accent] : ACCENT_IDLE[accent]
  }`;
}

function categoryChipClass(active: boolean, accent: LeaderboardTabAccent): string {
  return `${CHIP_BUTTON_BASE} ${active ? ACCENT_ACTIVE[accent] : CHIP_IDLE}`;
}

function periodButtonClass(active: boolean): string {
  const base =
    "btn-press rounded-full px-3.5 py-2 text-xs font-semibold transition min-h-[40px]";
  return active
    ? `${base} bg-pitch-950 text-white`
    : `${base} text-[color:var(--fl-muted)] hover:text-white`;
}

function playStyleButtonClass(
  active: boolean,
  accent: LeaderboardTabAccent
): string {
  const base = MODE_BUTTON_BASE;
  if (!active) {
    return `${base} ${IDLE_IN_TRACK}`;
  }
  return `${base} ${ACCENT_ACTIVE[accent]}`;
}

export function LeaderboardTabBar<T extends string>({
  tier,
  tabs,
  active,
  onChange,
  ariaLabel,
  scrollable: _scrollable = false,
}: LeaderboardTabBarProps<T>) {
  const handleSelect = (id: T) => {
    if (id === active) return;
    playTabChange();
    onChange(id);
  };

  if (tier === "playStyle") {
    return (
      <div
        className={TRACK}
        role="tablist"
        aria-label={ariaLabel}
      >
        <div className="grid grid-cols-2 gap-1">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            const accent = resolveAccent(tab, tier);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={playStyleButtonClass(isActive, accent)}
                onClick={() => handleSelect(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (tier === "mode") {
    const cols =
      tabs.length === 3
        ? "grid-cols-3"
        : tabs.length === 4
          ? "grid-cols-4"
          : tabs.length > 2
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2";
    return (
      <div
        className={`grid gap-1 ${cols} ${TRACK}`}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const accent = resolveAccent(tab, tier);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={modeButtonClass(isActive, accent)}
              onClick={() => handleSelect(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (tier === "category") {
    return (
      <div className="flex justify-center">
        <div
          className="flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label={ariaLabel}
        >
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            const accent = resolveAccent(tab, tier);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={categoryChipClass(isActive, accent)}
                onClick={() => handleSelect(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex justify-center rounded-full bg-pitch-900 p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="inline-flex flex-wrap justify-center gap-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={periodButtonClass(isActive)}
              onClick={() => handleSelect(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
