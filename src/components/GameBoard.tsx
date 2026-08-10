"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearStaleBodyScrollLocks } from "@/lib/ui/document-page-scroll";
import { recordShellMount } from "@/lib/ui/mount-diagnostics";
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
import { getAverageSquadRating } from "@/lib/squad-analysis";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { mergeClubFundsPayouts } from "@/lib/club-funds";
import {
  getDailyChallengeLeagueRunId,
  getDailyChallengePlayoffRunId,
  getDailyChallengeScenario,
  markDailyChallengeLeagueLeaders,
  markDailyChallengePlayoffTitle,
} from "@/lib/daily-challenge";
import {
  awardClubFundsForRun,
  awardClubFundsLines,
} from "@/lib/storage/club-funds";
import { recordCompletedRun, recordPlayoffCompletion } from "@/lib/storage/run";
import { triggerQuickSeasonAchievements } from "@/lib/achievements/achievementTriggers";
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
  playBoostSuccess,
  playBoostFailed,
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
import { LINK, BTN, CARD, SPACING, MODAL, MOBILE } from "@/lib/ui/design-system";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { uiLayerClass } from "@/lib/ui/layers";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "@/components/ui/GameButton";
import { StickyActionBar } from "@/components/ui/MobileLayout";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import {
  generateSlotTeamYearTargetForSlot,
  autofillSlotRecruitSquad,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotTeamYearPlayers,
} from "@/lib/game/slot-team-year-pick";
import {
  boostFailureNotice,
  boostedFirstPickStatusLines,
  buildBoostedFirstPickPlan,
  buildBoostedSpinPlan,
  clearBoostedFirstPickPlan,
  isActiveBoostedFirstPick,
  loadBoostedFirstPickPlan,
  markBoostedFirstPickChoicesReady,
  markBoostedFirstPickFulfilled,
  markBoostedFirstPickSpinning,
  markBoostedSpinPlanConsumed,
  markBoostedSpinPlanPlayersGenerated,
  markBoostedSpinPlanTeamSpun,
  persistBoostedFirstPickPlan,
  resolveBoostedSpinPlanPlayers,
  slotRevealTargetFromBoostedPlan,
  type BoostedSpinPlan,
  type QuickModeBoostedFirstPickPlan,
} from "@/lib/game/boosted-spin-plan";
import { pickLegendSpinSlotIndex } from "@/lib/game/legend-spin";
import { getPlayerTeamYearIds } from "@/lib/game/team-year-pools";
import type { SpinPoolVariant } from "@/lib/game/player-pool-eligibility";
import { EraRatingExplanation } from "./EraRatingExplanation";
import { CurrentRatingExplanation } from "./CurrentRatingExplanation";
import { QuickModePreGameBoostSetup } from "./QuickModePreGameBoostSetup";
import { MobileStepIndicator } from "@/components/ui/MobileStepIndicator";
import {
  armBoostForGame,
  cancelArmedBoost,
  clearArmedBoost,
  tryConsumeBoostFromInventory,
} from "@/lib/boosts/boostInventory";
import type { GameBoostId } from "@/lib/boosts/boostDefinitions";
import { getBoostDefinition } from "@/lib/boosts/boostDefinitions";
import {
  isQmSelectionBoostAllowedInMode,
  selectionHasBoostedPlayer,
} from "@/lib/boosts/applyQuickModeBoost";
import { validateQuickModeSelectionBoost } from "@/lib/boosts/validateBoost";
import {
  armPreGameBoost,
  createUnselectedPreGameBoost,
  isPreGameBoostPending,
  isPreGameBoostReady,
  QUICK_MODE_PRE_GAME_BOOST_VERSION,
  type QuickModePreGameBoostState,
} from "@/lib/game/quick-mode-pregame-boost";

interface GameBoardProps {
  mode: GameMode;
  difficulty: GameDifficulty;
  title?: string;
  subtitle?: string;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  /** Normal Mode: false = Current (2026 only), true = Era team-year pools. */
  normalEraMode?: boolean;
  /** Unique daily scenario (forced opponent league). */
  dailyChallengeMode?: boolean;
}

const QUICK_MODE_STEPS = [
  "Mode",
  "Spin",
  "Choose",
  "Squad",
  "Match",
  "Result",
] as const;

function getQuickModeStepIndex(
  phase: GamePhase,
  preGameReady: boolean
): number {
  if (!preGameReady) return 0;
  switch (phase) {
    case "reveal":
      return 1;
    case "choice":
      return 2;
    case "pitch":
    case "placement":
      return 3;
    case "simulation":
      return 4;
    case "review":
      return 5;
    default:
      return 3;
  }
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
  dailyChallengeMode = false,
}: GameBoardProps) {
  const spinVariant: SpinPoolVariant = normalEraMode ? "era" : "current";
  const isDraftMode = mode === "DRAFT";
  const dailyScenario = dailyChallengeMode
    ? getDailyChallengeScenario()
    : null;
  /** Daily + special modes: no inventory boosts (fair shared seed / fixed squad). */
  const skipPreGameBoosts =
    dailyChallengeMode || joeMellorMode || superSamHallasMode;
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
  const [selectionBoostsUsedThisRun, setSelectionBoostsUsedThisRun] =
    useState(0);
  const [usedBoostThisRun, setUsedBoostThisRun] = useState(false);
  const [boostNotice, setBoostNotice] = useState<string | null>(null);
  const [slotBoostGuaranteeId, setSlotBoostGuaranteeId] = useState<
    "qm-90-plus-player" | "qm-goat-hall-of-fame" | null
  >(null);
  const [boostedSpinPlan, setBoostedSpinPlan] =
    useState<BoostedSpinPlan | null>(null);
  const [boostedFirstPick, setBoostedFirstPick] =
    useState<QuickModeBoostedFirstPickPlan | null>(null);
  const preGameBoostUsageIdRef = useRef<string | null>(null);
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
      /** Stable for the run so first-pick hydration can remount safely. */
      runId: `run-${s}`,
    };
  }, [runKey]);

  // Sync init — avoid first-frame boost ↔ pitch flash (Daily/Joe/Super Sam skip boost).
  const [preGameBoost, setPreGameBoost] =
    useState<QuickModePreGameBoostState>(() =>
      skipPreGameBoosts
        ? armPreGameBoost(runId, null)
        : createUnselectedPreGameBoost(runId)
    );

  useEffect(() => {
    recordShellMount("qm-shell");
  }, []);

  useEffect(() => {
    if (skipPreGameBoosts) {
      clearBoostedFirstPickPlan();
      setBoostedFirstPick(null);
      setBoostedSpinPlan(null);
      setSlotBoostGuaranteeId(null);
      setBoostNotice(null);
      setSelectionBoostsUsedThisRun(0);
      setUsedBoostThisRun(false);
      preGameBoostUsageIdRef.current = null;
      setPreGameBoost(armPreGameBoost(runId, null));
      return;
    }
    const hydrated = loadBoostedFirstPickPlan(runId);
    if (hydrated && isActiveBoostedFirstPick(hydrated)) {
      const target = slotRevealTargetFromBoostedPlan(hydrated.spinPlan);
      if (target) {
        const usageId = `qm-pre-${hydrated.boostId}-${runId}`;
        preGameBoostUsageIdRef.current = usageId;
        armBoostForGame({
          id: usageId,
          boostId: hydrated.boostId,
          gameSaveId: runId,
          mode,
          status: "armed",
          armedAt: new Date().toISOString(),
        });
        setPreGameBoost({
          selectedBoostId: hydrated.boostId,
          status: "applied",
          runId,
          version: QUICK_MODE_PRE_GAME_BOOST_VERSION,
        });
        setSlotBoostGuaranteeId(hydrated.boostId);
        setBoostedFirstPick(hydrated);
        setBoostedSpinPlan(
          hydrated.status === "choices-ready"
            ? markBoostedSpinPlanPlayersGenerated(hydrated.spinPlan)
            : markBoostedSpinPlanTeamSpun(hydrated.spinPlan)
        );
        setSelectedSlotIndex(hydrated.selectedSlotIndex);
        setActiveSpinTarget(target);
        setSlotRecruitTarget(target);
        setSpinSessionId((id) => id + 1);
        setPhase(
          hydrated.status === "choices-ready" ? "choice" : "reveal"
        );
        setBoostNotice(
          hydrated.boostId === "qm-90-plus-player"
            ? "90+ player guaranteed in this selection."
            : "Legend player guaranteed in this selection."
        );
        return;
      }
    }

    setPreGameBoost(createUnselectedPreGameBoost(runId));
    preGameBoostUsageIdRef.current = null;
    setSlotBoostGuaranteeId(null);
    setBoostedSpinPlan(null);
    setBoostedFirstPick(null);
    setBoostNotice(null);
    setSelectionBoostsUsedThisRun(0);
    setUsedBoostThisRun(false);
  }, [runId, skipPreGameBoosts, mode]);

  const fulfillBoostedFirstPick = useCallback(() => {
    setBoostedFirstPick((prev) => {
      if (!prev || !isActiveBoostedFirstPick(prev)) return prev;
      const next = markBoostedFirstPickFulfilled(prev);
      persistBoostedFirstPickPlan(next);
      clearBoostedFirstPickPlan();
      return next;
    });
  }, []);

  const handlePreGameBoostConfirm = useCallback(
    (boostId: GameBoostId | null) => {
      if (skipPreGameBoosts) {
        clearBoostedFirstPickPlan();
        preGameBoostUsageIdRef.current = null;
        setSlotBoostGuaranteeId(null);
        setBoostedSpinPlan(null);
        setBoostedFirstPick(null);
        setBoostNotice(null);
        setPreGameBoost(armPreGameBoost(runId, null));
        return;
      }

      let resolvedBoostId = boostId;
      if (
        resolvedBoostId &&
        !isQmSelectionBoostAllowedInMode(resolvedBoostId, normalEraMode)
      ) {
        setBoostNotice(
          "Legend Player boost can only be used in Era Mode."
        );
        resolvedBoostId = null;
      }

      if (
        resolvedBoostId !== "qm-90-plus-player" &&
        resolvedBoostId !== "qm-goat-hall-of-fame"
      ) {
        clearBoostedFirstPickPlan();
        preGameBoostUsageIdRef.current = null;
        setSlotBoostGuaranteeId(null);
        setBoostedSpinPlan(null);
        setBoostedFirstPick(null);
        setBoostNotice(null);
        setPreGameBoost(armPreGameBoost(runId, null));
        return;
      }

      const usedIds = new Set(
        squad.filter((s) => s.player).map((s) => s.player!.id)
      );
      const firstPick = buildBoostedFirstPickPlan({
        runId,
        seed,
        spinIndex: spinPickIndex + selectionBoostsUsedThisRun + 17,
        boostId: resolvedBoostId,
        usedIds,
        squad,
        usedTeamYearKeys,
        options: {
          spinVariant,
          prepareSeed: seed,
          legendSpinSlotIndex,
          legendSpinUsed,
        },
      });

      if (firstPick.status === "failed" || !firstPick.spinPlan || firstPick.spinPlan.status === "failed") {
        clearBoostedFirstPickPlan();
        preGameBoostUsageIdRef.current = null;
        setSlotBoostGuaranteeId(null);
        setBoostedSpinPlan(null);
        setBoostedFirstPick(null);
        setPreGameBoost(createUnselectedPreGameBoost(runId));
        setBoostNotice(
          firstPick.failureReason ??
            boostFailureNotice(
              resolvedBoostId,
              "No valid boosted route for this run — boost not used."
            )
        );
        return;
      }

      const target = slotRevealTargetFromBoostedPlan(firstPick.spinPlan);
      if (!target) {
        clearBoostedFirstPickPlan();
        setPreGameBoost(createUnselectedPreGameBoost(runId));
        setBoostNotice(
          boostFailureNotice(
            resolvedBoostId,
            "No valid boosted route for this run — boost not used."
          )
        );
        return;
      }

      const usageId = `qm-pre-${resolvedBoostId}-${runId}`;
      preGameBoostUsageIdRef.current = usageId;
      armBoostForGame({
        id: usageId,
        boostId: resolvedBoostId,
        gameSaveId: runId,
        mode,
        status: "armed",
        armedAt: new Date().toISOString(),
      });

      const spinning = markBoostedFirstPickSpinning(firstPick);
      persistBoostedFirstPickPlan(spinning);
      setBoostedFirstPick(spinning);
      setBoostedSpinPlan(spinning.spinPlan);
      setSlotBoostGuaranteeId(resolvedBoostId);
      setPreGameBoost({
        ...armPreGameBoost(runId, resolvedBoostId),
        status: "applied",
      });
      setBoostNotice(
        resolvedBoostId === "qm-90-plus-player"
          ? "90+ player guaranteed in this selection."
          : "Legend player guaranteed in this selection."
      );

      playPositionSelect();
      setRecruitNotice(null);
      setPendingPlayer(null);
      lastScrolledPlayerIdRef.current = null;
      setSelectedSlotIndex(spinning.selectedSlotIndex);
      setActiveSpinTarget(target);
      setSlotRecruitTarget(target);
      setSpinSessionId((id) => id + 1);
      setPhase("reveal");
    },
    [
      runId,
      mode,
      normalEraMode,
      skipPreGameBoosts,
      seed,
      spinPickIndex,
      selectionBoostsUsedThisRun,
      squad,
      usedTeamYearKeys,
      spinVariant,
      legendSpinSlotIndex,
      legendSpinUsed,
    ]
  );

  const consumeArmedPreGameBoost = useCallback(
    (boostId: "qm-90-plus-player" | "qm-goat-hall-of-fame") => {
      const usageId = preGameBoostUsageIdRef.current ?? `qm-pre-${boostId}-${runId}`;
      const consumed = tryConsumeBoostFromInventory(boostId, {
        id: usageId,
        boostId,
        gameSaveId: runId,
        mode,
        status: "consumed",
        timestamp: new Date().toISOString(),
      });
      if (!consumed.success) {
        setBoostNotice(consumed.reason ?? "Could not consume boost.");
        setPreGameBoost((prev) =>
          prev ? { ...prev, status: "failed" } : prev
        );
        playBoostFailed();
        return false;
      }
      playBoostSuccess();
      setSelectionBoostsUsedThisRun((n) => n + 1);
      setUsedBoostThisRun(true);
      setSlotBoostGuaranteeId(null);
      setBoostedSpinPlan(null);
      fulfillBoostedFirstPick();
      setPreGameBoost((prev) =>
        prev ? { ...prev, status: "consumed" } : prev
      );
      setBoostNotice(
        boostId === "qm-90-plus-player"
          ? "90+ boost applied."
          : "Legend boost applied."
      );
      return true;
    },
    [runId, mode, fulfillBoostedFirstPick]
  );

  /** Keep inventory; drop the armed guarantee so the run continues normally. */
  const continueWithoutArmedBoost = useCallback(() => {
    const boostId = slotBoostGuaranteeId ?? preGameBoost?.selectedBoostId;
    if (boostId === "qm-90-plus-player" || boostId === "qm-goat-hall-of-fame") {
      clearArmedBoost(runId, boostId);
      const usageId = preGameBoostUsageIdRef.current;
      if (usageId) cancelArmedBoost(usageId);
    }
    preGameBoostUsageIdRef.current = null;
    setSlotBoostGuaranteeId(null);
    setBoostedSpinPlan(null);
    fulfillBoostedFirstPick();
    setPreGameBoost((prev) =>
      prev
        ? { ...prev, selectedBoostId: null, status: "skipped" }
        : prev
    );
    setBoostNotice(null);
  }, [runId, slotBoostGuaranteeId, preGameBoost?.selectedBoostId, fulfillBoostedFirstPick]);

  /** Return to pre-game boost picker without consuming inventory. */
  const returnToPreGameBoostSelection = useCallback(() => {
    const boostId = slotBoostGuaranteeId ?? preGameBoost?.selectedBoostId;
    if (boostId === "qm-90-plus-player" || boostId === "qm-goat-hall-of-fame") {
      clearArmedBoost(runId, boostId);
      const usageId = preGameBoostUsageIdRef.current;
      if (usageId) cancelArmedBoost(usageId);
    }
    preGameBoostUsageIdRef.current = null;
    setSlotBoostGuaranteeId(null);
    setBoostedSpinPlan(null);
    clearBoostedFirstPickPlan();
    setBoostedFirstPick(null);
    setBoostNotice(null);
    setSelectedSlotIndex(null);
    setActiveSpinTarget(null);
    setSlotRecruitTarget(null);
    setPhase("pitch");
    setPreGameBoost(
      skipPreGameBoosts
        ? armPreGameBoost(runId, null)
        : createUnselectedPreGameBoost(runId)
    );
  }, [
    runId,
    skipPreGameBoosts,
    slotBoostGuaranteeId,
    preGameBoost?.selectedBoostId,
  ]);

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
  const averageSquadRating = getAverageSquadRating(squad);

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

    if (
      boostedSpinPlan &&
      boostedSpinPlan.status !== "failed" &&
      boostedSpinPlan.status !== "consumed" &&
      boostedSpinPlan.selectedTeamId === activeSpinTarget.teamYearKey &&
      boostedSpinPlan.slotIndex === selectedSlotIndex &&
      boostedSpinPlan.playerChoiceIds.length > 0
    ) {
      return resolveBoostedSpinPlanPlayers(
        boostedSpinPlan,
        activeSpinTarget,
        signedPlayerIds,
        squad,
        selectedSlotIndex,
        seed
      );
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
        selectionBoostId: slotBoostGuaranteeId ?? undefined,
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
    slotBoostGuaranteeId,
    boostedSpinPlan,
  ]);

  useEffect(() => {
    if (
      !boostedSpinPlan ||
      boostedSpinPlan.status === "failed" ||
      boostedSpinPlan.status === "consumed" ||
      !activeSpinTarget ||
      selectedSlotIndex === null
    ) {
      return;
    }
    if (boostedSpinPlan.selectedTeamId !== activeSpinTarget.teamYearKey) {
      return;
    }
    if (slotRecruitEntries.length > 0) return;

    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Boosted spin plan produced empty player choices after a valid plan",
        boostedSpinPlan
      );
    }
    setBoostNotice(
      boostFailureNotice(
        boostedSpinPlan.boostId,
        "Boost held for a later pick."
      )
    );
    setBoostedSpinPlan((prev) =>
      prev
        ? {
            ...prev,
            status: "failed",
            failureReason:
              "Boost held for a later pick.",
          }
        : prev
    );
    setSlotRecruitTarget(null);
    setActiveSpinTarget(null);
    setSelectedSlotIndex(null);
    setPhase("pitch");
  }, [
    boostedSpinPlan,
    activeSpinTarget,
    selectedSlotIndex,
    slotRecruitEntries.length,
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
    clearBoostedFirstPickPlan();
    setBoostedFirstPick(null);
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
    setSelectionBoostsUsedThisRun(0);
    setUsedBoostThisRun(false);
    setBoostNotice(null);
    setSlotBoostGuaranteeId(null);
    setBoostedSpinPlan(null);
    modeSoundPlayed.current = false;
  }, [joeMellorMode, superSamHallasMode]);

  const startTournamentSimulation = useCallback(
    (finalSquad: SquadSlot[]) => {
      playSeasonStart();

      const result = simulateSeason(finalSquad, seed, {
        draftMode: isDraftMode,
        currentSeasonOnly: !normalEraMode,
        forceOpponentClub: dailyScenario?.forceOpponentClub,
        forceUndefeated: superSamHallasMode,
        joeMellorMode,
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
      dailyChallengeMode,
      dailyScenario?.forceOpponentClub,
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
          usedBoosts: usedBoostThisRun,
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
          dailyChallengeMode,
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
        let combined: ClubFundsPayoutResult | null = payout;
        if (
          dailyScenario &&
          tablePosition === 1 &&
          mode === "CLASSIC" &&
          !joeMellorMode &&
          !superSamHallasMode
        ) {
          const dailyPayout = awardClubFundsLines(
            getDailyChallengeLeagueRunId(),
            [
              {
                id: "daily-league-leaders",
                label: `Daily${dailyScenario.eraMode ? " Era" : ""}: ${dailyScenario.title} — League Leaders`,
                amount: dailyScenario.leagueLeadersBonus,
              },
            ]
          );
          if (dailyPayout.awarded) {
            markDailyChallengeLeagueLeaders();
          }
          combined = mergeClubFundsPayouts(payout, dailyPayout);
        }
        setClubFundsPayout(combined);
      }

      triggerQuickSeasonAchievements(
        finalSquad,
        {
          wins: result.wins,
          losses: result.losses,
          draws: result.draws ?? 0,
          leaguePosition: tablePosition,
          pointsDifference: result.pointsDifference,
          isPerfect: result.isPerfect,
          squadStrength: result.squadStrength,
          fixtures: result.fixtures,
        },
        {
          joeMellorMode,
          superSamHallasMode,
          normalEraMode,
          dailyChallengeMode,
          madePlayoffs: tablePosition <= 6,
        }
      );
    },
    [
      runId,
      mode,
      seed,
      difficulty,
      joeMellorMode,
      superSamHallasMode,
      normalEraMode,
      usedBoostThisRun,
      dailyScenario,
      dailyChallengeMode,
    ]
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
          usedBoosts: usedBoostThisRun,
          dailyChallengeMode,
        }
      ).then((completed) => {
        setSubmittedOnline(completed.submittedOnline);
        if (completed.nationalRank) setRunRank(completed.nationalRank);
      });

      triggerQuickSeasonAchievements(
        finalSquad,
        {
          wins: result.wins,
          losses: result.losses,
          draws: result.draws ?? 0,
          leaguePosition: tablePosition,
          pointsDifference: result.pointsDifference,
          isPerfect: result.isPerfect,
          squadStrength: result.squadStrength,
          fixtures: result.fixtures,
        },
        {
          joeMellorMode,
          superSamHallasMode,
          normalEraMode,
          dailyChallengeMode,
          madePlayoffs: true,
          playoffWins: playoff.wins,
          playoffLosses: playoff.losses,
          leagueChampion:
            playoff.isChampion ||
            playoff.finish === "Super League Champions",
        }
      );
    },
    [
      runId,
      mode,
      seed,
      difficulty,
      joeMellorMode,
      superSamHallasMode,
      normalEraMode,
      usedBoostThisRun,
      dailyChallengeMode,
    ]
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

  useEffect(() => {
    if (phase !== "review") return;
    // Player selection / spin / achievement / match-detail locks must not
    // survive into document-scrolled Match Review.
    clearStaleBodyScrollLocks();
  }, [phase, reviewStage]);

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
          let combined: ClubFundsPayoutResult | null = payout;
          const wonTitle =
            playoffResult.isChampion === true ||
            playoffResult.finish === "Super League Champions";
          if (
            dailyScenario &&
            wonTitle &&
            mode === "CLASSIC" &&
            !joeMellorMode &&
            !superSamHallasMode
          ) {
            const dailyPayout = awardClubFundsLines(
              getDailyChallengePlayoffRunId(),
              [
                {
                  id: "daily-playoff-title",
                  label: `Daily${dailyScenario.eraMode ? " Era" : ""}: ${dailyScenario.title} — Grand Final`,
                  amount: dailyScenario.playoffTitleBonus,
                },
              ]
            );
            if (dailyPayout.awarded) {
              markDailyChallengePlayoffTitle();
            }
            combined = mergeClubFundsPayouts(payout, dailyPayout);
          }
          setPlayoffFundsPayout(combined);
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
      normalEraMode,
      finalizePlayoffRun,
      dailyScenario,
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

      const boostId = slotBoostGuaranteeId;
      const preGamePending = isPreGameBoostPending(preGameBoost);
      let boostConsumed = false;
      if (
        boostId &&
        preGamePending &&
        selectionHasBoostedPlayer([player], boostId)
      ) {
        boostConsumed = consumeArmedPreGameBoost(boostId);
        if (boostConsumed) {
          setBoostedSpinPlan((prev) =>
            prev ? markBoostedSpinPlanConsumed(prev) : prev
          );
        }
      } else if (isActiveBoostedFirstPick(boostedFirstPick)) {
        // First auto pick completed without consuming (non-matching choice).
        fulfillBoostedFirstPick();
      }

      setSquad(newSquad);
      setPendingPlayer(null);
      setSelectedSlotIndex(null);
      setSlotRecruitTarget(null);
      setActiveSpinTarget(null);
      setBoostedSpinPlan(null);
      if (boostConsumed || !boostId || !preGamePending) {
        setSlotBoostGuaranteeId(null);
        if (boostConsumed) {
          /* notice set by consume helper */
        } else {
          setBoostNotice(null);
        }
      }
      // else: picked a non-boosted player while pre-game boost still pending — keep guarantee

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
      slotBoostGuaranteeId,
      preGameBoost,
      boostedFirstPick,
      consumeArmedPreGameBoost,
      fulfillBoostedFirstPick,
      legendSpinSlotIndex,
      legendSpinUsed,
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
      const armedBoost =
        preGameBoost?.status === "armed" || preGameBoost?.status === "applied"
          ? slotBoostGuaranteeId
          : null;

      let target: SlotRevealTarget | null = null;

      if (armedBoost) {
        const plan = buildBoostedSpinPlan({
          runId,
          seed,
          spinIndex: spinPickIndex + selectionBoostsUsedThisRun + 17,
          boostId: armedBoost,
          usedIds: signedPlayerIds,
          squad,
          slotIndex,
          usedTeamYearKeys,
          options: {
            requireLegendPlayer,
            spinVariant,
            prepareSeed: seed,
          },
        });

        if (plan.status === "failed") {
          setBoostedSpinPlan(plan);
          setBoostNotice(
            boostFailureNotice(armedBoost, plan.failureReason)
          );
          // Keep boost armed/inventory; do not start spin; never fall back.
          return;
        }

        target = slotRevealTargetFromBoostedPlan(plan);
        setBoostedSpinPlan(markBoostedSpinPlanTeamSpun(plan));
        setPreGameBoost((prev) =>
          prev ? { ...prev, status: "applied" } : prev
        );
        setBoostNotice(
          armedBoost === "qm-90-plus-player"
            ? "90+ player guaranteed in this selection."
            : "Legend player guaranteed in this selection."
        );
      } else {
        setBoostedSpinPlan(null);
        target = generateSlotTeamYearTargetForSlot(
          seed,
          spinPickIndex,
          signedPlayerIds,
          squad,
          slotIndex,
          usedTeamYearKeys,
          { requireLegendPlayer, spinVariant }
        );
      }

      if (process.env.NODE_ENV === "development") {
        console.debug(
          `[spin-timing] target-selected: ${(performance.now() - t0).toFixed(1)}ms`,
          target?.teamYearId
        );
      }
      if (!target) {
        setRecruitNotice(
          "No players left for this slot. Try another."
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
      runId,
      spinPickIndex,
      signedPlayerIds,
      usedTeamYearKeys,
      legendSpinUsed,
      legendSpinSlotIndex,
      spinVariant,
      preGameBoost,
      slotBoostGuaranteeId,
      selectionBoostsUsedThisRun,
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
    const armedBoost =
      (preGameBoost?.status === "armed" ||
        preGameBoost?.status === "applied") &&
      slotBoostGuaranteeId
        ? slotBoostGuaranteeId
        : null;

    // Exclude the offer being respinned so we do not land on the same team-year.
    const respinUsedTeamYearKeys = new Set(usedTeamYearKeys);
    if (activeSpinTarget) {
      respinUsedTeamYearKeys.add(activeSpinTarget.teamYearKey);
    }

    let target: SlotRevealTarget | null = null;

    if (armedBoost) {
      const plan = buildBoostedSpinPlan({
        runId,
        seed,
        spinIndex: nextSpinIndex + selectionBoostsUsedThisRun + 17,
        boostId: armedBoost,
        usedIds: signedPlayerIds,
        squad,
        slotIndex: selectedSlotIndex,
        usedTeamYearKeys: respinUsedTeamYearKeys,
        options: {
          requireLegendPlayer,
          spinVariant,
          prepareSeed: seed,
        },
      });

      if (plan.status === "failed") {
        setBoostedSpinPlan(plan);
        setBoostNotice(boostFailureNotice(armedBoost, plan.failureReason));
        // Keep guarantee; do not fall back to unfiltered respin.
        return;
      }

      target = slotRevealTargetFromBoostedPlan(plan);
      setBoostedSpinPlan(markBoostedSpinPlanTeamSpun(plan));
      setBoostNotice(
        armedBoost === "qm-90-plus-player"
          ? "90+ player guaranteed in this selection."
          : "Legend player guaranteed in this selection."
      );
    } else {
      setBoostedSpinPlan(null);
      target = generateSlotTeamYearTargetForSlot(
        seed,
        nextSpinIndex,
        signedPlayerIds,
        squad,
        selectedSlotIndex,
        respinUsedTeamYearKeys,
        { requireLegendPlayer, spinVariant }
      );
    }

    if (!target) {
      setRecruitNotice(
        "No respin left. Sign or pick another slot."
      );
      return;
    }

    setRecruitNotice(null);

    playReroll();
    setRespinsRemaining((n) => n - 1);
    setSpinPickIndex(nextSpinIndex);
    setPendingPlayer(null);
    lastScrolledPlayerIdRef.current = null;
    setActiveSpinTarget(target);
    setSlotRecruitTarget(target);
    // Never clear slotBoostGuaranteeId until the boost is consumed.
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
    runId,
    signedPlayerIds,
    squad,
    usedTeamYearKeys,
    activeSpinTarget,
    legendSpinUsed,
    legendSpinSlotIndex,
    spinVariant,
    preGameBoost,
    slotBoostGuaranteeId,
    selectionBoostsUsedThisRun,
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
    setBoostedSpinPlan((prev) =>
      prev && prev.status === "team-spun"
        ? markBoostedSpinPlanPlayersGenerated(prev)
        : prev
    );
    setBoostedFirstPick((prev) => {
      if (!prev || !isActiveBoostedFirstPick(prev)) return prev;
      const next = markBoostedFirstPickChoicesReady(prev);
      persistBoostedFirstPickPlan(next);
      return next;
    });
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

  const handleActivateQmBoost = useCallback(
    (boostId: GameBoostId) => {
      if (
        joeMellorMode ||
        superSamHallasMode ||
        (boostId !== "qm-90-plus-player" && boostId !== "qm-goat-hall-of-fame")
      ) {
        return;
      }

      const validation = validateQuickModeSelectionBoost(
        boostId,
        runId,
        selectionBoostsUsedThisRun,
        { eraMode: normalEraMode }
      );
      if (!validation.ok) {
        setBoostNotice(validation.reason ?? "Cannot use this boost.");
        return;
      }

      const usageId = `qm-${boostId}-${runId}-${Date.now()}`;
      armBoostForGame({
        id: usageId,
        boostId,
        gameSaveId: runId,
        mode,
        status: "armed",
        armedAt: new Date().toISOString(),
      });

      const fail = (reason: string) => {
        cancelArmedBoost(usageId);
        clearArmedBoost(runId, boostId);
        setBoostNotice(reason);
      };

      if (isDraftMode) {
        if (phase !== "choice" || draftPickIndex === null) {
          fail("Open a player choice before using a selection boost.");
          return;
        }
        const signedIds = squad
          .filter((s) => s.player)
          .map((s) => s.player!.id);
        const lockedIds = joeMellorMode ? [JOE_MELLOR_GOAT_ID] : [];
        const usedIds = collectUsedPlayerIds(
          slotOffers,
          signedIds,
          draftPickIndex,
          recruitmentOptions
        );
        const boostedOpts = {
          ...recruitmentOptions,
          selectionBoostId: boostId,
        };
        const nextRound = currentRound
          ? rerollDraftOffer(
              seed,
              draftPickIndex,
              currentRound,
              squad,
              usedIds,
              discardedPlayerIds,
              collectRecentDraftPositions(slotOffers, draftPickIndex),
              boostedOpts
            )
          : generateDraftOfferForPick(
              seed,
              draftPickIndex,
              squad,
              signedIds,
              lockedIds,
              collectRecentDraftPositions(slotOffers, draftPickIndex),
              boostedOpts
            );

        if (!nextRound) {
          fail(
            boostId === "qm-90-plus-player"
              ? "No eligible 90+ player is available for this selection."
              : "No eligible Legend player is available for this selection."
          );
          return;
        }

        const players = [
          getPlayerById(nextRound.optionA),
          getPlayerById(nextRound.optionB),
        ].filter(Boolean) as import("@/lib/types").Player[];
        if (!selectionHasBoostedPlayer(players, boostId)) {
          fail("Boost failed.");
          return;
        }

        const consumed = tryConsumeBoostFromInventory(boostId, {
          id: usageId,
          boostId,
          gameSaveId: runId,
          mode,
          status: "consumed",
          timestamp: new Date().toISOString(),
        });
        if (!consumed.success) {
          fail(consumed.reason ?? "Could not consume boost.");
          playBoostFailed();
          return;
        }

        playBoostSuccess();
        setSlotOffers((prev) => {
          const next = new Map(prev);
          next.set(draftPickIndex, nextRound);
          return next;
        });
        setSelectionBoostsUsedThisRun((n) => n + 1);
        setUsedBoostThisRun(true);
        setBoostNotice(
          boostId === "qm-90-plus-player"
            ? "90+ player guaranteed in this choice."
            : "Legend player guaranteed in this choice."
        );
        return;
      }

      if (isSlotRecruitMode) {
        if (
          (phase !== "reveal" && phase !== "choice") ||
          selectedSlotIndex === null
        ) {
          fail("Spin and open picks first.");
          return;
        }

        const requireLegendPlayer =
          !legendSpinUsed && legendSpinSlotIndex === selectedSlotIndex;
        const plan = buildBoostedSpinPlan({
          runId,
          seed,
          spinIndex: spinPickIndex + selectionBoostsUsedThisRun + 17,
          boostId,
          usedIds: signedPlayerIds,
          squad,
          slotIndex: selectedSlotIndex,
          usedTeamYearKeys,
          options: {
            requireLegendPlayer,
            spinVariant,
            prepareSeed: seed,
          },
        });

        if (plan.status === "failed") {
          fail(
            plan.failureReason ??
              (boostId === "qm-90-plus-player"
                ? "No eligible 90+ player is available for this slot."
                : "No eligible Legend player is available for this slot.")
          );
          return;
        }

        const target = slotRevealTargetFromBoostedPlan(plan);
        if (!target) {
          fail("Boost failed for this slot.");
          return;
        }

        const preview = resolveBoostedSpinPlanPlayers(
          plan,
          target,
          signedPlayerIds,
          squad,
          selectedSlotIndex,
          seed
        );
        if (
          preview.length === 0 ||
          !selectionHasBoostedPlayer(
            preview.map((e) => e.player),
            boostId
          )
        ) {
          fail("Boost failed for this slot.");
          return;
        }

        const consumed = tryConsumeBoostFromInventory(boostId, {
          id: usageId,
          boostId,
          gameSaveId: runId,
          mode,
          status: "consumed",
          timestamp: new Date().toISOString(),
        });
        if (!consumed.success) {
          fail(consumed.reason ?? "Could not consume boost.");
          playBoostFailed();
          return;
        }

        playBoostSuccess();
        setBoostedSpinPlan(markBoostedSpinPlanPlayersGenerated(plan));
        setActiveSpinTarget(target);
        setSlotRecruitTarget(target);
        setSlotBoostGuaranteeId(boostId);
        setPhase("choice");
        setSelectionBoostsUsedThisRun((n) => n + 1);
        setUsedBoostThisRun(true);
        setBoostNotice(
          boostId === "qm-90-plus-player"
            ? "90+ player guaranteed in this selection."
            : "Legend player guaranteed in this selection."
        );
        return;
      }

      fail("Selection boosts are not available in this mode.");
    },
    [
      joeMellorMode,
      superSamHallasMode,
      runId,
      selectionBoostsUsedThisRun,
      mode,
      normalEraMode,
      isDraftMode,
      isSlotRecruitMode,
      phase,
      draftPickIndex,
      squad,
      slotOffers,
      recruitmentOptions,
      currentRound,
      seed,
      discardedPlayerIds,
      selectedSlotIndex,
      spinPickIndex,
      signedPlayerIds,
      usedTeamYearKeys,
      spinVariant,
      legendSpinUsed,
      legendSpinSlotIndex,
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
    const keepBoost =
      !!slotBoostGuaranteeId &&
      isPreGameBoostPending(preGameBoost);
    setSelectedSlotIndex(null);
    setSlotRecruitTarget(null);
    setActiveSpinTarget(null);
    setPendingPlayer(null);
    setBoostedSpinPlan(null);
    // First-pick auto is done once the user returns to the sheet — later picks
    // use normal position selection (boost may still be armed).
    if (isActiveBoostedFirstPick(boostedFirstPick)) {
      fulfillBoostedFirstPick();
    }
    if (!keepBoost) {
      setSlotBoostGuaranteeId(null);
      setBoostNotice(null);
    } else if (slotBoostGuaranteeId) {
      setPreGameBoost((prev) =>
        prev?.selectedBoostId
          ? { ...prev, status: "armed" }
          : prev
      );
      setBoostNotice(
        slotBoostGuaranteeId === "qm-90-plus-player"
          ? "90+ boost armed for the next eligible selection."
          : "Legend boost armed for the next eligible selection."
      );
    }
    lastScrolledPlayerIdRef.current = null;
    revealSoundKey.current = null;
    setPhase("pitch");
  }, [
    isDraftMode,
    slotBoostGuaranteeId,
    preGameBoost,
    boostedFirstPick,
    fulfillBoostedFirstPick,
  ]);

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
          "Autofill failed — not enough players."
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
    const frame = requestAnimationFrame(() => {
      // Document scroll on mobile; nested rail on desktop — reset the active one only.
      const rail = mainScrollRef.current;
      const railScrolls =
        rail != null && rail.scrollHeight > rail.clientHeight + 1;
      if (railScrolls) {
        rail.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, reviewStage]);

  const playerPair =
    !isSlotRecruitMode &&
    (phase === "choice" || phase === "reveal") &&
    currentRound
      ? getRoundPlayers(currentRound)
      : null;

  const choiceKey =
    isSlotRecruitMode && activeSpinTarget
      ? `${runKey}-spin-${spinSessionId}-${spinVariant}-${activeSpinTarget.teamYearId}`
      : activeOfferKey !== null
        ? `${runKey}-pick-${activeOfferKey}-${currentRound?.optionA}-${currentRound?.optionB}`
        : "";

  const revealKey = `reveal-${choiceKey}`;
  const slotChoiceKey = `choice-${choiceKey}`;

  const isReviewPhase = phase === "review";
  const preGameReady = isPreGameBoostReady(preGameBoost);
  const quickModeStepIndex = getQuickModeStepIndex(phase, preGameReady);
  const hideChromeForOverlay = phase === "reveal";
  const hideActionBar =
    phase === "reveal" || phase === "choice" || phase === "simulation";
  const firstPickStatus = boostedFirstPickStatusLines(boostedFirstPick);
  const spinBoostStatus =
    phase === "reveal" && firstPickStatus
      ? firstPickStatus.headline
      : phase === "reveal" &&
          slotBoostGuaranteeId &&
          isPreGameBoostPending(preGameBoost)
        ? getBoostDefinition(slotBoostGuaranteeId)?.name ?? "Boost armed"
        : null;
  const spinBoostDetail =
    phase === "reveal" && firstPickStatus ? firstPickStatus.detail : null;

  return (
    <div
      className={`matchday-arena arena-surface relative flex flex-1 flex-col ${
        isReviewPhase ? "min-h-0" : "min-h-full lg:desktop-page-fit"
      }`}
    >
      <div
        ref={mainScrollRef}
        className={`game-page relative flex flex-col overflow-x-hidden ${
          isReviewPhase
            ? "overflow-y-visible py-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-4"
            : `py-4 ${MOBILE.actionBarPad} sm:py-5 sm:pb-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:desktop-scroll-rail lg:pb-4 ${
                !preGameReady ? "min-h-0 flex-1" : ""
              }`
        }`}
      >
      {!isReviewPhase && (title || subtitle || dailyScenario) && (
        <div className="pt-1 text-center lg:pt-0 sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            {title && (
              <h1 className={`${TYPO.viewTitle} text-lg sm:text-xl`}>
                {dailyScenario
                  ? `Daily${dailyScenario.eraMode ? " Era" : ""} · All ${dailyScenario.forceOpponentClub}`
                  : title}
              </h1>
            )}
          </div>
          {dailyScenario ? (
            <p className="text-sm text-gray-400">
              League Leaders + Grand Final bonuses
            </p>
          ) : subtitle ? (
            <p className="text-sm text-gray-400">{subtitle}</p>
          ) : null}
        </div>
      )}

      {!isReviewPhase && (
      <div
        className={
          hideChromeForOverlay
            ? "invisible pointer-events-none select-none"
            : !preGameReady
              ? "flex min-h-0 flex-1 flex-col"
              : undefined
        }
      >
          <GuestNotice variant="play" />

        <div className="mb-3 sm:mb-4">
          <MobileStepIndicator
            steps={[...QUICK_MODE_STEPS]}
            currentIndex={quickModeStepIndex}
          />
        </div>

        {!preGameReady ? (
          <div className="flex flex-1 flex-col justify-center">
            <QuickModePreGameBoostSetup
              runId={runId}
              eraMode={normalEraMode}
              notice={boostNotice}
              onConfirm={handlePreGameBoostConfirm}
            />
          </div>
        ) : (
          <>
        <MatchdayScoreboard
            filledCount={filledCount}
            totalSlots={TOTAL_SLOTS}
            averageSquadRating={averageSquadRating}
            hardMode={difficulty === "HARD"}
          />

        {recruitNotice && phase === "pitch" && (
          <p
            className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            role="status"
          >
            {recruitNotice}
          </p>
        )}

        {boostedSpinPlan?.status === "failed" &&
          phase === "pitch" &&
          (slotBoostGuaranteeId != null ||
            preGameBoost?.status === "armed" ||
            preGameBoost?.status === "applied") && (
          <div
            className="mt-3 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3"
            role="alert"
          >
            <p className="text-sm text-amber-100">
              {boostNotice ??
                boostedSpinPlan.failureReason ??
                "No valid boosted route for this position."}
            </p>
            <p className={`${TYPO.bodySm} text-amber-100/80`}>
              Try another position, skip the boost, or go back. Boost unused.
            </p>
            <div className="flex flex-wrap gap-2">
              <GameButton
                variant="secondary"
                size="sm"
                fullWidth={false}
                onClick={() => {
                  setBoostedSpinPlan(null);
                  setBoostNotice(
                    slotBoostGuaranteeId === "qm-90-plus-player"
                      ? "90+ boost still armed — pick another position."
                      : "Legend boost still armed — pick another position."
                  );
                }}
              >
                Try another position
              </GameButton>
              <GameButton
                variant="secondary"
                size="sm"
                fullWidth={false}
                onClick={continueWithoutArmedBoost}
              >
                Continue without boost
              </GameButton>
              <GameButton
                variant="theme"
                size="sm"
                fullWidth={false}
                onClick={returnToPreGameBoostSelection}
              >
                Change boost
              </GameButton>
            </div>
          </div>
        )}

        {superSamHallasMode && (
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

        {joeMellorMode && !superSamHallasMode && (
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
              Tap an empty slot to spin
            </p>
            {normalEraMode ? (
              <EraRatingExplanation compact className="w-full" />
            ) : (
              <CurrentRatingExplanation compact className="w-full" />
            )}
            <GameButton
              variant="theme"
              size="sm"
              fullWidth={false}
              onClick={handleAutofill}
              disabled={choosing}
              className="px-6"
            >
              Auto Fill Squad
            </GameButton>
          </div>
        )}

        {phase === "pitch" &&
          filledCount < TOTAL_SLOTS &&
          !superSamHallasMode &&
          !isDraftMode &&
          !isSlotRecruitMode && (
          <div className="mt-4 flex justify-center">
            <GameButton
              variant="theme"
              size="sm"
              fullWidth={false}
              onClick={handleAutofill}
              className="px-6"
            >
              Auto Fill Squad
            </GameButton>
          </div>
        )}

        {phase === "pitch" && filledCount >= TOTAL_SLOTS && (
          <div className="mt-4 flex justify-center">
            <GameButton
              variant="theme"
              size="sm"
              fullWidth={false}
              onClick={() => startTournamentSimulation(squad)}
              className="px-6"
            >
              Simulate Season
            </GameButton>
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

          {/* Reveal sits outside AnimatePresence: shared keys + BodyPortal under
              mode="wait" reused presence identity on respin and dropped the Era
              year reel (looked like Current Mode). */}
          {phase === "reveal" &&
            isSlotRecruitMode &&
            slotRecruitTarget && (
            <RecruitmentSlotReveal
              key={revealKey}
              target={slotRecruitTarget}
              spinVariant={spinVariant}
              boostStatus={spinBoostStatus}
              boostDetail={spinBoostDetail}
              onComplete={handleRevealComplete}
            />
          )}

          <AnimatePresence initial={false}>
            {phase === "choice" &&
              isSlotRecruitMode &&
              activeSpinTarget && (
              <BodyPortal key={slotChoiceKey}>
                <motion.div
                  className={`recruitment-choice-backdrop fixed inset-0 flex items-center justify-center bg-black/82 p-3 sm:p-6 ${uiLayerClass("modalBackdrop")}`}
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 1 }}
                >
                  <motion.div
                    className="manager-section w-full min-w-0 max-h-[min(92dvh,900px)] overflow-x-hidden overflow-y-auto overscroll-contain"
                    initial={{ y: 16 }}
                    animate={{ y: 0 }}
                    exit={{ y: 8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {boostNotice && (
                      <p className="mb-2 text-center text-xs text-theme-primary">
                        {boostNotice}
                      </p>
                    )}
                    <SlotTeamYearPicker
                      target={activeSpinTarget}
                      entries={slotRecruitEntries}
                      onSelect={handleSlotTeamYearPick}
                      onBack={handleBackToPitch}
                      onRespin={handleSlotRespin}
                      respinsRemaining={respinsRemaining}
                      maxRespins={MAX_RESPINS_PER_RUN}
                      disabled={choosing}
                      hardMode={difficulty === "HARD"}
                      boosted={Boolean(boostNotice)}
                      eraMode={normalEraMode}
                    />
                  </motion.div>
                </motion.div>
              </BodyPortal>
            )}
            {phase === "choice" &&
              !isSlotRecruitMode &&
              currentRound &&
              playerPair && (
              <BodyPortal key={choiceKey}>
              <motion.div
                className={`recruitment-choice-backdrop fixed inset-0 flex items-center justify-center bg-black/82 p-3 sm:p-6 ${uiLayerClass("modalBackdrop")}`}
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <motion.div
                  className={`${CARD.panel} ${MODAL.panelWide} ${MODAL.panelPadding} max-h-[min(92dvh,900px)] overflow-x-hidden overflow-y-auto overscroll-contain`}
                  initial={{ y: 16 }}
                  animate={{ y: 0 }}
                  exit={{ y: 8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
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
                  {boostNotice && (
                    <p className="mb-2 text-center text-xs text-theme-primary">
                      {boostNotice}
                    </p>
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
                    hardMode={difficulty === "HARD"}
                    draftMode={isDraftMode}
                    showDraftRule={isDraftMode && draftPickIndex === 0}
                    draftSquad={isDraftMode ? squad : undefined}
                    boosted={Boolean(boostNotice)}
                  />
                </motion.div>
              </motion.div>
              </BodyPortal>
            )}
          </AnimatePresence>
        </div>
          </>
        )}
      </div>
      )}

      {!isReviewPhase && preGameReady && (
        <StickyActionBar
          className={
            hideActionBar ? "invisible pointer-events-none" : undefined
          }
        >
            <Link
              href="/"
              onClick={() => playUiClick()}
              className={`${BTN.base} ${BTN.secondary} min-h-[var(--mobile-tap-target)] shrink-0 px-3 text-xs`}
            >
              Leave run
            </Link>
            {phase === "pitch" && filledCount < TOTAL_SLOTS && (
              <GameButton
                variant="theme"
                size="sm"
                fullWidth={false}
                onClick={handleAutofill}
                disabled={choosing || hideActionBar}
                className="min-h-[var(--mobile-tap-target)] flex-1 px-3 text-xs"
              >
                Auto Fill
              </GameButton>
            )}
            {phase === "pitch" && filledCount >= TOTAL_SLOTS && (
              <GameButton
                variant="theme"
                size="sm"
                fullWidth={false}
                onClick={() => startTournamentSimulation(squad)}
                disabled={hideActionBar}
                className="min-h-[var(--mobile-tap-target)] flex-1 px-3 text-xs"
              >
                Simulate Season
              </GameButton>
            )}
        </StickyActionBar>
      )}

      {isReviewPhase &&
        seasonResult &&
        reviewStage === "regular" && (
        <>
        <div className="mb-3 px-1 sm:mb-4">
          <MobileStepIndicator
            steps={[...QUICK_MODE_STEPS]}
            currentIndex={quickModeStepIndex}
          />
        </div>
        <SeasonReview
          squad={squad}
          mode={mode}
          seed={seed}
          difficulty={difficulty}
          joeMellorMode={joeMellorMode}
          superSamHallasMode={superSamHallasMode}
          normalEraMode={normalEraMode}
          dailyChallengeMode={dailyChallengeMode}
          dailyScenario={dailyScenario}
          seasonResult={seasonResult}
          runRank={runRank}
          submittedOnline={submittedOnline}
          boostedRun={usedBoostThisRun}
          clubFundsPayout={clubFundsPayout}
          onContinuePlayoffs={handleContinuePlayoffs}
          onFinalizeSeason={handleFinalizeSeason}
          onPlayAgain={resetRun}
          onClose={() => setPhase("pitch")}
          onReturnHome={resetRun}
        />
        </>
      )}

      {isReviewPhase &&
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

      {isReviewPhase &&
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
          dailyChallengeMode={dailyChallengeMode}
          dailyScenario={dailyScenario}
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
