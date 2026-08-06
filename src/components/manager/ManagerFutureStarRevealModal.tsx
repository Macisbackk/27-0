"use client";

import { useCallback, useEffect, useRef } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { ManagerStat } from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import {
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { getFullPositionName } from "@/lib/positions";
import type { ManagerCareer, ManagerReservePlayer } from "@/lib/manager/types";
import { playFutureStarReveal, playUiClick } from "@/lib/sound";

interface ManagerFutureStarRevealModalProps {
  career: ManagerCareer;
  player: ManagerReservePlayer;
  onAcknowledge: (career: ManagerCareer) => void;
  onViewInReserves: (career: ManagerCareer) => void;
}

function acknowledgeFutureStar(
  career: ManagerCareer,
  playerId: string,
  options?: { focusReserves?: boolean }
): ManagerCareer {
  return {
    ...career,
    pendingFutureStarRevealPlayerId: null,
    futureStarRevealAckByPlayerId: {
      ...(career.futureStarRevealAckByPlayerId ?? {}),
      [playerId]: true,
    },
    focusReservePlayerId: options?.focusReserves ? playerId : career.focusReservePlayerId,
    updatedAt: new Date().toISOString(),
  };
}

export function ManagerFutureStarRevealModal({
  career,
  player,
  onAcknowledge,
  onViewInReserves,
}: ManagerFutureStarRevealModalProps) {
  const playedRef = useRef(false);

  const handleClose = useCallback(() => {
    playUiClick();
    onAcknowledge(acknowledgeFutureStar(career, player.id));
  }, [career, onAcknowledge, player.id]);

  const handleViewReserves = useCallback(() => {
    playUiClick();
    onViewInReserves(
      acknowledgeFutureStar(career, player.id, { focusReserves: true })
    );
  }, [career, onViewInReserves, player.id]);

  const panelRef = useModalA11y(true, handleClose);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    playFutureStarReveal();
  }, []);

  const positionLabel = getFullPositionName(player.position);

  return (
    <ManagerModal
      open
      labelledBy="future-star-reveal-title"
      zClass="z-[9999]"
      panelRef={panelRef}
      onClose={handleClose}
      header={
        <div className="border-b border-accent-gold/30 bg-accent-gold/8">
          <span className={managerPillClass("gold")}>Academy</span>
          <h2 id="future-star-reveal-title" className={`mt-3 ${TYPO.pageTitle}`}>
            Future Star Discovered
          </h2>
        </div>
      }
      footer={
        <div className={`flex flex-col gap-2 sm:flex-row ${SPACING.buttonGap}`}>
          <GameButton
            variant="theme"
            onClick={handleViewReserves}
            className="sm:flex-1"
          >
            View in Reserves
          </GameButton>
          <GameButton
            variant="secondary"
            onClick={handleClose}
            className="sm:flex-1"
          >
            Close
          </GameButton>
        </div>
      }
    >
      <p className={TYPO.managerBody}>
        {player.name} has been scouted and signed for the reserves.
      </p>
      <p className={`mt-2 ${TYPO.managerBody}`}>
        The club believes the {player.age}-year-old {positionLabel} has the
        potential to become an outstanding first-team player.
      </p>

      <div className={`mt-4 grid grid-cols-2 gap-3`}>
        <ManagerStat label="Name" value={player.name} tone="primary" />
        <ManagerStat label="Age" value={String(player.age)} tone="muted" />
        <ManagerStat label="Position" value={positionLabel} tone="muted" />
        <ManagerStat
          label="Nationality"
          value={player.nationality}
          tone="muted"
        />
        <ManagerStat
          label="Rating"
          value={String(player.rating)}
          tone="primary"
        />
        <ManagerStat
          label="Potential"
          value={String(player.potentialRating)}
          tone="gold"
        />
        <ManagerStat label="Club" value={career.club} tone="muted" />
        <ManagerStat label="Status" value="Reserve" tone="sky" />
      </div>
    </ManagerModal>
  );
}

/** Resolve a pending Future Star reveal that has not been acknowledged. */
export function getPendingFutureStarReveal(
  career: ManagerCareer
): ManagerReservePlayer | null {
  const pendingId = career.pendingFutureStarRevealPlayerId;
  if (!pendingId) return null;
  if (career.futureStarRevealAckByPlayerId?.[pendingId]) return null;
  return (career.reserves ?? []).find((r) => r.id === pendingId) ?? null;
}
