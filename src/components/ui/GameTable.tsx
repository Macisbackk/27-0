import type { ReactNode } from "react";

interface GameTableProps {
  children: ReactNode;
  className?: string;
}

/** Simple overflow wrapper for tabular / row lists. */
export function GameTable({ children, className = "" }: GameTableProps) {
  return (
    <div className={`w-full overflow-x-auto ${className}`.trim()}>
      <div className="game-table min-w-0">{children}</div>
    </div>
  );
}
