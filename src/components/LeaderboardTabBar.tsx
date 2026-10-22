"use client";

import { TYPO } from "@/lib/ui/typography";
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

const ACCENT_ACTIVE: Record<LeaderboardTabAccent, string> = {
  theme:
    "border-transparent bg-theme-primary/15 text-theme-primary",
  gold:
    "border-transparent bg-accent-gold/15 text-accent-gold",
  green:
    "border-transparent bg-mode-current/15 text-mode-current",
  sky:
    "border-transparent bg-sky-500/15 text-sky-300",
  amber:
    "border-transparent bg-amber-500/15 text-amber-300",
};

const ACCENT_IDLE: Record<LeaderboardTabAccent, string> = {
  theme:
    "border-transparent bg-pitch-900 text-[color:var(--fl-muted)] hover:bg-pitch-800 hover:text-white",
  gold:
    "border-transparent bg-pitch-900 text-[color:var(--fl-muted)] hover:bg-pitch-800 hover:text-white",
  green:
    "border-transparent bg-pitch-900 text-[color:var(--fl-muted)] hover:bg-pitch-800 hover:text-white",
  sky:
    "border-transparent bg-pitch-900 text-[color:var(--fl-muted)] hover:bg-pitch-800 hover:text-white",
  amber:
    "border-transparent bg-pitch-900 text-[color:var(--fl-muted)] hover:bg-pitch-800 hover:text-white",
};

const PLAY_STYLE_DEFAULT_ACCENT: Record<string, LeaderboardTabAccent> = {
  manager: "gold",
  quick: "green",
};

const MODE_BUTTON_BASE =
  "btn-press box-border flex min-h-[48px] w-full items-center justify-center rounded-control border-2 px-3 py-2.5 text-center transition";

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
    "btn-press rounded-full px-3.5 py-2 text-xs font-semibold transition min-h-[40px]";
  return active
    ? `${base} bg-pitch-950 text-white`
    : `${base} text-[color:var(--fl-muted)] hover:text-white`;
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
        className="rounded-control border border-pitch-600/55 bg-pitch-950/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
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
    const cols =
      tabs.length === 3
        ? "grid-cols-3"
        : tabs.length > 2
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2";
    return (
      <div
        className={`grid gap-2 ${cols}`}
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
