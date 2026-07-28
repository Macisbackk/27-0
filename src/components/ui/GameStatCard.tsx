import type { ReactNode } from "react";

interface GameStatCardProps {
  label: string;
  value: ReactNode;
  className?: string;
  /** Lighter value treatment. */
  muted?: boolean;
}

/** Programme-style compact stat tile. */
export function GameStatCard({
  label,
  value,
  className = "",
  muted = false,
}: GameStatCardProps) {
  return (
    <div className={`game-stat-card ${className}`.trim()}>
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
