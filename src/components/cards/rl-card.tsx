import type { CSSProperties, ReactNode } from "react";
import {
  CLUB_CHOICE_CARD_CLASS,
  getClubChoiceCardStyle,
} from "@/lib/clubs";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

/** Shared Rugby League card design tokens — bridged to design-system. */
export const RL_CARD_SHADOW = "shadow-lg";
export const RL_CARD_RADIUS = "rounded-lg";
export const RL_CARD_BORDER = "border-2 border-solid";
export const RL_INFO_BOX_CLASS = CARD.stat;
export const RL_STAT_LABEL_CLASS = TYPO.statLabel;
export const RL_SECTION_TITLE_CLASS = TYPO.sectionTitle;
export const RL_FILTER_INPUT_CLASS = FILTER.input;
export const RL_FILTER_CHIP_ACTIVE = FILTER.chipActive;
export const RL_FILTER_CHIP_IDLE = FILTER.chipIdle;

export type RLTagVariant =
  | "neutral"
  | "current"
  | "historic"
  | "legend"
  | "goat"
  | "gold"
  | "green"
  | "purple"
  | "blue"
  | "silver"
  | "red";

const RL_TAG_VARIANT_CLASS: Record<RLTagVariant, string> = {
  neutral: "rl-tag-neutral",
  current: "rl-tag-green",
  historic: "rl-tag-purple",
  legend: "rl-tag-gold",
  goat: "rl-tag-gold",
  gold: "rl-tag-gold",
  green: "rl-tag-green",
  purple: "rl-tag-purple",
  blue: "rl-tag-blue",
  silver: "rl-tag-silver",
  red: "rl-tag-red",
};

/** Compact achievement and utility chips — not for Legend/Historic/Current status. */
export function RLTag({
  children,
  variant = "neutral",
  compact,
  className = "",
}: {
  children: ReactNode;
  variant?: RLTagVariant;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`rl-tag ${RL_TAG_VARIANT_CLASS[variant]} ${
        compact
          ? "px-1.5 py-px text-[9px] sm:px-2 sm:py-0.5 sm:text-[10px]"
          : "px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** @deprecated Use RLTag */
export const RLTierBadge = RLTag;

export const ACHIEVEMENT_TAG_VARIANT: Record<
  "gold" | "green" | "purple" | "blue" | "silver",
  RLTagVariant
> = {
  gold: "gold",
  green: "green",
  purple: "purple",
  blue: "blue",
  silver: "silver",
};

/** @deprecated Use RLTag with ACHIEVEMENT_TAG_VARIANT */
export const ACHIEVEMENT_BADGE_CLASSES: Record<
  "gold" | "green" | "purple" | "blue" | "silver",
  string
> = {
  gold: "rl-tag rl-tag-gold",
  green: "rl-tag rl-tag-green",
  purple: "rl-tag rl-tag-purple",
  blue: "rl-tag rl-tag-blue",
  silver: "rl-tag rl-tag-silver",
};

interface RLCardShellProps {
  club: string;
  /** When set, used for card border/background colours instead of `club`. */
  clubColorOverride?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function RLCardShell({
  club,
  clubColorOverride,
  children,
  className = "",
  style,
}: RLCardShellProps) {
  const colorClub = clubColorOverride ?? club;
  return (
    <div
      className={`rl-player-card flex flex-col overflow-hidden ${RL_CARD_RADIUS} ${RL_CARD_BORDER} ${RL_CARD_SHADOW} ${CLUB_CHOICE_CARD_CLASS} ${className}`}
      style={{ ...getClubChoiceCardStyle(colorClub), ...style }}
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

function tierStatValueClass(compact?: boolean): string {
  return compact
    ? "whitespace-nowrap text-[10px] leading-snug sm:text-sm"
    : "whitespace-nowrap text-[11px] sm:text-sm";
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
      } ${compact ? SPACING.cardPaddingSm : large ? "px-2.5 py-2" : "px-2 py-1.5"} ${className}`}
    >
      <p
        className={`${RL_STAT_LABEL_CLASS} shrink-0 ${
          compact ? "text-[9px] tracking-wide sm:text-[10px]" : ""
        }`}
      >
        {label}
      </p>
      <p
        className={`min-w-0 font-medium text-white ${
          isTier
            ? `font-normal text-gray-300 ${tierStatValueClass(compact)}`
            : prominent
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

/** Tier stat box spans full row on narrow layouts. */
export const RL_TIER_STAT_SPAN_CLASS = "col-span-2 sm:col-span-1";
