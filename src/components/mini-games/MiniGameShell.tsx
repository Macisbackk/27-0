"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { GameButton } from "@/components/ui/GameButton";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function MiniGameShell({
  title,
  eyebrow = "Mini Games",
  children,
  actions,
  compact = false,
}: {
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Tighter chrome for short mobile play loops (e.g. Higher or Lower). */
  compact?: boolean;
}) {
  return (
    <StandardPageShell>
      <div
        className={`${PAGE.section} mini-game-arena mx-auto flex w-full max-w-xl flex-col items-center text-center`}
      >
        <div
          className={`flex w-full flex-wrap items-center justify-center gap-3 ${
            compact ? "mb-2" : "mb-4"
          }`}
        >
          <GameButton
            variant="secondary"
            size="sm"
            href="/mini-games"
            fullWidth={false}
          >
            Mini Games
          </GameButton>
          {actions}
        </div>

        <div
          className={`mini-game-board${compact ? " mini-game-board--compact" : ""}`}
        >
          <span className="mini-game-board__accent" aria-hidden />
          <div className="mini-game-board__body">
            <p className={TYPO.sectionLabel}>{eyebrow}</p>
            <h1 className={`${compact ? "mt-1" : "mt-1.5"} ${TYPO.pageTitle}`}>
              {title}
            </h1>
            <div className="mt-1 flex w-full flex-col items-center">{children}</div>
          </div>
        </div>
      </div>
    </StandardPageShell>
  );
}

export function MiniGameStatLine({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="mini-game-stat-row" role="group" aria-label="Game stats">
      {items.map((item) => (
        <div key={item.label} className="mini-game-stat-chip">
          <span className="mini-game-stat-chip__label">{item.label}</span>
          <span className="mini-game-stat-chip__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniGameLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="text-sm text-theme-primary hover:underline">
      {children}
    </Link>
  );
}

/** End-of-run actions: replay this game and jump back to the Mini Games hub. */
export function MiniGameEndActions({
  onPlayAgain,
  playAgainLabel = "Play again",
  hubLabel = "Play another mini game",
  className = "",
}: {
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  hubLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto mt-4 grid w-full max-w-xs gap-2 ${className}`.trim()}
    >
      {onPlayAgain && (
        <GameButton variant="theme" onClick={onPlayAgain}>
          {playAgainLabel}
        </GameButton>
      )}
      <GameButton variant="secondary" href="/mini-games">
        {hubLabel}
      </GameButton>
    </div>
  );
}
