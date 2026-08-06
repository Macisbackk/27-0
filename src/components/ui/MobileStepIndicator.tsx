"use client";

import { MOBILE } from "@/lib/ui/design-system";

export interface MobileStepIndicatorProps {
  steps: string[];
  currentIndex: number;
  className?: string;
}

/** Compact progress bars for multi-step mobile flows. */
export function MobileStepIndicator({
  steps,
  currentIndex,
  className = "",
}: MobileStepIndicatorProps) {
  const safeIndex = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const currentLabel = steps[safeIndex] ?? "";

  return (
    <div
      className={`${MOBILE.stepIndicator} ${className}`.trim()}
      role="group"
      aria-label="Progress"
    >
      <span className="sr-only">
        Step {safeIndex + 1} of {steps.length}: {currentLabel}
      </span>
      {steps.map((label, index) => {
        const state =
          index === safeIndex
            ? "mobile-step-indicator__step--active"
            : index < safeIndex
              ? "mobile-step-indicator__step--done"
              : "";
        return (
          <div
            key={`${label}-${index}`}
            className={`mobile-step-indicator__step ${state}`.trim()}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
