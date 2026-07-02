"use client";

import { useMemo } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getAllManagerClubConfigs } from "@/lib/manager/club-config";
import { getClubAttendanceProfile } from "@/lib/manager/managerAttendance";
import { playUiClick } from "@/lib/sound";

interface ManagerClubSelectProps {
  onSelect: (club: string) => void;
  onBack: () => void;
}

function difficultyLabel(stars: number): string {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export function ManagerClubSelect({ onSelect, onBack }: ManagerClubSelectProps) {
  const clubs = useMemo(
    () =>
      getAllManagerClubConfigs().sort((a, b) => b.squadRating - a.squadRating),
    []
  );

  return (
    <div className={`mx-auto max-w-4xl ${SPACING.stackLg}`}>
      <div className="text-center sm:text-left">
        <h1 className={TYPO.pageTitle}>Choose Your Club</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Pick your Super League side — sorted by squad strength.
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
        {clubs.map((club) => {
          const attendance = getClubAttendanceProfile(club.name);
          return (
            <button
              key={club.name}
              type="button"
              onClick={() => {
                playUiClick();
                onSelect(club.name);
              }}
              className={`group relative overflow-hidden ${CARD.hero} ${CARD.interactive} text-left transition-transform hover:scale-[1.02]`}
              style={
                {
                  "--club-primary": club.primaryColor,
                  "--club-secondary": club.secondaryColor,
                } as React.CSSProperties
              }
            >
              <div
                className="absolute inset-0 opacity-25 transition-opacity group-hover:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${club.primaryColor} 0%, transparent 55%, ${club.secondaryColor} 100%)`,
                }}
              />
              <div className="relative p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 shadow-lg"
                    style={{
                      background: `linear-gradient(145deg, ${club.primaryColor}, ${club.secondaryColor})`,
                    }}
                  >
                    <span className="text-lg font-black text-white drop-shadow">
                      {club.squadRating}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`${TYPO.cardTitle} truncate text-white`}>
                      {club.name}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-medium`}
                      style={{ color: club.primaryColor }}
                    >
                      {club.expectation}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className={`${CARD.inset} px-2.5 py-2`}>
                    <p className="text-pitch-500">Squad OVR</p>
                    <p className="text-base font-bold text-theme-primary">
                      {club.squadRating}
                    </p>
                  </div>
                  <div className={`${CARD.inset} px-2.5 py-2`}>
                    <p className="text-pitch-500">Budget</p>
                    <p className="text-base font-semibold text-white">
                      £{(club.budget / 1000).toFixed(0)}k
                    </p>
                  </div>
                  <div className={`${CARD.inset} px-2.5 py-2`}>
                    <p className="text-pitch-500">Difficulty</p>
                    <p className="font-mono text-sm tracking-wide text-accent-gold">
                      {difficultyLabel(club.difficulty)}
                    </p>
                  </div>
                  <div className={`${CARD.inset} px-2.5 py-2`}>
                    <p className="text-pitch-500">Home crowd</p>
                    <p className="text-sm font-semibold text-white">
                      ~{(attendance.base / 1000).toFixed(1)}k
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wider text-pitch-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Manage {club.name.split(" ")[0]}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <GameButton variant="secondary" onClick={onBack} fullWidth={false}>
        Back
      </GameButton>
    </div>
  );
}
