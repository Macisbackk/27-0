"use client";

import { useEffect, useRef } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GameButton } from "@/components/ui/GameButton";
import { acquireScrollLock, releaseScrollLock } from "@/lib/ui/scroll-lock";
import { focusWithoutScroll } from "@/lib/ui/focus";
import { uiLayerClass } from "@/lib/ui/layers";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface ManagerTutorialChoiceModalProps {
  club: string;
  busy?: boolean;
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
}

/**
 * Pre-career choice — locked overlay (no backdrop dismiss / Escape).
 */
export function ManagerTutorialChoiceModal({
  club,
  busy = false,
  onStartTutorial,
  onSkipTutorial,
}: ManagerTutorialChoiceModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef<ReturnType<typeof acquireScrollLock> | null>(null);

  useEffect(() => {
    lockRef.current = acquireScrollLock("manager-tutorial-choice");
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const btn = panelRef.current?.querySelector<HTMLElement>("button");
      focusWithoutScroll(btn ?? panelRef.current);
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        focusWithoutScroll(last);
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        focusWithoutScroll(first);
      }
    };
    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      focusWithoutScroll(previous);
      releaseScrollLock(lockRef.current);
      lockRef.current = null;
    };
  }, []);

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 ${uiLayerClass("criticalAnimation")} flex items-center justify-center bg-black/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-tutorial-choice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className="game-modal-panel w-full max-w-md overflow-hidden outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-theme-primary/30 bg-theme-primary/8 px-4 py-4 sm:px-5">
            <p className={`${TYPO.keyLabel} text-theme-primary`}>New career</p>
            <h2
              id="manager-tutorial-choice-title"
              className={`mt-2 ${TYPO.pageTitle}`}
            >
              Would you like a tutorial?
            </h2>
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
              Learn the Club Hub, squad, transfers and fixtures before you take
              charge of {club}.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
            <GameButton
              variant="theme"
              disabled={busy}
              onClick={() => {
                playUiClick();
                onStartTutorial();
              }}
            >
              Start Tutorial
            </GameButton>
            <GameButton
              variant="secondary"
              disabled={busy}
              onClick={() => {
                playUiClick();
                onSkipTutorial();
              }}
            >
              No Tutorial
            </GameButton>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
