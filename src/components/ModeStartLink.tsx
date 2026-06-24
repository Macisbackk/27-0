"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ModeVariant } from "@/lib/types";
import {
  getModeButtonVariant,
  getModeStartButtonClass,
  type ModeStartButtonSize,
} from "@/lib/ui/mode-button-variant";
import { ActionButton } from "./ui/ActionButton";

interface ModeStartLinkProps {
  href: string;
  modeVariant?: ModeVariant | boolean;
  hardMode?: boolean;
  size?: ModeStartButtonSize;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/** Mode-aware start CTA link — gold for Era, green for Current. */
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
  const classes = getModeStartButtonClass(variant, size, hardMode);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block w-full no-underline ${className}`}
    >
      <span className={classes}>{children}</span>
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
  const classes = `${getModeStartButtonClass(variant, size, hardMode)} ${className}`;

  if (size === "compact") {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={classes}
      >
        {children}
      </button>
    );
  }

  return (
    <ActionButton
      variant={variant}
      hardMode={hardMode}
      className={className}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </ActionButton>
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
