import type { CSSProperties, ReactNode } from "react";
import {
  CLUB_CHOICE_CARD_CLASS,
  getClubChoiceCardStyle,
} from "@/lib/clubs";

/** Shared Rugby League card design tokens. */
export const RL_CARD_SHADOW = "shadow-lg";
export const RL_CARD_RADIUS = "rounded-lg";
export const RL_CARD_BORDER = "border-2 border-solid";
export const RL_INFO_BOX_CLASS =
  "rl-stat-box rounded-lg border border-pitch-600/40 bg-pitch-900/55";
export const RL_STAT_LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-wider text-gray-500";
export const RL_SECTION_TITLE_CLASS =
  "font-display text-xs font-bold uppercase tracking-[0.2em] text-accent-green";

export const RL_FILTER_INPUT_CLASS =
  "w-full rounded-lg border border-pitch-600 bg-pitch-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-accent-green";

export const RL_FILTER_CHIP_ACTIVE =
  "border-accent-green/50 bg-accent-green/10 text-accent-green";

export const RL_FILTER_CHIP_IDLE =
  "border-pitch-600 text-gray-400 hover:text-white";

export const ACHIEVEMENT_BADGE_CLASSES: Record<
  "gold" | "green" | "purple" | "blue" | "silver",
  string
> = {
  gold: "rl-achievement rl-achievement-gold",
  green: "rl-achievement rl-achievement-green",
  purple: "rl-achievement rl-achievement-purple",
  blue: "rl-achievement rl-achievement-blue",
  silver: "rl-achievement rl-achievement-silver",
};

interface RLCardShellProps {
  club: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function RLCardShell({
  club,
  children,
  className = "",
  style,
}: RLCardShellProps) {
  return (
    <div
      className={`rl-player-card flex flex-col overflow-hidden ${RL_CARD_RADIUS} ${RL_CARD_BORDER} ${RL_CARD_SHADOW} ${CLUB_CHOICE_CARD_CLASS} ${className}`}
      style={{ ...getClubChoiceCardStyle(club), ...style }}
    >
      {children}
    </div>
  );
}

export function RLInfoBox({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${RL_INFO_BOX_CLASS} ${className}`}>{children}</div>
  );
}

export function RLStatBox({
  label,
  value,
  highlight,
  large,
  light,
  prominent,
  compact,
  className = "",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  large?: boolean;
  light?: boolean;
  prominent?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${RL_INFO_BOX_CLASS} ${
        compact ? "px-1.5 py-1" : large ? "px-2.5 py-2" : "px-2 py-1.5"
      } ${className}`}
    >
      <p
        className={`${RL_STAT_LABEL_CLASS} ${
          compact ? "text-[8px] tracking-wide" : ""
        }`}
      >
        {label}
      </p>
      <p
        className={`truncate font-medium text-white ${
          prominent
            ? "text-lg font-bold sm:text-xl"
            : compact
              ? "text-[10px] leading-tight sm:text-sm"
              : light
                ? "font-normal text-gray-300"
                : large
                  ? "text-sm"
                  : "text-[11px]"
        } ${highlight ? "!text-accent-gold" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function RLRatingDisplay({
  rating,
  large,
  compact,
  className = "",
}: {
  rating: number;
  large?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`shrink-0 text-center ${className}`}>
      <p
        className={`font-bold uppercase tracking-wider text-accent-green/80 ${
          compact ? "text-[7px]" : large ? "text-[10px]" : "text-[8px]"
        }`}
      >
        Rating
      </p>
      <p
        className={`rl-rating-value font-display font-black leading-none text-accent-green drop-shadow-[0_0_14px_rgba(34,197,94,0.5)] ${
          compact
            ? "text-2xl sm:text-6xl"
            : large
              ? "text-5xl sm:text-6xl"
              : "text-2xl sm:text-3xl"
        }`}
      >
        {rating}
      </p>
    </div>
  );
}
