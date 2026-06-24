"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BTN } from "@/lib/ui/design-system";
import { ActionButton } from "./ui/ActionButton";

function currentStartClasses(hardMode: boolean): string {
  return hardMode ? BTN.currentStartHard : BTN.currentStart;
}

interface ModeStartLinkProps {
  href: string;
  hardMode?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Normal/Hard mode start CTA — opaque surface on inner span so card-glass
 * backdrop-filter does not blank gradient backgrounds on the anchor.
 */
export function ModeStartLink({
  href,
  hardMode = false,
  onClick,
  children,
  className = "",
}: ModeStartLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block w-full no-underline ${className}`}
    >
      <span className={currentStartClasses(hardMode)}>{children}</span>
    </Link>
  );
}

interface ModeStartButtonProps {
  hardMode?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function ModeStartButton({
  hardMode = false,
  onClick,
  children,
  className = "",
  disabled,
  type = "button",
}: ModeStartButtonProps) {
  return (
    <ActionButton
      variant="current"
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
