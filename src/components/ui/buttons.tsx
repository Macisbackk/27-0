"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BTN } from "@/lib/ui/design-system";

type ButtonVariant = "theme" | "primary" | "secondary" | "danger";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
    case "theme":
      return BTN.theme;
    case "danger":
      return BTN.danger;
    default:
      return `${BTN.base} ${BTN.secondary}`;
  }
}

/** @deprecated Use `GameButton` from `./GameButton` */
export function PrimaryButton({
  className = "",
  ...props
}: GameButtonProps) {
  return (
    <button
      type="button"
      className={`${BTN.theme} ${className}`}
      {...props}
    />
  );
}

/** @deprecated Use `GameButton` from `./GameButton` */
export function SecondaryButton({
  className = "",
  ...props
}: GameButtonProps) {
  return (
    <button
      type="button"
      className={`${BTN.base} ${BTN.secondary} ${className}`}
      {...props}
    />
  );
}

/** @deprecated Use `GameButton` from `./GameButton` */
export function GameButtonLegacy({
  variant = "secondary",
  className = "",
  ...props
}: GameButtonProps) {
  return (
    <button
      type="button"
      className={`${variantClass(variant)} ${className}`}
      {...props}
    />
  );
}
