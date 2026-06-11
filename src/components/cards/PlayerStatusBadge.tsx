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
  legend: "rl-status-strip rl-status-legend",
  historic: "rl-status-strip rl-status-historic",
  current: "rl-status-strip rl-status-current",
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
    <p
      className={`${STATUS_CLASS[status]} ${
        compact
          ? "text-[8px] tracking-[0.07em] sm:text-[9px]"
          : "text-[9px] tracking-[0.08em] sm:text-[10px]"
      } ${className}`}
      aria-label={`Player status: ${STATUS_LABEL[status]}`}
    >
      <span className="rl-status-prefix">STATUS</span>
      <span className="rl-status-separator" aria-hidden>
        ·
      </span>
      <span className="rl-status-value">{STATUS_LABEL[status]}</span>
    </p>
  );
}

type SpecialBadgeVariant = "goat" | "superSam";

const SPECIAL_LABEL: Record<SpecialBadgeVariant, string> = {
  goat: "GOAT",
  superSam: "SUPER SAM",
};

const SPECIAL_CLASS: Record<SpecialBadgeVariant, string> = {
  goat: "rl-status-strip rl-special-goat",
  superSam: "rl-status-strip rl-special-supersam",
};

interface PlayerSpecialBadgeProps {
  variant: SpecialBadgeVariant;
  compact?: boolean;
  className?: string;
}

/** Easter-egg mode metadata — distinct from status and achievements. */
export function PlayerSpecialBadge({
  variant,
  compact,
  className = "",
}: PlayerSpecialBadgeProps) {
  return (
    <p
      className={`${SPECIAL_CLASS[variant]} ${
        compact
          ? "text-[8px] tracking-[0.07em] sm:text-[9px]"
          : "text-[9px] tracking-[0.08em] sm:text-[10px]"
      } ${className}`}
    >
      <span className="rl-status-prefix">MODE</span>
      <span className="rl-status-separator" aria-hidden>
        ·
      </span>
      <span className="rl-status-value">{SPECIAL_LABEL[variant]}</span>
    </p>
  );
}
