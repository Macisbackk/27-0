"use client";

import Link from "next/link";
import type { ReactNode } from "react";

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
      <span
        className={`mode-start-btn ${hardMode ? "mode-start-btn-hard" : ""} btn-press ${
          hardMode ? "btn-press-glow-hard" : "btn-press-glow"
        }`}
      >
        {children}
      </span>
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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`mode-start-btn ${hardMode ? "mode-start-btn-hard" : ""} btn-press w-full ${
        hardMode ? "btn-press-glow-hard" : "btn-press-glow"
      } ${className}`}
    >
      {children}
    </button>
  );
}
