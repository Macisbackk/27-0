"use client";

import { useMemo, useState } from "react";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT } from "@/lib/positions";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
import {
  formatRetrainingDuration,
  formatRetrainingPathLabel,
  getActiveRetraining,
  getAvailableRetrainingTargets,
  getPlayerRetrainingStatus,
  getRetrainingProgress,
  listActiveRetraining,
  startPositionRetraining,
  WEEKS_PER_MONTH,
  type PlayerRetrainingStatus,
} from "@/lib/manager/managerPositionRetraining";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { playUiClick } from "@/lib/sound";

interface ManagerPositionRetrainingPanelProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

function weeksToMonthsLabel(weeks: number): string {
  const months = Math.max(1, Math.ceil(weeks / WEEKS_PER_MONTH));
  return formatRetrainingDuration(months);
}

function statusHint(status: PlayerRetrainingStatus): string | null {
  switch (status) {
    case "already_dual":
      return "Dual role";
    case "training":
      return "In training";
    case "no_paths":
      return "No paths";
    default:
      return null;
  }
}

function playerChipClass(
  status: PlayerRetrainingStatus,
  selected: boolean
): string {
  const base = "rounded-lg border px-3 py-2 text-xs transition";
  if (status === "already_dual" || status === "no_paths") {
    return `${base} cursor-not-allowed border-pitch-700/50 bg-pitch-950/40 text-pitch-600 opacity-50`;
  }
  if (status === "training") {
    return `${base} cursor-not-allowed border-theme-primary/25 bg-theme-primary/5 text-pitch-500 opacity-70`;
  }
  if (selected) return `${base} ${FILTER.chipActive}`;
  return `${base} ${FILTER.chipIdle} btn-press hover:border-theme-primary/45 hover:text-white`;
}

export function ManagerPositionRetrainingPanel({
  career,
  onUpdate,
}: ManagerPositionRetrainingPanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const squadPlayers = useMemo(() => {
    return career.squad
      .map((entry) => {
        const player = getManagerPlayer(career, entry.playerId);
        if (!player) return null;
        const status = getPlayerRetrainingStatus(career, entry.playerId);
        const options = getAvailableRetrainingTargets(career, entry.playerId);
        return { entry, player, status, options };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => {
        const rank = (s: PlayerRetrainingStatus) =>
          s === "available"
            ? 0
            : s === "training"
              ? 1
              : s === "already_dual"
                ? 2
                : 3;
        const diff = rank(a.status) - rank(b.status);
        if (diff !== 0) return diff;
        return b.player.peakRating - a.player.peakRating;
      });
  }, [career]);

  const activeTraining = useMemo(() => listActiveRetraining(career), [career]);

  const selectedRow = selectedPlayerId
    ? squadPlayers.find((row) => row.entry.playerId === selectedPlayerId) ?? null
    : null;

  const selectedPath = selectedRow?.options.find(
    (path) => `${path.from}->${path.to}` === selectedPathKey
  );

  const handleSelectPlayer = (playerId: string, status: PlayerRetrainingStatus) => {
    if (status !== "available") return;
    playUiClick();
    setNotice(null);
    setSelectedPathKey(null);
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const handleStart = () => {
    if (!selectedPlayerId || !selectedPath) return;
    playUiClick();
    const result = startPositionRetraining(
      career,
      selectedPlayerId,
      selectedPath.to
    );
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(null);
    onUpdate(result.career);
    setSelectedPlayerId(null);
    setSelectedPathKey(null);
  };

  return (
    <div className="text-center">
      <p className={`${TYPO.sectionLabel} mb-2`}>Dual Position Training</p>
      <p className={`mx-auto max-w-lg ${TYPO.bodySm} text-pitch-400`}>
        Single-role players can learn a second position over several months.
        Progress advances each league week ({WEEKS_PER_MONTH} weeks = 1 month).
        Players who already have dual roles cannot retrain.
      </p>

      {notice && (
        <p
          className={`mx-auto mt-3 max-w-lg ${TYPO.bodySm} text-amber-300`}
          role="status"
        >
          {notice}
        </p>
      )}

      {activeTraining.length > 0 && (
        <div className={`${CARD.stat} ${SPACING.cardPaddingSm} mt-4 text-left`}>
          <p className={`${TYPO.sectionLabel} mb-3 text-center`}>In progress</p>
          <ul className={SPACING.stackSm}>
            {activeTraining.map(({ playerId, training }) => {
              const player = getManagerPlayer(career, playerId);
              const progress = getRetrainingProgress(training);
              return (
                <li key={playerId}>
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
        <p className={`${TYPO.sectionLabel} mb-2`}>Squad players</p>
        <div className="flex flex-wrap justify-center gap-2">
          {squadPlayers.map(({ entry, player, status, options }) => {
            const isSelected = selectedPlayerId === entry.playerId;
            const hint = statusHint(status);
            const active = getActiveRetraining(career, entry.playerId);
            const positionsLabel = formatPlayerPositionLabel(player, {
              short: true,
            });

            return (
              <button
                key={entry.playerId}
                type="button"
                disabled={status !== "available"}
                onClick={() => handleSelectPlayer(entry.playerId, status)}
                title={
                  status === "already_dual"
                    ? `${player.name} already plays ${positionsLabel}`
                    : status === "no_paths"
                      ? `${player.name} has no retraining paths from ${POSITION_SHORT[player.position]}`
                      : undefined
                }
                className={`min-w-[7.5rem] max-w-[11rem] text-left ${playerChipClass(status, isSelected)}`}
              >
                <span className="block truncate font-semibold text-inherit">
                  {player.name}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-pitch-500">
                  {positionsLabel}
                  {active
                    ? ` · ${POSITION_SHORT[active.targetPosition]}`
                    : hint
                      ? ` · ${hint}`
                      : options.length > 0
                        ? ` · ${options.length} path${options.length === 1 ? "" : "s"}`
                        : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedRow && selectedRow.status === "available" && (
        <div className="mt-4">
          <p className={`${TYPO.sectionLabel} mb-2`}>
            Train {selectedRow.player.name} as
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {selectedRow.options.map((path) => {
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
                  className={`rounded-lg border px-3 py-2 text-xs transition ${
                    active ? FILTER.chipActive : `${FILTER.chipIdle} btn-press`
                  }`}
                >
                  {formatRetrainingPathLabel(path.from, path.to)}
                  <span className="mt-0.5 block text-[10px] text-pitch-500">
                    {formatRetrainingDuration(path.months)}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedPath && (
            <>
              <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-400`}>
                {selectedRow.player.name} will learn{" "}
                {POSITION_SHORT[selectedPath.to]} over{" "}
                {formatRetrainingDuration(selectedPath.months)}, starting from{" "}
                {POSITION_SHORT[selectedPath.from]}.
              </p>
              <button
                type="button"
                onClick={handleStart}
                className={`mt-3 rounded-lg border px-4 py-2 text-xs font-semibold transition ${FILTER.chipActive} btn-press`}
              >
                Start training
              </button>
            </>
          )}
        </div>
      )}

      <p className={`mx-auto mt-4 max-w-lg ${TYPO.bodySm} text-pitch-500`}>
        Paths by primary role: CE→SR/WG, SR→PF/LF, PF→SR, HK→HB/LF, WG→FB,
        HB→FB, LF→HB, FB→WG/HB.
      </p>
    </div>
  );
}
