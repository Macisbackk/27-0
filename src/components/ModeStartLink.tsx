"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  getGameButtonClass,
  type GameButtonSize,
} from "@/lib/ui/game-button-variants";
import {
  getModeStartButtonVariant,
  type ModeStartButtonSize,
} from "@/lib/ui/mode-button-variant";
import { GameButton } from "./ui/GameButton";

interface ModeStartLinkProps {
  href: string;
  /** When true, start CTA uses fixed Era gold (not Store theme). */
  eraMode?: boolean;
  /** @deprecated Use eraMode */
  modeVariant?: boolean;
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
 * Primary “start mode” CTA — Store theme for Current, fixed gold for Era.
 */
export function ModeStartLink({
  href,
  eraMode = false,
  modeVariant,
  onClick,
  children,
  className = "",
  size = "home",
}: ModeStartLinkProps) {
  const variant = getModeStartButtonVariant(
    modeVariant !== undefined ? modeVariant : eraMode
  );
  const classes = `${getGameButtonClass(variant, {
    size: SIZE_MAP[size],
  })} w-full no-underline ${className}`;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={classes}
      data-game-button-variant={variant}
    >
      {children}
    </Link>
  );
}

interface ModeStartButtonProps {
  eraMode?: boolean;
  /** @deprecated Use eraMode */
  modeVariant?: boolean;
  hardMode?: boolean;
  size?: ModeStartButtonSize;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

/** In-flow start CTA — gold when Era, Store theme when Current. */
export function ModeStartButton({
  eraMode = false,
  modeVariant,
  size = "home",
  onClick,
  children,
  className = "",
  disabled,
  type = "button",
}: ModeStartButtonProps) {
  const variant = getModeStartButtonVariant(
    modeVariant !== undefined ? modeVariant : eraMode
  );

  return (
    <GameButton
      variant={variant}
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

export function EraStartLink(props: Omit<ModeStartLinkProps, "eraMode">) {
  return <ModeStartLink {...props} eraMode />;
}

export function EraStartButton(props: Omit<ModeStartButtonProps, "eraMode">) {
  return <ModeStartButton {...props} eraMode />;
}
