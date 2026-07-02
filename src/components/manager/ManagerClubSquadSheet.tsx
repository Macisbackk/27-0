"use client";

import { useState } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubMatchdayLineup } from "@/lib/manager/managerLeagueLineup";
import { getManagerPlayerAge } from "@/lib/manager/managerPlayers";
import {
  slotAbbrev,
  TEAM_SHEET_ROWS,
} from "@/lib/manager/managerMatchdaySquad";
import type { ManagerCareer } from "@/lib/manager/types";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { CURRENT_PLAYABLE_CLUBS } from "@/lib/clubs/super-league-display";

interface ManagerClubSquadSheetProps {
  career: ManagerCareer;
  club: string;
  onClose: () => void;
  onViewUserSquad?: () => void;
  round?: number;
}

export function ManagerClubSquadSheet({
  career,
  club,
  onClose,
  onViewUserSquad,
  round,
}: ManagerClubSquadSheetProps) {
  const lineup = getClubMatchdayLineup(career, club, round);
  const avgRating =
    lineup.xiii.length + lineup.interchange.length > 0
      ? Math.round(
          [...lineup.xiii.map((row) => row.player), ...lineup.interchange].reduce(
            (sum, player) => sum + (player.rating ?? player.peakRating),
            0
          ) /
            (lineup.xiii.length + lineup.interchange.length)
        )
      : 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-label={`${club} matchday squad`}
      onClick={() => {
        playPanelClose();
        onClose();
      }}
    >
      <div
        className={`card-glass max-h-[90vh] w-full max-w-2xl overflow-y-auto ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={TYPO.sectionLabel}>Matchday Squad</p>
            <div className="mt-1 flex items-center gap-2">
              <ClubDualSwatch club={club} size="sm" />
              <h2 className={`truncate ${TYPO.cardTitle}`}>{club}</h2>
            </div>
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
              Season {career.seasonYear}
              {lineup.isUserClub
                ? " · Your current team sheet"
                : " · Projected starting lineup"}
              {avgRating > 0 ? ` · ~${avgRating} avg rating` : ""}
            </p>
          </div>
          <GameButton
            variant="secondary"
            size="sm"
            onClick={() => {
              playPanelClose();
              onClose();
            }}
          >
            Close
          </GameButton>
        </div>

        <div className={`mt-5 ${SPACING.stackMd}`}>
          <section>
            <p className={TYPO.sectionLabel}>Starting XIII</p>
            <div className={`mt-3 ${CARD.base} ${SPACING.cardPadding} space-y-2`}>
              {TEAM_SHEET_ROWS.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${row.slots.length}, minmax(0, 1fr))`,
                  }}
                >
                  {row.slots.map((slotIndex) => {
                    const entry = lineup.xiii[slotIndex];
                    if (!entry) {
                      return (
                        <div
                          key={slotIndex}
                          className="rounded-lg border border-dashed border-pitch-700/50 px-2 py-2 text-center text-xs text-pitch-500"
                        >
                          —
                        </div>
                      );
                    }
                    const age = getManagerPlayerAge(career, entry.player.id);
                    return (
                      <div
                        key={slotIndex}
                        className="rounded-lg border border-pitch-700/50 bg-pitch-950/45 px-2 py-2"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-pitch-500">
                          {slotAbbrev(entry.position)}
                        </p>
                        <p className="truncate text-sm font-medium text-white">
                          {entry.player.name}
                        </p>
                        <p className="text-[10px] text-theme-primary">
                          {entry.player.rating ?? entry.player.peakRating}
                          {age != null ? ` · ${age}y` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className={TYPO.sectionLabel}>Interchange</p>
            {lineup.interchange.length === 0 ? (
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                No interchange selected.
              </p>
            ) : (
              <ul className={`mt-3 grid gap-2 sm:grid-cols-2`}>
                {lineup.interchange.map((player) => {
                  const age = getManagerPlayerAge(career, player.id);
                  return (
                    <li
                      key={player.id}
                      className={`${CARD.base} flex items-center justify-between gap-3 ${SPACING.listItem}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {player.name}
                        </p>
                        <p className="text-[10px] text-pitch-400">
                          {player.position.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-theme-primary">
                        {player.rating ?? player.peakRating}
                        {age != null ? (
                          <span className="ml-1 text-[10px] font-normal text-pitch-500">
                            · {age}y
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {lineup.isUserClub && onViewUserSquad && (
          <GameButton
            variant="theme"
            className="mt-5 w-full"
            onClick={() => {
              playUiClick();
              onClose();
              onViewUserSquad();
            }}
          >
            Open Squad Screen
          </GameButton>
        )}
      </div>
    </div>
  );
}

interface ManagerClubSquadBrowserProps {
  career: ManagerCareer;
  onViewUserSquad?: () => void;
}

/** Browse any league club's projected matchday squad during the save. */
export function ManagerClubSquadBrowser({
  career,
  onViewUserSquad,
}: ManagerClubSquadBrowserProps) {
  const clubs =
    career.leagueTable.length > 0
      ? career.leagueTable.map((row) => row.team)
      : CURRENT_PLAYABLE_CLUBS;
  const [selectedClub, setSelectedClub] = useState<string>(
    clubs.find((club) => club !== career.club) ?? career.club
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>League Squads</p>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          View any club&apos;s starting XIII and interchange for this season.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedClub}
            onChange={(e) => {
              playUiClick();
              setSelectedClub(e.target.value);
            }}
            className="min-h-[44px] flex-1 rounded-lg border border-pitch-600 bg-pitch-900/60 px-3 py-2 text-sm text-white outline-none focus:border-theme-primary"
          >
            {clubs.map((club) => (
              <option key={club} value={club}>
                {club}
                {club === career.club ? " (You)" : ""}
              </option>
            ))}
          </select>
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              setSheetOpen(true);
            }}
          >
            View Team Sheet
          </GameButton>
        </div>
      </div>

      {sheetOpen && (
        <ManagerClubSquadSheet
          career={career}
          club={selectedClub}
          onClose={() => setSheetOpen(false)}
          onViewUserSquad={onViewUserSquad}
        />
      )}
    </>
  );
}
