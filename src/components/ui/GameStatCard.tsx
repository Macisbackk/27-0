import type { ReactNode } from "react";

interface GameStatCardProps {
  label: string;
  value: ReactNode;
  className?: string;
  /** Lighter value treatment. */
  muted?: boolean;
  /**
   * No Store theme accent strip — use on Showcase and other surfaces
   * where club/kit colours must stay the only chromatic identity.
   */
  neutral?: boolean;
}

/** Compact stat tile. Default uses Store theme accent; `neutral` disables it. */
export function GameStatCard({
  label,
  value,
  className = "",
  muted = false,
  neutral = false,
}: GameStatCardProps) {
  return (
    <div
      className={`game-stat-card ${neutral ? "game-stat-card--neutral" : ""} ${className}`.trim()}
    >
      <p className="game-stat-card__label">{label}</p>
      <p
        className={`game-stat-card__value ${
          muted ? "!text-base !font-medium text-gray-300" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
