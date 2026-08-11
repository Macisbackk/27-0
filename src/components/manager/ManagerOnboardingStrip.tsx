"use client";

import { GameButton } from "@/components/ui/GameButton";
import {
  getOnboardingProgress,
  MANAGER_ONBOARDING_STEPS,
  reopenManagerOnboardingModal,
} from "@/lib/manager/managerOnboarding";
import type { ManagerView } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

interface ManagerOnboardingStripProps {
  onNavigate?: (view: ManagerView) => void;
  onOpenGuide: () => void;
}

export function ManagerOnboardingStrip({
  onNavigate,
  onOpenGuide,
}: ManagerOnboardingStripProps) {
  const progress = getOnboardingProgress();
  const nextStep = MANAGER_ONBOARDING_STEPS.find(
    (step) => !progress.completedSteps.includes(step.id)
  );
  if (!nextStep) return null;

  const doneCount = progress.completedSteps.length;
  const total = MANAGER_ONBOARDING_STEPS.length;

  return (
    <div className="rounded-xl border border-theme-primary/30 bg-theme-primary/8 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-left">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-theme-primary">
            First season · {doneCount}/{total}
          </p>
          <p className={`mt-0.5 ${TYPO.bodySm} text-white`}>
            Next: {nextStep.title}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onNavigate && nextStep.view !== "hub" ? (
            <GameButton
              variant="theme"
              size="sm"
              onClick={() => {
                playUiClick();
                onNavigate(nextStep.view);
              }}
            >
              Go to{" "}
              {nextStep.view === "squad"
                ? "Squad"
                : nextStep.view === "contracts"
                  ? "Contracts"
                  : "Hub"}
            </GameButton>
          ) : null}
          <GameButton
            variant="secondary"
            size="sm"
            onClick={() => {
              playUiClick();
              reopenManagerOnboardingModal();
              onOpenGuide();
            }}
          >
            Guide
          </GameButton>
        </div>
      </div>
    </div>
  );
}
