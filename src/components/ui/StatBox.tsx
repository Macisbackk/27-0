"use client";

import type { ReactNode } from "react";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface StatBoxProps {
  label: string;
  value: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatBox({
  label,
  value,
  size = "md",
  className = "",
}: StatBoxProps) {
  const valueClass =
    size === "lg"
      ? TYPO.statValueLg
      : size === "sm"
        ? "text-xs font-medium text-white"
        : TYPO.statValue;

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm} ${className}`}>
      <p className={TYPO.statLabel}>{label}</p>
      <p className={`mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}
