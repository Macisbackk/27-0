"use client";

import { HARD } from "@/lib/ui/design-system";

export function HardModeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`${HARD.badge} ${className}`}>
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
      Hard Mode
    </span>
  );
}
