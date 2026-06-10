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

/** Pill badge for tier / category labels — never clips on mobile. */
export function RLTierBadge({
  children,
  variant = "tier",
  highlight,
  compact,
  className = "",
}: {
  children: ReactNode;
  variant?: "tier" | "goat" | "legend" | "historic" | "current";
  highlight?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const variantClass =
    variant === "goat"
      ? "border-accent-gold/70 bg-accent-gold text-pitch-950"
      : variant === "legend"
        ? "border-accent-gold/50 bg-accent-gold/20 text-accent-gold"
        : variant === "historic"
          ? "border-purple-400/45 bg-purple-950/80 text-purple-200"
          : variant === "current"
            ? "border-accent-green/45 bg-accent-green/15 text-accent-green"
            : "border-pitch-600/60 bg-pitch-950/90 text-white";

  return (
    <span
      className={`inline-flex w-fit max-w-full items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-semibold leading-snug shadow-sm ${
        compact
          ? "text-[10px] tracking-normal sm:text-xs"
          : "text-[10px] sm:text-xs"
      } ${variantClass} ${
        highlight ? "!border-accent-gold/50 !text-accent-gold" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}

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
  const isTier = label === "Tier";

  return (
    <div
      className={`${RL_INFO_BOX_CLASS} flex min-h-0 flex-col ${
        isTier ? "min-w-[5.5rem]" : "min-w-0"
      } ${compact ? "px-2 py-1.5" : large ? "px-2.5 py-2" : "px-2 py-1.5"} ${className}`}
    >
      <p
        className={`${RL_STAT_LABEL_CLASS} shrink-0 ${
          compact ? "text-[9px] tracking-wide sm:text-[10px]" : ""
        }`}
      >
        {label}
      </p>
      {isTier ? (
        <div className="mt-0.5 flex min-w-0 items-start">
          <RLTierBadge highlight={highlight} compact={compact}>
            {value}
          </RLTierBadge>
        </div>
      ) : (
        <p
          className={`min-w-0 font-medium text-white ${
            prominent
              ? "text-lg font-bold sm:text-xl"
              : compact
                ? "text-[10px] leading-snug sm:text-sm"
                : light
                  ? "break-words font-normal text-gray-300"
                  : large
                    ? "truncate text-sm"
                    : "truncate text-[11px]"
          } ${highlight ? "!text-accent-gold" : ""}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

export function RLRatingDisplay({
  rating,
  large,
  compact,
  masked,
  className = "",
}: {
  rating: number;
  large?: boolean;
  compact?: boolean;
  masked?: boolean;
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
        className={`rl-rating-value font-display font-black leading-none ${
          masked
            ? "text-gray-600"
            : "text-accent-green drop-shadow-[0_0_14px_rgba(34,197,94,0.5)]"
        } ${
          compact
            ? "text-2xl sm:text-6xl"
            : large
              ? "text-5xl sm:text-6xl"
              : "text-2xl sm:text-3xl"
        }`}
      >
        {masked ? "???" : rating}
      </p>
    </div>
  );
}

/** Shared class for tier stat box spanning full row on narrow layouts. */
export const RL_TIER_STAT_SPAN_CLASS = "col-span-2 sm:col-span-1";
