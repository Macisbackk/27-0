"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type {
  GameDifficulty,
  GameMode,
  GamePhase,
  Player,
  SquadSlot,
} from "@/lib/types";
import {
  autofillFromOffers,
  collectRecentDraftPositions,
  collectUsedPlayerIds,
  generateDraftOfferForPick,
  generateSlotOffers,
  getOfferForPick,
  getOfferForSlot,
  getRoundPlayers,
  rerollDraftOffer,
  rerollSlotOffer,
  type RecruitmentRound,
} from "@/lib/game/recruitment";
import {
  getPlacementPenalty,
} from "@/lib/game/position-placement";
import { getPlayerById } from "@/lib/players";
import { getJoeMellorGoatPlayer } from "@/lib/players/goat";
import {
  getSuperSamHallasPlayer,
  isSuperSamHallasId,
} from "@/lib/players/super-sam-hallas";
import { generateRunSeed } from "@/lib/game/generator";
import {
  simulateSeason,
  type SeasonResult,
} from "@/lib/game/season-simulation";
import { buildLeagueTable } from "@/lib/game/league-table";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
import {
  createPlayoffBracket,
  type PlayoffBracketState,
} from "@/lib/game/playoff-bracket";
import { createJoeMellorStartingSquad } from "@/lib/game/joe-mellor-mode";
import {
  ALL_SUPER_SAM_SLOT_INDICES,
  createSuperSamHallasStartingSquad,
} from "@/lib/game/super-sam-hallas-mode";
import { JOE_MELLOR_GOAT_ID } from "@/lib/players/goat";
import {
  createEmptySquad,
  getFilledCount,
  getSquadValue,
  LOOSE_FORWARD_SLOT_INDEX,
  signPlayerToSlot,
  TOTAL_SLOTS,
} from "@/lib/positions";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { awardClubFundsForRun } from "@/lib/storage/club-funds";
import { recordCompletedRun, recordPlayoffCompletion } from "@/lib/storage/run";
import {
  playJoeMellorActivate,
  playSuperSamHallasActivate,
  playModeClassicStart,
  playModeDraftStart,
  playDraftPlacement,
  playPlayerSelect,
  playAutofill,
  playPositionComplete,
  playPositionSelect,
  playRevealChoices,
  playReroll,
  playSeasonStart,
  playUiClick,
} from "@/lib/sound";
import { PlayerChoice } from "./PlayerChoice";
import { RecruitmentSlotReveal } from "./RecruitmentSlotReveal";
import { SlotTeamYearPicker } from "./SlotTeamYearPicker";
import { RugbyPitch, TEAM_SHEET_RUGBY_PITCH_PROPS } from "./RugbyPitch";
import { PlayoffReview } from "./PlayoffReview";
import { PlayoffBracket } from "./PlayoffBracket";
import { SeasonReview } from "./SeasonReview";
import { SeasonSimulation } from "./SeasonSimulation";
import { MatchdayScoreboard } from "./MatchdayScoreboard";
import { GuestNotice } from "./GuestNotice";
import { DraftPositionPlacement } from "./DraftPositionPlacement";
import { LINK, BTN, CARD, SPACING, MODAL } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import {
  generateSlotTeamYearTargetForSlot,
  autofillSlotRecruitSquad,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotTeamYearPlayers,
} from "@/lib/game/slot-team-year-pick";
import { pickLegendSpinSlotIndex } from "@/lib/game/legend-spin";
import { getPlayerTeamYearIds } from "@/lib/game/team-year-pools";
import type { SpinPoolVariant } from "@/lib/game/player-pool-eligibility";

interface GameBoardProps {
  mode: GameMode;
  difficulty: GameDifficulty;
  title?: string;
  subtitle?: string;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  /** Normal Mode: false = Current (2026 only), true = Era team-year pools. */
  normalEraMode?: boolean;
}

function createRunSeed(runKey: number): string {
  return `${generateRunSeed()}-${runKey}`;
}

function createStartingSquad(options: {
  joeMellorMode: boolean;
  superSamHallasMode: boolean;
}): SquadSlot[] {
  if (options.superSamHallasMode) return createSuperSamHallasStartingSquad();
  if (options.joeMellorMode) return createJoeMellorStartingSquad();
  return createEmptySquad();
}

function resolveHiddenPlayer(playerId: string, slotIndex?: number): Player | undefined {
  if (playerId === JOE_MELLOR_GOAT_ID) return getJoeMellorGoatPlayer();
  if (isSuperSamHallasId(playerId)) {
    const parsedIndex = Number.parseInt(
      playerId.slice("ssh-sam-hallas-".length),
      10
    );
    const idx = slotIndex ?? parsedIndex;
    const squad = createEmptySquad();
    const slot = squad.find((s) => s.slotIndex === idx);
    if (slot) return getSuperSamHallasPlayer(idx, slot.position);
  }
  return undefined;
}

export function GameBoard({
  mode,
  difficulty,
  title,
  subtitle,
  joeMellorMode = false,
  superSamHallasMode = false,
  normalEraMode = false,
}: GameBoardProps) {
  const spinVariant: SpinPoolVariant = normalEraMode ? "era" : "current";
  const isDraftMode = mode === "DRAFT";
  const isSlotRecruitMode = mode === "CLASSIC";
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("pitch");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [squad, setSquad] = useState<SquadSlot[]>(() =>
    createStartingSquad({ joeMellorMode, superSamHallasMode })
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
  const [runRank, setRunRank] = useState<number | undefined>();
  const [submittedOnline, setSubmittedOnline] = useState(false);
  const [clubFundsPayout, setClubFundsPayout] =
    useState<ClubFundsPayoutResult | null>(null);
  const [playoffFundsPayout, setPlayoffFundsPayout] =
    useState<ClubFundsPayoutResult | null>(null);
  const [reviewStage, setReviewStage] = useState<
    "regular" | "playoffs" | "playoffFinal"
  >("regular");
  const [choosing, setChoosing] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [draftPickIndex, setDraftPickIndex] = useState(0);
  const [spinPickIndex, setSpinPickIndex] = useState(0);
  const [spinSessionId, setSpinSessionId] = useState(0);
  const MAX_RESPINS_PER_RUN = 3;
  const [respinsRemaining, setRespinsRemaining] = useState(MAX_RESPINS_PER_RUN);
  const [usedTeamYearKeys, setUsedTeamYearKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const [slotRecruitTarget, setSlotRecruitTarget] =
    useState<SlotRevealTarget | null>(null);
  /** Frozen team/year from spin — sole source of truth for the player picker. */
  const [activeSpinTarget, setActiveSpinTarget] =
    useState<SlotRevealTarget | null>(null);
  const recordedRef = useRef(false);
  const playoffRecordedRef = useRef(false);
  const fundsAwardedRef = useRef(false);
  const playoffFundsAwardedRef = useRef(false);
  const playoffResultRef = useRef<PlayoffResult | null>(null);
  const [playoffBracketState, setPlayoffBracketState] =
    useState<PlayoffBracketState | null>(null);
  const [completedPlayoffBracketState, setCompletedPlayoffBracketState] =
    useState<PlayoffBracketState | null>(null);
  const [legendSpinSlotIndex, setLegendSpinSlotIndex] = useState<number | null>(
    null
  );
  const [legendSpinUsed, setLegendSpinUsed] = useState(false);
  const [recruitNotice, setRecruitNotice] = useState<string | null>(null);
  const modeSoundPlayed = useRef(false);
  const revealSoundKey = useRef<string | null>(null);
  const placementScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const lastScrolledPlayerIdRef = useRef<string | null>(null);

  const recruitmentOptions = useMemo(
    () => ({
      draftMode: isDraftMode,
    }),
    [isDraftMode]
  );

  const { seed, runId } = useMemo(() => {
    const s = createRunSeed(runKey);
    return {
      seed: s,
      runId: `run-${Date.now()}-${runKey}`,
    };
  }, [runKey]);

  useEffect(() => {
    if (
      !isSlotRecruitMode ||
      joeMellorMode ||
      superSamHallasMode
    ) {
      setLegendSpinSlotIndex(null);
      setLegendSpinUsed(false);
      return;
    }
    setLegendSpinSlotIndex(
      pickLegendSpinSlotIndex(seed, createEmptySquad(), new Set(), spinVariant)
    );
    setLegendSpinUsed(false);
  }, [
    runKey,
    seed,
    isSlotRecruitMode,
    joeMellorMode,
    superSamHallasMode,
    spinVariant,
  ]);

  useEffect(() => {
    if (superSamHallasMode) {
      setSlotOffers(new Map());
      setDraftPickIndex(0);
      setSpinPickIndex(0);
      setPendingPlayer(null);
      setDiscardedPlayerIds(new Set());
      setRerollsRemaining(MAX_REROLLS_PER_RUN);
      setRerollsThisRun(0);
      rerollsThisRunRef.current = 0;
      return;
    }

    const lockedIds = joeMellorMode ? [JOE_MELLOR_GOAT_ID] : [];

    setSlotOffers(
      isDraftMode || isSlotRecruitMode
        ? new Map()
        : generateSlotOffers(
            seed,
            joeMellorMode ? [LOOSE_FORWARD_SLOT_INDEX] : [],
            lockedIds,
            recruitmentOptions
          )
    );
    setDraftPickIndex(0);
    setSpinPickIndex(0);
    setPendingPlayer(null);
    setDiscardedPlayerIds(new Set());
    setRerollsRemaining(MAX_REROLLS_PER_RUN);
    setRerollsThisRun(0);
    rerollsThisRunRef.current = 0;
  }, [
    seed,
    joeMellorMode,
    superSamHallasMode,
    recruitmentOptions,
    isDraftMode,
    isSlotRecruitMode,
  ]);

  useEffect(() => {
    if (modeSoundPlayed.current) return;
    modeSoundPlayed.current = true;
    if (superSamHallasMode) {
      playSuperSamHallasActivate();
    } else if (joeMellorMode) {
      playJoeMellorActivate();
    } else if (isDraftMode) {
      playModeDraftStart(difficulty);
    } else {
      playModeClassicStart(difficulty);
    }
  }, [superSamHallasMode, joeMellorMode, isDraftMode, difficulty]);

  const activeOfferKey = isDraftMode ? draftPickIndex : selectedSlotIndex;

  const currentRound: RecruitmentRound | null =
    activeOfferKey !== null
      ? isDraftMode
        ? getOfferForPick(slotOffers, draftPickIndex)
        : getOfferForSlot(slotOffers, selectedSlotIndex!)
      : null;

  useEffect(() => {
    if (phase !== "choice") return;
    const key = `${activeOfferKey ?? "x"}-${seed}`;
    if (revealSoundKey.current === key) return;
    revealSoundKey.current = key;
  }, [phase, activeOfferKey, seed]);

  useEffect(() => {
    if (!isDraftMode || superSamHallasMode) return;
    const maxPicks = TOTAL_SLOTS - (joeMellorMode ? 1 : 0);
    if (draftPickIndex >= maxPicks) return;
    if (getOfferForPick(slotOffers, draftPickIndex)) return;

    const signedIds = squad
      .filter((slot) => slot.player)
      .map((slot) => slot.player!.id);
    const lockedIds = joeMellorMode ? [JOE_MELLOR_GOAT_ID] : [];
    const recentPositions = collectRecentDraftPositions(
      slotOffers,
      draftPickIndex
    );
    const offer = generateDraftOfferForPick(
      seed,
      draftPickIndex,
      squad,
      signedIds,
      lockedIds,
      recentPositions,
      recruitmentOptions
    );
    if (!offer) return;

    setSlotOffers((prev) => {
      if (prev.get(draftPickIndex)) return prev;
      const next = new Map(prev);
      next.set(draftPickIndex, offer);
      return next;
    });
  }, [
    isDraftMode,
    superSamHallasMode,
    draftPickIndex,
    squad,
    seed,
    slotOffers,
    joeMellorMode,
    recruitmentOptions,
  ]);

  useEffect(() => {
    if (!isDraftMode || superSamHallasMode) return;
    if (pendingPlayer) return;
    if (getFilledCount(squad) >= TOTAL_SLOTS) return;

    const hasOffer = !!getOfferForPick(slotOffers, draftPickIndex);
    if (phase === "pitch" && hasOffer) {
      setPhase("choice");
    } else if (phase === "choice" && !hasOffer) {
      setPhase("pitch");
    }
  }, [
    isDraftMode,
    superSamHallasMode,
    phase,
    squad,
    slotOffers,
    draftPickIndex,
    pendingPlayer,
  ]);

  const filledCount = getFilledCount(squad);
  const totalValue = getSquadValue(squad);

  const signedPlayerIds = useMemo(
    () =>
      new Set(
        squad.filter((s) => s.player).map((s) => s.player!.id)
      ),
    [squad]
  );

  const slotRecruitEntries = useMemo(() => {
    if (
      !isSlotRecruitMode ||
      !activeSpinTarget ||
      selectedSlotIndex === null
    ) {
      return [];
    }
    return prepareSlotTeamYearPlayers(
      activeSpinTarget,
      signedPlayerIds,
      squad,
      selectedSlotIndex,
      {
        seed,
        legendOnly:
          !legendSpinUsed &&
          legendSpinSlotIndex === selectedSlotIndex,
      }
    );
  }, [
    isSlotRecruitMode,
    activeSpinTarget,
    signedPlayerIds,
    squad,
    selectedSlotIndex,
    seed,
    legendSpinUsed,
    legendSpinSlotIndex,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!isSlotRecruitMode || !activeSpinTarget || slotRecruitEntries.length === 0) return;

    const mismatched = slotRecruitEntries.find(
      ({ player }) => !getPlayerTeamYearIds(player.id).includes(activeSpinTarget.teamYearId)
    );
    if (mismatched) {
      console.warn("Player pool leak", {
        spinTeamYearId: activeSpinTarget.teamYearId,
        playerId: mismatched.player.id,
        playerTeamYearIds: getPlayerTeamYearIds(mismatched.player.id),
      });
    }
  }, [isSlotRecruitMode, activeSpinTarget, slotRecruitEntries]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!slotRecruitTarget || !activeSpinTarget) return;
    if (slotRecruitTarget.teamYearId === activeSpinTarget.teamYearId) return;
    console.warn("Spin mismatch", {
      animationFinalResult: slotRecruitTarget,
      playerPoolTeamYearId: activeSpinTarget.teamYearId,
    });
  }, [slotRecruitTarget, activeSpinTarget]);

  const rerollAvailable =
    !isSlotRecruitMode &&
    activeOfferKey !== null &&
    rerollsRemaining > 0 &&
    phase === "choice";

  const resetRun = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase("pitch");
    setSelectedSlotIndex(null);
    setSlotRecruitTarget(null);
    setActiveSpinTarget(null);
    setSquad(createStartingSquad({ joeMellorMode, superSamHallasMode }));
    setSeasonResult(null);
    setRunRank(undefined);
    setSubmittedOnline(false);
    setClubFundsPayout(null);
    setPlayoffFundsPayout(null);
    setChoosing(false);
    setRerolling(false);
    setDraftPickIndex(0);
    setSpinPickIndex(0);
    setSpinSessionId(0);
    setRespinsRemaining(MAX_RESPINS_PER_RUN);
    setUsedTeamYearKeys(new Set());
    setPendingPlayer(null);
    lastScrolledPlayerIdRef.current = null;
    recordedRef.current = false;
    playoffRecordedRef.current = false;
    fundsAwardedRef.current = false;
    playoffFundsAwardedRef.current = false;
    playoffResultRef.current = null;
    setPlayoffBracketState(null);
    setCompletedPlayoffBracketState(null);
    setLegendSpinSlotIndex(null);
    setLegendSpinUsed(false);
    setReviewStage("regular");
    setRecruitNotice(null);
    modeSoundPlayed.current = false;
  }, [joeMellorMode, superSamHallasMode]);

  const startTournamentSimulation = useCallback(
    (finalSquad: SquadSlot[]) => {
      playSeasonStart();

      const result = simulateSeason(finalSquad, seed, {
        draftMode: isDraftMode,
        currentSeasonOnly: !normalEraMode,
      });
      setSeasonResult(result);
      setPhase("simulation");
      setReviewStage("regular");
      recordedRef.current = false;
      fundsAwardedRef.current = false;
    },
    [
      runId,
      mode,
      seed,
      difficulty,
      joeMellorMode,
      superSamHallasMode,
      isDraftMode,
      normalEraMode,
    ]
  );

  const finalizeRegularSeason = useCallback(
    (result: SeasonResult, finalSquad: SquadSlot[]) => {
      if (recordedRef.current) return;
      recordedRef.current = true;

      const signedIds = finalSquad
        .filter((s) => s.player)
        .map((s) => s.player!.id);
      const value = getSquadValue(finalSquad);
      const leagueTable = buildLeagueTable(result, seed);
      const tablePosition =
        leagueTable.find((row) => row.isUserTeam)?.position ??
        result.leaguePosition;

      void recordCompletedRun(
        {
          id: runId,
          mode,
          modeVariant: normalEraMode ? "era" : "current",
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
          superSamHallasMode,
          seasonWins: result.wins,
          seasonLosses: result.losses,
          playoffWins: 0,
          playoffLosses: 0,
          seasonLeaguePosition: tablePosition,
          isPerfectSeason: result.isPerfect,
          longestWinStreak: result.longestWinStreak,
          longestLosingStreak: result.longestLosingStreak,
          rerollsUsed: rerollsThisRunRef.current,
          topSixFinish: tablePosition <= 6,
          normalEraMode,
        }
      ).then((completed) => {
        setSubmittedOnline(completed.submittedOnline);
        if (completed.nationalRank) setRunRank(completed.nationalRank);
      });

      if (!fundsAwardedRef.current) {
        fundsAwardedRef.current = true;
        const payout = awardClubFundsForRun({
          runId,
          mode,
          isHiddenRun: joeMellorMode || superSamHallasMode,
          seasonResult: result,
          fundsPhase: "regular",
        });
        setClubFundsPayout(payout);
      }
    },
    [runId, mode, seed, difficulty, joeMellorMode, superSamHallasMode, normalEraMode]
  );

  const finalizePlayoffRun = useCallback(
    (result: SeasonResult, finalSquad: SquadSlot[]) => {
      const playoff = result.playoffResult ?? playoffResultRef.current;
      if (!playoff || playoffRecordedRef.current) return;
      playoffRecordedRef.current = true;

      const signedIds = finalSquad
        .filter((s) => s.player)
        .map((s) => s.player!.id);
      const value = getSquadValue(finalSquad);
      const leagueTable = buildLeagueTable(result, seed);
      const tablePosition =
        leagueTable.find((row) => row.isUserTeam)?.position ??
        result.leaguePosition;

      void recordPlayoffCompletion(
        {
          id: runId,
          mode,
          modeVariant: normalEraMode ? "era" : "current",
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
          regularWins: result.wins,
          regularLosses: result.losses,
          playoffWins: playoff.wins,
          playoffLosses: playoff.losses,
          seasonLeaguePosition: tablePosition,
          playoffFinish: playoff.finish,
          superLeagueTitle:
            playoff.isChampion ||
            playoff.finish === "Super League Champions",
        }
      ).then((completed) => {
        setSubmittedOnline(completed.submittedOnline);
        if (completed.nationalRank) setRunRank(completed.nationalRank);
      });
    },
    [runId, mode, seed, difficulty, joeMellorMode, superSamHallasMode, normalEraMode]
  );

  useEffect(() => {
    if (phase !== "review" || reviewStage !== "regular" || !seasonResult) return;
    if (joeMellorMode || superSamHallasMode) return;
    finalizeRegularSeason(seasonResult, squad);
  }, [
    phase,
    reviewStage,
    seasonResult,
    squad,
    joeMellorMode,
    superSamHallasMode,
    finalizeRegularSeason,
  ]);

  const handleContinuePlayoffs = useCallback(() => {
    if (!seasonResult) return;
    finalizeRegularSeason(seasonResult, squad);
    const leagueTable = buildLeagueTable(seasonResult, seed);
    const tablePosition =
      leagueTable.find((row) => row.isUserTeam)?.position ??
      seasonResult.leaguePosition;
    setPlayoffBracketState(
      createPlayoffBracket(seed, leagueTable, tablePosition, {
        currentSeasonOnly: !normalEraMode,
      })
    );
    setReviewStage("playoffs");
  }, [seasonResult, seed, squad, finalizeRegularSeason, normalEraMode]);

  const handlePlayoffBracketComplete = useCallback(
    (playoffResult: PlayoffResult, finalState: PlayoffBracketState) => {
      playoffResultRef.current = playoffResult;
      setCompletedPlayoffBracketState(finalState);
      if (seasonResult) {
        const updated = { ...seasonResult, playoffResult };
        if (!playoffFundsAwardedRef.current) {
          playoffFundsAwardedRef.current = true;
          const payout = awardClubFundsForRun({
            runId,
            mode,
            isHiddenRun: joeMellorMode || superSamHallasMode,
            seasonResult: updated,
            fundsPhase: "playoff",
          });
          setPlayoffFundsPayout(payout);
        }
        finalizePlayoffRun(updated, squad);
        setSeasonResult(updated);
      } else {
        setSeasonResult((prev) => (prev ? { ...prev, playoffResult } : prev));
      }
      setReviewStage("playoffFinal");
    },
    [
      seasonResult,
      runId,
      mode,
      squad,
      joeMellorMode,
      superSamHallasMode,
      finalizePlayoffRun,
    ]
  );

  const handleFinalizePlayoffRun = useCallback(() => {
    if (!seasonResult) return;
    const playoff = playoffResultRef.current ?? seasonResult.playoffResult;
    if (!playoff) return;
    finalizePlayoffRun({ ...seasonResult, playoffResult: playoff }, squad);
  }, [seasonResult, squad, finalizePlayoffRun]);

  const handlePlayoffReviewDone = useCallback(() => {
    handleFinalizePlayoffRun();
    resetRun();
  }, [handleFinalizePlayoffRun, resetRun]);

  const handleFinalizeSeason = useCallback(() => {
    if (!seasonResult) return;
    finalizeRegularSeason(seasonResult, squad);
  }, [seasonResult, squad, finalizeRegularSeason]);

  const handleSlotTeamYearPick = useCallback(
    (player: Player) => {
      if (
        choosing ||
        phase !== "choice" ||
        !isSlotRecruitMode ||
        !activeSpinTarget ||
        selectedSlotIndex === null
      ) {
        return;
      }

      const newSquad = placeSlotRecruitPlayerAtSlot(
        squad,
        player,
        activeSpinTarget,
        selectedSlotIndex
      );
      if (!newSquad) return;

      setChoosing(true);
      playPositionComplete();

      setSquad(newSquad);
      setPendingPlayer(null);
      setSelectedSlotIndex(null);
      setSlotRecruitTarget(null);
      setActiveSpinTarget(null);
      setChoosing(false);
      setUsedTeamYearKeys((prev) => {
        const next = new Set(prev);
        next.add(activeSpinTarget.teamYearKey);
        return next;
      });
      if (
        legendSpinSlotIndex === selectedSlotIndex &&
        !legendSpinUsed
      ) {
        setLegendSpinUsed(true);
      }

      const filled = getFilledCount(newSquad);
      if (filled >= TOTAL_SLOTS) {
        startTournamentSimulation(newSquad);
      } else {
        setSpinPickIndex((i) => i + 1);
        setPhase("pitch");
      }
    },
    [
      choosing,
      phase,
      isSlotRecruitMode,
      activeSpinTarget,
      selectedSlotIndex,
      squad,
      startTournamentSimulation,
    ]
  );

  const startSlotRecruitSpin = useCallback(
    (slotIndex: number) => {
      if (
        phase !== "pitch" ||
        !isSlotRecruitMode ||
        filledCount >= TOTAL_SLOTS ||
        choosing
      ) {
        return;
      }

      const slot = squad.find((s) => s.slotIndex === slotIndex);
      if (!slot || slot.player) return;

      playPositionSelect();
      const t0 = performance.now();
      const requireLegendPlayer =
        !legendSpinUsed &&
        legendSpinSlotIndex === slotIndex;
      const target = generateSlotTeamYearTargetForSlot(
        seed,
        spinPickIndex,
        signedPlayerIds,
        squad,
        slotIndex,
        usedTeamYearKeys,
        { requireLegendPlayer, spinVariant }
      );
      if (process.env.NODE_ENV === "development") {
        console.debug(
          `[spin-timing] target-selected: ${(performance.now() - t0).toFixed(1)}ms`,
          target?.teamYearId
        );
      }
      if (!target) {
        setRecruitNotice(
          "No eligible players left for this slot. Try another position or finish manually."
        );
        return;
      }

      setRecruitNotice(null);

      setPendingPlayer(null);
      lastScrolledPlayerIdRef.current = null;
      setSelectedSlotIndex(slotIndex);
      setActiveSpinTarget(target);
      setSlotRecruitTarget(target);
      setSpinSessionId((id) => id + 1);
      setPhase("reveal");
    },
    [
      phase,
      isSlotRecruitMode,
      filledCount,
      choosing,
      squad,
      seed,
      spinPickIndex,
      signedPlayerIds,
      usedTeamYearKeys,
      legendSpinUsed,
      legendSpinSlotIndex,
    ]
  );

  const handleSlotRespin = useCallback(() => {
    if (
      !isSlotRecruitMode ||
      respinsRemaining <= 0 ||
      phase !== "choice" ||
      selectedSlotIndex === null ||
      choosing
    ) {
      return;
    }

    const nextSpinIndex = spinPickIndex + 1;
    const requireLegendPlayer =
      !legendSpinUsed &&
      legendSpinSlotIndex === selectedSlotIndex;
    const target = generateSlotTeamYearTargetForSlot(
      seed,
      nextSpinIndex,
      signedPlayerIds,
      squad,
      selectedSlotIndex,
      usedTeamYearKeys,
      { requireLegendPlayer, spinVariant }
    );
    if (!target) {
      setRecruitNotice(
        "No eligible players left for a respin. Sign the current offer or pick another slot."
      );
      return;
    }

    setRecruitNotice(null);

    playReroll();
    setRespinsRemaining((n) => n - 1);
    setSpinPickIndex(nextSpinIndex);
    setActiveSpinTarget(target);
    setSlotRecruitTarget(target);
    setSpinSessionId((id) => id + 1);
    setPhase("reveal");
  }, [
    isSlotRecruitMode,
    respinsRemaining,
    phase,
    selectedSlotIndex,
    choosing,
    spinPickIndex,
    seed,
    signedPlayerIds,
    squad,
    usedTeamYearKeys,
    legendSpinUsed,
    legendSpinSlotIndex,
  ]);

  const handleSelectSlot = useCallback(
    (slotIndex: number) => {
      if (isSlotRecruitMode) {
        startSlotRecruitSpin(slotIndex);
        return;
      }
      if (phase !== "pitch" || isDraftMode) return;
      if (joeMellorMode && slotIndex === LOOSE_FORWARD_SLOT_INDEX) return;
      if (superSamHallasMode) return;
      const slot = squad.find((s) => s.slotIndex === slotIndex);
      if (!slot || slot.player) return;
      playPositionSelect();
      setSelectedSlotIndex(slotIndex);
      setPhase("choice");
      playRevealChoices();
    },
    [
      isSlotRecruitMode,
      startSlotRecruitSpin,
      phase,
      squad,
      joeMellorMode,
      superSamHallasMode,
      isDraftMode,
    ]
  );

  const handleRevealComplete = useCallback(() => {
    setPendingPlayer(null);
    setPhase("choice");
  }, []);

  const handlePlaceDraftPlayer = useCallback(
    (slotIndex: number) => {
      if (phase !== "placement" || !pendingPlayer || choosing) return;
      const slot = squad.find((s) => s.slotIndex === slotIndex);
      if (!slot || slot.player) return;

      const penalty = getPlacementPenalty(
        pendingPlayer.position,
        slot.position,
        pendingPlayer
      );
      const newSquad = signPlayerToSlot(
        squad,
        pendingPlayer,
        slotIndex,
        penalty
      );
      setSquad(newSquad);
      setPendingPlayer(null);
      playDraftPlacement();

      const filled = getFilledCount(newSquad);
      if (filled >= TOTAL_SLOTS) {
        startTournamentSimulation(newSquad);
      } else {
        setDraftPickIndex((i) => i + 1);
        setPhase("pitch");
      }
    },
    [
      phase,
      pendingPlayer,
      choosing,
      squad,
      startTournamentSimulation,
    ]
  );

  const handleChoose = useCallback(
    (player: Player) => {
      if (!currentRound || choosing || phase !== "choice") return;
      setChoosing(true);
      playPlayerSelect();

      if (isDraftMode) {
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
      isDraftMode,
    ]
  );

  const handleReroll = useCallback(() => {
    const rerollKey = isDraftMode ? draftPickIndex : selectedSlotIndex;
    if (
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
      rerollKey,
      recruitmentOptions
    );
    const discarded = new Set(discardedPlayerIds);
    discarded.add(currentRound.optionA);
    discarded.add(currentRound.optionB);

    const nextRound = isDraftMode
      ? rerollDraftOffer(
          seed,
          rerollKey!,
          currentRound,
          squad,
          usedIds,
          discarded,
          collectRecentDraftPositions(slotOffers, rerollKey!),
          recruitmentOptions
        )
      : rerollSlotOffer(
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
      playReroll();
      setRerollsThisRun((count) => {
        const next = count + 1;
        rerollsThisRunRef.current = next;
        return next;
      });
    }

    setRerolling(false);
  }, [
    isDraftMode,
    draftPickIndex,
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
    if (isDraftMode) return;
    setSelectedSlotIndex(null);
    setSlotRecruitTarget(null);
    setActiveSpinTarget(null);
    setPendingPlayer(null);
    lastScrolledPlayerIdRef.current = null;
    revealSoundKey.current = null;
    setPhase("pitch");
  }, [isDraftMode]);

  const handleAutofill = useCallback(() => {
    if (phase !== "pitch" || filledCount >= TOTAL_SLOTS || isDraftMode) return;

    if (isSlotRecruitMode) {
      const result = autofillSlotRecruitSquad(
        seed,
        spinPickIndex,
        squad,
        usedTeamYearKeys,
        spinVariant
      );
      if (!result) {
        setRecruitNotice(
          "Autofill could not complete the squad — not enough eligible players remain."
        );
        return;
      }
      setRecruitNotice(null);
      setSquad(result.squad);
      setSpinPickIndex(result.nextSpinIndex);
      setUsedTeamYearKeys(new Set(result.usedTeamYearKeys));
      playAutofill();
      playPositionComplete();
      return;
    }

    const skipSlots = joeMellorMode ? [LOOSE_FORWARD_SLOT_INDEX] : [];
    const choices = autofillFromOffers(seed, slotOffers, skipSlots);

    let newSquad = squad;
    for (const [slotIndex, playerId] of choices) {
      const player =
        getPlayerById(playerId) ??
        resolveHiddenPlayer(playerId, slotIndex);
      if (!player) continue;
      newSquad = signPlayerToSlot(newSquad, player, slotIndex);
    }

    setSquad(newSquad);
    playPositionComplete();
  }, [
    phase,
    filledCount,
    isDraftMode,
    isSlotRecruitMode,
    joeMellorMode,
    seed,
    spinPickIndex,
    spinVariant,
    usedTeamYearKeys,
    slotOffers,
    squad,
  ]);

  const handleSimulationComplete = useCallback(() => {
    setReviewStage("regular");
    setPhase("review");
  }, []);

  useEffect(() => {
    if (phase !== "simulation" && phase !== "review") return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [phase, reviewStage]);

  const playerPair =
    !isSlotRecruitMode &&
    (phase === "choice" || phase === "reveal") &&
    currentRound
      ? getRoundPlayers(currentRound)
      : null;

  const choiceKey =
    isSlotRecruitMode && activeSpinTarget
      ? `${runKey}-spin-${spinSessionId}-${activeSpinTarget.teamYearId}`
      : activeOfferKey !== null
        ? `${runKey}-pick-${activeOfferKey}-${currentRound?.optionA}-${currentRound?.optionB}`
        : "";

  return (
    <div className="matchday-arena arena-surface relative flex min-h-full flex-1 flex-col lg:desktop-page-fit">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="stadium-lights pointer-events-none fixed inset-0" />

      <div
        ref={mainScrollRef}
        className={`relative mx-auto flex w-full max-w-6xl flex-col overflow-x-hidden ${SPACING.pageX} py-4 pb-28 sm:py-5 sm:pb-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:desktop-scroll-rail lg:pb-4`}
      >
      {(title || subtitle) && (
        <div className="pt-1 lg:pt-0">
          <div className="flex flex-wrap items-center gap-3">
            {title && (
              <h1 className={`${TYPO.viewTitle} text-lg sm:text-xl`}>{title}</h1>
            )}
          </div>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
      )}

      <div>
        {phase !== "review" && (
          <GuestNotice variant="play" />
        )}

        <MatchdayScoreboard
            filledCount={filledCount}
            totalSlots={TOTAL_SLOTS}
            totalValue={totalValue}
          />

        {recruitNotice && phase === "pitch" && (
          <p
            className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            role="status"
          >
            {recruitNotice}
          </p>
        )}

        {superSamHallasMode && phase !== "review" && (
          <motion.div
            className={`mt-4 overflow-hidden ${CARD.base} border-accent-gold/50 bg-accent-gold/15 px-3 py-3 text-center sm:px-4 sm:py-4`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className={`${TYPO.sectionLabel} text-accent-gold`}>
              SUPER SAM HALLAS MODE ACTIVATED
            </p>
          </motion.div>
        )}

        {joeMellorMode && !superSamHallasMode && phase !== "review" && (
          <motion.div
            className={`mt-4 overflow-hidden ${CARD.base} border-accent-gold/50 bg-accent-gold/15 px-3 py-3 text-center sm:px-4 sm:py-4`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className={`${TYPO.sectionLabel} text-accent-gold`}>
              GOAT MODE ACTIVATED
            </p>
          </motion.div>
        )}

        {phase === "pitch" &&
          isSlotRecruitMode &&
          filledCount < TOTAL_SLOTS && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <p className={`w-full text-center ${TYPO.bodySm} text-gray-400`}>
              Tap an empty position on the team sheet to spin for a team & year
            </p>
            <button
              type="button"
              onClick={handleAutofill}
              disabled={choosing}
              className={`${BTN.base} ${BTN.greenOutlineSm} px-6`}
            >
              Auto Fill Squad
            </button>
          </div>
        )}

        {phase === "pitch" &&
          filledCount < TOTAL_SLOTS &&
          !superSamHallasMode &&
          !isDraftMode &&
          !isSlotRecruitMode && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleAutofill}
              className={`${BTN.base} ${BTN.greenOutlineSm} px-6`}
            >
              Auto Fill Squad
            </button>
          </div>
        )}

        {phase === "pitch" && filledCount >= TOTAL_SLOTS && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => startTournamentSimulation(squad)}
              className={`${BTN.base} ${BTN.goldOutlineSm} px-6`}
            >
              Simulate Season
            </button>
          </div>
        )}

        <div className="relative mt-4 overflow-x-hidden overflow-y-visible">
          {(phase === "pitch" ||
            phase === "reveal" ||
            phase === "choice" ||
            phase === "placement") && (
            <div
              ref={placementScrollRef}
              className={`pb-2 sm:max-h-none sm:overflow-visible ${
                phase === "choice" || phase === "reveal"
                  ? "overflow-x-hidden overflow-y-visible"
                  : "overflow-x-hidden overflow-y-visible sm:max-h-[min(88vh,900px)] sm:overflow-y-auto"
              }`}
            >
              {phase === "placement" && pendingPlayer && isDraftMode && (
                <DraftPositionPlacement
                  player={pendingPlayer}
                  squad={squad}
                  showRule={draftPickIndex === 0}
                  onPlace={handlePlaceDraftPlayer}
                  disabled={choosing}
                />
              )}
              <RugbyPitch
                squad={squad}
                totalValue={totalValue}
                filledCount={filledCount}
                totalSlots={TOTAL_SLOTS}
                {...TEAM_SHEET_RUGBY_PITCH_PROPS}
                selectedSlot={
                  phase === "pitch" && !isDraftMode
                    ? selectedSlotIndex ?? undefined
                    : undefined
                }
                interactive={
                  !superSamHallasMode &&
                  phase === "pitch" &&
                  !isDraftMode
                }
                onSlotClick={handleSelectSlot}
                dimmed={phase === "choice" || phase === "reveal"}
                lockedSlots={
                  superSamHallasMode
                    ? ALL_SUPER_SAM_SLOT_INDICES
                    : joeMellorMode
                      ? [LOOSE_FORWARD_SLOT_INDEX]
                      : undefined
                }
              />
            </div>
          )}

          {phase === "simulation" && seasonResult && (
            <div className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}>
              <SeasonSimulation
                result={seasonResult}
                onComplete={handleSimulationComplete}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {phase === "reveal" &&
              isSlotRecruitMode &&
              slotRecruitTarget && (
              <RecruitmentSlotReveal
                key={choiceKey}
                target={slotRecruitTarget}
                spinVariant={spinVariant}
                onComplete={handleRevealComplete}
              />
            )}
            {phase === "choice" &&
              isSlotRecruitMode &&
              activeSpinTarget && (
              <motion.div
                key={choiceKey}
                className={MODAL.backdrop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className={`${CARD.panel} ${MODAL.panel} ${MODAL.panelPadding}`}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <SlotTeamYearPicker
                    target={activeSpinTarget}
                    entries={slotRecruitEntries}
                    onSelect={handleSlotTeamYearPick}
                    onBack={handleBackToPitch}
                    onRespin={handleSlotRespin}
                    respinsRemaining={respinsRemaining}
                    maxRespins={MAX_RESPINS_PER_RUN}
                    disabled={choosing}
                  />
                </motion.div>
              </motion.div>
            )}
            {phase === "choice" &&
              !isSlotRecruitMode &&
              currentRound &&
              playerPair && (
              <motion.div
                key={choiceKey}
                className={MODAL.backdrop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className={`${CARD.panel} ${MODAL.panelWide} ${MODAL.panelPadding}`}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  {!isDraftMode && (
                    <button
                      type="button"
                      onClick={handleBackToPitch}
                      disabled={choosing || rerolling}
                      className={`mb-4 ${LINK.subtle} disabled:opacity-40`}
                    >
                      ← Back to team sheet
                    </button>
                  )}
                  <PlayerChoice
                    playerA={playerPair[0]}
                    playerB={playerPair[1]}
                    positionLabel={
                      isDraftMode
                        ? `Pick ${draftPickIndex + 1}`
                        : currentRound.slotLabel
                    }
                    onChoose={handleChoose}
                    onReroll={handleReroll}
                    rerollAvailable={rerollAvailable}
                    rerollsRemaining={rerollsRemaining}
                    disabled={choosing || rerolling}
                    draftMode={isDraftMode}
                    showDraftRule={isDraftMode && draftPickIndex === 0}
                    draftSquad={isDraftMode ? squad : undefined}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {phase !== "review" && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-pitch-700/60 bg-pitch-950/95 px-3 py-2 backdrop-blur-md sm:hidden"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <Link
              href="/"
              onClick={() => playUiClick()}
              className={`${BTN.base} ${BTN.secondary} min-h-[44px] shrink-0 px-3 text-xs`}
            >
              Leave run
            </Link>
            {phase === "pitch" && filledCount < TOTAL_SLOTS && (
              <button
                type="button"
                onClick={handleAutofill}
                disabled={choosing}
                className={`${BTN.base} ${BTN.greenOutlineSm} min-h-[44px] flex-1 px-3 text-xs`}
              >
                Auto Fill
              </button>
            )}
            {phase === "pitch" && filledCount >= TOTAL_SLOTS && (
              <button
                type="button"
                onClick={() => startTournamentSimulation(squad)}
                className={`${BTN.base} ${BTN.goldOutlineSm} min-h-[44px] flex-1 px-3 text-xs`}
              >
                Simulate Season
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "review" &&
        seasonResult &&
        reviewStage === "regular" && (
        <SeasonReview
          squad={squad}
          mode={mode}
          seed={seed}
          difficulty={difficulty}
          joeMellorMode={joeMellorMode}
          superSamHallasMode={superSamHallasMode}
          normalEraMode={normalEraMode}
          seasonResult={seasonResult}
          runRank={runRank}
          submittedOnline={submittedOnline}
          clubFundsPayout={clubFundsPayout}
          onContinuePlayoffs={handleContinuePlayoffs}
          onFinalizeSeason={handleFinalizeSeason}
          onPlayAgain={resetRun}
          onClose={() => setPhase("pitch")}
          onReturnHome={resetRun}
        />
      )}

      {phase === "review" &&
        reviewStage === "playoffs" &&
        playoffBracketState &&
        seasonResult && (
        <PlayoffBracket
          squad={squad}
          seed={seed}
          leagueTable={buildLeagueTable(seasonResult, seed)}
          leaguePosition={
            playoffBracketState.leaguePosition ??
            seasonResult.leaguePosition
          }
          initialState={playoffBracketState}
          onComplete={handlePlayoffBracketComplete}
        />
      )}

      {phase === "review" &&
        seasonResult &&
        seasonResult.playoffResult &&
        reviewStage === "playoffFinal" && (
        <PlayoffReview
          squad={squad}
          seasonResult={seasonResult}
          playoffResult={seasonResult.playoffResult}
          playoffBracketState={completedPlayoffBracketState}
          playoffFundsPayout={playoffFundsPayout}
          clubFundsPayout={clubFundsPayout}
          onFinalizeRun={handleFinalizePlayoffRun}
          onPlayAgain={handlePlayoffReviewDone}
          onClose={() => setPhase("pitch")}
          onReturnHome={resetRun}
        />
      )}
      </div>
    </div>
  );
}
