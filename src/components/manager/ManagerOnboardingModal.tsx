"use client";

import { useCallback } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
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
    <GameModal
      open
      labelledBy="onboarding-guide-title"
      zClass="z-[9999]"
      panelRef={panelRef}
      className="!flex !max-h-[min(78dvh,720px)] !flex-col !overflow-hidden !p-0"
    >
      <div
        className={`shrink-0 px-3 pt-3 sm:px-6 sm:pt-6 ${managerModalHeaderClass("primary")}`}
      >
        <span className={managerPillClass("primary")}>First season</span>
        <h2 id="onboarding-guide-title" className={`mt-3 ${TYPO.pageTitle}`}>
          Your first season guide
        </h2>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          New to the dugout? Work through these steps to get your campaign
          rolling.
        </p>
      </div>

      <ol
        data-scroll-lock-allow="true"
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 ${SPACING.stackSm}`}
      >
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

      <div
        className={`shrink-0 border-t border-pitch-700/40 bg-pitch-950/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6 ${SPACING.buttonGap}`}
      >
        <GameButton variant="theme" onClick={handleDismiss} className="w-full">
          Got it
        </GameButton>
      </div>
    </GameModal>
  );
}
