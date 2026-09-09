"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { GameButton } from "@/components/ui/GameButton";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function MiniGameShell({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StandardPageShell>
      <div
        className={`${PAGE.section} mini-game-arena mx-auto flex w-full max-w-xl flex-col items-center text-center`}
      >
        <div className="mb-5 flex w-full flex-wrap items-center justify-center gap-3">
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
        <h1 className={TYPO.pageTitle}>{title}</h1>
        <div className="flex w-full flex-col items-center">{children}</div>
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
    <p className={`mt-2 text-center ${TYPO.bodySm}`}>
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? " · " : ""}
          {item.label} {item.value}
        </span>
      ))}
    </p>
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
