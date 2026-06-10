"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BTN } from "@/lib/ui/design-system";

type ButtonVariant = "primary" | "secondary" | "danger";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
      return BTN.primary;
    case "danger":
      return BTN.danger;
    default:
      return BTN.secondary;
  }
}

export function PrimaryButton({
  className = "",
  ...props
}: GameButtonProps) {
  return (
    <button
      type="button"
      className={`${BTN.base} ${BTN.primary} ${className}`}
      {...props}
    />
  );
}

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

export function GameButton({
  variant = "secondary",
  className = "",
  ...props
}: GameButtonProps) {
  return (
    <button
      type="button"
      className={`${BTN.base} ${variantClass(variant)} ${className}`}
      {...props}
    />
  );
}
