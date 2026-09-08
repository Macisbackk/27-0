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
      <div className={`${PAGE.section} mini-game-arena`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
        {children}
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
    <p className={`mt-2 ${TYPO.bodySm}`}>
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
