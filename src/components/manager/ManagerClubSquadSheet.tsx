"use client";

import { useCallback, useMemo, useState } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { ManagerMatchdayFormation } from "@/components/manager/ManagerMatchdayFormation";
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
import { CURRENT_PLAYABLE_CLUBS } from "@/lib/clubs/super-league-display";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playPanelClose, playUiClick } from "@/lib/sound";

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

function ReadonlyInterchangeSlot({
  player,
  shirtNumber,
  listed,
  age,
}: {
  player: Player | undefined;
  shirtNumber: number;
  listed?: boolean;
  age?: number;
}) {
  return (
    <div className="rounded-lg border border-pitch-700/50 bg-pitch-950/55 px-2 py-2 text-left">
      <p className="text-[10px] text-pitch-500">{shirtNumber}.</p>
      <p className="truncate text-sm text-white">{player?.name ?? "Empty"}</p>
      {player && (
        <p className="text-[10px] text-theme-primary">{player.peakRating}</p>
      )}
      {(age != null || listed) && (
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-pitch-500">
          {age != null && <span>{age}y</span>}
          {listed && (
            <span className="font-bold uppercase tracking-wider text-theme-primary">
              Listed
            </span>
          )}
        </div>
      )}
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
  const lineup = useMemo(
    () => getClubMatchdayLineup(career, club, round),
    [career, club, round]
  );
  const squadSlots = useMemo(
    () => clubLineupToSquadSlots(lineup, career),
    [lineup, career]
  );
  const clubAccent = getClubIndicatorColor(club);

  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);

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

  const interchangePlayers = lineup.interchange;

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm`}
        role="presentation"
        onClick={handleClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-club-sheet-title"
          className="card-glass flex max-h-[min(88vh,720px)] w-full max-w-md flex-col overflow-hidden outline-none sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="h-1 w-full shrink-0"
            style={{ backgroundColor: clubAccent }}
            aria-hidden
          />

          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-pitch-700/40 px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <ClubDualSwatch club={club} size="sm" />
              <div className="min-w-0">
                <p className={TYPO.sectionLabel}>Team Sheet</p>
                <h2
                  id="manager-club-sheet-title"
                  className={`truncate ${TYPO.cardTitle}`}
                >
                  {club}
                </h2>
                <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                  {lineup.isUserClub
                    ? "Your matchday 17"
                    : "Projected matchday 17"}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
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

            <div className="mt-3">
              {lineup.isUserClub ? (
                <ManagerMatchdayFormation career={career} title="Starting XIII" />
              ) : (
                <ManagerMatchdayFormation
                  squad={squadSlots}
                  clubColorOverride={club}
                  title="Starting XIII"
                />
              )}
            </div>

            <div className={`${CARD.base} ${SPACING.cardPadding} mt-3`}>
              <p className={`${TYPO.sectionLabel} mb-2`}>Interchange</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => {
                  const player = interchangePlayers[i];
                  const playerId = player?.id;
                  return (
                    <ReadonlyInterchangeSlot
                      key={i}
                      player={player}
                      shirtNumber={14 + i}
                      listed={playerId ? listedPlayerIds.has(playerId) : false}
                      age={
                        playerId
                          ? getManagerPlayerAge(career, playerId)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>

            {lineup.isUserClub && onViewUserSquad && (
              <GameButton
                variant="theme"
                className="mt-4 w-full"
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
