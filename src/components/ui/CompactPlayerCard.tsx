"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { MOBILE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export interface CompactPlayerCardProps {
  name: string;
  position?: string;
  nationality?: string;
  club?: string;
  rating?: number | string;
  tierBadge?: ReactNode;
  /** Club colour for the top accent strip. */
  accentColor?: string;
  selected?: boolean;
  /** Actions area below the identity row. */
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Presentational shell for dense mobile player rows —
 * club strip, left-aligned name, muted meta, optional tier + rating.
 */
export function CompactPlayerCard({
  name,
  position,
  nationality,
  club,
  rating,
  tierBadge,
  accentColor,
  selected = false,
  children,
  onClick,
  className = "",
}: CompactPlayerCardProps) {
  const meta = [position, nationality, club].filter(Boolean).join(" · ");
  const style = accentColor
    ? ({ ["--card-accent"]: accentColor } as CSSProperties)
    : undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`${MOBILE.compactCard} overflow-hidden rounded-[var(--mobile-radius-medium)] border ${
        selected
          ? "border-white/20 ring-1 ring-white/10"
          : "border-[color:var(--mobile-divider)]"
      } bg-[var(--mobile-surface-secondary)] ${className}`.trim()}
      style={style}
    >
      <div className={MOBILE.clubAccentStrip} aria-hidden />
      <div
        className={`flex min-w-0 items-start gap-2 px-2.5 py-2 text-left ${
          onClick ? "btn-press cursor-pointer" : ""
        }`}
        onClick={onClick}
        onKeyDown={onClick ? onKeyDown : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate ${TYPO.playerNameSm}`}>{name}</p>
          {meta ? <p className={`mt-0.5 truncate ${TYPO.meta}`}>{meta}</p> : null}
          {tierBadge ? <div className="mt-1">{tierBadge}</div> : null}
        </div>
        {rating != null && rating !== "" ? (
          <span
            className="shrink-0 font-display text-base font-bold tabular-nums leading-none text-white"
            aria-label={`Rating ${rating}`}
          >
            {rating}
          </span>
        ) : null}
      </div>
      {children ? (
        <div className="border-t border-[color:var(--mobile-divider)] px-2.5 py-1.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
