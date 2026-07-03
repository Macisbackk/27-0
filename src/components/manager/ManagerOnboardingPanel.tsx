"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  MANAGER_ONBOARDING_STEPS,
  dismissManagerOnboarding,
  getOnboardingProgress,
} from "@/lib/manager/managerOnboarding";
import type { ManagerView } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

interface ManagerOnboardingPanelProps {
  onNavigate?: (view: ManagerView) => void;
  onDismiss: () => void;
}

export function ManagerOnboardingPanel({
  onNavigate,
  onDismiss,
}: ManagerOnboardingPanelProps) {
  const progress = getOnboardingProgress();

  return (
    <div
      className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4 border-theme-primary`}
    >
      <p className={TYPO.sectionLabel}>First season guide</p>
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
        New to the dugout? Work through these steps to get your campaign rolling.
      </p>
      <ol className={`mt-3 ${SPACING.stackSm}`}>
        {MANAGER_ONBOARDING_STEPS.map((step, index) => {
          const done = progress.completedSteps.includes(step.id);
          return (
            <li
              key={step.id}
              className={`rounded-lg border px-3 py-2 ${
                done
                  ? "border-theme-primary/30 bg-theme-primary/5"
                  : "border-pitch-700/50 bg-pitch-950/40"
              }`}
            >
              <p className="text-sm font-medium text-white">
                {index + 1}. {step.title}
                {done ? " ✓" : ""}
              </p>
              <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                {step.body}
              </p>
              {!done && onNavigate && step.view !== "hub" && (
                <GameButton
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    playUiClick();
                    onNavigate(step.view);
                  }}
                >
                  Go to {step.view}
                </GameButton>
              )}
            </li>
          );
        })}
      </ol>
      <GameButton
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => {
          playUiClick();
          dismissManagerOnboarding();
          onDismiss();
        }}
      >
        Dismiss guide
      </GameButton>
    </div>
  );
}
