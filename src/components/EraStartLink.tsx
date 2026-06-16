"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface EraStartLinkProps {
  href: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/** Era start CTA — gold surface on inner span so Link/anchor never renders blank. */
export function EraStartLink({
  href,
  onClick,
  children,
  className = "",
}: EraStartLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block w-full no-underline ${className}`}
    >
      <span className="era-start-btn btn-press btn-press-glow-gold">
        {children}
      </span>
    </Link>
  );
}

interface EraStartButtonProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function EraStartButton({
  onClick,
  children,
  className = "",
  disabled,
  type = "button",
}: EraStartButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`era-start-btn btn-press btn-press-glow-gold ${className}`}
    >
      {children}
    </button>
  );
}
