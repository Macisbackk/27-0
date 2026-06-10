"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  CupRunRankingResult,
  GameDifficulty,
  GameMode,
  GamePhase,
  Player,
  SquadSlot,
} from "@/lib/types";
import {
  autofillFromOffers,
  collectUsedPlayerIds,
  generateDraftOffers,
  generateSlotOffers,
  getOfferForPick,
  getOfferForSlot,
  getRoundPlayers,
  rerollSlotOffer,
  type RecruitmentRound,
} from "@/lib/game/recruitment";
import { getPlacementPenalty } from "@/lib/game/position-placement";
import { getPlayerById } from "@/lib/players";
import { getJoeMellorGoatPlayer } from "@/lib/players/goat";
import { generateRunSeed } from "@/lib/game/generator";
import {
  simulateSeason,
  type SeasonResult,
} from "@/lib/game/season-simulation";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import { createJoeMellorStartingSquad } from "@/lib/game/joe-mellor-mode";
import { JOE_MELLOR_GOAT_ID } from "@/lib/players/goat";
import {
  createEmptySquad,
  getFilledCount,
  getSquadValue,
  LOOSE_FORWARD_SLOT_INDEX,
  signPlayerToSlot,
  TOTAL_SLOTS,
} from "@/lib/positions";
import { recordCompletedRun } from "@/lib/storage/run";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { addHallOfFameEntry } from "@/lib/storage/hall-of-fame";
import {
  playJoeMellorActivate,
  playPlayerSelect,
  playPositionComplete,
  playSeasonStart,
} from "@/lib/sound";
import { PlayerChoice } from "./PlayerChoice";
import { RugbyPitch } from "./RugbyPitch";
import { SeasonReview } from "./SeasonReview";
import { SeasonSimulation } from "./SeasonSimulation";
import { ChallengeCupReview } from "./ChallengeCupReview";
import { ChallengeCupBracket } from "./ChallengeCupBracket";
import { ChallengeCupClubSelect } from "./ChallengeCupClubSelect";
import { MatchdayScoreboard } from "./MatchdayScoreboard";
import { HardModeBadge } from "./HardModeBadge";
import { ClubHeaderBar } from "./ClubBadge";
import { GuestNotice } from "./GuestNotice";
import { DraftPlacementBanner } from "./DraftPlacementBanner";

interface GameBoardProps {
  mode: GameMode;
  difficulty: GameDifficulty;
  title?: string;
  subtitle?: string;
  joeMellorMode?: boolean;
  draftMode?: boolean;
}

function createRunSeed(runKey: number): string {
  return `${generateRunSeed()}-${runKey}`;
}

function createStartingSquad(joeMellorMode: boolean): SquadSlot[] {
  return joeMellorMode ? createJoeMellorStartingSquad() : createEmptySquad();
}

export function GameBoard({
  mode,
  difficulty,
  title,
  subtitle,
  joeMellorMode = false,
  draftMode = false,
}: GameBoardProps) {
  const isChallengeCup = mode === "CHALLENGE_CUP";
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<GamePhase>(
    isChallengeCup ? "clubSelect" : "pitch"
  );
  const [cupClub, setCupClub] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [squad, setSquad] = useState<SquadSlot[]>(() =>
    createStartingSquad(joeMellorMode)
  );
  const [slotOffers, setSlotOffers] = useState<
    Map<number, RecruitmentRound>
  >(new Map());
  const MAX_REROLLS_PER_RUN = 3;
  const [rerollsRemaining, setRerollsRemaining] = useState(MAX_REROLLS_PER_RUN);
  const [discardedPlayerIds, setDiscardedPlayerIds] = useState<Set<string>>(
    new Set()
  );
  const [rerollsThisRun, setRerollsThisRun] = useState(0);
  const rerollsThisRunRef = useRef(0);
  const [seasonResult, setSeasonResult] = useState<SeasonResult | null>(null);
  const [cupResult, setCupResult] = useState<ChallengeCupResult | null>(null);
  const [runRank, setRunRank] = useState<number | undefined>();
  const [cupRankingResult, setCupRankingResult] = useState<
    CupRunRankingResult | undefined
  >();
  const [submittedOnline, setSubmittedOnline] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [draftPickIndex, setDraftPickIndex] = useState(0);
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const [hoveredPlacementSlot, setHoveredPlacementSlot] = useState<
    number | null
  >(null);
  const recordedRef = useRef(false);
  const joeMellorSoundPlayed = useRef(false);

  const isHardMode = difficulty === "HARD";
  const recruitmentOptions = useMemo(
    () => ({
      hardMode: isHardMode,
      clubFilter: isChallengeCup && cupClub ? cupClub : undefined,
    }),
    [isHardMode, isChallengeCup, cupClub]
  );

  const { seed, runId } = useMemo(() => {
    const s = createRunSeed(runKey);
    return {
      seed: s,
      runId: `run-${Date.now()}-${runKey}`,
    };
  }, [runKey]);

  useEffect(() => {
    if (isChallengeCup && !cupClub) return;

    const skipCount = joeMellorMode ? 1 : 0;
    const lockedIds = joeMellorMode ? [JOE_MELLOR_GOAT_ID] : [];
    const pickCount = TOTAL_SLOTS - skipCount;

    setSlotOffers(
      draftMode && !isChallengeCup
        ? generateDraftOffers(seed, pickCount, lockedIds, recruitmentOptions)
        : generateSlotOffers(
            seed,
            joeMellorMode ? [LOOSE_FORWARD_SLOT_INDEX] : [],
            lockedIds,
            recruitmentOptions
          )
    );
    setDraftPickIndex(0);
    setPendingPlayer(null);
    setDiscardedPlayerIds(new Set());
    setRerollsRemaining(isHardMode ? 0 : MAX_REROLLS_PER_RUN);
    setRerollsThisRun(0);
    rerollsThisRunRef.current = 0;
  }, [
    seed,
    joeMellorMode,
    recruitmentOptions,
    isChallengeCup,
    cupClub,
    isHardMode,
    draftMode,
  ]);

  useEffect(() => {
    if (joeMellorMode && !joeMellorSoundPlayed.current) {
      joeMellorSoundPlayed.current = true;
      playJoeMellorActivate();
    }
  }, [joeMellorMode]);

  const activeOfferKey =
    draftMode && !isChallengeCup ? draftPickIndex : selectedSlotIndex;

  const currentRound: RecruitmentRound | null =
    activeOfferKey !== null
      ? draftMode && !isChallengeCup
        ? getOfferForPick(slotOffers, draftPickIndex)
        : selectedSlotIndex !== null
          ? getOfferForSlot(slotOffers, selectedSlotIndex)
          : null
      : null;

  useEffect(() => {
    if (!draftMode || isChallengeCup || phase !== "pitch") return;
    if (pendingPlayer) return;
    if (getFilledCount(squad) >= TOTAL_SLOTS) return;
    if (!getOfferForPick(slotOffers, draftPickIndex)) return;
    setPhase("choice");
  }, [
    draftMode,
    isChallengeCup,
    phase,
    squad,
    slotOffers,
    draftPickIndex,
    pendingPlayer,
  ]);

  const filledCount = getFilledCount(squad);
  const totalValue = getSquadValue(squad);
  const rerollAvailable =
    !isHardMode &&
    activeOfferKey !== null &&
    rerollsRemaining > 0 &&
    phase === "choice";

  const resetRun = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase(isChallengeCup ? "clubSelect" : "pitch");
    setCupClub(null);
    setSelectedSlotIndex(null);
    setSquad(createStartingSquad(joeMellorMode));
    setSeasonResult(null);
    setCupResult(null);
    setRunRank(undefined);
    setCupRankingResult(undefined);
    setSubmittedOnline(false);
    setChoosing(false);
    setRerolling(false);
    setDraftPickIndex(0);
    setPendingPlayer(null);
    setHoveredPlacementSlot(null);
    recordedRef.current = false;
  }, [joeMellorMode, isChallengeCup]);

  const handleCupClubSelected = useCallback((club: string) => {
    setCupClub(club);
    setPhase("pitch");
  }, []);

  const startTournamentSimulation = useCallback(
    (finalSquad: SquadSlot[]) => {
      playSeasonStart();

      if (isChallengeCup) {
        setCupResult(null);
        setSeasonResult(null);
        setPhase("simulation");
      } else {
        const result = simulateSeason(finalSquad, seed);
        setSeasonResult(result);
        setCupResult(null);
        setPhase("simulation");

        if (recordedRef.current) return;
        recordedRef.current = true;

        const signedIds = finalSquad
          .filter((s) => s.player)
          .map((s) => s.player!.id);
        const value = getSquadValue(finalSquad);

        void recordCompletedRun(
          {
            id: runId,
            mode,
            status: "COMPLETED",
            currentPlayer: null,
            currentIndex: TOTAL_SLOTS,
            totalOffers: TOTAL_SLOTS,
            squad: finalSquad,
            totalValue: value,
            filledCount: getFilledCount(finalSquad),
            totalSlots: TOTAL_SLOTS,
            canSign: false,
            seed,
          },
          signedIds,
          difficulty,
          {
            joeMellorMode,
            seasonWins: result.wins,
            seasonLosses: result.losses,
            seasonLeaguePosition: result.leaguePosition,
            isPerfectSeason: result.isPerfect,
            longestWinStreak: result.longestWinStreak,
            longestLosingStreak: result.longestLosingStreak,
            rerollsUsed: rerollsThisRunRef.current,
          }
        ).then((completed) => {
          setSubmittedOnline(completed.submittedOnline);
          if (completed.nationalRank) setRunRank(completed.nationalRank);
        });

        if (result.isPerfect && !joeMellorMode) {
          addHallOfFameEntry(value, mode, difficulty);
        }
      }
    },
    [
      runId,
      mode,
      seed,
      difficulty,
      joeMellorMode,
      isChallengeCup,
    ]
  );

  const handlePlacementSlot = useCallback(
    (slotIndex: number) => {
      if (phase !== "placement" || !pendingPlayer || choosing) return;
      const slot = squad.find((s) => s.slotIndex === slotIndex);
      if (!slot || slot.player) return;
      if (joeMellorMode && slotIndex === LOOSE_FORWARD_SLOT_INDEX) return;

      const penalty = getPlacementPenalty(
        pendingPlayer.position,
        slot.position
      );
      const newSquad = signPlayerToSlot(
        squad,
        pendingPlayer,
        slotIndex,
        penalty
      );
      setSquad(newSquad);
      setPendingPlayer(null);
      setHoveredPlacementSlot(null);
      playPositionComplete();

      const filled = getFilledCount(newSquad);
      if (filled >= TOTAL_SLOTS) {
        startTournamentSimulation(newSquad);
      } else {
        setDraftPickIndex((i) => i + 1);
        setPhase("choice");
      }
    },
    [
      phase,
      pendingPlayer,
      choosing,
      squad,
      joeMellorMode,
      startTournamentSimulation,
    ]
  );

  const handleSelectSlot = useCallback(
    (slotIndex: number) => {
      if (phase === "placement") {
        handlePlacementSlot(slotIndex);
        return;
      }
      if (phase !== "pitch" || draftMode) return;
      if (joeMellorMode && slotIndex === LOOSE_FORWARD_SLOT_INDEX) return;
      const slot = squad.find((s) => s.slotIndex === slotIndex);
      if (!slot || slot.player) return;
      setSelectedSlotIndex(slotIndex);
      setPhase("choice");
    },
    [phase, squad, joeMellorMode, draftMode, handlePlacementSlot]
  );

  const handleChoose = useCallback(
    (player: Player) => {
      if (!currentRound || choosing || phase !== "choice") return;
      setChoosing(true);
      playPlayerSelect();

      if (draftMode && !isChallengeCup) {
        setTimeout(() => {
          setChoosing(false);
          setPendingPlayer(player);
          setPhase("placement");
        }, 300);
        return;
      }

      const newSquad = signPlayerToSlot(
        squad,
        player,
        currentRound.slotIndex
      );
      setSquad(newSquad);

      setTimeout(() => {
        setChoosing(false);
        setSelectedSlotIndex(null);

        const filled = getFilledCount(newSquad);
        if (filled >= TOTAL_SLOTS) {
          playPositionComplete();
          startTournamentSimulation(newSquad);
        } else {
          playPositionComplete();
          setSelectedSlotIndex(null);
          setPhase("pitch");
        }
      }, 400);
    },
    [
      currentRound,
      choosing,
      phase,
      squad,
      startTournamentSimulation,
      draftMode,
      isChallengeCup,
    ]
  );

  const handleReroll = useCallback(() => {
    const rerollKey =
      draftMode && !isChallengeCup ? draftPickIndex : selectedSlotIndex;
    if (
      isHardMode ||
      !currentRound ||
      rerollKey === null ||
      rerolling ||
      choosing ||
      phase !== "choice" ||
      rerollsRemaining <= 0
    ) {
      return;
    }

    setRerolling(true);

    const signedIds = squad
      .filter((s) => s.player)
      .map((s) => s.player!.id);
    const usedIds = collectUsedPlayerIds(
      slotOffers,
      signedIds,
      rerollKey
    );
    const discarded = new Set(discardedPlayerIds);
    discarded.add(currentRound.optionA);
    discarded.add(currentRound.optionB);

    const nextRound = rerollSlotOffer(
      seed,
      rerollKey!,
      currentRound,
      usedIds,
      discarded,
      recruitmentOptions
    );

    if (nextRound) {
      setSlotOffers((prev) => {
        const next = new Map(prev);
        next.set(rerollKey!, nextRound);
        return next;
      });
      setDiscardedPlayerIds(discarded);
      setRerollsRemaining((n) => n - 1);
      setRerollsThisRun((count) => {
        const next = count + 1;
        rerollsThisRunRef.current = next;
        return next;
      });
    }

    setRerolling(false);
  }, [
    isHardMode,
    currentRound,
    selectedSlotIndex,
    rerolling,
    choosing,
    phase,
    rerollsRemaining,
    squad,
    slotOffers,
    discardedPlayerIds,
    seed,
    recruitmentOptions,
  ]);

  const handleBackToPitch = useCallback(() => {
    setSelectedSlotIndex(null);
    setPhase("pitch");
  }, []);

  const handleAutofill = useCallback(() => {
    if (phase !== "pitch" || filledCount >= TOTAL_SLOTS) return;

    const skipSlots = joeMellorMode ? [LOOSE_FORWARD_SLOT_INDEX] : [];
    const choices = autofillFromOffers(seed, slotOffers, skipSlots);

    let newSquad = squad;
    for (const [slotIndex, playerId] of choices) {
      const player =
        getPlayerById(playerId) ??
        (playerId === JOE_MELLOR_GOAT_ID ? getJoeMellorGoatPlayer() : undefined);
      if (!player) continue;
      newSquad = signPlayerToSlot(newSquad, player, slotIndex);
    }

    setSquad(newSquad);
    playPositionComplete();
    startTournamentSimulation(newSquad);
  }, [
    phase,
    filledCount,
    joeMellorMode,
    seed,
    slotOffers,
    squad,
    startTournamentSimulation,
  ]);

  const handleSimulationComplete = useCallback(() => {
    setPhase("review");
  }, []);

  const handleCupComplete = useCallback(
    (result: ChallengeCupResult) => {
      setCupResult(result);

      if (recordedRef.current) {
        setPhase("review");
        return;
      }
      recordedRef.current = true;

      const signedIds = squad
        .filter((s) => s.player)
        .map((s) => s.player!.id);
      const value = getSquadValue(squad);

      void recordCompletedRun(
        {
          id: runId,
          mode,
          status: "COMPLETED",
          currentPlayer: null,
          currentIndex: TOTAL_SLOTS,
          totalOffers: TOTAL_SLOTS,
          squad,
          totalValue: value,
          filledCount: getFilledCount(squad),
          totalSlots: TOTAL_SLOTS,
          canSign: false,
          seed,
        },
        signedIds,
        difficulty,
        {
          joeMellorMode,
          challengeCupMode: true,
          seasonWins: result.wins,
          seasonLosses: result.losses,
          cupFinish: result.finish,
          cupWon: result.isWinner,
          averageSquadRating: getAverageSquadRating(squad),
          rerollsUsed: rerollsThisRunRef.current,
          matchResults: result.fixtures.map((fixture) => fixture.result),
        }
      ).then((completed) => {
        setSubmittedOnline(completed.submittedOnline);
        setCupRankingResult(completed.cupRanking);
        if (completed.cupRanking?.cupWinsRank) {
          setRunRank(completed.cupRanking.cupWinsRank);
        }
        setPhase("review");
      });
      return;
    },
    [
      squad,
      runId,
      mode,
      seed,
      difficulty,
      joeMellorMode,
    ]
  );

  const playerPair =
    phase === "choice" && currentRound
      ? getRoundPlayers(currentRound)
      : null;

  const choiceKey =
    activeOfferKey !== null
      ? `${runKey}-pick-${activeOfferKey}-${currentRound?.optionA}-${currentRound?.optionB}`
      : "";

  const placementSlot =
    hoveredPlacementSlot !== null
      ? squad.find((s) => s.slotIndex === hoveredPlacementSlot)
      : undefined;

  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="stadium-lights pointer-events-none fixed inset-0" />

      {(title || subtitle || isHardMode) && (
        <div className="relative mx-auto max-w-6xl px-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {title && (
              <h1 className="font-display text-lg font-bold">{title}</h1>
            )}
            {isHardMode && <HardModeBadge />}
          </div>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}

      <div className="relative mx-auto max-w-6xl overflow-x-hidden px-4 py-4 pb-10 sm:py-6">
        {phase !== "clubSelect" && phase !== "review" && (
          <GuestNotice variant="play" />
        )}

        {phase !== "clubSelect" && (
          <MatchdayScoreboard
            difficulty={difficulty}
            filledCount={filledCount}
            totalSlots={TOTAL_SLOTS}
            totalValue={totalValue}
            hideScore={isHardMode}
          />
        )}

        {joeMellorMode && phase !== "clubSelect" && phase !== "review" && (
          <motion.div
            className="mt-4 overflow-hidden rounded-xl border border-accent-gold/50 bg-accent-gold/15 px-3 py-3 text-center sm:px-4 sm:py-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className="font-display text-[10px] font-black uppercase tracking-[0.28em] text-accent-gold sm:text-xs sm:tracking-[0.35em]">
              GOAT MODE ACTIVATED
            </p>
          </motion.div>
        )}

        {isChallengeCup && cupClub && phase !== "clubSelect" && (
          <motion.div
            className="mt-4 overflow-hidden rounded-xl border border-accent-gold/40 bg-accent-gold/10"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ClubHeaderBar club={cupClub} size="md" thick />
            <div className="px-4 py-3 text-center">
              <p className="font-display text-xs font-black uppercase tracking-[0.35em] text-accent-gold">
                Challenge Cup — {cupClub}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                Club-only draft · Single elimination knockout tournament
              </p>
            </div>
          </motion.div>
        )}

        {phase === "pitch" && filledCount < TOTAL_SLOTS && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleAutofill}
              className="rounded-lg border border-accent-green/50 bg-accent-green/10 px-6 py-2.5 font-display text-xs font-bold uppercase tracking-[0.2em] text-accent-green transition hover:bg-accent-green/20"
            >
              Auto Fill Squad
            </button>
          </div>
        )}

        <div className="relative mt-4 overflow-x-hidden overflow-y-visible">
          {phase === "clubSelect" && isChallengeCup && (
            <ChallengeCupClubSelect
              seed={seed}
              onSelect={handleCupClubSelected}
            />
          )}

          {(phase === "pitch" ||
            phase === "choice" ||
            phase === "placement") && (
            <div className="max-h-[min(88vh,900px)] overflow-y-auto overflow-x-hidden pb-2 sm:max-h-none sm:overflow-visible">
              {phase === "placement" && pendingPlayer && (
                <DraftPlacementBanner
                  player={pendingPlayer}
                  selectedSlotPosition={placementSlot?.position}
                  hardMode={isHardMode}
                  showRule={draftPickIndex === 0}
                />
              )}
              <RugbyPitch
                squad={squad}
                totalValue={totalValue}
                filledCount={filledCount}
                totalSlots={TOTAL_SLOTS}
                selectedSlot={
                  phase === "placement"
                    ? hoveredPlacementSlot ?? undefined
                    : selectedSlotIndex ?? undefined
                }
                hardMode={isHardMode}
                interactive={
                  phase === "placement" ||
                  (phase === "pitch" && !draftMode)
                }
                onSlotClick={handleSelectSlot}
                onSlotHover={
                  phase === "placement"
                    ? (idx) => setHoveredPlacementSlot(idx)
                    : undefined
                }
                dimmed={phase === "choice"}
                lockedSlots={
                  joeMellorMode ? [LOOSE_FORWARD_SLOT_INDEX] : undefined
                }
              />
            </div>
          )}

          {phase === "simulation" && isChallengeCup && !cupResult && (
            <div className="matchday-panel mt-4 p-2 sm:p-4">
              <ChallengeCupBracket
                squad={squad}
                seed={seed}
                userClub={cupClub!}
                onComplete={handleCupComplete}
              />
            </div>
          )}

          {phase === "simulation" && seasonResult && !isChallengeCup && (
            <div className="matchday-panel mt-4 p-4">
              <SeasonSimulation
                result={seasonResult}
                onComplete={handleSimulationComplete}
              />
            </div>
          )}

          <AnimatePresence>
            {phase === "choice" && currentRound && playerPair && (
              <motion.div
                key={choiceKey}
                className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="matchday-panel max-h-[92vh] w-full max-w-4xl overflow-y-auto p-2 sm:p-8"
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  {!draftMode && (
                    <button
                      type="button"
                      onClick={handleBackToPitch}
                      disabled={choosing || rerolling}
                      className="mb-4 text-sm text-gray-500 transition hover:text-white disabled:opacity-40"
                    >
                      ← Back to team sheet
                    </button>
                  )}
                  <PlayerChoice
                    playerA={playerPair[0]}
                    playerB={playerPair[1]}
                    positionLabel={
                      draftMode && !isChallengeCup
                        ? `Pick ${draftPickIndex + 1}`
                        : currentRound.slotLabel
                    }
                    onChoose={handleChoose}
                    onReroll={handleReroll}
                    rerollAvailable={rerollAvailable}
                    rerollsRemaining={rerollsRemaining}
                    disabled={choosing || rerolling}
                    hardMode={isHardMode}
                    draftMode={draftMode && !isChallengeCup}
                    showDraftRule={
                      draftMode && !isChallengeCup && draftPickIndex === 0
                    }
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {phase === "review" && cupResult && isChallengeCup && (
        <ChallengeCupReview
          squad={squad}
          cupResult={cupResult}
          seed={seed}
          difficulty={difficulty}
          joeMellorMode={joeMellorMode}
          cupRankingResult={cupRankingResult}
          submittedOnline={submittedOnline}
          onPlayAgain={resetRun}
          onClose={() => setPhase(isChallengeCup ? "clubSelect" : "pitch")}
        />
      )}

      {phase === "review" && seasonResult && !isChallengeCup && (
        <SeasonReview
          squad={squad}
          mode={mode}
          seed={seed}
          difficulty={difficulty}
          joeMellorMode={joeMellorMode}
          seasonResult={seasonResult}
          runRank={runRank}
          submittedOnline={submittedOnline}
          onPlayAgain={resetRun}
          onClose={() => setPhase("pitch")}
        />
      )}
    </div>
  );
}
