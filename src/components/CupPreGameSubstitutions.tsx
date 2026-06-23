"use client";

import { useMemo, useState } from "react";
import type { EraTeam } from "@/lib/players/era-teams";
import { getPlayerById } from "@/lib/players";
import type { SquadSlot } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { POSITION_SHORT } from "@/lib/positions";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { formatTeamRatingDisplay } from "@/lib/team-tiers";
import { swapCupSquadPlayers } from "@/lib/game/cup-squad-swap";
import { BTN, CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { RugbyPitch } from "./RugbyPitch";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { playUiClick } from "@/lib/sound";

interface CupPreGameSubstitutionsProps {
  eraTeam: EraTeam;
  initialSquad: SquadSlot[];
  onConfirm: (squad: SquadSlot[]) => void;
}

export function CupPreGameSubstitutions({
  eraTeam,
  initialSquad,
  onConfirm,
}: CupPreGameSubstitutionsProps) {
  const [squad, setSquad] = useState<SquadSlot[]>(initialSquad);
  const [selectedStarter, setSelectedStarter] = useState<number | null>(null);

  const benchPlayers = useMemo(() => {
    const usedIds = new Set(
      squad.filter((s) => s.player).map((s) => s.player!.id)
    );
    return eraTeam.benchPlayerIds
      .map((id) => getPlayerById(id))
      .filter((p): p is NonNullable<typeof p> => !!p && !usedIds.has(p.id));
  }, [eraTeam.benchPlayerIds, squad]);

  const teamRating = getAverageSquadRating(squad);

  const handleStarterClick = (slotIndex: number) => {
    playUiClick();
    setSelectedStarter((prev) => (prev === slotIndex ? null : slotIndex));
  };

  const handleBenchClick = (playerId: string) => {
    if (selectedStarter === null) return;
    const player = getPlayerById(playerId);
    if (!player) return;

    const next = swapCupSquadPlayers(squad, selectedStarter, player);
    if (!next) return;

    playUiClick();
    setSquad(next);
    setSelectedStarter(null);
  };

  if (benchPlayers.length === 0) {
    return null;
  }

  return (
    <div className={`${CARD.panel} mx-auto max-w-3xl p-4 sm:p-6`}>
      <h2 className={`${TYPO.cardTitle} text-center`}>Matchday Squad</h2>
      <p className={`mt-2 text-center ${TYPO.bodySm}`}>
        Tap a starter, then a bench player to swap — position rules apply.
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
        <span className="rounded-lg border border-pitch-700/50 bg-pitch-950/50 px-3 py-1.5">
          Rating:{" "}
          <span className="font-semibold text-accent-green">
            {formatTeamRatingDisplay(teamRating, { includeTier: false })}
          </span>
        </span>
      </div>

      <div className={`${CARD.inset} mt-4 overflow-x-hidden p-2 sm:p-4`}>
        <RugbyPitch
          squad={squad}
          totalValue={getSquadValue(squad)}
          filledCount={getFilledCount(squad)}
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
              ? squad.find((s) => s.slotIndex === selectedStarter)
              : null;
          const canSwap =
            starterSlot &&
            getPlayerEligiblePositions(player).includes(starterSlot.position);

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
                {getPlayerEligiblePositions(player)
                  .map((p) => POSITION_SHORT[p])
                  .join(" / ")}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onConfirm(squad)}
        className={`${BTN.base} ${BTN.primaryLg} mt-6 w-full`}
      >
        Confirm Squad & Start Tournament
      </button>
    </div>
  );
}
