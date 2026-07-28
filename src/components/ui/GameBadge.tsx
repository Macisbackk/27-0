import type { ReactNode } from "react";

export type GameBadgeTone = "theme" | "win" | "loss" | "gold" | "muted";

interface GameBadgeProps {
  children: ReactNode;
  tone?: GameBadgeTone;
  className?: string;
}

const TONE_CLASS: Record<GameBadgeTone, string> = {
  theme: "game-badge",
  win: "game-badge game-badge--win",
  loss: "game-badge game-badge--loss",
  gold: "game-badge game-badge--gold",
  muted: "game-badge game-badge--muted",
};

/** Ticket-style chip for W/L, competition, roles. */
export function GameBadge({
  children,
  tone = "theme",
  className = "",
}: GameBadgeProps) {
  return (
    <span className={`${TONE_CLASS[tone]} ${className}`.trim()}>{children}</span>
  );
}
