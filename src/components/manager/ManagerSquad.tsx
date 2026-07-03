"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CARD, MANAGER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
} from "@/lib/manager/managerPlayers";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { getUnavailableSquadPlayers, isPlayerUnavailable } from "@/lib/manager/managerSquad";
import {
  tryAssignPlayerToMatchday,
  findPlayerMatchdaySlot,
  getMatchdayPlayerIds,
  getReplacementCandidates,
  getSquadPoolPlayers,
  type MatchdaySlotTarget,
} from "@/lib/manager/managerMatchdaySquad";
import { ManagerMatchdayFormation } from "@/components/manager/ManagerMatchdayFormation";
import { ManagerSquadPlayerModal } from "@/components/manager/ManagerSquadPlayerModal";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { autoFixMatchdaySquad, autoSortMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerPage,
  ManagerViewHeader,
} from "@/components/manager/manager-ui";
import { ManagerTacticsPanel } from "@/components/manager/ManagerTactics";
import { playUiClick } from "@/lib/sound";

interface ManagerSquadProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

const SINGLE_CLICK_DELAY_MS = 220;

const SQUAD_SELECTION_CLASS = {
  idle: "border-pitch-700/60 bg-pitch-900/50 hover:border-pitch-500",
  source: "border-theme-primary bg-theme-primary/12 ring-2 ring-theme-primary/45",
  target: "border-accent-gold bg-accent-gold/10 ring-1 ring-accent-gold/50",
} as const;

type SquadSelectionRole = keyof typeof SQUAD_SELECTION_CLASS;

function squadSelectionClass(role: SquadSelectionRole): string {
  return SQUAD_SELECTION_CLASS[role];
}

function unavailableAccentClass(isSuspension: boolean): string {
  return isSuspension
    ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/35"
    : "border-red-500/50 bg-red-500/10 ring-1 ring-red-500/35";
}

function unavailableTextClass(isSuspension: boolean): string {
  return isSuspension ? "text-amber-300" : "text-red-300";
}

function useFinePointer(): boolean {
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setFinePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return finePointer;
}

export function ManagerSquad({ career, onUpdate }: ManagerSquadProps) {
  const finePointer = useFinePointer();
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MatchdaySlotTarget | null>(
    null
  );
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [pendingAssignId, setPendingAssignId] = useState<string | null>(null);
  const [replaceSourcePlayerId, setReplaceSourcePlayerId] = useState<
    string | null
  >(null);
  const [assignmentNotice, setAssignmentNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!assignmentNotice) return;
    const timer = window.setTimeout(() => setAssignmentNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [assignmentNotice]);

  useEffect(
    () => () => {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
      }
    },
    []
  );

  const clearSingleClickTimer = () => {
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
  };

  const openPlayerDetails = (playerId: string) => {
    clearSingleClickTimer();
    setModalPlayerId(playerId);
  };

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

  const applyAssignment = (
    target: MatchdaySlotTarget,
    playerId: string,
    onDone?: () => void
  ) => {
    const result = tryAssignPlayerToMatchday(career, target, playerId);
    if (result.ok) {
      onUpdate(result.career);
      onDone?.();
      return;
    }
    setAssignmentNotice(result.message ?? "Could not assign player.");
  };

  const handleSelectSlot = (target: MatchdaySlotTarget) => {
    if (pendingAssignId) {
      applyAssignment(target, pendingAssignId, () => {
        setPendingAssignId(null);
        setSelectedTarget(null);
      });
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
      applyAssignment(replaceSlot, playerId, () => {
        setReplaceSourcePlayerId(null);
      });
      return;
    }
    if (!selectedTarget) return;
    applyAssignment(selectedTarget, playerId, () => {
      setSelectedTarget(null);
    });
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
    clearSingleClickTimer();
    if (pendingAssignId) return;
    if (selectedTarget || replaceSourcePlayerId) {
      handlePickPlayer(playerId);
      return;
    }
    setPendingAssignId(playerId);
    setModalPlayerId(null);
  };

  const handleMatchdayPlayerPrimaryClick = (playerId: string) => {
    if (selectedTarget && replaceCandidateIds.has(playerId)) {
      clearSingleClickTimer();
      handlePickPlayer(playerId);
      return;
    }
    if (replaceSourcePlayerId && replaceCandidateIds.has(playerId)) {
      clearSingleClickTimer();
      handlePickPlayer(playerId);
      return;
    }

    if (!finePointer) {
      openPlayerDetails(playerId);
      return;
    }

    clearSingleClickTimer();
    singleClickTimerRef.current = setTimeout(() => {
      handleReplacePlayer(playerId);
      singleClickTimerRef.current = null;
    }, SINGLE_CLICK_DELAY_MS);
  };

  const persistAndClose = (next: ManagerCareer) => {
    onUpdate(next);
    setModalPlayerId(null);
  };

  const squadCheck = validateFitMatchdaySquad(resolveCareerForMatchSimulation(career));

  const unavailablePlayers = useMemo(
    () => getUnavailableSquadPlayers(career),
    [career]
  );

  const matchdayIds = useMemo(
    () => getMatchdayPlayerIds(career),
    [career]
  );

  const inSelectionMode =
    !!pendingAssignId || !!replaceSourcePlayerId || !!selectedTarget;

  const getMatchdaySlotRole = (
    target: MatchdaySlotTarget,
    playerId: string,
    canAssignHere = true
  ): SquadSelectionRole => {
    if (playerId && replaceSourcePlayerId === playerId) return "source";
    if (
      selectedTarget?.kind === target.kind &&
      selectedTarget.index === target.index
    ) {
      return "source";
    }
    if (pendingAssignId && canAssignHere) return "target";
    if (inSelectionMode && playerId && replaceCandidateIds.has(playerId)) {
      return "target";
    }
    return "idle";
  };

  const getPoolPlayerRole = (playerId: string): SquadSelectionRole => {
    if (pendingAssignId === playerId) return "source";
    if (inSelectionMode && replaceCandidateIds.has(playerId)) return "target";
    return "idle";
  };

  return (
    <ManagerPage wide>
      <ManagerViewHeader
        title="Squad"
        subtitle={
          finePointer
            ? "Click squad players to assign · click matchday players to swap · double-click for options"
            : "Tap a player to assign, or a slot then a player · tap matchday players for options"
        }
        action={
          <GameButton
            variant="theme"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              playUiClick();
              const result = autoSortMatchdaySquad(career);
              onUpdate(result.career);
              setPendingAssignId(null);
              setSelectedTarget(null);
              setReplaceSourcePlayerId(null);
              if (!result.ok) {
                setDialog({ title: "Auto Sort failed", message: result.message });
              }
            }}
          >
            Auto Sort Best XI
          </GameButton>
        }
      />

      {assignmentNotice && (
        <div
          className={`${CARD.inset} ${SPACING.cardPaddingSm} border border-red-500/40`}
          role="status"
        >
          <p className={`${TYPO.bodySm} text-red-200`}>{assignmentNotice}</p>
        </div>
      )}

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
              if (!result.ok) {
                setDialog({ title: "Auto Fix failed", message: result.message });
              }
            }}
          >
            Auto Fix Squad
          </GameButton>
        </div>
      )}

      {unavailablePlayers.length > 0 && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-2.5 sm:px-3 sm:py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-300/80">
            Unavailable ({unavailablePlayers.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unavailablePlayers.map((ps) => {
              const player = getManagerPlayer(career, ps.playerId);
              if (!player || !ps.injury) return null;
              const isSuspension = ps.injury.type === "suspension";
              const onMatchday = matchdayIds.has(ps.playerId);
              return (
                <span
                  key={ps.playerId}
                  className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border px-2 py-0.5 text-[11px] ${unavailableAccentClass(isSuspension)}`}
                >
                  <span className="truncate font-medium text-white">
                    {player.name}
                  </span>
                  <span className={unavailableTextClass(isSuspension)}>
                    {formatInjuryLabel(ps.injury)}
                  </span>
                  {onMatchday && (
                    <span className="text-[10px] font-medium text-amber-300">
                      on sheet
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className={MANAGER.splitLayout}>
        <div className={SPACING.stackMd}>
          <ManagerMatchdayFormation
            career={career}
            interactive
            selectedTarget={selectedTarget}
            pendingAssignId={pendingAssignId}
            replaceSourcePlayerId={replaceSourcePlayerId}
            replaceCandidateIds={replaceCandidateIds}
            onSlotClick={handleSelectSlot}
            onFilledSlotClick={handleMatchdayPlayerPrimaryClick}
          />

          <div className={`${CARD.base} ${SPACING.cardPadding}`}>
            <p className={`${TYPO.sectionLabel} mb-2`}>Interchange</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => {
                const playerId = career.matchdayInterchange[i] ?? "";
                const slotTarget: MatchdaySlotTarget = { kind: "bench", index: i };
                const selectionRole = getMatchdaySlotRole(slotTarget, playerId);
                const player = playerId
                  ? getManagerPlayer(career, playerId)
                  : null;
                const ps = playerId
                  ? career.squad.find((p) => p.playerId === playerId)
                  : null;
                const unavailable = ps ? isPlayerUnavailable(ps) : false;
                const isSuspension = ps?.injury?.type === "suspension";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      playUiClick();
                      if (selectionRole === "target") {
                        if (playerId) handleMatchdayPlayerPrimaryClick(playerId);
                        else handleSelectSlot({ kind: "bench", index: i });
                        return;
                      }
                      if (selectionRole === "source" && !playerId) {
                        setSelectedTarget(null);
                        return;
                      }
                      if (playerId) handleMatchdayPlayerPrimaryClick(playerId);
                      else handleSelectSlot({ kind: "bench", index: i });
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if (!playerId) return;
                      playUiClick();
                      openPlayerDetails(playerId);
                    }}
                    className={`${squadSelectionClass(selectionRole)} select-none rounded-lg border ${SPACING.listItem} text-left ${
                      unavailable ? unavailableAccentClass(!!isSuspension) : ""
                    }`}
                  >
                    <p className="text-[10px] text-pitch-500">{14 + i}.</p>
                    <p className="truncate text-sm text-white">
                      {player?.name ?? "Empty"}
                    </p>
                    {player && (
                      <p className="text-[10px] text-theme-primary">
                        {player.peakRating}
                      </p>
                    )}
                    {ps?.injury && (
                      <p
                        className={`text-[10px] font-medium ${unavailableTextClass(!!isSuspension)}`}
                      >
                        {formatInjuryLabel(ps.injury)}
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
            <p className={`mb-2 ${TYPO.bodySm} text-pitch-300`}>
              <span className="font-semibold text-theme-primary">
                {getManagerPlayer(career, pendingAssignId)?.name}
              </span>{" "}
              selected — pick a{" "}
              <span className="font-semibold text-accent-gold">highlighted slot</span>
            </p>
          ) : replaceSourcePlayerId ? (
            <p className={`mb-2 ${TYPO.bodySm} text-pitch-300`}>
              Swapping{" "}
              <span className="font-semibold text-theme-primary">
                {getManagerPlayer(career, replaceSourcePlayerId)?.name}
              </span>{" "}
              — pick a{" "}
              <span className="font-semibold text-accent-gold">highlighted player</span>
            </p>
          ) : selectedTarget ? (
            <p className={`mb-2 ${TYPO.bodySm} text-pitch-300`}>
              Slot selected — pick a{" "}
              <span className="font-semibold text-accent-gold">highlighted player</span>
            </p>
          ) : (
            <p className={`mb-2 ${TYPO.bodySm} text-pitch-500`}>
              {finePointer
                ? "Click to assign · double-click for player options"
                : "Tap a player to assign, or tap matchday players for options"}
            </p>
          )}
          <div className="mb-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
            <button
              type="button"
              onClick={() => setPositionFilter("all")}
              className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${
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
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${
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
              const poolRole = getPoolPlayerRole(playerId);
              const sourceLabel = isReserveCallUp ? "Reserve" : "Squad";
              return (
                <li key={playerId}>
                  <button
                    type="button"
                    onClick={() => {
                      playUiClick();
                      handlePoolPlayerClick(playerId);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if (!finePointer) return;
                      playUiClick();
                      openPlayerDetails(playerId);
                    }}
                    className={`${squadSelectionClass(poolRole)} select-none rounded-lg border ${SPACING.listItem} text-left transition`}
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
                        {player.peakRating}
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
                  : career.calledUpReserveIds.length === 0
                    ? "No squad players available — call up reserves from the Reserves tab, or all fit players are already on the sheet."
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

      <ManagerDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        onConfirm={() => setDialog(null)}
        onCancel={() => setDialog(null)}
      />
    </ManagerPage>
  );
}
