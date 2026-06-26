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
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
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
import { getAverageSquadRating } from "@/lib/squad-analysis";
import {
  playJoeMellorActivate,
  playSuperSamHallasActivate,
  playModeChallengeCupStart,
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
} from "@/lib/sound";
import { PlayerChoice } from "./PlayerChoice";
import { RecruitmentSlotReveal } from "./RecruitmentSlotReveal";
import { SlotTeamYearPicker } from "./SlotTeamYearPicker";
import { RugbyPitch } from "./RugbyPitch";
import { PlayoffReview } from "./PlayoffReview";
import { PlayoffBracket } from "./PlayoffBracket";
import { SeasonReview } from "./SeasonReview";
import { SeasonSimulation } from "./SeasonSimulation";
import { ChallengeCupReview } from "./ChallengeCupReview";
import { ChallengeCupBracket } from "./ChallengeCupBracket";
import { ChallengeCupClubSelect } from "./ChallengeCupClubSelect";
import { MatchdayScoreboard } from "./MatchdayScoreboard";
import { HardModeBadge } from "./HardModeBadge";
import { ClubHeaderBar } from "./ClubBadge";
import { GuestNotice } from "./GuestNotice";
import { DraftPositionPlacement } from "./DraftPositionPlacement";
import { LINK, BTN, CARD, SPACING } from "@/lib/ui/design-system";
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
  const isChallengeCup = mode === "CHALLENGE_CUP";
  const isDraftMode = mode === "DRAFT";
  const isSlotRecruitMode = mode === "CLASSIC" && !isChallengeCup;
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<GamePhase>(
    isChallengeCup ? "clubSelect" : "pitch"
  );
  const [cupClub, setCupClub] = useState<string | null>(null);
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
  const [cupResult, setCupResult] = useState<ChallengeCupResult | null>(null);
  const [runRank, setRunRank] = useState<number | undefined>();
  const [cupRankingResult, setCupRankingResult] = useState<
    CupRunRankingResult | undefined
  >();
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
  const modeSoundPlayed = useRef(false);
  const revealSoundKey = useRef<string | null>(null);
  const placementScrollRef = useRef<HTMLDivElement>(null);
  const lastScrolledPlayerIdRef = useRef<string | null>(null);

  const isHardMode = difficulty === "HARD";
  const recruitmentOptions = useMemo(
    () => ({
      hardMode: isHardMode,
      draftMode: isDraftMode,
      clubFilter: isChallengeCup && cupClub ? cupClub : undefined,
    }),
    [isHardMode, isDraftMode, isChallengeCup, cupClub]
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
      isHardMode ||
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
    isHardMode,
    joeMellorMode,
    superSamHallasMode,
    spinVariant,
  ]);

  useEffect(() => {
    if (isChallengeCup && !cupClub) return;
    if (superSamHallasMode) {
      setSlotOffers(new Map());
      setDraftPickIndex(0);
      setSpinPickIndex(0);
      setPendingPlayer(null);
      setDiscardedPlayerIds(new Set());
      setRerollsRemaining(isHardMode ? 0 : MAX_REROLLS_PER_RUN);
      setRerollsThisRun(0);
      rerollsThisRunRef.current = 0;
      return;
    }

    const lockedIds = joeMellorMode ? [JOE_MELLOR_GOAT_ID] : [];

    setSlotOffers(
      isDraftMode
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
    setRerollsRemaining(isHardMode ? 0 : MAX_REROLLS_PER_RUN);
    setRerollsThisRun(0);
    rerollsThisRunRef.current = 0;
  }, [
    seed,
    joeMellorMode,
    superSamHallasMode,
    recruitmentOptions,
    isChallengeCup,
    cupClub,
    isHardMode,
    isDraftMode,
  ]);

  useEffect(() => {
    if (modeSoundPlayed.current) return;
    modeSoundPlayed.current = true;
    if (superSamHallasMode) {
      playSuperSamHallasActivate();
    } else if (joeMellorMode) {
      playJoeMellorActivate();
    } else if (isChallengeCup) {
      playModeChallengeCupStart();
    } else if (isDraftMode) {
      playModeDraftStart(difficulty);
    } else {
      playModeClassicStart(difficulty);
    }
  }, [superSamHallasMode, joeMellorMode, isChallengeCup, isDraftMode, difficulty]);

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
    if (!isDraftMode || superSamHallasMode || isChallengeCup) return;
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
    isChallengeCup,
    draftPickIndex,
    squad,
    seed,
    slotOffers,
    joeMellorMode,
    recruitmentOptions,
  ]);

  useEffect(() => {
    if (!isDraftMode || superSamHallasMode || isChallengeCup) return;
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
    isChallengeCup,
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
          !isHardMode &&
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
    isHardMode,
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
    !isHardMode &&
    !isSlotRecruitMode &&
    activeOfferKey !== null &&
    rerollsRemaining > 0 &&
    phase === "choice";

  const resetRun = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase(isChallengeCup ? "clubSelect" : "pitch");
    setCupClub(null);
    setSelectedSlotIndex(null);
    setSlotRecruitTarget(null);
    setActiveSpinTarget(null);
    setSquad(createStartingSquad({ joeMellorMode, superSamHallasMode }));
    setSeasonResult(null);
    setCupResult(null);
    setRunRank(undefined);
    setCupRankingResult(undefined);
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
  }, [joeMellorMode, superSamHallasMode, isChallengeCup]);

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
        const result = simulateSeason(finalSquad, seed, {
          draftMode: isDraftMode,
          currentSeasonOnly: !normalEraMode,
        });
        setSeasonResult(result);
        setCupResult(null);
        setPhase("simulation");
        setReviewStage("regular");
        recordedRef.current = false;
        fundsAwardedRef.current = false;
      }
    },
    [
      runId,
      mode,
      seed,
      difficulty,
      joeMellorMode,
      superSamHallasMode,
      isChallengeCup,
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
          cupResult: null,
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
    if (isChallengeCup || joeMellorMode || superSamHallasMode) return;
    finalizeRegularSeason(seasonResult, squad);
  }, [
    phase,
    reviewStage,
    seasonResult,
    squad,
    isChallengeCup,
    joeMellorMode,
    superSamHallasMode,
    finalizeRegularSeason,
  ]);

  useEffect(() => {
    if (phase !== "review" || reviewStage !== "playoffFinal" || !seasonResult) {
      return;
    }
    if (isChallengeCup || joeMellorMode || superSamHallasMode) return;
    const playoff = playoffResultRef.current ?? seasonResult.playoffResult;
    if (!playoff) return;
    finalizePlayoffRun({ ...seasonResult, playoffResult: playoff }, squad);
  }, [
    phase,
    reviewStage,
    seasonResult,
    squad,
    isChallengeCup,
    joeMellorMode,
    superSamHallasMode,
    finalizePlayoffRun,
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
            cupResult: null,
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
        !isHardMode &&
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
      if (!target) return;

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
      isHardMode,
    ]
  );

  const handleSlotRespin = useCallback(() => {
    if (
      isHardMode ||
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
      !isHardMode &&
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
    if (!target) return;

    playReroll();
    setRespinsRemaining((n) => n - 1);
    setSpinPickIndex(nextSpinIndex);
    setActiveSpinTarget(target);
    setSlotRecruitTarget(target);
    setSpinSessionId((id) => id + 1);
    setPhase("reveal");
  }, [
    isHardMode,
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
    isHardMode,
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
    isHardMode,
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
      if (!result) return;
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

  const handleCupComplete = useCallback(
    (result: ChallengeCupResult) => {
      setCupResult({
        ...result,
        userTeamYearId: cupClub ?? result.userClub,
      });

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
          superSamHallasMode,
          challengeCupMode: true,
          seasonWins: result.wins,
          seasonLosses: result.losses,
          cupFinish: result.finish,
          cupWon: result.isWinner,
          averageSquadRating: getAverageSquadRating(squad),
          rerollsUsed: rerollsThisRunRef.current,
          matchResults: result.fixtures.map((fixture) => fixture.result),
          cupTeam: cupClub ?? result.userClub,
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
      superSamHallasMode,
      cupClub,
    ]
  );

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
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="stadium-lights pointer-events-none fixed inset-0" />

      {(title || subtitle || isHardMode) && (
        <div className="relative mx-auto max-w-6xl px-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {title && (
              <h1 className="font-display text-lg font-bold text-white">{title}</h1>
            )}
            {isHardMode && <HardModeBadge />}
          </div>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
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

        {superSamHallasMode && phase !== "clubSelect" && phase !== "review" && (
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

        {joeMellorMode && !superSamHallasMode && phase !== "clubSelect" && phase !== "review" && (
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

        {isChallengeCup && cupClub && phase !== "clubSelect" && (
          <motion.div
            className={`mt-4 overflow-hidden ${CARD.base} border-accent-green/40 bg-accent-green/10`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ClubHeaderBar club={cupClub} size="md" thick />
            <div className="px-4 py-3 text-center">
              <p className={`${TYPO.sectionTitle} text-accent-green`}>
                Challenge Cup — {cupClub}
              </p>
              <p className={`mt-1 ${TYPO.bodySm}`}>
                Club-only draft · Single elimination knockout tournament
              </p>
            </div>
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
          {phase === "clubSelect" && isChallengeCup && (
            <ChallengeCupClubSelect
              seed={seed}
              onSelect={handleCupClubSelected}
            />
          )}

          {(phase === "pitch" ||
            phase === "reveal" ||
            phase === "choice" ||
            phase === "placement") && (
            <div
              ref={placementScrollRef}
              className={`pb-2 sm:max-h-none sm:overflow-visible ${
                phase === "choice" || phase === "reveal"
                  ? "overflow-x-hidden overflow-y-visible"
                  : "max-h-[min(88vh,900px)] overflow-x-hidden overflow-y-auto"
              }`}
            >
              {phase === "placement" && pendingPlayer && isDraftMode && (
                <DraftPositionPlacement
                  player={pendingPlayer}
                  squad={squad}
                  hardMode={isHardMode}
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
                selectedSlot={
                  phase === "pitch" && !isDraftMode
                    ? selectedSlotIndex ?? undefined
                    : undefined
                }
                hardMode={isHardMode}
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

          {phase === "simulation" && isChallengeCup && !cupResult && (
            <div className={`${CARD.panel} mt-4 p-2 sm:p-4`}>
              <ChallengeCupBracket
                squad={squad}
                seed={seed}
                userClub={cupClub!}
                onComplete={handleCupComplete}
              />
            </div>
          )}

          {phase === "simulation" && seasonResult && !isChallengeCup && (
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
                className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className={`${CARD.panel} max-h-[92vh] w-full max-w-3xl overflow-y-auto overflow-x-hidden p-3 sm:p-6`}
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
                    onRespin={!isHardMode ? handleSlotRespin : undefined}
                    respinsRemaining={!isHardMode ? respinsRemaining : 0}
                    maxRespins={MAX_RESPINS_PER_RUN}
                    disabled={choosing}
                    hardMode={isHardMode}
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
                className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className={`${CARD.panel} max-h-[92vh] w-full max-w-4xl overflow-y-auto overflow-x-hidden p-2 sm:p-8`}
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
                    hardMode={isHardMode}
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

      {phase === "review" && cupResult && isChallengeCup && (
        <ChallengeCupReview
          squad={squad}
          cupResult={cupResult}
          seed={seed}
          difficulty={difficulty}
          joeMellorMode={joeMellorMode}
          superSamHallasMode={superSamHallasMode}
          cupRankingResult={cupRankingResult}
          submittedOnline={submittedOnline}
          clubFundsPayout={clubFundsPayout}
          onPlayAgain={resetRun}
          onClose={() => setPhase(isChallengeCup ? "clubSelect" : "pitch")}
          onReturnHome={resetRun}
        />
      )}

      {phase === "review" &&
        seasonResult &&
        !isChallengeCup &&
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
          isHardMode={isHardMode}
          onFinalizeRun={handleFinalizePlayoffRun}
          onPlayAgain={handlePlayoffReviewDone}
          onClose={() => setPhase("pitch")}
          onReturnHome={resetRun}
        />
      )}
    </div>
  );
}
