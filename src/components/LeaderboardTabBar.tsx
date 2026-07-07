"use client";

import { TAB_RAIL } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playTabChange, playUiClick } from "@/lib/sound";

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
  scrollable?: boolean;
}

const ACCENT_ACTIVE: Record<LeaderboardTabAccent, string> = {
  theme:
    "border-theme-primary/60 bg-theme-primary/14 text-theme-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_var(--theme-glow-soft)]",
  gold:
    "border-accent-gold/60 bg-accent-gold/14 text-accent-gold shadow-[0_0_18px_rgba(251,191,36,0.2)]",
  green:
    "border-mode-current/60 bg-mode-current/14 text-mode-current shadow-[0_0_18px_var(--mode-current-glow)]",
  sky:
    "border-sky-400/55 bg-sky-500/12 text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.18)]",
  amber:
    "border-amber-400/55 bg-amber-500/12 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.16)]",
};

const ACCENT_IDLE: Record<LeaderboardTabAccent, string> = {
  theme:
    "border-pitch-600/55 bg-pitch-900/45 text-pitch-400 hover:border-theme-primary/40 hover:text-pitch-200",
  gold:
    "border-pitch-600/55 bg-pitch-900/45 text-pitch-400 hover:border-accent-gold/40 hover:text-pitch-200",
  green:
    "border-pitch-600/55 bg-pitch-900/45 text-pitch-400 hover:border-mode-current/40 hover:text-pitch-200",
  sky:
    "border-pitch-600/55 bg-pitch-900/45 text-pitch-400 hover:border-sky-400/40 hover:text-pitch-200",
  amber:
    "border-pitch-600/55 bg-pitch-900/45 text-pitch-400 hover:border-amber-400/40 hover:text-pitch-200",
};

const PLAY_STYLE_DEFAULT_ACCENT: Record<string, LeaderboardTabAccent> = {
  manager: "gold",
  quick: "green",
};

const MODE_BUTTON_BASE =
  "btn-press box-border flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 px-3 py-2.5 text-center transition";

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
  return `${MODE_BUTTON_BASE} ${TYPO.button} ${
    active ? ACCENT_ACTIVE[accent] : ACCENT_IDLE[accent]
  }`;
}

function categoryChipClass(active: boolean, accent: LeaderboardTabAccent): string {
  return `${CHIP_BUTTON_BASE} ${
    active ? ACCENT_ACTIVE[accent] : ACCENT_IDLE[accent]
  }`;
}

function periodButtonClass(active: boolean): string {
  const base =
    "btn-press rounded-lg px-3.5 py-2 font-display text-[10px] font-bold uppercase tracking-[0.14em] transition min-h-[40px]";
  return active
    ? `${base} bg-pitch-800/90 text-white ring-1 ring-theme-tertiary/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`
    : `${base} text-pitch-500 hover:bg-pitch-800/50 hover:text-pitch-300`;
}

function playStyleButtonClass(
  active: boolean,
  accent: LeaderboardTabAccent
): string {
  const base = `${MODE_BUTTON_BASE} text-sm sm:text-base ${TYPO.button}`;
  if (!active) {
    return `${base} border-transparent bg-transparent text-pitch-500 hover:bg-pitch-800/40 hover:text-pitch-300`;
  }
  return `${base} ${ACCENT_ACTIVE[accent]}`;
}

export function LeaderboardTabBar<T extends string>({
  tier,
  tabs,
  active,
  onChange,
  ariaLabel,
  scrollable = false,
}: LeaderboardTabBarProps<T>) {
  const handleSelect = (id: T) => {
    if (id === active) return;
    playTabChange();
    playUiClick();
    onChange(id);
  };

  if (tier === "playStyle") {
    return (
      <div
        className="rounded-2xl border border-pitch-600/55 bg-gradient-to-b from-pitch-900/90 to-pitch-950/95 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)]"
        role="tablist"
        aria-label={ariaLabel}
      >
        <div className="grid grid-cols-2 gap-1.5">
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
    return (
      <div
        className={`grid gap-2 ${
          tabs.length > 2
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2"
        }`}
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
    const railClass = scrollable
      ? TAB_RAIL.outer
      : "flex justify-start sm:justify-center";

    return (
      <div className={railClass}>
        <div
          className={`${scrollable ? TAB_RAIL.inner : "flex flex-wrap justify-center"} gap-2`}
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
                className={`${categoryChipClass(isActive, accent)}${
                  scrollable ? ` ${TAB_RAIL.item}` : ""
                }`}
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
      className="flex justify-center rounded-xl border border-pitch-700/55 bg-pitch-950/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
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
