"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  getGameButtonClass,
  type GameButtonSize,
} from "@/lib/ui/game-button-variants";
import type { ModeStartButtonSize } from "@/lib/ui/mode-button-variant";
import { GameButton } from "./ui/GameButton";

interface ModeStartLinkProps {
  href: string;
  /** @deprecated No longer affects button colour — start CTAs always use Store theme. */
  modeVariant?: unknown;
  /** @deprecated Use danger variant via GameButton if needed. */
  hardMode?: boolean;
  size?: ModeStartButtonSize;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

const SIZE_MAP: Record<ModeStartButtonSize, GameButtonSize> = {
  home: "lg",
  compact: "sm",
};

/**
 * Primary “start mode” CTA — always uses selected Store UI theme.
 * Current green / Era gold appear only on the Current/Era toggle, not here.
 */
export function ModeStartLink({
  href,
  onClick,
  children,
  className = "",
  size = "home",
}: ModeStartLinkProps) {
  const classes = `${getGameButtonClass("theme", {
    size: SIZE_MAP[size],
  })} w-full no-underline ${className}`;

  return (
    <Link href={href} onClick={onClick} className={classes} data-game-button-variant="theme">
      {children}
    </Link>
  );
}

interface ModeStartButtonProps {
  /** @deprecated No longer affects button colour */
  modeVariant?: unknown;
  hardMode?: boolean;
  size?: ModeStartButtonSize;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

/** In-flow start CTA — Store theme colours (not Current green / Era gold). */
export function ModeStartButton({
  size = "home",
  onClick,
  children,
  className = "",
  disabled,
  type = "button",
}: ModeStartButtonProps) {
  return (
    <GameButton
      variant="theme"
      size={SIZE_MAP[size]}
      className={className}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </GameButton>
  );
}

/** @deprecated EraStartLink — use ModeStartLink (all starts use Store theme). */
export function EraStartLink(
  props: Omit<ModeStartLinkProps, "modeVariant">
) {
  return <ModeStartLink {...props} />;
}

/** @deprecated EraStartButton — use ModeStartButton */
export function EraStartButton(
  props: Omit<ModeStartButtonProps, "modeVariant">
) {
  return <ModeStartButton {...props} />;
}
