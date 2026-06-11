import type { Player } from "@/lib/types";
import { isActivePlayer } from "@/lib/players/active";
import { isGoatPlayer } from "@/lib/players/goat";
import { isSuperSamHallasPlayer } from "@/lib/players/super-sam-hallas";

export type PlayerStatusType = "legend" | "historic" | "current";

const STATUS_LABEL: Record<PlayerStatusType, string> = {
  legend: "LEGEND",
  historic: "HISTORIC",
  current: "CURRENT",
};

const STATUS_CLASS: Record<PlayerStatusType, string> = {
  legend: "rl-status-badge rl-status-legend",
  historic: "rl-status-badge rl-status-historic",
  current: "rl-status-badge rl-status-current",
};

export function resolvePlayerStatus(player: Player): PlayerStatusType | null {
  if (isGoatPlayer(player) || isSuperSamHallasPlayer(player)) return null;
  if (player.category === "legend") return "legend";
  if (player.category === "historic") return "historic";
  if (isActivePlayer(player)) return "current";
  return null;
}

interface PlayerStatusBadgeProps {
  status: PlayerStatusType;
  compact?: boolean;
  className?: string;
}

export function PlayerStatusBadge({
  status,
  compact,
  className = "",
}: PlayerStatusBadgeProps) {
  return (
    <span
      className={`${STATUS_CLASS[status]} font-display font-bold uppercase ${
        compact
          ? "px-2 py-0.5 text-[9px] tracking-[0.14em] sm:px-2.5 sm:py-1 sm:text-[10px]"
          : "px-2.5 py-1 text-[10px] tracking-[0.14em] sm:px-3 sm:py-1.5 sm:text-[11px]"
      } ${className}`}
      aria-label={`Player status: ${STATUS_LABEL[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

type SpecialBadgeVariant = "goat" | "superSam";

const SPECIAL_LABEL: Record<SpecialBadgeVariant, string> = {
  goat: "GOAT",
  superSam: "SUPER SAM",
};

const SPECIAL_CLASS: Record<SpecialBadgeVariant, string> = {
  goat: "rl-special-badge rl-special-goat",
  superSam: "rl-special-badge rl-special-supersam",
};

interface PlayerSpecialBadgeProps {
  variant: SpecialBadgeVariant;
  compact?: boolean;
  className?: string;
}

/** Easter-egg mode badges — distinct from status and achievements. */
export function PlayerSpecialBadge({
  variant,
  compact,
  className = "",
}: PlayerSpecialBadgeProps) {
  return (
    <span
      className={`${SPECIAL_CLASS[variant]} font-display font-bold uppercase ${
        compact
          ? "px-2 py-0.5 text-[9px] tracking-[0.12em] sm:px-2.5 sm:py-1 sm:text-[10px]"
          : "px-2.5 py-1 text-[10px] tracking-[0.12em] sm:px-3 sm:py-1.5 sm:text-[11px]"
      } ${className}`}
    >
      {SPECIAL_LABEL[variant]}
    </span>
  );
}
