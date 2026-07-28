import type { ReactNode } from "react";

export interface GameStatStripItem {
  label: string;
  value: ReactNode;
}

interface GameStatStripProps {
  items: GameStatStripItem[];
  className?: string;
}

/** Horizontal scoreboard stat zones. */
export function GameStatStrip({ items, className = "" }: GameStatStripProps) {
  return (
    <div className={`game-stat-strip ${className}`.trim()} role="group">
      {items.map((item) => (
        <div key={item.label} className="game-stat-strip__cell">
          <p className="game-stat-strip__label">{item.label}</p>
          <p className="game-stat-strip__value">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
