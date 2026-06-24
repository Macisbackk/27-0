"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ModeVariant } from "@/lib/types";
import {
  getGameButtonClass,
  type GameButtonSize,
} from "@/lib/ui/game-button-variants";
import {
  getModeButtonVariant,
  type ModeStartButtonSize,
} from "@/lib/ui/mode-button-variant";
import { GameButton } from "./ui/GameButton";

interface ModeStartLinkProps {
  href: string;
  modeVariant?: ModeVariant | boolean;
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

/** Mode-aware start CTA link — premium button on the anchor, not a text link. */
export function ModeStartLink({
  href,
  modeVariant = "current",
  hardMode = false,
  size = "home",
  onClick,
  children,
  className = "",
}: ModeStartLinkProps) {
  const variant = getModeButtonVariant(modeVariant);
  const classes = `${getGameButtonClass(variant, {
    hardMode,
    size: SIZE_MAP[size],
  })} w-full no-underline ${className}`;

  return (
    <Link href={href} onClick={onClick} className={classes}>
      {children}
    </Link>
  );
}

interface ModeStartButtonProps {
  modeVariant?: ModeVariant | boolean;
  hardMode?: boolean;
  size?: ModeStartButtonSize;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function ModeStartButton({
  modeVariant = "current",
  hardMode = false,
  size = "home",
  onClick,
  children,
  className = "",
  disabled,
  type = "button",
}: ModeStartButtonProps) {
  const variant = getModeButtonVariant(modeVariant);

  return (
    <GameButton
      variant={variant}
      hardMode={hardMode}
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

/** @deprecated Use ModeStartLink with modeVariant="era" */
export function EraStartLink(
  props: Omit<ModeStartLinkProps, "modeVariant"> & { modeVariant?: never }
) {
  return <ModeStartLink {...props} modeVariant="era" />;
}

/** @deprecated Use ModeStartButton with modeVariant="era" */
export function EraStartButton(
  props: Omit<ModeStartButtonProps, "modeVariant"> & { modeVariant?: never }
) {
  return <ModeStartButton {...props} modeVariant="era" />;
}
