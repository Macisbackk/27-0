"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { PlayoffBracketDisplay } from "@/components/PlayoffBracketDisplay";
import { ManagerStat } from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { ensurePlayoffsReady } from "@/lib/manager/managerPlayoffs";
import type { ManagerCareer } from "@/lib/manager/types";
import { playSeasonComplete, playUiClick } from "@/lib/sound";
import {
  managerInsetPanelClass,
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerPlayoffsIntroModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function ManagerPlayoffsIntroModal({
  career,
  onContinue,
}: ManagerPlayoffsIntroModalProps) {
  const ready = ensurePlayoffsReady(career);
  const bracket = ready.playoffs;
  const position = getUserLeaguePosition(career.leagueTable, career.club);

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  useEffect(() => {
    playSeasonComplete();
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} ${SPACING.safeBottom} sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="playoffs-intro-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="game-modal-panel my-auto flex w-full max-w-2xl max-h-[min(78dvh,720px)] flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`shrink-0 ${SPACING.cardPadding} pb-0`}>
          <div className={managerModalHeaderClass("primary")}>
            <span className={managerPillClass("primary")}>
              Regular season complete
            </span>
            <h2 id="playoffs-intro-title" className={`mt-2 ${TYPO.pageTitle}`}>
              Play-Offs begin
            </h2>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
              {career.club} finished the league in{" "}
              <span className="font-semibold text-theme-primary">
                {ordinal(position)}
              </span>{" "}
              — you&apos;ve qualified for the top-six play-offs.
            </p>
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${SPACING.cardPadding} pt-4`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ManagerStat
              label="League finish"
              value={ordinal(position)}
              tone={position <= 2 ? "gold" : "primary"}
            />
            <ManagerStat
              label="Record"
              value={`${career.wins}W-${career.draws ?? 0}D-${career.losses}L`}
              tone="default"
            />
            <ManagerStat
              label="Season"
              value={String(career.seasonYear)}
              tone="muted"
            />
          </div>

          {bracket && (
            <div
              className={`mt-4 overflow-x-auto overflow-y-hidden ${managerInsetPanelClass()} p-2 sm:p-3`}
            >
              <PlayoffBracketDisplay state={bracket} embedded />
            </div>
          )}

          <p className={`mt-4 ${TYPO.bodySm} text-pitch-400`}>
            The league table is frozen — from here on, only play-off results
            matter for the title.
          </p>
        </div>

        <div className="shrink-0 border-t border-pitch-700/40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <GameButton variant="theme" className="w-full" onClick={handleContinue}>
            Continue to Play-Offs
          </GameButton>
        </div>
      </div>
    </div>
  );
}
