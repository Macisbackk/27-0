"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { PlayoffBracketDisplay } from "@/components/PlayoffBracketDisplay";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { ManagerStat } from "@/components/manager/manager-ui";
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
    <ManagerModal
      open
      wide
      labelledBy="playoffs-intro-title"
      panelRef={panelRef}
      header={
        <div className={managerModalHeaderClass("primary", { slotted: true })}>
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
      }
      footer={
        <GameButton variant="theme" className="w-full" onClick={handleContinue}>
          Continue to Play-Offs
        </GameButton>
      }
    >
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
        The league table is frozen — from here on, only play-off results matter
        for the title.
      </p>
    </ManagerModal>
  );
}
