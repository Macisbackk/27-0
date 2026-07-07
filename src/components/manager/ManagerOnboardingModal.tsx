"use client";

import { useCallback } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import {
  MANAGER_ONBOARDING_STEPS,
  dismissManagerOnboarding,
  getOnboardingProgress,
} from "@/lib/manager/managerOnboarding";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import type { ManagerView } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

interface ManagerOnboardingModalProps {
  onNavigate?: (view: ManagerView) => void;
  onDismiss: () => void;
}

export function ManagerOnboardingModal({
  onNavigate,
  onDismiss,
}: ManagerOnboardingModalProps) {
  const progress = getOnboardingProgress();

  const handleDismiss = useCallback(() => {
    playUiClick();
    dismissManagerOnboarding();
    onDismiss();
  }, [onDismiss]);

  const panelRef = useModalA11y(true, handleDismiss);

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-guide-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass my-auto w-full max-w-lg overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("primary")}>
          <span className={managerPillClass("primary")}>First season</span>
          <h2 id="onboarding-guide-title" className={`mt-3 ${TYPO.pageTitle}`}>
            Your first season guide
          </h2>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            New to the dugout? Work through these steps to get your campaign
            rolling.
          </p>
        </div>

        <ol className={`mt-4 ${SPACING.stackSm}`}>
          {MANAGER_ONBOARDING_STEPS.map((step, index) => {
            const done = progress.completedSteps.includes(step.id);
            return (
              <li
                key={step.id}
                className={`rounded-lg border px-3 py-2.5 ${
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

        <div className={`mt-5 flex flex-col gap-2 sm:flex-row sm:items-center ${SPACING.buttonGap}`}>
          <GameButton variant="theme" onClick={handleDismiss} className="sm:flex-1">
            Got it
          </GameButton>
        </div>
      </div>
    </div>
  );
}
