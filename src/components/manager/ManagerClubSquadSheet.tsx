"use client";

import { useCallback, useMemo, useState } from "react";
import { ClubHeaderBar, ClubLogoBox } from "@/components/ClubBadge";
import { GameButton } from "@/components/ui/GameButton";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { getClubIndicatorColor } from "@/lib/clubs";
import {
  getClubMatchdayLineup,
  getLineupXiiiPlayers,
} from "@/lib/manager/managerLeagueLineup";
import { getManagerPlayerAge } from "@/lib/manager/managerPlayers";
import {
  slotAbbrev,
  TEAM_SHEET_ROWS,
} from "@/lib/manager/managerMatchdaySquad";
import type { ManagerCareer } from "@/lib/manager/types";
import { POSITION_SHORT } from "@/lib/positions";
import type { Player, Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
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

function ratingBadgeClass(rating: number): string {
  if (rating >= 85) {
    return "bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/35";
  }
  if (rating >= 78) {
    return "bg-theme-primary/15 text-theme-primary ring-1 ring-theme-primary/35";
  }
  return "bg-pitch-800/80 text-pitch-200 ring-1 ring-pitch-600/50";
}

function teamStrengthLabel(avg: number): { label: string; className: string } {
  if (avg >= 84) {
    return { label: "Elite", className: "text-accent-gold border-accent-gold/40 bg-accent-gold/10" };
  }
  if (avg >= 80) {
    return { label: "Strong", className: "text-theme-primary border-theme-primary/40 bg-theme-primary/10" };
  }
  if (avg >= 76) {
    return { label: "Competitive", className: "text-sky-300 border-sky-400/35 bg-sky-400/10" };
  }
  return { label: "Developing", className: "text-pitch-300 border-pitch-600/50 bg-pitch-800/50" };
}

function isBackPosition(position: Position): boolean {
  return (
    position === "FULLBACK" ||
    position === "WING" ||
    position === "CENTRE" ||
    position === "STAND_OFF" ||
    position === "SCRUM_HALF"
  );
}

function positionChipClass(position: Position): string {
  return isBackPosition(position)
    ? "border-sky-400/35 bg-sky-400/10 text-sky-200"
    : "border-amber-400/35 bg-amber-400/10 text-amber-200";
}

function TeamSheetPlayerSlot({
  position,
  player,
  age,
  listed,
  compact,
}: {
  position: Position;
  player: Player;
  age: number | null | undefined;
  listed: boolean;
  compact?: boolean;
}) {
  const rating = player.peakRating;

  return (
    <div
      className={`relative flex min-h-[4.5rem] flex-col justify-between rounded-lg border border-pitch-700/55 bg-pitch-950/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
        compact ? "px-1.5 py-1.5 sm:px-2 sm:py-2" : "px-2 py-2"
      }`}
    >
      <span
        className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md font-display text-[11px] font-black sm:h-8 sm:w-8 sm:text-xs ${ratingBadgeClass(rating)}`}
      >
        {rating}
      </span>

      <div className="flex flex-wrap items-center gap-1 pr-8">
        <span
          className={`rounded border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider ${positionChipClass(position)}`}
        >
          {slotAbbrev(position)}
        </span>
        {listed && (
          <span className="rounded border border-theme-primary/35 bg-theme-primary/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-theme-primary">
            Listed
          </span>
        )}
      </div>

      <div className="mt-1 min-w-0 pr-7">
        <p
          className={`truncate font-display font-bold leading-tight text-white ${
            compact ? "text-[11px] sm:text-sm" : "text-sm"
          }`}
          title={player.name}
        >
          {player.name}
        </p>
        {age != null && (
          <p className="mt-0.5 text-[10px] text-pitch-500">{age}y</p>
        )}
      </div>
    </div>
  );
}

function BenchPlayerSlot({
  index,
  player,
  age,
  listed,
}: {
  index: number;
  player: Player;
  age: number | null | undefined;
  listed: boolean;
}) {
  const positions = getPlayerEligiblePositions(player);
  const posLabel = positions.map((p) => POSITION_SHORT[p]).join(" · ");

  return (
    <li
      className={`${CARD.inset} relative flex min-h-[5rem] flex-col justify-between ${SPACING.cardPaddingSm}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] font-bold text-pitch-500">
          {14 + index}
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-xs font-black ${ratingBadgeClass(player.peakRating)}`}
        >
          {player.peakRating}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold text-white" title={player.name}>
          {player.name}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-pitch-400">{posLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {age != null && (
            <span className="text-[10px] text-pitch-500">{age}y</span>
          )}
          {listed && (
            <span className="rounded border border-theme-primary/35 bg-theme-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-theme-primary">
              Listed
            </span>
          )}
        </div>
      </div>
    </li>
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

  const benchAvg =
    lineup.interchange.length > 0
      ? Math.round(
          lineup.interchange.reduce((sum, player) => sum + player.peakRating, 0) /
            lineup.interchange.length
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
  const starPlayer =
    xiiiPlayers.length > 0
      ? xiiiPlayers.reduce((best, player) =>
          player.peakRating > best.peakRating ? player : best
        )
      : null;

  const compactRow = (slotCount: number) => slotCount >= 3;

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 z-[90] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} ${SPACING.safeBottom} backdrop-blur-sm sm:items-center`}
        role="dialog"
        aria-modal="true"
        aria-label={`${club} matchday squad`}
        onClick={handleClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`${MODAL.panelWide} card-glass overflow-hidden outline-none`}
          onClick={(e) => e.stopPropagation()}
        >
        <ClubHeaderBar club={club} size="sm" />

        <div className={MODAL.panelPadding}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <ClubLogoBox club={club} size="md" />
                <div className="min-w-0">
                  <p className={TYPO.sectionLabel}>Team Sheet</p>
                  <h2 className={`truncate ${TYPO.cardTitle}`}>{club}</h2>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-pitch-600/60 bg-pitch-900/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pitch-300">
                  Season {career.seasonYear}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${strength.className}`}
                >
                  {strength.label}
                </span>
                <span className="text-[11px] text-pitch-400">
                  {lineup.isUserClub
                    ? "Your current lineup"
                    : "Projected matchday 17"}
                </span>
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

          <div
            className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
            style={{ borderLeftWidth: 3, borderLeftColor: clubAccent }}
          >
            <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
                Squad avg
              </p>
              <p className="mt-0.5 font-display text-xl font-black text-white">
                {teamAvg || "—"}
              </p>
            </div>
            <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
                Starting XIII
              </p>
              <p className="mt-0.5 font-display text-xl font-black text-theme-primary">
                {xiiiAvg || "—"}
              </p>
            </div>
            <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
                Interchange
              </p>
              <p className="mt-0.5 font-display text-xl font-black text-sky-300">
                {benchAvg || "—"}
              </p>
            </div>
            <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
                Key player
              </p>
              <p
                className="mt-0.5 truncate font-display text-sm font-bold text-accent-gold"
                title={starPlayer?.name}
              >
                {starPlayer?.name ?? "—"}
              </p>
            </div>
          </div>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <p className={TYPO.sectionLabel}>Starting XIII</p>
              <span className="text-[10px] text-pitch-500">1–13</span>
            </div>
            <div
              className={`mt-3 rounded-xl border border-pitch-700/45 bg-gradient-to-b from-theme-primary/[0.07] via-pitch-900/50 to-pitch-950/80 ${SPACING.cardPadding} ${SPACING.stackSm}`}
            >
              {TEAM_SHEET_ROWS.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid gap-1.5 sm:gap-2"
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
                          className="flex min-h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-pitch-700/45 bg-pitch-950/30 text-center text-[10px] text-pitch-600"
                        >
                          Empty
                        </div>
                      );
                    }
                    const age = getManagerPlayerAge(career, entry.player.id);
                    return (
                      <TeamSheetPlayerSlot
                        key={slotIndex}
                        position={entry.position}
                        player={entry.player}
                        age={age}
                        listed={listedPlayerIds.has(entry.player.id)}
                        compact={compactRow(row.slots.length)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-pitch-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-sky-400/35 bg-sky-400/15" />
                Backs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-amber-400/35 bg-amber-400/15" />
                Forwards
              </span>
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <p className={TYPO.sectionLabel}>Interchange</p>
              <span className="text-[10px] text-pitch-500">14–17</span>
            </div>
            {lineup.interchange.length === 0 ? (
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                No interchange selected.
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {lineup.interchange.map((player, index) => {
                  const age = getManagerPlayerAge(career, player.id);
                  return (
                    <BenchPlayerSlot
                      key={player.id}
                      index={index}
                      player={player}
                      age={age}
                      listed={listedPlayerIds.has(player.id)}
                    />
                  );
                })}
              </ul>
            )}
          </section>

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
