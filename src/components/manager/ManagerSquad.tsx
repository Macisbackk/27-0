"use client";

import { useMemo, useState } from "react";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
} from "@/lib/manager/managerPlayers";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import {
  assignPlayerToMatchday,
  findPlayerMatchdaySlot,
  getReplacementCandidates,
  slotAbbrev,
  TEAM_SHEET_ROWS,
  type MatchdaySlotTarget,
} from "@/lib/manager/managerMatchdaySquad";
import { ManagerSquadPlayerModal } from "@/components/manager/ManagerSquadPlayerModal";
import { ManagerTacticsPanel } from "@/components/manager/ManagerTactics";
import { playUiClick } from "@/lib/sound";

interface ManagerSquadProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

function TeamSheetSlot({
  slotIndex,
  position,
  playerId,
  career,
  selected,
  onSelect,
  onPlayerClick,
}: {
  slotIndex: number;
  position: Position;
  playerId: string;
  career: ManagerCareer;
  selected: boolean;
  onSelect: () => void;
  onPlayerClick: (playerId: string) => void;
}) {
  const player = playerId ? getManagerPlayer(career, playerId) : null;
  const ps = career.squad.find((p) => p.playerId === playerId);
  const reserve = career.reserves.find((r) => r.id === playerId);
  const unavailable = ps ? isPlayerUnavailable(ps) : false;

  return (
    <button
      type="button"
      onClick={() => {
        playUiClick();
        if (playerId) onPlayerClick(playerId);
        else onSelect();
      }}
      className={`min-h-[52px] w-full rounded-lg border px-2 py-1.5 text-left transition ${
        selected
          ? "border-theme-primary bg-theme-primary/10 ring-1 ring-theme-primary/40"
          : "border-pitch-700/60 bg-pitch-900/50 hover:border-pitch-500"
      } ${unavailable ? "opacity-60" : ""}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-pitch-500">
        {slotAbbrev(position)}
      </p>
      {player ? (
        <>
          <p className="truncate text-sm font-medium text-white">{player.name}</p>
          <p className="text-[10px] text-theme-primary">
            {player.rating ?? player.peakRating}
            {ps && ` · Fit ${ps.fitness}`}
            {reserve && ` · Fit ${reserve.fitness}`}
          </p>
          {ps?.injury && (
            <p className="text-[10px] text-red-300">
              {formatInjuryLabel(ps.injury)}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-pitch-500">Select player</p>
      )}
    </button>
  );
}

export function ManagerSquad({ career, onUpdate }: ManagerSquadProps) {
  const [selectedTarget, setSelectedTarget] = useState<MatchdaySlotTarget | null>(
    null
  );
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [pendingAssignId, setPendingAssignId] = useState<string | null>(null);

  const replacementCandidates = useMemo(() => {
    if (!selectedTarget) return [];
    return getReplacementCandidates(career, selectedTarget);
  }, [career, selectedTarget]);

  const filteredCandidates = useMemo(() => {
    if (positionFilter === "all") return replacementCandidates;
    return replacementCandidates.filter(({ playerId }) =>
      getManagerPlayerEligiblePositions(career, playerId).includes(
        positionFilter
      )
    );
  }, [replacementCandidates, career, positionFilter]);

  const handleSelectSlot = (target: MatchdaySlotTarget) => {
    if (pendingAssignId) {
      onUpdate(assignPlayerToMatchday(career, target, pendingAssignId));
      setPendingAssignId(null);
      setSelectedTarget(null);
      return;
    }
    setSelectedTarget((prev) =>
      prev?.kind === target.kind && prev.index === target.index ? null : target
    );
  };

  const handlePickPlayer = (playerId: string) => {
    if (!selectedTarget) return;
    onUpdate(assignPlayerToMatchday(career, selectedTarget, playerId));
    setSelectedTarget(null);
  };

  const handleReplacePlayer = (playerId: string) => {
    const slot = findPlayerMatchdaySlot(career, playerId);
    if (slot) {
      setSelectedTarget(slot);
      setPendingAssignId(null);
    } else {
      setPendingAssignId(playerId);
      setSelectedTarget(null);
    }
  };

  const persistAndClose = (next: ManagerCareer) => {
    onUpdate(next);
    setModalPlayerId(null);
  };

  return (
    <div className={`mx-auto max-w-5xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Squad</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Team sheet & matchday 17 · click a slot, then pick a player
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className={SPACING.stackMd}>
          <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
            <p className={`${TYPO.sectionLabel} mb-3`}>Starting XIII</p>
            <div className={`${SPACING.stackSm}`}>
              {TEAM_SHEET_ROWS.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className={`grid gap-2 ${
                    row.slots.length === 1
                      ? "grid-cols-1 max-w-[200px] mx-auto"
                      : row.slots.length === 2
                        ? "grid-cols-2 max-w-md mx-auto"
                        : row.slots.length === 3
                          ? "grid-cols-3"
                          : "grid-cols-4"
                  }`}
                >
                  {row.slots.map((slotIndex) => {
                    const position =
                      career.xiiiSlotPositions[slotIndex] ?? "CENTRE";
                    const playerId = career.matchdayXiii[slotIndex] ?? "";
                    const isSelected =
                      selectedTarget?.kind === "xiii" &&
                      selectedTarget.index === slotIndex;
                    return (
                      <TeamSheetSlot
                        key={slotIndex}
                        slotIndex={slotIndex}
                        position={position}
                        playerId={playerId}
                        career={career}
                        selected={isSelected}
                        onSelect={() =>
                          handleSelectSlot({ kind: "xiii", index: slotIndex })
                        }
                        onPlayerClick={setModalPlayerId}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className={`${CARD.base} ${SPACING.cardPadding}`}>
            <p className={`${TYPO.sectionLabel} mb-2`}>Interchange</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => {
                const playerId = career.matchdayInterchange[i] ?? "";
                const isSelected =
                  selectedTarget?.kind === "bench" && selectedTarget.index === i;
                const player = playerId
                  ? getManagerPlayer(career, playerId)
                  : null;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      playUiClick();
                      if (playerId) setModalPlayerId(playerId);
                      else handleSelectSlot({ kind: "bench", index: i });
                    }}
                    className={`rounded-lg border px-2 py-2 text-left ${
                      isSelected
                        ? "border-theme-primary bg-theme-primary/10"
                        : "border-pitch-700/60 bg-pitch-900/40"
                    }`}
                  >
                    <p className="text-[10px] text-pitch-500">{14 + i}.</p>
                    <p className="truncate text-sm text-white">
                      {player?.name ?? "Empty"}
                    </p>
                    {player && (
                      <p className="text-[10px] text-theme-primary">
                        {player.rating ?? player.peakRating}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-2`}>Available Players</p>
          {pendingAssignId ? (
            <p className={`mb-2 ${TYPO.bodySm} text-accent-gold`}>
              Select a starter or interchange slot for this player
            </p>
          ) : selectedTarget ? (
            <p className={`mb-2 ${TYPO.bodySm} text-accent-gold`}>
              Tap a replacement — interchange, starters, or available squad
            </p>
          ) : (
            <p className={`mb-2 ${TYPO.bodySm} text-pitch-500`}>
              Click a slot to swap, or a player for actions
            </p>
          )}
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setPositionFilter("all")}
              className={`rounded border px-2 py-0.5 text-[10px] ${
                positionFilter === "all"
                  ? "border-theme-primary text-theme-primary"
                  : "border-pitch-600 text-pitch-400"
              }`}
            >
              All
            </button>
            {(Object.keys(POSITION_SHORT) as Position[]).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(pos)}
                className={`rounded border px-2 py-0.5 text-[10px] ${
                  positionFilter === pos
                    ? "border-theme-primary text-theme-primary"
                    : "border-pitch-600 text-pitch-400"
                }`}
              >
                {POSITION_SHORT[pos]}
              </button>
            ))}
          </div>
          <ul className={`max-h-[420px] overflow-y-auto ${SPACING.stackSm}`}>
            {filteredCandidates.map(
              ({ playerId, source, isReserveCallUp }) => {
                const player = getManagerPlayer(career, playerId);
                if (!player) return null;
                const positions = getManagerPlayerEligiblePositions(
                  career,
                  playerId
                );
                const ps = career.squad.find((p) => p.playerId === playerId);
                const sourceLabel =
                  source === "bench"
                    ? "INT"
                    : source === "xiii"
                      ? "XIII"
                      : isReserveCallUp
                        ? "Call-up"
                        : "Squad";
                return (
                  <li key={playerId}>
                    <button
                      type="button"
                      disabled={!selectedTarget}
                      onClick={() => {
                        playUiClick();
                        handlePickPlayer(playerId);
                      }}
                      className={`w-full rounded-lg border px-2 py-2 text-left transition ${
                        selectedTarget
                          ? "border-pitch-600 hover:border-theme-primary/50"
                          : "border-pitch-800/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {player.name}
                            <span className="ml-1 text-[10px] text-pitch-500">
                              ({sourceLabel})
                            </span>
                          </p>
                          <p className="text-[10px] text-pitch-400">
                            {positions.map((p) => POSITION_SHORT[p]).join(" · ")}
                            {ps && ` · Fit ${ps.fitness}`}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-theme-primary">
                          {player.rating ?? player.peakRating}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              }
            )}
            {!selectedTarget && !pendingAssignId && (
              <p className={`${TYPO.bodySm} text-pitch-500`}>
                Select a slot to see replacement options
              </p>
            )}
          </ul>
        </div>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-3`}>Tactics</p>
        <ManagerTacticsPanel
          career={career}
          onChange={(tactics) => onUpdate({ ...career, tactics })}
        />
      </div>

      {modalPlayerId && (
        <ManagerSquadPlayerModal
          career={career}
          playerId={modalPlayerId}
          onClose={() => setModalPlayerId(null)}
          onUpdate={persistAndClose}
          onReplace={handleReplacePlayer}
        />
      )}
    </div>
  );
}
