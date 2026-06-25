"use client";

import { useMemo, useState } from "react";
import type { EraTeam } from "@/lib/players/era-teams";
import { getPlayerById } from "@/lib/players";
import type { SquadSlot } from "@/lib/types";
import { canPlayPosition, getEligiblePositions } from "@/lib/players/player-positions";
import { POSITION_SHORT } from "@/lib/positions";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { formatTeamRatingDisplay } from "@/lib/team-tiers";
import { canBenchPlayerFillSlot, swapCupSquadPlayers } from "@/lib/game/cup-squad-swap";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "./ui/GameButton";
import { RugbyPitch } from "./RugbyPitch";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { playUiClick } from "@/lib/sound";

interface CupPreGameSubstitutionsProps {
  eraTeam: EraTeam;
  initialSquad: SquadSlot[];
  onConfirm: (squad: SquadSlot[]) => void;
}

function initialBenchIds(eraTeam: EraTeam, squad: SquadSlot[]): string[] {
  const starterIds = new Set(
    squad.filter((s) => s.player).map((s) => s.player!.id)
  );
  return eraTeam.benchPlayerIds.filter((id) => !starterIds.has(id));
}

export function CupPreGameSubstitutions({
  eraTeam,
  initialSquad,
  onConfirm,
}: CupPreGameSubstitutionsProps) {
  const [draftSquad, setDraftSquad] = useState<SquadSlot[]>(initialSquad);
  const [benchIds, setBenchIds] = useState<string[]>(() =>
    initialBenchIds(eraTeam, initialSquad)
  );
  const [selectedStarter, setSelectedStarter] = useState<number | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

  const benchPlayers = useMemo(
    () =>
      benchIds
        .map((id) => getPlayerById(id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [benchIds]
  );

  const teamRating = getAverageSquadRating(draftSquad);

  const handleStarterClick = (slotIndex: number) => {
    playUiClick();
    setSwapMessage(null);
    setSelectedStarter((prev) => (prev === slotIndex ? null : slotIndex));
  };

  const handleBenchClick = (playerId: string) => {
    if (selectedStarter === null) return;
    const player = getPlayerById(playerId);
    const starterSlot = draftSquad.find((s) => s.slotIndex === selectedStarter);
    if (!player || !starterSlot?.player) return;

    if (!canBenchPlayerFillSlot(player, starterSlot.position)) {
      setSwapMessage(
        `${player.name} can't play ${POSITION_SHORT[starterSlot.position]}`
      );
      return;
    }

    const displacedId = starterSlot.player.id;
    const next = swapCupSquadPlayers(draftSquad, selectedStarter, player);
    if (!next) return;

    playUiClick();
    setDraftSquad(next);
    setBenchIds((prev) => [
      ...prev.filter((id) => id !== playerId),
      displacedId,
    ]);
    setSelectedStarter(null);
    setSwapMessage(null);
  };

  if (benchPlayers.length === 0) {
    return null;
  }

  return (
    <div className={`${CARD.panel} mx-auto max-w-3xl p-4 sm:p-6`}>
      <h2 className={`${TYPO.cardTitle} text-center`}>Matchday Squad</h2>
      <p className={`mt-2 text-center ${TYPO.bodySm}`}>
        Tap a starter, then a bench player to swap. Change your mind freely
        until you confirm the squad.
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
        <span className="rounded-lg border border-pitch-700/50 bg-pitch-950/50 px-3 py-1.5">
          Rating:{" "}
          <span className="font-semibold text-accent-green">
            {formatTeamRatingDisplay(teamRating, { includeTier: false })}
          </span>
        </span>
      </div>

      {swapMessage && (
        <p
          className="mt-3 text-center text-xs font-medium text-amber-400"
          role="status"
        >
          {swapMessage}
        </p>
      )}

      <div className={`${CARD.inset} mt-4 overflow-x-hidden p-2 sm:p-4`}>
        <RugbyPitch
          squad={draftSquad}
          totalValue={getSquadValue(draftSquad)}
          filledCount={getFilledCount(draftSquad)}
          totalSlots={TOTAL_SLOTS}
          hideValueSummary
          formationOnly
          compact
          clubColorOverride={eraTeam.displayName}
          interactive
          allowFilledSlotClick
          onSlotClick={handleStarterClick}
          selectedSlot={selectedStarter ?? undefined}
        />
      </div>

      <p className={`mt-4 ${TYPO.statLabel}`}>Bench</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {benchPlayers.map((player) => {
          const starterSlot =
            selectedStarter !== null
              ? draftSquad.find((s) => s.slotIndex === selectedStarter)
              : null;
          const canSwap =
            starterSlot &&
            canPlayPosition(player, starterSlot.position);

          return (
            <button
              key={player.id}
              type="button"
              disabled={selectedStarter === null || !canSwap}
              onClick={() => handleBenchClick(player.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${
                canSwap && selectedStarter !== null
                  ? "border-accent-gold/50 bg-accent-gold/10 hover:bg-accent-gold/15"
                  : "border-pitch-700/50 bg-pitch-950/40 opacity-70"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="block font-semibold text-white">{player.name}</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {getEligiblePositions(player)
                  .map((p) => POSITION_SHORT[p])
                  .join(" / ")}
              </span>
            </button>
          );
        })}
      </div>

      <GameButton
        variant="theme"
        size="md"
        className="mx-auto mt-6 max-w-md"
        onClick={() => onConfirm(draftSquad)}
      >
        Confirm Squad & Start Tournament
      </GameButton>
    </div>
  );
}
