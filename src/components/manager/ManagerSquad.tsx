"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CARD, SPACING, MANAGER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { CollapsibleDetails } from "@/components/ui/MobileLayout";
import { POSITION_SHORT, getFullPositionName, getFullPositionNames } from "@/lib/positions";
import type { Position } from "@/lib/types";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
} from "@/lib/manager/managerPlayers";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import {
  tryAssignPlayerToMatchday,
  findPlayerMatchdaySlot,
  getReplacementCandidates,
  getSquadRosterPoolPlayers,
  type MatchdaySlotTarget,
} from "@/lib/manager/managerMatchdaySquad";
import { ManagerMatchdayFormation } from "@/components/manager/ManagerMatchdayFormation";
import { ManagerSquadPlayerModal } from "@/components/manager/ManagerSquadPlayerModal";
import { ManagerBoostsPanel } from "@/components/manager/ManagerBoostsPanel";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { autoFixMatchdaySquad, autoSortMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { GameButton } from "@/components/ui/GameButton";
import { ClipboardPanel } from "@/components/ui/ClipboardPanel";
import {
  ManagerPage,
  ManagerSection,
  ManagerViewHeader,
} from "@/components/manager/manager-ui";
import { ManagerTacticsPanel } from "@/components/manager/ManagerTactics";
import {
  type SquadSubTab,
} from "@/lib/manager/manager-routes";
import { managerAlertPanelClass } from "@/lib/manager/managerSurfaces";
import { playUiClick } from "@/lib/sound";

interface ManagerSquadProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  subTab: SquadSubTab;
}

const SINGLE_CLICK_DELAY_MS = 280;

function useFinePointer(): boolean {
  const [finePointer, setFinePointer] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: fine)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setFinePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return finePointer;
}

const SQUAD_SELECTION_CLASS = {
  // Keep a transparent ring on idle so selection rings never resize the box.
  idle: "border-pitch-700/60 bg-pitch-900/50 ring-2 ring-transparent hover:border-pitch-500",
  source: "border-theme-primary bg-theme-primary/12 ring-2 ring-theme-primary/45",
  target: "border-accent-gold bg-accent-gold/10 ring-2 ring-accent-gold/50",
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

type SquadPoolEntry = ReturnType<typeof getSquadRosterPoolPlayers>[number];

/** Shared footprint for squad pool + interchange player boxes. */
const SQUAD_PLAYER_BOX_CLASS =
  "squad-side-player-card flex h-full w-full min-w-0 flex-col overflow-hidden px-2 py-1.5 sm:px-2.5 sm:py-2";

const SQUAD_PLAYER_NAME_CLASS =
  "squad-side-player-card__name text-[10px] font-medium leading-[1.15] text-white sm:text-xs sm:leading-tight";

/** Wrap in 2 columns so ratings never clip (3-col horizontal strip was too wide for the side panel). */
const SQUAD_POOL_GRID_CLASS =
  "squad-side-player-grid grid w-full min-w-0 grid-cols-2 items-stretch gap-1.5 sm:gap-2";

function squadPlayerBoxClass(
  selectionRole: SquadSelectionRole,
  unavailable?: boolean,
  isSuspension?: boolean,
  dimmed = false
): string {
  return [
    squadSelectionClass(selectionRole),
    SQUAD_PLAYER_BOX_CLASS,
    "btn-press select-none rounded-lg border text-center transition",
    unavailable ? `${unavailableAccentClass(!!isSuspension)} opacity-90` : "",
    dimmed ? "opacity-40" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function SquadPoolPlayerButton({
  career,
  entry,
  poolRole,
  dimmed,
  onClick,
  onDoubleClick,
}: {
  career: ManagerCareer;
  entry: SquadPoolEntry;
  poolRole: SquadSelectionRole;
  dimmed?: boolean;
  onClick: () => void;
  onDoubleClick?: (e: MouseEvent) => void;
}) {
  const { playerId, isReserveCallUp, unavailable } = entry;
  const player = getManagerPlayer(career, playerId);
  if (!player) return null;

  const ps = career.squad.find((p) => p.playerId === playerId);
  const isSuspension = ps?.injury?.type === "suspension";
  const positions = getManagerPlayerEligiblePositions(career, playerId);

  return (
    <li className="min-w-0 w-full overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={squadPlayerBoxClass(
          poolRole,
          unavailable,
          isSuspension,
          dimmed
        )}
      >
        <div className="squad-side-player-card__main">
          <p className={SQUAD_PLAYER_NAME_CLASS}>{player.name}</p>
          {unavailable && ps?.injury ? (
            <div className="squad-side-player-card__statusRow">
              <span
                className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${unavailableTextClass(isSuspension)}`}
              >
                {isSuspension ? "Suspended" : "Injured"}
              </span>
            </div>
          ) : null}
          {isReserveCallUp ? (
            <div className="squad-side-player-card__statusRow">
              <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-theme-primary">
                Reserve call-up
              </span>
            </div>
          ) : null}
          <div className="squad-side-player-card__footer">
            <span className="squad-side-player-card__meta">
              {getFullPositionNames(positions)}
            </span>
            <span className="squad-side-player-card__rating">
              {player.peakRating}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

export function ManagerSquad({
  career,
  onUpdate,
  subTab,
}: ManagerSquadProps) {
  const finePointer = useFinePointer();
  const clickTimerRef = useRef<number | null>(null);
  const squadPoolPanelRef = useRef<HTMLDivElement>(null);
  const matchdayPanelRef = useRef<HTMLDivElement>(null);
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
      if (clickTimerRef.current != null) {
        window.clearTimeout(clickTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setPendingAssignId(null);
    setSelectedTarget(null);
    setReplaceSourcePlayerId(null);
    setModalPlayerId(null);
    setAssignmentNotice(null);
  }, [subTab]);

  useEffect(() => {
    if (!pendingAssignId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (squadPoolPanelRef.current?.contains(target)) return;
      if (matchdayPanelRef.current?.contains(target)) return;
      setPendingAssignId(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pendingAssignId]);

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

  const squadPool = useMemo(() => getSquadRosterPoolPlayers(career), [career]);

  const filteredPool = useMemo(() => {
    // Keep the full (position-filtered) list during selection so cards don't jump.
    if (positionFilter === "all") return squadPool;
    return squadPool.filter(({ playerId }) =>
      getManagerPlayerEligiblePositions(career, playerId).includes(
        positionFilter
      )
    );
  }, [squadPool, career, positionFilter]);

  const displayPool = useMemo(
    () =>
      [...filteredPool].sort((a, b) => {
        const ra = getManagerPlayer(career, a.playerId)?.peakRating ?? 0;
        const rb = getManagerPlayer(career, b.playerId)?.peakRating ?? 0;
        return rb - ra;
      }),
    [filteredPool, career]
  );

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

  const clearClickTimer = () => {
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  const handlePoolPlayerClick = (playerId: string, unavailable: boolean) => {
    if (unavailable) {
      openPlayerModal(playerId);
      return;
    }
    if (!finePointer) {
      openPlayerModal(playerId);
      return;
    }
    if (pendingAssignId === playerId) {
      setPendingAssignId(null);
      return;
    }
    if (pendingAssignId) return;
    if (selectedTarget || replaceSourcePlayerId) {
      if (!replaceCandidateIds.has(playerId)) {
        setAssignmentNotice("That player is not eligible for this swap.");
        return;
      }
      handlePickPlayer(playerId);
      return;
    }
    setModalPlayerId(null);
    setPendingAssignId(playerId);
  };

  const handlePoolPlayerPrimaryClick = (
    playerId: string,
    unavailable: boolean
  ) => {
    playUiClick();
    if (unavailable || !finePointer) {
      openPlayerModal(playerId);
      return;
    }
    clearClickTimer();
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      handlePoolPlayerClick(playerId, unavailable);
    }, SINGLE_CLICK_DELAY_MS);
  };

  const openPlayerModal = (playerId: string) => {
    clearClickTimer();
    setModalPlayerId(playerId);
    setPendingAssignId(null);
    setSelectedTarget(null);
    setReplaceSourcePlayerId(null);
  };

  const handleMatchdayPlayerClick = (playerId: string) => {
    if (selectedTarget && replaceCandidateIds.has(playerId)) {
      handlePickPlayer(playerId);
      return;
    }
    if (replaceSourcePlayerId && replaceCandidateIds.has(playerId)) {
      handlePickPlayer(playerId);
      return;
    }
    handleReplacePlayer(playerId);
  };

  const handleMatchdayPlayerDoubleClick = (playerId: string) => {
    playUiClick();
    openPlayerModal(playerId);
  };

  const handleMatchdayPlayerPrimaryClick = (playerId: string) => {
    playUiClick();
    if (!finePointer) {
      openPlayerModal(playerId);
      return;
    }
    clearClickTimer();
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      handleMatchdayPlayerClick(playerId);
    }, SINGLE_CLICK_DELAY_MS);
  };

  const squadHelpText = finePointer
    ? "Click a squad player, then a highlighted slot to sub · click matchday players to swap · double-click for options"
    : "Tap any player for options · substitute from the player menu";

  const tacticsHelpText =
    "Set your playing style, attack focus, and defence focus for the next match.";

  const squadPoolHelpText = finePointer
    ? pendingAssignId
      ? "Pick a highlighted slot on the pitch or interchange"
      : "Click to select, then pick a slot · double-click for options"
    : "Tap for player options";

  const squadCheck = validateFitMatchdaySquad(resolveCareerForMatchSimulation(career));

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

  const clearAssignmentState = () => {
    setSelectedTarget(null);
    setPendingAssignId(null);
    setReplaceSourcePlayerId(null);
    setModalPlayerId(null);
    clearClickTimer();
  };

  return (
    <ManagerPage>
      <ManagerSection>
      <ManagerViewHeader
        title={subTab === "tactics" ? "Tactics" : "Squad"}
        subtitle={subTab === "squad" ? squadHelpText : tacticsHelpText}
        action={
          subTab === "squad" ? (
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
          ) : undefined
        }
      />

      {subTab === "tactics" ? (
        <ClipboardPanel padded>
          <ManagerTacticsPanel
            career={career}
            onChange={(tactics) => onUpdate({ ...career, tactics })}
            onCareerUpdate={onUpdate}
          />
        </ClipboardPanel>
      ) : (
        <>
      <ManagerBoostsPanel
        career={career}
        stage="manager-squad"
        onApplied={onUpdate}
        compact
      />
      {assignmentNotice && (
        <div className={managerAlertPanelClass("red")} role="status">
          <p className={`${TYPO.bodySm} text-red-200`}>{assignmentNotice}</p>
        </div>
      )}

      {!squadCheck.valid && (
        <div className={managerAlertPanelClass("gold")}>
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

      <div
        className={`${MANAGER.splitLayout} lg:grid-cols-[minmax(0,1fr)_min(100%,440px)]`}
      >
        <div
          ref={matchdayPanelRef}
          className={`mx-auto min-w-0 w-full max-w-[min(100%,26.25rem)] lg:mx-0 lg:max-w-none ${SPACING.stackMd}`}
        >
          <ManagerMatchdayFormation
            career={career}
            interactive
            selectedTarget={selectedTarget}
            pendingAssignId={pendingAssignId}
            replaceSourcePlayerId={replaceSourcePlayerId}
            replaceCandidateIds={replaceCandidateIds}
            onSlotClick={handleSelectSlot}
            onFilledSlotClick={handleMatchdayPlayerPrimaryClick}
            onFilledSlotDoubleClick={handleMatchdayPlayerDoubleClick}
          />

          <CollapsibleDetails summary="Interchange (14–17)" defaultOpen={false}>
            <div className="grid grid-cols-2 auto-rows-fr items-stretch gap-2 sm:grid-cols-4">
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
                      if (pendingAssignId) {
                        playUiClick();
                        handleSelectSlot({ kind: "bench", index: i });
                        return;
                      }
                      if (selectionRole === "target") {
                        if (playerId) handleMatchdayPlayerPrimaryClick(playerId);
                        else {
                          playUiClick();
                          handleSelectSlot({ kind: "bench", index: i });
                        }
                        return;
                      }
                      if (selectionRole === "source" && !playerId) {
                        playUiClick();
                        setSelectedTarget(null);
                        return;
                      }
                      if (playerId) handleMatchdayPlayerPrimaryClick(playerId);
                      else {
                        playUiClick();
                        handleSelectSlot({ kind: "bench", index: i });
                      }
                    }}
                    onDoubleClick={
                      playerId && finePointer
                        ? (e) => {
                            e.preventDefault();
                            handleMatchdayPlayerDoubleClick(playerId);
                          }
                        : undefined
                    }
                    className={squadPlayerBoxClass(
                      selectionRole,
                      unavailable,
                      isSuspension
                    )}
                  >
                    <div className="player-slot player-slot--interchange">
                      <div className="player-slot__header">
                        <span className="player-slot__role">
                          Interchange {14 + i}
                        </span>
                        {unavailable ? (
                          <span
                            className={`text-[10px] font-semibold ${unavailableTextClass(!!isSuspension)}`}
                          >
                            {isSuspension ? "Sus" : "Inj"}
                          </span>
                        ) : null}
                      </div>
                      <div className="player-slot__name">
                        <p
                          className={`${SQUAD_PLAYER_NAME_CLASS} ${
                            player ? "" : "text-pitch-500"
                          }`}
                        >
                          {player?.name ?? "Empty"}
                        </p>
                      </div>
                      <div className="player-slot__footer">
                        <span className="player-slot__position">
                          {player
                            ? getFullPositionName(player.position)
                            : "Bench"}
                        </span>
                        {player ? (
                          <span className="player-slot__rating text-[10px] font-bold text-theme-primary sm:text-xs">
                            {player.peakRating}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsibleDetails>
        </div>

        <div ref={squadPoolPanelRef} className={`min-w-0 w-full ${CARD.clipboard} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-2`}>Squad Players</p>
          <div
            className={`mb-2 ${TYPO.bodySm} ${
              pendingAssignId || replaceSourcePlayerId || selectedTarget
                ? "min-h-[2.75rem]"
                : ""
            }`}
          >
            {pendingAssignId ? (
              <p className="text-pitch-300">
                <span className="font-semibold text-theme-primary">
                  {getManagerPlayer(career, pendingAssignId)?.name}
                </span>{" "}
                selected — pick a{" "}
                <span className="font-semibold text-accent-gold">highlighted slot</span>
              </p>
            ) : replaceSourcePlayerId ? (
              <p className="text-pitch-300">
                Swapping{" "}
                <span className="font-semibold text-theme-primary">
                  {getManagerPlayer(career, replaceSourcePlayerId)?.name}
                </span>{" "}
                — pick a{" "}
                <span className="font-semibold text-accent-gold">highlighted player</span>
              </p>
            ) : selectedTarget ? (
              <p className="text-pitch-300">
                Slot selected — pick a{" "}
                <span className="font-semibold text-accent-gold">highlighted player</span>
              </p>
            ) : (
              <p className={`${TYPO.meta}`}>{squadPoolHelpText}</p>
            )}
          </div>
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
          <div className="min-w-0">
            <ul className={SQUAD_POOL_GRID_CLASS}>
              {displayPool.map((entry) => {
                const selectingForSlot =
                  !!selectedTarget || !!replaceSourcePlayerId;
                const dimmed =
                  selectingForSlot &&
                  !replaceCandidateIds.has(entry.playerId);
                return (
                <SquadPoolPlayerButton
                  key={entry.playerId}
                  career={career}
                  entry={entry}
                  poolRole={getPoolPlayerRole(entry.playerId)}
                  dimmed={dimmed}
                  onClick={() => {
                    handlePoolPlayerPrimaryClick(
                      entry.playerId,
                      entry.unavailable
                    );
                  }}
                  onDoubleClick={
                    finePointer
                      ? (e) => {
                          e.preventDefault();
                          handleMatchdayPlayerDoubleClick(entry.playerId);
                        }
                      : undefined
                  }
                />
                );
              })}
            </ul>
          </div>
          {displayPool.length === 0 && (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
              {career.calledUpReserveIds.length === 0
                ? "No squad players available — call up reserves from the Reserves tab, or all fit players are already on the sheet."
                : "No fit squad players available — injured players are shown above; others may already be on the sheet."}
            </p>
          )}
          {displayPool.length > 0 &&
            (selectedTarget || replaceSourcePlayerId) &&
            replaceCandidateIds.size === 0 && (
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                No eligible players for this slot.
              </p>
            )}
        </div>
      </div>
        </>
      )}
      </ManagerSection>

      {modalPlayerId && (
        <ManagerSquadPlayerModal
          career={career}
          playerId={modalPlayerId}
          onClose={() => setModalPlayerId(null)}
          onUpdate={onUpdate}
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
