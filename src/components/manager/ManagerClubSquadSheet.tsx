"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { TeamSheet } from "@/components/TeamSheet";
import { GameButton } from "@/components/ui/GameButton";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { getClubIndicatorColor } from "@/lib/clubs";
import {
  clubLineupToSquadSlots,
  getClubMatchdayLineup,
  getLineupXiiiPlayers,
} from "@/lib/manager/managerLeagueLineup";
import { getManagerPlayerAge } from "@/lib/manager/managerPlayers";
import type { ManagerCareer } from "@/lib/manager/types";
import type { Player } from "@/lib/types";
import { POSITION_SHORT } from "@/lib/positions";
import { CARD, MODAL, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { CURRENT_PLAYABLE_CLUBS } from "@/lib/clubs/super-league-display";

interface ManagerClubSquadSheetProps {
  career: ManagerCareer;
  club: string;
  onClose: () => void;
  onViewUserSquad?: () => void;
  round?: number;
}

function teamStrengthLabel(avg: number): { label: string; className: string } {
  if (avg >= 84) {
    return {
      label: "Elite",
      className: "text-accent-gold border-accent-gold/40 bg-accent-gold/10",
    };
  }
  if (avg >= 80) {
    return {
      label: "Strong",
      className: "text-theme-primary border-theme-primary/40 bg-theme-primary/10",
    };
  }
  if (avg >= 76) {
    return {
      label: "Competitive",
      className: "text-sky-300 border-sky-400/35 bg-sky-400/10",
    };
  }
  return {
    label: "Developing",
    className: "text-pitch-300 border-pitch-600/50 bg-pitch-800/50",
  };
}

function InterchangeSlot({
  player,
  age,
  listed,
  shirtNumber,
}: {
  player: Player;
  age: number | undefined;
  listed: boolean;
  shirtNumber: number;
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center gap-1.5 rounded-lg border border-pitch-700/50 bg-pitch-950/55 px-2 py-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-pitch-600/60 bg-pitch-900/80 text-[10px] font-bold text-pitch-300">
        {shirtNumber}
      </span>
      <p className="line-clamp-2 min-h-[2rem] w-full text-center text-[11px] font-semibold leading-tight text-white">
        {player.name}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1 text-[10px]">
        <span className="rounded border border-pitch-600/50 bg-pitch-900/70 px-1 py-0.5 font-bold uppercase tracking-wide text-sky-300">
          {POSITION_SHORT[player.position]}
        </span>
        <span className="font-bold text-theme-primary">{player.peakRating}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-pitch-500">
        {age != null && <span>{age}y</span>}
        {listed && (
          <span className="rounded border border-theme-primary/35 bg-theme-primary/10 px-1 py-0.5 font-bold uppercase tracking-wider text-theme-primary">
            Listed
          </span>
        )}
      </div>
    </div>
  );
}

export function ManagerClubSquadSheet({
  career,
  club,
  onClose,
  onViewUserSquad,
  round,
}: ManagerClubSquadSheetProps) {
  const lineup = getClubMatchdayLineup(career, club, round);
  const squadSlots = useMemo(() => clubLineupToSquadSlots(lineup), [lineup]);
  const clubAccent = getClubIndicatorColor(club);

  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);

  useEffect(() => {
    requestAnimationFrame(() => {
      panelRef.current?.scrollTo({ top: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [club, round, panelRef]);

  const listedPlayerIds = useMemo(
    () =>
      new Set(
        career.leagueListedPlayers
          .filter((entry) => entry.club === club)
          .map((entry) => entry.playerId)
      ),
    [career.leagueListedPlayers, club]
  );

  const xiiiPlayers = getLineupXiiiPlayers(lineup);
  const allPlayers = [...xiiiPlayers, ...lineup.interchange];
  const xiiiAvg =
    xiiiPlayers.length > 0
      ? Math.round(
          xiiiPlayers.reduce((sum, player) => sum + player.peakRating, 0) /
            xiiiPlayers.length
        )
      : 0;
  const teamAvg =
    allPlayers.length > 0
      ? Math.round(
          allPlayers.reduce((sum, player) => sum + player.peakRating, 0) /
            allPlayers.length
        )
      : 0;
  const strength = teamStrengthLabel(teamAvg);
  const filledXiii = xiiiPlayers.length;

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} ${SPACING.safeBottom} backdrop-blur-sm sm:items-center`}
        role="presentation"
        onClick={handleClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-club-sheet-title"
          className={`${MODAL.panelWide} card-glass outline-none`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="h-1.5 w-full shrink-0"
            style={{ backgroundColor: clubAccent }}
            aria-hidden
          />

          <div className={MODAL.panelPadding}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ClubDualSwatch club={club} size="md" />
                <div className="min-w-0">
                  <p className={TYPO.sectionLabel}>Team Sheet</p>
                  <h2
                    id="manager-club-sheet-title"
                    className={`truncate ${TYPO.cardTitle}`}
                  >
                    {club}
                  </h2>
                  <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
                    {lineup.isUserClub
                      ? "Your matchday 17"
                      : "Projected matchday 17"}{" "}
                    · Season {career.seasonYear}
                  </p>
                </div>
              </div>
              <GameButton
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={handleClose}
              >
                Close
              </GameButton>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${strength.className}`}
              >
                {strength.label}
              </span>
              <span className="text-[11px] text-pitch-400">
                XIII avg{" "}
                <span className="font-semibold text-theme-primary">
                  {xiiiAvg || "—"}
                </span>
              </span>
              <span className="text-[11px] text-pitch-400">
                Squad avg{" "}
                <span className="font-semibold text-white">
                  {teamAvg || "—"}
                </span>
              </span>
            </div>

            {filledXiii < 13 ? (
              <p
                className={`mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 ${TYPO.bodySm} text-amber-100`}
                role="status"
              >
                Only {filledXiii} of 13 starting spots could be filled from this
                club&apos;s squad pool.
              </p>
            ) : null}

            <div className="mt-4 min-w-0 rounded-xl border border-pitch-700/40 bg-gradient-to-b from-pitch-800/20 to-pitch-950/60 p-3 sm:p-4">
              <TeamSheet
                squad={squadSlots}
                clubColorOverride={club}
                interactive
              />
            </div>

            {lineup.interchange.length > 0 && (
              <section className="mt-5">
                <p className={TYPO.sectionLabel}>Interchange · 14–17</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {lineup.interchange.map((player, index) => (
                    <InterchangeSlot
                      key={player.id}
                      player={player}
                      age={getManagerPlayerAge(career, player.id)}
                      listed={listedPlayerIds.has(player.id)}
                      shirtNumber={14 + index}
                    />
                  ))}
                </div>
              </section>
            )}

            {lineup.isUserClub && onViewUserSquad && (
              <GameButton
                variant="theme"
                className="mt-5 w-full"
                onClick={() => {
                  playUiClick();
                  handleClose();
                  onViewUserSquad();
                }}
              >
                Open Squad Screen
              </GameButton>
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
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
    clubs.find((c) => c !== career.club) ?? career.club
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
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
                {c === career.club ? " (You)" : ""}
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
