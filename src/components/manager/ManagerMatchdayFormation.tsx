"use client";

import { useMemo } from "react";
import { RugbyPitch } from "@/components/RugbyPitch";
import { toMatchdaySquadSlotsFromCareer } from "@/lib/manager/matchday-lineup";
import type { MatchdaySlotTarget } from "@/lib/manager/managerMatchdaySquad";
import { canAssignPlayerToXiiiSlot } from "@/lib/manager/managerMatchdaySquad";
import type { ManagerCareer } from "@/lib/manager/types";
import type { SquadSlot } from "@/lib/types";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

type SlotAccent = "source" | "target";

interface ManagerMatchdayFormationProps {
  career?: ManagerCareer;
  /** Read-only opponent / league club sheet — same pitch layout without career state. */
  squad?: SquadSlot[];
  clubColorOverride?: string;
  title?: string;
  /** Hide the in-card section title (e.g. when the parent modal already labels the sheet). */
  hideTitle?: boolean;
  interactive?: boolean;
  selectedTarget?: MatchdaySlotTarget | null;
  pendingAssignId?: string | null;
  replaceSourcePlayerId?: string | null;
  replaceCandidateIds?: Set<string>;
  onSlotClick?: (target: MatchdaySlotTarget) => void;
  onFilledSlotClick?: (playerId: string) => void;
  onFilledSlotDoubleClick?: (playerId: string) => void;
  /** Read-only — tap filled slots to inspect player details. */
  onPlayerClick?: (playerId: string, slotIndex: number) => void;
}

export function ManagerMatchdayFormation({
  career,
  squad: squadOverride,
  clubColorOverride,
  title = "Starting XIII",
  hideTitle = false,
  interactive = false,
  selectedTarget,
  pendingAssignId,
  replaceSourcePlayerId,
  replaceCandidateIds,
  onSlotClick,
  onFilledSlotClick,
  onFilledSlotDoubleClick,
  onPlayerClick,
}: ManagerMatchdayFormationProps) {
  const squad = useMemo(
    () =>
      squadOverride ??
      (career ? toMatchdaySquadSlotsFromCareer(career) : []),
    [career, squadOverride]
  );
  const pitchClub = clubColorOverride ?? career?.club ?? "";
  const canInspectPlayers = Boolean(onPlayerClick);

  const slotAccent = useMemo(() => {
    if (!interactive || !career) return undefined;
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
      {!hideTitle && (
        <p className={`${TYPO.sectionLabel} mb-2 text-center sm:mb-3`}>{title}</p>
      )}
      <RugbyPitch
        squad={squad}
        totalValue={getSquadValue(squad)}
        filledCount={getFilledCount(squad)}
        totalSlots={TOTAL_SLOTS}
        formationOnly
        compact
        hideValueSummary
        interactive={interactive || canInspectPlayers}
        allowFilledSlotClick={interactive || canInspectPlayers}
        clubColorOverride={pitchClub || undefined}
        slotAccent={slotAccent}
        selectedSlot={
          selectedTarget?.kind === "xiii" ? selectedTarget.index : undefined
        }
        onSlotClick={(slotIndex) => {
          const slot = squad.find((s) => s.slotIndex === slotIndex);
          if (canInspectPlayers && slot?.player) {
            onPlayerClick!(slot.player.id, slotIndex);
            return;
          }
          if (!interactive || !career) return;
          const playerId = career.matchdayXiii[slotIndex] ?? "";
          if (playerId && onFilledSlotClick) {
            onFilledSlotClick(playerId);
            return;
          }
          onSlotClick?.({ kind: "xiii", index: slotIndex });
        }}
        onFilledSlotDoubleClick={
          interactive && career && onFilledSlotDoubleClick
            ? (slotIndex) => {
                const playerId = career.matchdayXiii[slotIndex] ?? "";
                if (playerId) onFilledSlotDoubleClick(playerId);
              }
            : undefined
        }
      />
      {interactive && (
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-500`}>
          Tap a slot or player to swap · use the squad list for full options
        </p>
      )}
      {canInspectPlayers && !interactive && (
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-500`}>
          Tap a player for contract and profile details
        </p>
      )}
    </div>
  );
}
