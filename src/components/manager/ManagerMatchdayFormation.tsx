"use client";

import { useMemo } from "react";
import { RugbyPitch } from "@/components/RugbyPitch";
import { toMatchdaySquadSlotsFromCareer } from "@/lib/manager/matchday-lineup";
import type { MatchdaySlotTarget } from "@/lib/manager/managerMatchdaySquad";
import { canAssignPlayerToXiiiSlot } from "@/lib/manager/managerMatchdaySquad";
import type { ManagerCareer } from "@/lib/manager/types";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

type SlotAccent = "source" | "target";

interface ManagerMatchdayFormationProps {
  career: ManagerCareer;
  title?: string;
  interactive?: boolean;
  selectedTarget?: MatchdaySlotTarget | null;
  pendingAssignId?: string | null;
  replaceSourcePlayerId?: string | null;
  replaceCandidateIds?: Set<string>;
  onSlotClick?: (target: MatchdaySlotTarget) => void;
  onFilledSlotClick?: (playerId: string) => void;
}

export function ManagerMatchdayFormation({
  career,
  title = "Starting XIII",
  interactive = false,
  selectedTarget,
  pendingAssignId,
  replaceSourcePlayerId,
  replaceCandidateIds,
  onSlotClick,
  onFilledSlotClick,
}: ManagerMatchdayFormationProps) {
  const squad = useMemo(
    () => toMatchdaySquadSlotsFromCareer(career),
    [career]
  );

  const slotAccent = useMemo(() => {
    if (!interactive) return undefined;
    const accent: Partial<Record<number, SlotAccent>> = {};

    for (let slotIndex = 0; slotIndex < 13; slotIndex++) {
      const playerId = career.matchdayXiii[slotIndex] ?? "";
      if (playerId && replaceSourcePlayerId === playerId) {
        accent[slotIndex] = "source";
        continue;
      }
      if (
        selectedTarget?.kind === "xiii" &&
        selectedTarget.index === slotIndex
      ) {
        accent[slotIndex] = "source";
        continue;
      }
      if (
        pendingAssignId &&
        canAssignPlayerToXiiiSlot(career, slotIndex, pendingAssignId)
      ) {
        accent[slotIndex] = "target";
        continue;
      }
      if (
        playerId &&
        replaceCandidateIds?.has(playerId) &&
        (selectedTarget || replaceSourcePlayerId)
      ) {
        accent[slotIndex] = "target";
      }
    }

    return accent;
  }, [
    career,
    interactive,
    pendingAssignId,
    replaceCandidateIds,
    replaceSourcePlayerId,
    selectedTarget,
  ]);

  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} overflow-hidden border border-pitch-700/40 bg-gradient-to-b from-pitch-800/20 to-pitch-950/60`}
    >
      <p className={`${TYPO.sectionLabel} mb-3 text-center`}>{title}</p>
      <RugbyPitch
        squad={squad}
        totalValue={getSquadValue(squad)}
        filledCount={getFilledCount(squad)}
        totalSlots={TOTAL_SLOTS}
        formationOnly
        compact
        hideValueSummary
        interactive={interactive}
        allowFilledSlotClick={interactive}
        clubColorOverride={career.club}
        slotAccent={slotAccent}
        selectedSlot={
          selectedTarget?.kind === "xiii" ? selectedTarget.index : undefined
        }
        onSlotClick={(slotIndex) => {
          if (!interactive) return;
          const playerId = career.matchdayXiii[slotIndex] ?? "";
          if (playerId && onFilledSlotClick) {
            onFilledSlotClick(playerId);
            return;
          }
          onSlotClick?.({ kind: "xiii", index: slotIndex });
        }}
      />
      {interactive && (
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-500`}>
          Tap a slot or player to swap · use the squad list for full options
        </p>
      )}
    </div>
  );
}
