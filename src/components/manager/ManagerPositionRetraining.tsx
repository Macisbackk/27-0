"use client";

import { useMemo, useState } from "react";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT } from "@/lib/positions";
import type { ManagerCareer, PlayerPositionRetraining } from "@/lib/manager/types";
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
import {
  formatRetrainingDuration,
  formatRetrainingPathLabel,
  getAvailableRetrainingTargets,
  getActiveRetraining,
  getPlayerRetrainingStatus,
  getRetrainingProgress,
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

const RETRAINING_PLAYER_CARD_WIDTH =
  "w-[10.5rem] shrink-0 sm:w-[11rem]";

function retrainingCardShellClass(variant: "idle" | "selected" | "training" | "disabled"): string {
  const base = `${CARD.inset} ${RETRAINING_PLAYER_CARD_WIDTH} flex flex-col rounded-lg border px-3 py-2.5 text-left transition`;
  switch (variant) {
    case "selected":
      return `${base} border-theme-tertiary/60 bg-theme-primary/10`;
    case "training":
      return `${base} border-theme-primary/35 bg-gradient-to-b from-theme-primary/10 to-pitch-950/90`;
    case "disabled":
      return `${base} cursor-not-allowed border-pitch-600/60 bg-pitch-900/40 opacity-60`;
    default:
      return `${base} border-pitch-600/60 bg-pitch-950/55 btn-press hover:border-pitch-500/55 hover:bg-pitch-900/70`;
  }
}

function RetrainingPlayerCardHeader({
  name,
  rating,
}: {
  name: string;
  rating: number;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 truncate text-xs font-semibold text-white">{name}</p>
      <span className="shrink-0 text-[10px] font-bold tabular-nums text-theme-primary">
        {rating}
      </span>
    </div>
  );
}

function RetrainingPlayerCardFooter({
  training,
}: {
  training?: PlayerPositionRetraining;
}) {
  if (training) {
    const progress = getRetrainingProgress(training);
    const pct = Math.round(progress * 100);
    const weeksDone = training.totalWeeks - training.weeksRemaining;

    return (
      <div className="mt-2 min-h-[2.75rem]">
        <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
          <span className="font-semibold text-theme-primary">{pct}%</span>
          <span className="text-pitch-500">
            {weeksDone}/{training.totalWeeks} wk
          </span>
          <span className="text-pitch-400">{weeksToMonthsLabel(training.weeksRemaining)} left</span>
        </div>
        <div
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-pitch-800/90 ring-1 ring-pitch-700/50"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-theme-primary/80 to-theme-primary transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return <div className="mt-2 min-h-[2.75rem]" aria-hidden />;
}

interface RetrainingPlayerCardProps {
  name: string;
  rating: number;
  subtitle: string;
  variant: "idle" | "selected" | "training" | "disabled";
  training?: PlayerPositionRetraining;
  title?: string;
  onClick?: () => void;
}

function RetrainingPlayerCard({
  name,
  rating,
  subtitle,
  variant,
  training,
  title,
  onClick,
}: RetrainingPlayerCardProps) {
  const shellClass = retrainingCardShellClass(variant);
  const subtitleClass =
    variant === "training"
      ? "text-theme-primary/90"
      : variant === "selected"
        ? "text-theme-primary"
        : variant === "disabled"
          ? "text-pitch-500"
          : "text-pitch-400";

  const body = (
    <>
      <RetrainingPlayerCardHeader name={name} rating={rating} />
      <p className={`mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight ${subtitleClass}`}>
        {subtitle}
      </p>
      <RetrainingPlayerCardFooter training={training} />
    </>
  );

  if (variant === "idle" || variant === "selected") {
    return (
      <button
        type="button"
        className={shellClass}
        title={title}
        onClick={onClick}
        aria-pressed={variant === "selected"}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={shellClass}
      title={title}
      aria-label={
        training
          ? `${name} training ${Math.round(getRetrainingProgress(training) * 100)}% complete`
          : title
      }
    >
      {body}
    </div>
  );
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
          s === "training"
            ? 0
            : s === "available"
              ? 1
              : s === "already_dual"
                ? 2
                : 3;
        const diff = rank(a.status) - rank(b.status);
        if (diff !== 0) return diff;
        return b.player.peakRating - a.player.peakRating;
      });
  }, [career]);

  const selectedRow = selectedPlayerId
    ? squadPlayers.find((row) => row.entry.playerId === selectedPlayerId) ?? null
    : null;

  const selectedPath = selectedRow?.options.find(
    (path) => `${path.from}->${path.to}` === selectedPathKey
  );

  const trainingCount = squadPlayers.filter((p) => p.status === "training").length;

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
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm} text-center`}>
      <p className={TYPO.sectionLabel}>Dual Position Training</p>
      <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-400`}>
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

      {trainingCount > 0 && (
        <p className={`mx-auto mt-3 max-w-lg ${TYPO.bodySm} text-theme-primary/90`}>
          {trainingCount} player{trainingCount === 1 ? "" : "s"} in training — progress
          updates each league week.
        </p>
      )}

      <div className="mt-4">
        <p className={`${TYPO.sectionLabel} mb-2`}>Squad players</p>
        <div className="mx-auto grid max-w-3xl grid-cols-2 justify-items-center gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {squadPlayers.map(({ entry, player, status }) => {
            const isSelected = selectedPlayerId === entry.playerId;
            const training = getActiveRetraining(career, entry.playerId);
            const positionLabel = formatPlayerPositionLabel(player, { short: true });

            if (status === "training" && training) {
              return (
                <RetrainingPlayerCard
                  key={entry.playerId}
                  name={player.name}
                  rating={player.peakRating}
                  subtitle={formatRetrainingPathLabel(
                    training.fromPosition,
                    training.targetPosition
                  )}
                  variant="training"
                  training={training}
                />
              );
            }

            if (status === "already_dual") {
              return (
                <RetrainingPlayerCard
                  key={entry.playerId}
                  name={player.name}
                  rating={player.peakRating}
                  subtitle={`${positionLabel} · Dual role`}
                  variant="disabled"
                  title={`${player.name} already has a dual role`}
                />
              );
            }

            if (status === "no_paths") {
              return (
                <RetrainingPlayerCard
                  key={entry.playerId}
                  name={player.name}
                  rating={player.peakRating}
                  subtitle={`${positionLabel} · No paths`}
                  variant="disabled"
                  title={`${player.name} has no retraining paths`}
                />
              );
            }

            return (
              <RetrainingPlayerCard
                key={entry.playerId}
                name={player.name}
                rating={player.peakRating}
                subtitle={
                  isSelected && selectedPath
                    ? formatRetrainingPathLabel(selectedPath.from, selectedPath.to)
                    : `${positionLabel} · Tap to select`
                }
                variant={isSelected ? "selected" : "idle"}
                onClick={() => handleSelectPlayer(entry.playerId, status)}
              />
            );
          })}
        </div>
        <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-400`}>
          {selectedRow
            ? `${selectedRow.player.name} · ${formatPlayerPositionLabel(selectedRow.player, { short: true })}`
            : "Select a single-role player to view retraining paths."}
        </p>
      </div>

      {selectedRow && selectedRow.status === "available" && (
        <div className="mt-4">
          <p className={`${TYPO.sectionLabel} mb-2`}>New position</p>
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
                </button>
              );
            })}
          </div>
          <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-400`}>
            {selectedPath
              ? `${formatRetrainingDuration(selectedPath.months)} · ${selectedRow.player.name} learns ${POSITION_SHORT[selectedPath.to]} from ${POSITION_SHORT[selectedPath.from]}`
              : "Pick a path to see duration and confirm training."}
          </p>
          {selectedPath && (
            <button
              type="button"
              onClick={handleStart}
              className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold transition ${FILTER.chipActive} btn-press`}
            >
              Start training
            </button>
          )}
        </div>
      )}

      <p className={`mx-auto mt-4 max-w-lg ${TYPO.bodySm} text-pitch-500`}>
        CE→SR/WG · SR→PF/LF · PF→SR · HK→SO/SH/LF · HB→HK/FB · WG→FB · LF→SO/SH ·
        FB→WG/SO/SH
      </p>
    </div>
  );
}
