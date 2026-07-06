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
      className={`fixed inset-0 z-[95] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="playoffs-intro-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass my-auto w-full max-w-2xl overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ManagerStat
            label="League finish"
            value={ordinal(position)}
            tone={position <= 2 ? "gold" : "primary"}
          />
          <ManagerStat
            label="Record"
            value={`${career.wins}W-${career.losses}L`}
            tone="default"
          />
          <ManagerStat
            label="Season"
            value={String(career.seasonYear)}
            tone="muted"
          />
        </div>

        {bracket && (
          <div className="mt-4 overflow-hidden rounded-xl border border-pitch-700/40 bg-pitch-950/40 p-2 sm:p-3">
            <PlayoffBracketDisplay state={bracket} embedded />
          </div>
        )}

        <p className={`mt-4 ${TYPO.bodySm} text-pitch-400`}>
          The league table is frozen — from here on, only play-off results
          matter for the title.
        </p>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue to Play-Offs
        </GameButton>
      </div>
    </div>
  );
}
