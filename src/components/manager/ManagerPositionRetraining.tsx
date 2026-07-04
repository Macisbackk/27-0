"use client";

import { useMemo, useState } from "react";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  formatPlayerPositionLabel,
} from "@/lib/players/player-positions";
import {
  formatRetrainingDuration,
  formatRetrainingPathLabel,
  getActiveRetraining,
  getAvailableRetrainingTargets,
  getRetrainingProgress,
  listActiveRetraining,
  startPositionRetraining,
  WEEKS_PER_MONTH,
} from "@/lib/manager/managerPositionRetraining";
import {
  getManagerPlayer,
} from "@/lib/manager/managerPlayers";
import { playUiClick } from "@/lib/sound";

interface ManagerPositionRetrainingPanelProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

function weeksToMonthsLabel(weeks: number): string {
  const months = Math.max(1, Math.ceil(weeks / WEEKS_PER_MONTH));
  return formatRetrainingDuration(months);
}

export function ManagerPositionRetrainingPanel({
  career,
  onUpdate,
}: ManagerPositionRetrainingPanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const squadPlayers = useMemo(() => {
    return career.squad
      .map((entry) => {
        const player = getManagerPlayer(career, entry.playerId);
        if (!player) return null;
        return { entry, player };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [career]);

  const activeTraining = useMemo(() => listActiveRetraining(career), [career]);

  const selectedTargets = selectedPlayerId
    ? getAvailableRetrainingTargets(career, selectedPlayerId)
    : [];

  const handleStart = (playerId: string, target: Position) => {
    playUiClick();
    const result = startPositionRetraining(career, playerId, target);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(null);
    onUpdate(result.career);
    setSelectedPlayerId(null);
  };

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
      <p className={TYPO.sectionLabel}>Position Retraining</p>
      <p className={`mx-auto mt-2 max-w-lg text-center ${TYPO.bodySm} text-pitch-400`}>
        Train first-team players for a second position. Progress advances each
        league week ({WEEKS_PER_MONTH} weeks = 1 month).
      </p>

      {notice && (
        <p className={`mt-3 text-center ${TYPO.bodySm} text-amber-300`} role="status">
          {notice}
        </p>
      )}

      {activeTraining.length > 0 && (
        <div className={`mt-4 ${SPACING.stackSm}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
            In progress
          </p>
          <ul className={SPACING.stackSm}>
            {activeTraining.map(({ playerId, training }) => {
              const player = getManagerPlayer(career, playerId);
              const progress = getRetrainingProgress(training);
              return (
                <li
                  key={playerId}
                  className={`${CARD.inset} ${SPACING.cardPaddingSm}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {player?.name ?? "Unknown"}
                      </p>
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        {formatRetrainingPathLabel(
                          training.fromPosition,
                          training.targetPosition
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-theme-primary">
                      {weeksToMonthsLabel(training.weeksRemaining)} left
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pitch-800">
                    <div
                      className="h-full rounded-full bg-theme-primary transition-all"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
          Select player
        </p>
        <ul className={`max-h-56 ${SPACING.stackSm} overflow-y-auto pr-0.5`}>
          {squadPlayers.map(({ entry, player }) => {
            const active = getActiveRetraining(career, entry.playerId);
            const options = getAvailableRetrainingTargets(career, entry.playerId);
            const isSelected = selectedPlayerId === entry.playerId;
            const positionsLabel = formatPlayerPositionLabel(player, {
              short: true,
            });

            return (
              <li key={entry.playerId}>
                <button
                  type="button"
                  disabled={Boolean(active) || options.length === 0}
                  onClick={() => {
                    playUiClick();
                    setNotice(null);
                    setSelectedPlayerId(isSelected ? null : entry.playerId);
                  }}
                  className={`btn-press w-full rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? FILTER.chipActive : FILTER.chipIdle
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-white">
                      {player.name}
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-theme-primary">
                      {player.peakRating}
                    </span>
                  </div>
                  <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                    {positionsLabel}
                    {active
                      ? ` · Retraining ${POSITION_SHORT[active.targetPosition]}`
                      : options.length === 0
                        ? " · No retraining paths"
                        : ""}
                  </p>
                </button>

                {isSelected && options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-1">
                    {options.map((path) => (
                      <button
                        key={path.to}
                        type="button"
                        onClick={() => handleStart(entry.playerId, path.to)}
                        className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${FILTER.chipIdle} hover:border-theme-primary/45 hover:text-white`}
                      >
                        <span className="font-semibold text-theme-primary">
                          {formatRetrainingPathLabel(path.from, path.to)}
                        </span>
                        <span className="ml-1.5 text-pitch-500">
                          · {formatRetrainingDuration(path.months)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {selectedPlayerId && selectedTargets.length === 0 && (
        <p className={`mt-3 text-center ${TYPO.bodySm} text-pitch-500`}>
          {getActiveRetraining(career, selectedPlayerId)
            ? "This player is already retraining."
            : "No retraining paths available from this player's primary position."}
        </p>
      )}

      <p className={`mx-auto mt-4 max-w-lg text-center ${TYPO.bodySm} text-pitch-500`}>
        Available paths depend on primary position: CE→SR/WG, SR→PF/LF, PF→SR,
        WG→FB, HB→FB, LF→HB, FB→WG/HB.
      </p>
    </div>
  );
}
