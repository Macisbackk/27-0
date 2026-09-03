"use client";

import { useCallback, useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { FILTER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import {
  formatRetrainingDuration,
  formatRetrainingPathLabel,
  startPositionRetraining,
  type PositionRetrainingPath,
} from "@/lib/manager/managerPositionRetraining";
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
import { managerModalHeaderClass } from "@/lib/manager/managerSurfaces";
import { playMenuOpen, playUiClick } from "@/lib/sound";

interface ManagerRetrainingPathModalProps {
  career: ManagerCareer;
  playerId: string;
  paths: PositionRetrainingPath[];
  onClose: () => void;
  onUpdate: (career: ManagerCareer) => void;
}

export function ManagerRetrainingPathModal({
  career,
  playerId,
  paths,
  onClose,
  onUpdate,
}: ManagerRetrainingPathModalProps) {
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const player = getManagerPlayer(career, playerId);
  const selectedPath = paths.find(
    (path) => `${path.from}->${path.to}` === selectedPathKey
  );

  const handleClose = useCallback(() => {
    playUiClick();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);

  useEffect(() => {
    playMenuOpen();
  }, []);

  if (!player) return null;

  const handleStart = () => {
    if (!selectedPath) return;
    playUiClick();
    const result = startPositionRetraining(career, playerId, selectedPath.to);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    onUpdate(result.career);
    onClose();
  };

  return (
    <ManagerModal
      open
      labelledBy="retrain-path-title"
      panelRef={panelRef}
      header={
        <div
          className={managerModalHeaderClass("primary", {
            centered: true,
            slotted: true,
          })}
        >
          <p className={TYPO.sectionLabel}>Dual position training</p>
          <h2 id="retrain-path-title" className={`mt-1 ${TYPO.cardTitle}`}>
            {player.name}
          </h2>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            Primary role:{" "}
            {formatPlayerPositionLabel(player, { short: true })} ·{" "}
            {player.peakRating} rated
          </p>
        </div>
      }
      footer={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GameButton
            variant="theme"
            disabled={!selectedPath}
            onClick={handleStart}
          >
            Start training
          </GameButton>
          <GameButton variant="secondary" onClick={handleClose}>
            Cancel
          </GameButton>
        </div>
      }
    >
      {notice && (
        <p className={`${TYPO.bodySm} text-amber-300`} role="status">
          {notice}
        </p>
      )}

      <p className={`${notice ? "mt-4" : ""} ${TYPO.sectionLabel}`}>
        Choose new position
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
        {paths.map((path) => {
          const key = `${path.from}->${path.to}`;
          const active = selectedPathKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                playUiClick();
                setSelectedPathKey(active ? null : key);
                setNotice(null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                active ? FILTER.chipActive : `${FILTER.chipIdle} btn-press`
              }`}
            >
              {formatRetrainingPathLabel(path.from, path.to)}
            </button>
          );
        })}
      </div>

      <p className={`mt-3 ${TYPO.bodySm} text-pitch-400`}>
        {selectedPath
          ? `${formatRetrainingDuration(selectedPath.weeks)} training · learns ${formatRetrainingPathLabel(selectedPath.from, selectedPath.to)}`
          : "Pick a path to see duration and confirm."}
      </p>
    </ManagerModal>
  );
}
