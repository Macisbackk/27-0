"use client";

import type { ReactNode } from "react";
import { BTN } from "@/lib/ui/design-system";
import {
  ActionButton,
  type ActionButtonVariant,
} from "./ActionButton";

export type GameButtonVariant = ActionButtonVariant;
export type GameButtonSize = "sm" | "md" | "lg";

type GameButtonProps = {
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

const SIZE_CLASS: Record<GameButtonSize, string> = {
  sm: "min-h-[40px] px-3 py-2 text-xs",
  md: "",
  lg: "",
};

/** Shared progression CTA — wraps ActionButton with optional size tokens. */
export function GameButton({
  variant = "secondary",
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
  const startVariant = variant === "era" || variant === "current";
  const sizeClass = startVariant && size === "lg" ? "" : SIZE_CLASS[size];
  const lgTheme = !startVariant && size === "lg" ? BTN.themeLg : "";

  const classes = `${sizeClass} ${lgTheme} ${className}`;

  if (href) {
    return (
      <ActionButton
        href={href}
        variant={variant}
        hardMode={hardMode}
        fullWidth={fullWidth}
        className={classes}
        onClick={onClick}
      >
        {children}
      </ActionButton>
    );
  }

  return (
    <ActionButton
      variant={variant}
      hardMode={hardMode}
      fullWidth={fullWidth}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </ActionButton>
  );
}
