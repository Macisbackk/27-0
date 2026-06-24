"use client";

import type { ReactNode } from "react";
import type { GameButtonSize, GameButtonVariant } from "@/lib/ui/game-button-variants";
import { ActionButton } from "./ActionButton";

export type { GameButtonSize, GameButtonVariant };

type GameButtonProps = {
  /** Generic UI uses `theme` (Store colours). Only use `current`/`era` for mode actions. */
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  hardMode?: boolean;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
};

/**
 * Shared 27-0 button — all generic CTAs must use `variant="theme"`.
 * Do not map generic/primary buttons to Current green.
 */
export function GameButton({
  variant = "theme",
  size = "md",
  hardMode = false,
  className = "",
  children,
  fullWidth = true,
  href,
  disabled,
  onClick,
  type = "button",
}: GameButtonProps) {
  return (
    <ActionButton
      variant={variant}
      size={size}
      hardMode={hardMode}
      fullWidth={fullWidth}
      className={className}
      href={href}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </ActionButton>
  );
}
