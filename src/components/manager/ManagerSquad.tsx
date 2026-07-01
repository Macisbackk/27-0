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
  getSquadPoolPlayers,
  slotAbbrev,
  TEAM_SHEET_ROWS,
  type MatchdaySlotTarget,
} from "@/lib/manager/managerMatchdaySquad";
import { ManagerSquadPlayerModal } from "@/components/manager/ManagerSquadPlayerModal";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { autoFixMatchdaySquad } from "@/lib/manager/managerAutoFix";
import { GameButton } from "@/components/ui/GameButton";
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
  replaceHighlight,
  assignMode,
  onSelect,
  onPlayerClick,
}: {
  slotIndex: number;
  position: Position;
  playerId: string;
  career: ManagerCareer;
  selected: boolean;
  replaceHighlight?: boolean;
  assignMode?: boolean;
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
      className={`min-h-[44px] w-full rounded-md border px-1.5 py-1 text-left transition ${
        replaceHighlight
          ? "border-accent-gold bg-accent-gold/10 ring-1 ring-accent-gold/50"
          : selected
          ? "border-theme-primary bg-theme-primary/10 ring-1 ring-theme-primary/40"
          : assignMode
          ? "border-theme-primary/60 bg-theme-primary/5 hover:border-theme-primary"
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
  const [replaceSourcePlayerId, setReplaceSourcePlayerId] = useState<
    string | null
  >(null);

  const replaceSlot = replaceSourcePlayerId
    ? findPlayerMatchdaySlot(career, replaceSourcePlayerId)
    : null;

  const replacementCandidates = useMemo(() => {
    if (replaceSlot) return getReplacementCandidates(career, replaceSlot);
    if (!selectedTarget) return [];
    return getReplacementCandidates(career, selectedTarget);
  }, [career, selectedTarget, replaceSlot]);

  const replaceCandidateIds = useMemo(
    () => new Set(replacementCandidates.map((c) => c.playerId)),
    [replacementCandidates]
  );

  const squadPool = useMemo(() => getSquadPoolPlayers(career), [career]);

  const filteredPool = useMemo(() => {
    if (selectedTarget || replaceSlot) {
      const eligibleIds = new Set(replacementCandidates.map((c) => c.playerId));
      return squadPool.filter(({ playerId }) => eligibleIds.has(playerId));
    }
    if (positionFilter === "all") return squadPool;
    return squadPool.filter(({ playerId }) =>
      getManagerPlayerEligiblePositions(career, playerId).includes(
        positionFilter
      )
    );
  }, [squadPool, career, positionFilter, selectedTarget, replaceSlot, replacementCandidates]);

  const handleSelectSlot = (target: MatchdaySlotTarget) => {
    if (pendingAssignId) {
      onUpdate(assignPlayerToMatchday(career, target, pendingAssignId));
      setPendingAssignId(null);
      setSelectedTarget(null);
      return;
    }
    if (target.kind === "xiii") {
      const pos = career.xiiiSlotPositions[target.index];
      if (pos) setPositionFilter(pos);
    }
    setSelectedTarget((prev) =>
      prev?.kind === target.kind && prev.index === target.index ? null : target
    );
  };

  const handlePickPlayer = (playerId: string) => {
    if (replaceSlot) {
      onUpdate(assignPlayerToMatchday(career, replaceSlot, playerId));
      setReplaceSourcePlayerId(null);
      return;
    }
    if (!selectedTarget) return;
    onUpdate(assignPlayerToMatchday(career, selectedTarget, playerId));
    setSelectedTarget(null);
  };

  const handleReplacePlayer = (playerId: string) => {
    const slot = findPlayerMatchdaySlot(career, playerId);
    if (slot) {
      setReplaceSourcePlayerId(playerId);
      setSelectedTarget(null);
      setPendingAssignId(null);
    } else {
      setPendingAssignId(playerId);
      setReplaceSourcePlayerId(null);
      setSelectedTarget(null);
    }
  };

  const handlePoolPlayerClick = (playerId: string) => {
    if (pendingAssignId) return;
    if (selectedTarget || replaceSourcePlayerId) {
      handlePickPlayer(playerId);
      return;
    }
    setPendingAssignId(playerId);
    setModalPlayerId(null);
  };

  const handlePlayerClick = (playerId: string) => {
    if (selectedTarget && replaceCandidateIds.has(playerId)) {
      handlePickPlayer(playerId);
      return;
    }
    if (replaceSourcePlayerId && replaceCandidateIds.has(playerId)) {
      handlePickPlayer(playerId);
      return;
    }
    setModalPlayerId(playerId);
  };

  const persistAndClose = (next: ManagerCareer) => {
    onUpdate(next);
    setModalPlayerId(null);
  };

  const squadCheck = validateFitMatchdaySquad(career);

  return (
    <div className={`mx-auto max-w-5xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Squad</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Team sheet & matchday 17 · click a slot, then pick a player
        </p>
      </div>

      {!squadCheck.valid && (
        <div
          className={`${CARD.inset} ${SPACING.cardPaddingSm} border border-accent-gold/40`}
        >
          <p className={`${TYPO.bodySm} text-accent-gold whitespace-pre-line`}>
            {squadCheck.message}
          </p>
          <GameButton
            variant="theme"
            size="sm"
            className="mt-2"
            onClick={() => {
              playUiClick();
              const result = autoFixMatchdaySquad(career);
              onUpdate(result.career);
              if (!result.ok) window.alert(result.message);
            }}
          >
            Auto Fix Squad
          </GameButton>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className={SPACING.stackMd}>
          <div className="rounded-xl border border-pitch-700/40 bg-gradient-to-b from-pitch-800/20 to-pitch-950/60 p-4">
            <p className={`${TYPO.sectionLabel} mb-3 text-center`}>Starting XIII</p>
            <div className="mx-auto max-w-lg space-y-2">
              {TEAM_SHEET_ROWS.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className={`grid gap-1.5 ${
                    row.slots.length === 1
                      ? "grid-cols-1 max-w-[140px] mx-auto"
                      : row.slots.length === 2
                        ? "grid-cols-2 max-w-xs mx-auto"
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
                    const isReplaceTarget =
                      !!playerId && replaceCandidateIds.has(playerId);
                    return (
                      <TeamSheetSlot
                        key={slotIndex}
                        slotIndex={slotIndex}
                        position={position}
                        playerId={playerId}
                        career={career}
                        selected={isSelected}
                        replaceHighlight={isReplaceTarget}
                        assignMode={!!pendingAssignId}
                        onSelect={() =>
                          handleSelectSlot({ kind: "xiii", index: slotIndex })
                        }
                        onPlayerClick={handlePlayerClick}
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
                const isReplaceTarget =
                  !!playerId && replaceCandidateIds.has(playerId);
                const isAssignTarget = !!pendingAssignId;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      playUiClick();
                      if (playerId) handlePlayerClick(playerId);
                      else handleSelectSlot({ kind: "bench", index: i });
                    }}
                    className={`rounded-lg border px-2 py-2 text-left ${
                      isReplaceTarget
                        ? "border-accent-gold bg-accent-gold/10 ring-1 ring-accent-gold/50"
                        : isSelected || isAssignTarget
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
          <p className={`${TYPO.sectionLabel} mb-2`}>Squad Players</p>
          {pendingAssignId ? (
            <p className={`mb-2 ${TYPO.bodySm} text-accent-gold`}>
              Select a starter or interchange slot for this player
            </p>
          ) : replaceSourcePlayerId ? (
            <p className={`mb-2 ${TYPO.bodySm} text-accent-gold`}>
              Tap a highlighted player to replace{" "}
              {getManagerPlayer(career, replaceSourcePlayerId)?.name}
            </p>
          ) : selectedTarget ? (
            <p className={`mb-2 ${TYPO.bodySm} text-accent-gold`}>
              Tap a player below to fill this slot
            </p>
          ) : (
            <p className={`mb-2 ${TYPO.bodySm} text-pitch-500`}>
              Click a player to assign, or a slot then a player · double-click a
              player for details
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
            {filteredPool.map(({ playerId, isReserveCallUp }) => {
              const player = getManagerPlayer(career, playerId);
              if (!player) return null;
              const positions = getManagerPlayerEligiblePositions(
                career,
                playerId
              );
              const ps = career.squad.find((p) => p.playerId === playerId);
              const isHighlighted = replaceCandidateIds.has(playerId);
              const sourceLabel = isReserveCallUp ? "Reserve" : "Squad";
              return (
                <li key={playerId}>
                  <button
                    type="button"
                    onClick={() => {
                      playUiClick();
                      handlePoolPlayerClick(playerId);
                    }}
                    onDoubleClick={() => {
                      playUiClick();
                      setModalPlayerId(playerId);
                    }}
                    className={`rounded-lg border px-2 py-2 text-left transition ${
                      pendingAssignId === playerId
                        ? "border-theme-primary bg-theme-primary/10 ring-1 ring-theme-primary/40"
                        : isHighlighted
                        ? "border-accent-gold bg-accent-gold/10 hover:border-accent-gold"
                        : "border-pitch-700/50 hover:border-pitch-500"
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
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-theme-primary">
                        {player.rating ?? player.peakRating}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredPool.length === 0 && (
              <p className={`${TYPO.bodySm} text-pitch-500`}>
                {selectedTarget || replaceSourcePlayerId
                  ? "No eligible players for this slot."
                  : "No squad players available — all are in the matchday 17."}
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
