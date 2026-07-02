"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { PlayoffBracketDisplay } from "@/components/PlayoffBracketDisplay";
import { ManagerStat } from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { ensurePlayoffsReady } from "@/lib/manager/managerPlayoffs";
import type { ManagerCareer } from "@/lib/manager/types";
import { playSeasonComplete, playUiClick } from "@/lib/sound";

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
        className={`card-glass my-auto w-full max-w-2xl overflow-hidden ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="-mx-4 -mt-4 mb-4 border-b border-theme-primary/30 bg-theme-primary/10 px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
          <span className="inline-flex rounded-full border border-theme-primary/45 bg-theme-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-theme-primary">
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
          <div className="mt-4">
            <p className={TYPO.sectionLabel}>Bracket</p>
            <div className="mt-2">
              <PlayoffBracketDisplay state={bracket} />
            </div>
          </div>
        )}

        <p className={`mt-4 ${TYPO.bodySm} text-pitch-400`}>
          The league table is frozen — from here on, only play-off results
          matter for the title.
        </p>

        <GameButton
          variant="theme"
          className="mt-5"
          onClick={() => {
            playUiClick();
            onContinue();
          }}
        >
          Continue to Play-Offs
        </GameButton>
      </div>
    </div>
  );
}
