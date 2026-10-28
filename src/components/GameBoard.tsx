"use client";

import { recordSquadBookRun } from "@/lib/squad-book";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { challengeBannerText, type ChallengePayload } from "@/lib/challenge-link";
import { getChallengeRuleScenario } from "@/lib/challenge-run";
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
import { formatClubFunds, mergeClubFundsPayouts } from "@/lib/club-funds";
import {
  claimDailyChallengeAttempt,
  dailyRuleDisablesRespins,
  getDailyChallengeDateKey,
  getDailyChallengeLeagueRunId,
  getDailyChallengePlayoffRunId,
  getDailyChallengeProgress,
  getDailyChallengeScenario,
  markDailyChallengeLeagueLeaders,
  markDailyChallengePlayoffTitle,
} from "@/lib/daily-challenge";
import {
  claimWeeklyChallengeAttempt,
  getWeeklyChallengeRunIdPrefix,
  getWeeklyChallengeScenario,
  getWeeklyChallengeSeed,
  submitWeeklyChallengeRun,
  WEEKLY_SCORE,
} from "@/lib/weekly-challenge";
import {
  awardClubFundsForRun,
  awardClubFundsLines,
} from "@/lib/storage/club-funds";
import { recordCompletedRun, recordPlayoffCompletion } from "@/lib/storage/run";
import { reportMissionEvent } from "@/lib/daily-missions";
import { seasonMissionEvent } from "@/lib/daily-missions-season";
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
import { PitchHero } from "@/components/ui/PitchHero";
import { BallGlyph, FixtureGlyph, ProgrammeGlyph } from "@/components/icons/rugby-icons";
import { StickyActionBar } from "@/components/ui/MobileLayout";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import {
  generateSlotTeamYearTargetForSlot,
  autofillSlotRecruitSquad,
  getPositionSpinOptions,
  pickPositionSpin,
  POSITION_SPIN_LABELS,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotClubChoicePlayers,
  prepareSlotTeamYearPlayers,
} from "@/lib/game/slot-team-year-pick";
import {
  boostFailureNotice,
  boostedFirstPickStatusLines,
  buildBoostedFirstPickPlan,
  buildBoostedSpinPlan,
  clearBoostedFirstPickPlan,
  listValidBoostedFirstPickSlots,
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
import { getSpinRuleFilter } from "@/lib/game/daily-rule-filter";
import { computeChemistry, formatChemistryBonus } from "@/lib/game/chemistry";
import type { HalfwayCallId } from "@/lib/game/halfway-call";
import { DailyRuleBanner } from "./DailyRuleBanner";
import { GauntletRun } from "./GauntletRun";
import type { SideMode } from "@/lib/play-side-modes";
import { getOneClubFormulaOverride, getOneClubRuleFilter } from "@/lib/game/one-club";
import { runGauntlet, GAUNTLET_LENGTH, type GauntletResult } from "@/lib/game/gauntlet";
import {
  formatDailyArchiveDate,
  getDailyArchiveRunIdPrefix,
  getDailyArchiveScenario,
  getDailyArchiveSeed,
} from "@/lib/daily-archive";
import {
  formatOneClubRecord,
  recordGauntletRun,
  recordOneClubSeason,
  recordOneClubTitle,
  type GauntletRecord,
  type OneClubRecord,
} from "@/lib/storage/mode-records";
import { getPlayerTeamYearIds } from "@/lib/game/team-year-pools";
import type { SpinPoolVariant } from "@/lib/game/player-pool-eligibility";
import { EraRatingExplanation } from "./EraRatingExplanation";
import { CurrentRatingExplanation } from "./CurrentRatingExplanation";
import { QuickModePreGameBoostSetup } from "./QuickModePreGameBoostSetup";
import { RunProgress } from "./RunProgress";
import {
  getNextEmptySlotIndex,
  getRunFormulaMode,
  resolveSpinRequest,
  usesClubChoiceSpin,
  type RunProgressStage,
} from "@/lib/game/draft-flow";
import {
  clearRunResume,
  getResumeModeKey,
  loadRunResume,
  saveRunResume,
  RUN_RESUME_VERSION,
  type RunResumeSnapshot,
} from "@/lib/game/run-resume";
import {
  getQuickSpins,
  markFirstRunFinished,
  QUICK_SPINS_CHANGED_EVENT,
  setQuickSpins,
} from "@/lib/storage/spin-settings";
import {
  armBoostForGame,
  cancelArmedBoost,
  clearArmedBoost,
  getBoostQuantity,
  tryConsumeBoostFromInventory,
  BOOST_INVENTORY_CHANGED_EVENT,
} from "@/lib/boosts/boostInventory";
import type { GameBoostId } from "@/lib/boosts/boostDefinitions";
import {
  getBoostDefinition,
  getQuickModeBoosts,
} from "@/lib/boosts/boostDefinitions";
import {
  isQmSelectionBoostAllowedInMode,
  selectionHasBoostedPlayer,
} from "@/lib/boosts/applyQuickModeBoost";
import { validateQuickModeSelectionBoost } from "@/lib/boosts/validateBoost";
import { E2E_BUILD } from "@/lib/feature-flags";
import {
  armPreGameBoost,
  createUnselectedPreGameBoost,
  isPreGameBoostPending,
  isPreGameBoostReady,
  isQmSelectionBoostId,
  QUICK_MODE_PRE_GAME_BOOST_VERSION,
  type QuickModePreGameBoostState,
} from "@/lib/game/quick-mode-pregame-boost";

const BOOSTS_RETIRED = true;

function ownsEligiblePreGameBoost(eraMode: boolean): boolean {
  // Store boosts are retired: never offer the pre-game chooser. Owned boosts were refunded.
  if (BOOSTS_RETIRED) return false;
  return getQuickModeBoosts().some(
    (b) =>
      isQmSelectionBoostId(b.id) &&
      getBoostQuantity(b.id) > 0 &&
      isQmSelectionBoostAllowedInMode(b.id, eraMode)
  );
}

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
  /**
   * Weekly Challenge: the week's rule and shared seed, applied like the Daily's. One ranked
   * attempt per UK week (later runs are practice), scored for the Weekly board. No Auto-fill.
   */
  weeklyChallengeMode?: boolean;
  /**
   * "Challenge a mate" link (/play?challenge=…): the challenger's seed and rule, unranked — no
   * leaderboard, stats, Club Funds, missions, achievements, Squad Book or Daily/Weekly attempt.
   */
  challenge?: ChallengePayload | null;
  /**
   * v1.19 side modes (lib/play-side-modes.ts): One-Club XI, Gauntlet, past Daily. Unranked —
   * no leaderboards, streaks, missions, achievements or Club Funds; never resumed.
   */
  sideMode?: SideMode | null;
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
  weeklyChallengeMode: weeklyChallengeModeProp = false,
  challenge = null,
  sideMode = null,
}: GameBoardProps) {
  // The Daily wins if both flags are set.
  const weeklyChallengeMode = weeklyChallengeModeProp && !dailyChallengeMode;
  const isSideMode = sideMode != null && !dailyChallengeMode && !weeklyChallengeMode;
  const oneClub = isSideMode && sideMode?.kind === "one-club" ? sideMode.club : null;
  const gauntletMode = isSideMode && sideMode?.kind === "gauntlet";
  const archiveDateKey = isSideMode && sideMode?.kind === "daily-archive" ? sideMode.dateKey : null;
  // One-Club XI spins a club's whole history: Era seasons and the 2026 squad.
  const spinVariant: SpinPoolVariant = oneClub ? "all" : normalEraMode ? "era" : "current";
  /** Normal Classic: pick one of three cards from three different clubs (draft-flow.ts). */
  const clubChoiceSpin = usesClubChoiceSpin({
    slotRecruitMode: mode === "CLASSIC",
    spinVariant,
    dailyChallengeMode,
    weeklyChallengeMode,
    sideMode: isSideMode,
    challengeKind: challenge?.kind ?? null,
  });
  /** The 27-0 formula ladder for this run's league season (sim-formula.ts). */
  const formulaMode = getRunFormulaMode({
    eraCards: normalEraMode || Boolean(oneClub),
    clubChoice: clubChoiceSpin,
  });
  /** Chemistry has no effect in Era (v1.40), so it isn't shown there. One-Club keeps it. */
  const showChemistry = !normalEraMode || Boolean(oneClub);
  const isDraftMode = mode === "DRAFT";
  /**
   * Boost ownership is snapshotted per run (refreshed only before the first pick). Reading the
   * inventory live let a boost bought in another tab / merged from the cloud bring the chooser
   * back mid-run, unmounting the season sim and resetting the run's boost counters.
   */
  const [ownsBoostAtRunStart, setOwnsBoostAtRunStart] = useState(() =>
    ownsEligiblePreGameBoost(normalEraMode)
  );
  /** Daily + special modes: no inventory boosts (fair shared seed / fixed squad).
   * Also skip the chooser when the player owns no eligible boosts — avoids a blank screen. */
  const skipPreGameBoosts =
    dailyChallengeMode ||
    weeklyChallengeMode ||
    challenge !== null ||
    isSideMode ||
    joeMellorMode ||
    superSamHallasMode ||
    !ownsBoostAtRunStart;
  const isSlotRecruitMode = mode === "CLASSIC";
  const router = useRouter();
  /** Save / resume slot for this mode (null for the hidden modes and Draft). */
  const resumeModeKey = isSlotRecruitMode && !challenge && !isSideMode
    ? getResumeModeKey({
        dailyChallengeMode,
        weeklyChallengeMode,
        normalEraMode,
        ballKnower: difficulty === "HARD",
        hiddenMode: joeMellorMode || superSamHallasMode,
      })
    : null;
  /**
   * A half-built run saved on this device for this mode, read once on mount. The Daily / Weekly
   * only resume the same day's / week's attempt (the seed must still match).
   */
  const [initialResume] = useState<RunResumeSnapshot | null>(() => {
    if (!resumeModeKey) return null;
    const now = new Date();
    const expectedSeed =
      resumeModeKey === "daily"
        ? `daily-${getDailyChallengeDateKey(now)}`
        : resumeModeKey === "weekly"
          ? getWeeklyChallengeSeed(now)
          : undefined;
    return loadRunResume(resumeModeKey, expectedSeed);
  });
  const [runKey, setRunKey] = useState(0);
  /** Set once the saved run has been restored (or there was none) — saving waits for it. */
  const [resumeReady, setResumeReady] = useState(false);
  const [resumedFromSave, setResumedFromSave] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("pitch");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [squad, setSquad] = useState<SquadSlot[]>(() =>
    initialResume
      ? initialResume.squad
      : createStartingSquad({ joeMellorMode, superSamHallasMode })
  );
  /** The slot holding a landed spin that hasn't been signed yet (the spin lock). */
  const [pendingSpin, setPendingSpin] = useState<{
    slotIndex: number;
    target: SlotRevealTarget;
  } | null>(null);
  /** Last slot signed — the next empty slot after it is suggested (auto-advance). */
  const [lastSignedSlot, setLastSignedSlot] = useState<number | null>(null);
  /** Shown on the picker when a tap on another slot reopened the locked spin. */
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [quickSpins, setQuickSpinsState] = useState(() => getQuickSpins());
  useEffect(() => {
    const sync = () => setQuickSpinsState(getQuickSpins());
    window.addEventListener(QUICK_SPINS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(QUICK_SPINS_CHANGED_EVENT, sync);
  }, []);
  /** Cards this run added to the Squad Book for the first time (review line). */
  const [squadBookNewCards, setSquadBookNewCards] = useState(0);
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
  /** Mid-season fork — null until the player picks at round 14. */
  const [halfwayCall, setHalfwayCall] = useState<HalfwayCallId | null>(null);
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

  const { seed, runId, dailyDate } = useMemo(() => {
    // A resumed run keeps its seed, id (so a Daily / Weekly attempt still counts) and start time.
    if (runKey === 0 && initialResume) {
      return {
        seed: initialResume.seed,
        runId: initialResume.runId,
        dailyDate: new Date(initialResume.startedAt),
      };
    }
    const startedAt = new Date();
    if (challenge) {
      // Challenge link: the challenger's spins, under their rule (see challengeLinkScenario).
      return {
        seed: challenge.seed,
        runId: `run-challenge-${createRunSeed(runKey)}`,
        dailyDate: startedAt,
      };
    }
    if (dailyChallengeMode) {
      // Shared daily seed: everyone (and every retry) gets the same spins today.
      const dateKey = getDailyChallengeDateKey(startedAt);
      return {
        seed: `daily-${dateKey}`,
        runId: `run-daily-${dateKey}-${createRunSeed(runKey)}`,
        dailyDate: startedAt,
      };
    }
    if (archiveDateKey) {
      // Past Daily: that day's shared seed, so the same spins and season as on the day.
      return {
        seed: getDailyArchiveSeed(archiveDateKey),
        runId: `${getDailyArchiveRunIdPrefix(archiveDateKey)}-${createRunSeed(runKey)}`,
        dailyDate: startedAt,
      };
    }
    if (weeklyChallengeMode) {
      // Shared weekly seed: everyone (and every practice run) gets the same spins this week.
      return {
        seed: getWeeklyChallengeSeed(startedAt),
        runId: `${getWeeklyChallengeRunIdPrefix(startedAt)}-${createRunSeed(runKey)}`,
        dailyDate: startedAt,
      };
    }
    const s = createRunSeed(runKey);
    return {
      seed: s,
      /** Stable for the run so first-pick hydration can remount safely. */
      runId: `run-${s}`,
      dailyDate: startedAt,
    };
  }, [runKey, dailyChallengeMode, weeklyChallengeMode, initialResume, challenge, archiveDateKey]);
  /** Frozen at run start so a run that crosses UK midnight keeps its club and bonus day. */
  const dailyScenario = useMemo(
    () => (dailyChallengeMode ? getDailyChallengeScenario(dailyDate) : null),
    [dailyChallengeMode, dailyDate]
  );
  /** Frozen at run start so a run that crosses the Monday rollover keeps its rule and week. */
  const weeklyScenario = useMemo(
    () => (weeklyChallengeMode ? getWeeklyChallengeScenario(dailyDate) : null),
    [weeklyChallengeMode, dailyDate]
  );
  /** A challenge link to a Daily / Weekly replays that day's / week's rule (no bonuses, unranked). */
  const challengeLinkScenario = useMemo(() => (challenge ? getChallengeRuleScenario(challenge) : null), [challenge]);
  /** Past Daily (practice): that day's rule. */
  const archiveScenario = useMemo(
    () => (archiveDateKey ? getDailyArchiveScenario(archiveDateKey) : null),
    [archiveDateKey]
  );
  /** Whichever challenge rule applies to this run (Daily, Weekly, past Daily or a challenge link). */
  const challengeScenario = dailyScenario ?? weeklyScenario ?? archiveScenario ?? challengeLinkScenario;
  /** The run's rule as a spin filter (null outside the Daily/Weekly / for rules that don't filter). */
  const dailyRuleFilter = useMemo(
    () => (oneClub ? getOneClubRuleFilter(oneClub) : getSpinRuleFilter(challengeScenario?.rule ?? null)),
    [challengeScenario, oneClub]
  );
  /** Gauntlet run (after the draft) and the bests it produced. */
  const [gauntletResult, setGauntletResult] = useState<GauntletResult | null>(null);
  const [gauntletRecord, setGauntletRecord] = useState<{ record: GauntletRecord; newBest: boolean } | null>(null);
  /** One-Club XI: this club's best record after the season (and the one before it). */
  const [oneClubOutcome, setOneClubOutcome] = useState<{
    record: OneClubRecord;
    previous: OneClubRecord | null;
    newBest: boolean;
  } | null>(null);
  /** "No respins" rule: the respin button shows as spent for the whole run. */
  const respinsAllowed = !dailyRuleDisablesRespins(challengeScenario?.rule);
  /** Weekly: false when this week's ranked attempt was already used (practice run). */
  const [weeklyAttemptCounts, setWeeklyAttemptCounts] = useState(true);
  useEffect(() => {
    if (weeklyChallengeMode) setWeeklyAttemptCounts(claimWeeklyChallengeAttempt(runId, dailyDate));
  }, [weeklyChallengeMode, runId, dailyDate]);
  /** Weekly: this run's score so far (review copy), null until the regular season ends. */
  const [weeklyRunScore, setWeeklyRunScore] = useState<number | null>(null);
  const weeklyRegularSubmittedRef = useRef(false);
  const weeklyPlayoffSubmittedRef = useRef(false);
  useEffect(() => {
    weeklyRegularSubmittedRef.current = false;
    weeklyPlayoffSubmittedRef.current = false;
    setWeeklyRunScore(null);
  }, [runId]);
  const lockedSlotTargetsRef = useRef(
    new Map<number, { target: SlotRevealTarget; boosted: boolean }>()
  );
  useEffect(() => {
    lockedSlotTargetsRef.current = new Map();
  }, [runId]);
  const [dailyAttemptCounts, setDailyAttemptCounts] = useState(true);
  useEffect(() => {
    if (dailyChallengeMode) setDailyAttemptCounts(claimDailyChallengeAttempt(runId, dailyDate));
  }, [dailyChallengeMode, runId, dailyDate]);

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
          "The Legend boost only works in Era Classic."
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
              "No route for this boost. Boost not used."
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
            "No route for this boost. Boost not used."
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
      pickLegendSpinSlotIndex(
        seed,
        createEmptySquad(),
        new Set(),
        spinVariant,
        dailyRuleFilter
      )
    );
    setLegendSpinUsed(false);
  }, [
    runKey,
    seed,
    isSlotRecruitMode,
    joeMellorMode,
    superSamHallasMode,
    spinVariant,
    dailyRuleFilter,
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

  // Restore a saved half-built run. Declared after the per-seed resets above so its state wins
  // (idempotent, so a Strict Mode re-run of the effects restores it again).
  useEffect(() => {
    const snap = initialResume;
    if (snap) {
      setSpinPickIndex(snap.spinPickIndex);
      setRespinsRemaining(Math.min(MAX_RESPINS_PER_RUN, snap.respinsRemaining));
      rerollsThisRunRef.current = Math.max(0, MAX_RESPINS_PER_RUN - snap.respinsRemaining);
      setUsedTeamYearKeys(new Set(snap.usedTeamYearKeys));
      setLegendSpinSlotIndex(snap.legendSpinSlotIndex);
      setLegendSpinUsed(snap.legendSpinUsed);
      if (snap.pendingSpin) {
        lockedSlotTargetsRef.current.set(snap.pendingSpin.slotIndex, {
          target: snap.pendingSpin.target,
          boosted: false,
        });
        setPendingSpin(snap.pendingSpin);
      }
      setResumedFromSave(true);
    }
    setResumeReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const chemistry = useMemo(() => computeChemistry(squad), [squad]);

  // Refresh the boost-ownership snapshot only while the run hasn't started.
  const runNotStarted = filledCount === 0 && phase === "pitch";
  useEffect(() => {
    if (!runNotStarted) return;
    const refresh = () => setOwnsBoostAtRunStart(ownsEligiblePreGameBoost(normalEraMode));
    refresh();
    window.addEventListener(BOOST_INVENTORY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BOOST_INVENTORY_CHANGED_EVENT, refresh);
  }, [runNotStarted, runKey, normalEraMode]);

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

    const activeBoostPlan =
      boostedSpinPlan &&
      boostedSpinPlan.status !== "failed" &&
      boostedSpinPlan.status !== "consumed" &&
      boostedSpinPlan.selectedTeamId === activeSpinTarget.teamYearKey &&
      boostedSpinPlan.slotIndex === selectedSlotIndex &&
      boostedSpinPlan.playerChoiceIds.length > 0
        ? boostedSpinPlan
        : null;

    if (clubChoiceSpin) {
      // Classic: the spun club gives one card (any boost / legend guarantee lands there) and
      // two other clubs give one each — one usually a club link with a signed neighbour.
      return prepareSlotClubChoicePlayers(
        activeSpinTarget,
        signedPlayerIds,
        squad,
        selectedSlotIndex,
        {
          seed,
          spinVariant,
          legendOnly: !legendSpinUsed && legendSpinSlotIndex === selectedSlotIndex,
          selectionBoostId: activeBoostPlan?.boostId ?? slotBoostGuaranteeId ?? undefined,
          guaranteedPlayerId: activeBoostPlan?.guaranteedPlayerId,
        }
      );
    }

    if (activeBoostPlan) {
      return resolveBoostedSpinPlanPlayers(
        activeBoostPlan,
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
        ruleFilter: dailyRuleFilter,
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
    dailyRuleFilter,
    clubChoiceSpin,
    spinVariant,
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
      ({ player, target }) =>
        !getPlayerTeamYearIds(player.id).includes((target ?? activeSpinTarget).teamYearId)
    );
    if (mismatched) {
      console.warn("Player pool leak", {
        spinTeamYearId: (mismatched.target ?? activeSpinTarget).teamYearId,
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

  // Keep the half-built run saved so leaving (or a reload / crash) never loses it.
  useEffect(() => {
    if (!resumeModeKey || !resumeReady) return;
    if (phase === "simulation" || phase === "review") {
      // The season is decided and recorded from here on: nothing to resume.
      clearRunResume(resumeModeKey);
      return;
    }
    if (phase !== "pitch" && phase !== "reveal" && phase !== "choice") return;
    saveRunResume({
      v: RUN_RESUME_VERSION,
      modeKey: resumeModeKey,
      seed,
      runId,
      startedAt: dailyDate.toISOString(),
      squad,
      spinPickIndex,
      respinsRemaining,
      usedTeamYearKeys: [...usedTeamYearKeys],
      legendSpinSlotIndex,
      legendSpinUsed,
      pendingSpin,
      savedAt: new Date().toISOString(),
    });
  }, [
    resumeModeKey,
    resumeReady,
    phase,
    seed,
    runId,
    dailyDate,
    squad,
    spinPickIndex,
    respinsRemaining,
    usedTeamYearKeys,
    legendSpinSlotIndex,
    legendSpinUsed,
    pendingSpin,
  ]);

  const resetRun = useCallback(() => {
    clearBoostedFirstPickPlan();
    setHalfwayCall(null);
    setBoostedFirstPick(null);
    setRunKey((k) => k + 1);
    setPhase("pitch");
    setSelectedSlotIndex(null);
    setSlotRecruitTarget(null);
    setActiveSpinTarget(null);
    setSquad(createStartingSquad({ joeMellorMode, superSamHallasMode }));
    setSeasonResult(null);
    setGauntletResult(null);
    setGauntletRecord(null);
    setOneClubOutcome(null);
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
    setPendingSpin(null);
    lockedSlotTargetsRef.current = new Map();
    setLastSignedSlot(null);
    setPickerNotice(null);
    setResumedFromSave(false);
    setLeaveConfirmOpen(false);
    setSquadBookNewCards(0);
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

      if (gauntletMode) {
        // Gauntlet: ten great sides instead of a league season. Decided (and recorded) now, so
        // leaving mid-reveal can't bin a bad run.
        const run = runGauntlet(finalSquad, seed, formulaMode);
        setGauntletResult(run);
        setGauntletRecord(
          recordGauntletRun({ runId, beaten: run.beaten, era: normalEraMode, total: GAUNTLET_LENGTH })
        );
        markFirstRunFinished();
        setPhase("simulation");
        return;
      }

      const result = simulateSeason(finalSquad, seed, {
        draftMode: isDraftMode,
        currentSeasonOnly: !normalEraMode && !oneClub,
        formulaMode,
        forceOpponentClub: challengeScenario?.forceOpponentClub ?? undefined,
        forceUndefeated: superSamHallasMode,
        joeMellorMode,
        ...(oneClub ? { formulaOverride: getOneClubFormulaOverride(finalSquad, oneClub) } : {}),
      });
      // Fresh season: the round-14 fork is open again.
      setHalfwayCall(null);
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
      challengeScenario?.forceOpponentClub,
      gauntletMode,
      oneClub,
      formulaMode,
    ]
  );

  /**
   * Round-14 fork. Rounds 1–14 are already decided (per-match RNG streams), so
   * re-simulating with the same seed + choice only reshapes rounds 15–27 —
   * deterministic, so a Daily Challenge season is fair for everyone on the seed.
   */
  const handleHalfwayCall = useCallback(
    (choice: HalfwayCallId) => {
      if (phase !== "simulation" || halfwayCall !== null) return;
      setHalfwayCall(choice);
      const result = simulateSeason(squad, seed, {
        draftMode: isDraftMode,
        currentSeasonOnly: !normalEraMode && !oneClub,
        formulaMode,
        forceOpponentClub: challengeScenario?.forceOpponentClub ?? undefined,
        forceUndefeated: superSamHallasMode,
        joeMellorMode,
        halfwayCall: choice,
        ...(oneClub ? { formulaOverride: getOneClubFormulaOverride(squad, oneClub) } : {}),
      });
      setSeasonResult(result);
    },
    [
      phase,
      halfwayCall,
      squad,
      seed,
      isDraftMode,
      normalEraMode,
      oneClub,
      formulaMode,
      challengeScenario?.forceOpponentClub,
      superSamHallasMode,
      joeMellorMode,
    ]
  );

  /**
   * Weekly Challenge score for this run. The ranked attempt goes to the board after the
   * regular season (so a run that misses the play-offs, or is left mid-bracket, still counts)
   * and, if it made the play-offs, once more with the play-off result. Practice runs are
   * scored for the review only.
   */
  const submitWeeklyScore = useCallback(
    (result: SeasonResult, tablePosition: number, playoff: PlayoffResult | null) => {
      if (!weeklyChallengeMode || mode !== "CLASSIC" || joeMellorMode || superSamHallasMode) {
        return;
      }
      const submitted = submitWeeklyChallengeRun(
        runId,
        {
          regularWins: result.wins,
          playoffWins: playoff?.wins ?? 0,
          grandFinalWon:
            playoff?.isChampion === true || playoff?.finish === "Super League Champions",
          leagueLeaders: tablePosition === 1,
        },
        // Final now unless the play-offs are still to come.
        playoff !== null || tablePosition > 6,
        dailyDate
      );
      setWeeklyRunScore(submitted.score);
    },
    [weeklyChallengeMode, mode, joeMellorMode, superSamHallasMode, runId, dailyDate]
  );

  const finalizeRegularSeason = useCallback(
    (result: SeasonResult, finalSquad: SquadSlot[]) => {
      if (recordedRef.current) return;
      recordedRef.current = true;
      // Challenge runs are unranked and earn nothing (a known seed would otherwise be farmable).
      if (challenge) return;
      if (isSideMode) {
        // Unranked side modes: no stats, leaderboards, missions, achievements or Club Funds —
        // and no Squad Book (its collections pay Club Funds).
        markFirstRunFinished();
        if (oneClub) {
          setOneClubOutcome(
            recordOneClubSeason({ runId, club: oneClub, wins: result.wins, losses: result.losses })
          );
        }
        setClubFundsPayout(null);
        return;
      }
      const squadBook = recordSquadBookRun({ runId, mode, squad: finalSquad, hidden: joeMellorMode || superSamHallasMode, era: normalEraMode, daily: dailyChallengeMode, weekly: weeklyChallengeMode });
      setSquadBookNewCards(squadBook.newIds.length);
      // Quick spins default on from the next run (unless the player has chosen).
      markFirstRunFinished();

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
          weeklyChallengeMode,
        }
      )
        .then((completed) => {
          setSubmittedOnline(completed.submittedOnline);
          if (completed.nationalRank) setRunRank(completed.nationalRank);
        })
        .catch((error) => {
          // Network/Supabase failure — the run is still saved locally.
          console.error("[run] Failed to record completed run online:", error);
          setSubmittedOnline(false);
        });

      if (weeklyChallengeMode && !weeklyRegularSubmittedRef.current) {
        weeklyRegularSubmittedRef.current = true;
        submitWeeklyScore(result, tablePosition, null);
      }

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
          !superSamHallasMode &&
          dailyAttemptCounts &&
          // Belt and braces with the payout-id ledger: one League Leaders bonus per day.
          !getDailyChallengeProgress(dailyDate).leagueLeaders
        ) {
          const dailyPayout = awardClubFundsLines(
            getDailyChallengeLeagueRunId(dailyDate),
            [
              {
                id: "daily-league-leaders",
                label: `Daily${dailyScenario.eraMode ? " Era" : ""}: ${dailyScenario.title} — League Leaders`,
                amount: dailyScenario.leagueLeadersBonus,
              },
            ]
          );
          if (dailyPayout.awarded) {
            markDailyChallengeLeagueLeaders(dailyDate);
          }
          combined = mergeClubFundsPayouts(payout, dailyPayout);
        }
        combined = mergeClubFundsPayouts(combined, reportMissionEvent(seasonMissionEvent({ squad: finalSquad, result, leaguePosition: tablePosition, mode, era: normalEraMode, daily: dailyChallengeMode, hidden: joeMellorMode || superSamHallasMode })).payout);
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
          // Weekly runs are rule-restricted too: no Normal Mode achievement credit.
          dailyChallengeMode: dailyChallengeMode || weeklyChallengeMode,
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
      weeklyChallengeMode,
      submitWeeklyScore,
      dailyAttemptCounts,
      dailyDate,
      challenge,
      isSideMode,
      oneClub,
    ]
  );

  const finalizePlayoffRun = useCallback(
    (result: SeasonResult, finalSquad: SquadSlot[]) => {
      const playoff = result.playoffResult ?? playoffResultRef.current;
      if (!playoff || playoffRecordedRef.current) return;
      playoffRecordedRef.current = true;
      if (challenge) return;
      if (isSideMode) {
        if (oneClub && (playoff.isChampion || playoff.finish === "Super League Champions")) {
          recordOneClubTitle({ runId, club: oneClub });
        }
        return;
      }

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
          weeklyChallengeMode,
        }
      )
        .then((completed) => {
          setSubmittedOnline(completed.submittedOnline);
          if (completed.nationalRank) setRunRank(completed.nationalRank);
        })
        .catch((error) => {
          // Network/Supabase failure — the run is still saved locally.
          console.error("[run] Failed to record completed run online:", error);
          setSubmittedOnline(false);
        });

      if (weeklyChallengeMode && !weeklyPlayoffSubmittedRef.current) {
        weeklyPlayoffSubmittedRef.current = true;
        submitWeeklyScore(result, tablePosition, playoff);
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
          dailyChallengeMode: dailyChallengeMode || weeklyChallengeMode,
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
      weeklyChallengeMode,
      submitWeeklyScore,
      challenge,
      isSideMode,
      oneClub,
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

  // The season is already decided when the sim animation starts. Leaving or reloading during
  // the ~8s animation used to skip recording it, so a bad season could be quietly binned.
  const pendingSeasonRef = useRef<{ result: SeasonResult; squad: SquadSlot[] } | null>(null);
  pendingSeasonRef.current =
    phase === "simulation" && seasonResult && !joeMellorMode && !superSamHallasMode
      ? { result: seasonResult, squad }
      : null;
  const finalizeRegularSeasonRef = useRef(finalizeRegularSeason);
  finalizeRegularSeasonRef.current = finalizeRegularSeason;
  useEffect(() => {
    const flush = () => {
      const pending = pendingSeasonRef.current;
      if (pending) finalizeRegularSeasonRef.current(pending.result, pending.squad);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush(); // unmount = "Leave run" or navigating away mid-sim
    };
  }, []);

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
        if (isSideMode) playoffFundsAwardedRef.current = true; // unranked: no Club Funds
        if (!playoffFundsAwardedRef.current && !challenge) {
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
            !superSamHallasMode &&
            dailyAttemptCounts &&
            !getDailyChallengeProgress(dailyDate).playoffTitle
          ) {
            const dailyPayout = awardClubFundsLines(
              getDailyChallengePlayoffRunId(dailyDate),
              [
                {
                  id: "daily-playoff-title",
                  label: `Daily${dailyScenario.eraMode ? " Era" : ""}: ${dailyScenario.title} — Grand Final`,
                  amount: dailyScenario.playoffTitleBonus,
                },
              ]
            );
            if (dailyPayout.awarded) {
              markDailyChallengePlayoffTitle(dailyDate);
            }
            combined = mergeClubFundsPayouts(payout, dailyPayout);
          }
          combined = mergeClubFundsPayouts(combined, reportMissionEvent({ kind: "playoffs", mode, hidden: joeMellorMode || superSamHallasMode, champion: wonTitle }).payout);
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
      dailyAttemptCounts,
      dailyDate,
      challenge,
      isSideMode,
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

      // Club choice: each card carries its own club-season.
      const pickedTarget =
        slotRecruitEntries.find((e) => e.player.id === player.id)?.target ?? activeSpinTarget;
      const newSquad = placeSlotRecruitPlayerAtSlot(
        squad,
        player,
        pickedTarget,
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
        } else {
          // The boost is gone (e.g. spent in another tab): don't hand over the guaranteed
          // player. Back to the team sheet; this slot re-spins without the boost.
          lockedSlotTargetsRef.current.delete(selectedSlotIndex);
          setPendingSpin(null);
          setSlotBoostGuaranteeId(null);
          setBoostedSpinPlan(null);
          setPendingPlayer(null);
          setSelectedSlotIndex(null);
          setSlotRecruitTarget(null);
          setActiveSpinTarget(null);
          setChoosing(false);
          setPhase("pitch");
          return;
        }
      } else if (isActiveBoostedFirstPick(boostedFirstPick)) {
        // First auto pick completed without consuming (non-matching choice).
        fulfillBoostedFirstPick();
      }

      lockedSlotTargetsRef.current.delete(selectedSlotIndex);
      setPendingSpin(null);
      setPickerNotice(null);
      setLastSignedSlot(selectedSlotIndex);
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
        next.add(pickedTarget.teamYearKey);
        return next;
      });
      if (
        legendSpinSlotIndex === selectedSlotIndex &&
        !legendSpinUsed
      ) {
        setLegendSpinUsed(true);
      }

      // The 13th signing stays on the team sheet ("Squad complete") — the player kicks off.
      setSpinPickIndex((i) => i + 1);
      setPhase("pitch");
    },
    [
      choosing,
      phase,
      isSlotRecruitMode,
      activeSpinTarget,
      slotRecruitEntries,
      selectedSlotIndex,
      squad,
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
    (requestedSlotIndex: number) => {
      if (
        phase !== "pitch" ||
        !isSlotRecruitMode ||
        filledCount >= TOTAL_SLOTS ||
        choosing
      ) {
        return;
      }

      // Spin lock: once a spin lands it belongs to its slot until someone is signed there.
      // Backing out and tapping another slot reopens that spin — it never re-rolls, and the
      // other slots stay unspun (no peeking at every slot's result on the seeded Daily/Weekly).
      const lockedSlot =
        pendingSpin && lockedSlotTargetsRef.current.has(pendingSpin.slotIndex)
          ? pendingSpin.slotIndex
          : null;
      const request = resolveSpinRequest(lockedSlot, requestedSlotIndex);
      const slotIndex = request.slotIndex;

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

      if (request.reopenLocked) {
        const locked = lockedSlotTargetsRef.current.get(slotIndex)!;
        // Club choice repeats clubs on purpose (links), so a used club doesn't void the lock.
        const stillValid = clubChoiceSpin
          ? prepareSlotClubChoicePlayers(locked.target, signedPlayerIds, squad, slotIndex, {
              seed,
              spinVariant,
              legendOnly: requireLegendPlayer,
            }).length > 0
          : !usedTeamYearKeys.has(locked.target.teamYearKey) &&
            prepareSlotTeamYearPlayers(locked.target, signedPlayerIds, squad, slotIndex, {
              seed,
              legendOnly: requireLegendPlayer,
              ruleFilter: dailyRuleFilter,
            }).length > 0;
        if (stillValid) {
          setRecruitNotice(null);
          setPickerNotice(
            request.redirected
              ? `Your ${slot.label} spin is locked in — sign one of these first.`
              : null
          );
          setPendingPlayer(null);
          lastScrolledPlayerIdRef.current = null;
          setSelectedSlotIndex(slotIndex);
          setActiveSpinTarget(locked.target);
          setSlotRecruitTarget(locked.target);
          setSpinSessionId((id) => id + 1);
          // Straight back to the picker: the reel already landed.
          setPhase("choice");
          return;
        }
        // Can't happen in normal play (nothing else is signed while a spin is locked).
        lockedSlotTargetsRef.current.delete(slotIndex);
        setPendingSpin(null);
      }

      // Club choice never steers away from clubs already signed: repeats are how links happen.
      const spinUsedTeamYearKeys = clubChoiceSpin ? new Set<string>() : usedTeamYearKeys;
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
          usedTeamYearKeys: spinUsedTeamYearKeys,
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
          spinUsedTeamYearKeys,
          { requireLegendPlayer, spinVariant, ruleFilter: dailyRuleFilter }
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
      setPickerNotice(null);
      lockedSlotTargetsRef.current.set(slotIndex, { target, boosted: Boolean(armedBoost) });
      setPendingSpin({ slotIndex, target });

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
      pendingSpin,
      signedPlayerIds,
      usedTeamYearKeys,
      legendSpinUsed,
      legendSpinSlotIndex,
      spinVariant,
      preGameBoost,
      slotBoostGuaranteeId,
      selectionBoostsUsedThisRun,
      dailyRuleFilter,
      clubChoiceSpin,
    ]
  );

  /** Classic position reel: with a 90+ / Legend boost armed, only positions it can fill. */
  const getPositionSpinAllowedSlots = useCallback(
    (boostId: "qm-90-plus-player" | "qm-goat-hall-of-fame" | null): number[] | null =>
      boostId
        ? listValidBoostedFirstPickSlots(boostId, signedPlayerIds, squad, new Set(), {
            spinVariant,
            legendSpinSlotIndex,
            legendSpinUsed,
          })
        : null,
    [signedPlayerIds, squad, spinVariant, legendSpinSlotIndex, legendSpinUsed]
  );

  /**
   * Classic: the one Spin button. The reel spins positions and lands on one with an empty slot;
   * a landed spin stays locked (pressing Spin again reopens it, never re-rolls).
   */
  const startPositionSpin = useCallback(() => {
    if (pendingSpin && lockedSlotTargetsRef.current.has(pendingSpin.slotIndex)) {
      startSlotRecruitSpin(pendingSpin.slotIndex);
      return;
    }
    const armedBoost =
      preGameBoost?.status === "armed" || preGameBoost?.status === "applied"
        ? slotBoostGuaranteeId
        : null;
    const pick = pickPositionSpin(seed, spinPickIndex, squad, getPositionSpinAllowedSlots(armedBoost));
    if (!pick) {
      setRecruitNotice("No position left to spin.");
      return;
    }
    startSlotRecruitSpin(pick.slotIndex);
  }, [
    pendingSpin,
    preGameBoost,
    slotBoostGuaranteeId,
    seed,
    spinPickIndex,
    squad,
    getPositionSpinAllowedSlots,
    startSlotRecruitSpin,
  ]);

  const handleSlotRespin = useCallback((): boolean => {
    if (
      !isSlotRecruitMode ||
      !respinsAllowed ||
      respinsRemaining <= 0 ||
      // Classic can also respin the position straight after it lands (owner, v1.42).
      !(phase === "choice" || (phase === "reveal" && clubChoiceSpin)) ||
      selectedSlotIndex === null ||
      choosing
    ) {
      return false;
    }

    const nextSpinIndex = spinPickIndex + 1;
    const armedBoost =
      (preGameBoost?.status === "armed" ||
        preGameBoost?.status === "applied") &&
      slotBoostGuaranteeId
        ? slotBoostGuaranteeId
        : null;
    // Classic: a respin spins the position reel again too (it may land somewhere else).
    const respinSlot = clubChoiceSpin
      ? pickPositionSpin(seed, nextSpinIndex, squad, getPositionSpinAllowedSlots(armedBoost))
          ?.slotIndex ?? selectedSlotIndex
      : selectedSlotIndex;
    const sameSlot = respinSlot === selectedSlotIndex;
    const requireLegendPlayer =
      !legendSpinUsed &&
      legendSpinSlotIndex === respinSlot;

    // Exclude the offer being respinned so we do not land on the same team-year (club choice:
    // on any of the offered clubs — signed clubs stay in, repeats are how links happen).
    const respinUsedTeamYearKeys = new Set<string>(clubChoiceSpin ? [] : usedTeamYearKeys);
    if (activeSpinTarget && sameSlot) {
      respinUsedTeamYearKeys.add(activeSpinTarget.teamYearKey);
    }
    if (clubChoiceSpin && sameSlot) {
      for (const entry of slotRecruitEntries) {
        if (entry.target) respinUsedTeamYearKeys.add(entry.target.teamYearKey);
      }
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
        slotIndex: respinSlot,
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
        return false;
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
        respinSlot,
        respinUsedTeamYearKeys,
        { requireLegendPlayer, spinVariant, ruleFilter: dailyRuleFilter }
      );
    }

    if (!target) {
      setRecruitNotice(
        "No respin left. Sign or pick another slot."
      );
      return false;
    }
    // Only one team-year can fill this slot (e.g. the Era legend slot at Hooker): a respin
    // would land on the same offer, so don't spend one.
    if (sameSlot && activeSpinTarget && target.teamYearKey === activeSpinTarget.teamYearKey) {
      setRecruitNotice("No other team can fill this slot — respin not used.");
      return false;
    }

    setRecruitNotice(null);
    setPickerNotice(null);
    if (!sameSlot) lockedSlotTargetsRef.current.delete(selectedSlotIndex);
    lockedSlotTargetsRef.current.set(respinSlot, { target, boosted: Boolean(armedBoost) });
    setPendingSpin({ slotIndex: respinSlot, target });
    setSelectedSlotIndex(respinSlot);

    playReroll();
    setRespinsRemaining((n) => n - 1);
    // Counted for the Stats page (Total Respins Used / Most in a Run / Average per Run).
    rerollsThisRunRef.current += 1;
    setSpinPickIndex(nextSpinIndex);
    setPendingPlayer(null);
    lastScrolledPlayerIdRef.current = null;
    setActiveSpinTarget(target);
    setSlotRecruitTarget(target);
    // Never clear slotBoostGuaranteeId until the boost is consumed.
    setSpinSessionId((id) => id + 1);
    setPhase("reveal");
    return true;
  }, [
    isSlotRecruitMode,
    respinsAllowed,
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
    dailyRuleFilter,
    clubChoiceSpin,
    slotRecruitEntries,
    getPositionSpinAllowedSlots,
  ]);

  const handleSelectSlot = useCallback(
    (slotIndex: number) => {
      // Classic spins positions (one Spin button); team-sheet slots aren't spin buttons there.
      if (clubChoiceSpin) return;
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
      clubChoiceSpin,
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

      // Squad complete stays on the team sheet; the player kicks off the season.
      setDraftPickIndex((i) => i + 1);
      setPhase("pitch");
    },
    [
      phase,
      pendingPlayer,
      choosing,
      squad,
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

        playPositionComplete();
        setPhase("pitch");
      }, 400);
    },
    [
      currentRound,
      choosing,
      phase,
      squad,
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
          fail("Open a player choice first.");
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

      fail("Boosts aren't available in this mode.");
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
          ? "90+ boost ready for your next pick."
          : "Legend boost ready for your next pick."
      );
    }
    lastScrolledPlayerIdRef.current = null;
    revealSoundKey.current = null;
    setPickerNotice(null);
    setPhase("pitch");
  }, [
    isDraftMode,
    slotBoostGuaranteeId,
    preGameBoost,
    boostedFirstPick,
    fulfillBoostedFirstPick,
  ]);

  // Ranked Classic has no Auto-fill (see E2E_BUILD in feature-flags); the Daily and the hidden
  // modes keep it. Test builds can turn it back on with ?e2e=1.
  // Read after mount: the server render has no URL query, so reading it during render made the
  // button differ between server and client (React hydration error #418).
  const [e2eAutofill, setE2eAutofill] = useState(false);
  useEffect(() => {
    if (E2E_BUILD && new URLSearchParams(window.location.search).get("e2e") === "1") setE2eAutofill(true);
  }, []);
  const autofillAllowed =
    dailyChallengeMode ||
    archiveDateKey !== null ||
    joeMellorMode ||
    superSamHallasMode ||
    e2eAutofill;
  const handleAutofill = useCallback(() => {
    if (phase !== "pitch" || filledCount >= TOTAL_SLOTS || isDraftMode) return;
    // A landed spin is locked to its slot: Auto-fill can't be used to dodge it.
    if (pendingSpin) return;

    if (isSlotRecruitMode) {
      const result = autofillSlotRecruitSquad(
        seed,
        spinPickIndex,
        squad,
        usedTeamYearKeys,
        spinVariant,
        dailyRuleFilter
      );
      if (!result) {
        setRecruitNotice(
          "Auto-fill failed: not enough players."
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
    pendingSpin,
    joeMellorMode,
    seed,
    spinPickIndex,
    spinVariant,
    usedTeamYearKeys,
    slotOffers,
    squad,
    dailyRuleFilter,
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
  // The player pickers are dialogs: focus moves in, Tab stays inside, Escape goes back to the team sheet.
  const slotPickerRef = useModalA11y(phase === "choice" && isSlotRecruitMode, handleBackToPitch, { lockScroll: false });
  const pairPickerRef = useModalA11y(phase === "choice" && !isSlotRecruitMode && !isDraftMode, handleBackToPitch, {
    lockScroll: false,
  });
  const leaveDialogRef = useModalA11y(leaveConfirmOpen, () => setLeaveConfirmOpen(false));
  const preGameReady = isPreGameBoostReady(preGameBoost);
  const runProgressStage: RunProgressStage =
    phase === "simulation" || (phase === "review" && reviewStage === "regular")
      ? "season"
      : phase === "review"
        ? "playoffs"
        : "squad";
  const squadComplete = filledCount >= TOTAL_SLOTS;
  /** Auto-advance: the next empty slot after the last signing (team-sheet order). */
  const suggestedSlotIndex =
    isSlotRecruitMode && phase === "pitch" && !squadComplete && !superSamHallasMode
      ? pendingSpin?.slotIndex ??
        // Classic spins positions: no suggested slot, only a landed spin waiting.
        (clubChoiceSpin ? null : getNextEmptySlotIndex(
          squad,
          lastSignedSlot,
          joeMellorMode ? [LOOSE_FORWARD_SLOT_INDEX] : []
        ))
      : null;
  const suggestedSlotLabel =
    suggestedSlotIndex !== null
      ? squad.find((s) => s.slotIndex === suggestedSlotIndex)?.label ?? null
      : null;
  /** Classic position reel: positions with an empty slot, landing on the spun slot's. */
  const positionReel =
    clubChoiceSpin && selectedSlotIndex !== null
      ? (() => {
          const slot = squad.find((s) => s.slotIndex === selectedSlotIndex);
          if (!slot) return null;
          return {
            labels: getPositionSpinOptions(squad).map((o) => o.label),
            final: POSITION_SPIN_LABELS[slot.position],
          };
        })()
      : null;
  const runInProgress =
    !isReviewPhase && phase !== "simulation" && (filledCount > 0 || pendingSpin !== null) &&
    !superSamHallasMode;
  const kickOffSeason = () => {
    if (!squadComplete || phase !== "pitch") return;
    if (resumeModeKey) clearRunResume(resumeModeKey);
    startTournamentSimulation(squad);
  };
  const toggleQuickSpins = () => {
    playUiClick();
    const next = !quickSpins;
    setQuickSpins(next);
    setQuickSpinsState(next);
  };
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
      {!isReviewPhase && (title || subtitle || challengeScenario) && (
        <PitchHero
          size="slim"
          className="mb-4 sm:mb-5"
          icon={challengeScenario ? <FixtureGlyph /> : normalEraMode ? <ProgrammeGlyph /> : <BallGlyph />}
          eyebrow={
            challengeScenario ? (
              <>
                {challenge
                  ? "Challenge"
                  : weeklyScenario
                  ? weeklyScenario.theme
                    ? `Weekly Challenge · ${weeklyScenario.theme.event}`
                    : "Weekly Challenge"
                  : archiveScenario && archiveDateKey
                    ? `Past Daily · ${formatDailyArchiveDate(archiveDateKey)}`
                    : "Daily Challenge"}
                {challengeScenario.eraMode ? " · Era" : ""}
              </>
            ) : undefined
          }
          title={challengeScenario ? challengeScenario.ruleTitle : title}
          description={
            dailyScenario ? (
              <>
                {dailyScenario.ruleSummary}
                <span className="pitch-sub__meta">
                  {dailyAttemptCounts
                    ? `Top the table +${formatClubFunds(dailyScenario.leagueLeadersBonus)} · Grand Final +${formatClubFunds(dailyScenario.playoffTitleBonus)}`
                    : "Practice run. Today's Daily is used."}
                </span>
              </>
            ) : weeklyScenario ? (
              <>
                {weeklyScenario.ruleSummary}
                <span className="pitch-sub__meta">
                  {weeklyAttemptCounts
                    ? `Ranked · Win ${WEEKLY_SCORE.regularWin} · Play-off win ${WEEKLY_SCORE.playoffWin} · Grand Final +${WEEKLY_SCORE.grandFinal} · League Leaders +${WEEKLY_SCORE.leagueLeaders}`
                    : "Practice run. This week's ranked run is used."}
                </span>
              </>
            ) : challenge ? (
              <>
                {challengeLinkScenario ? <>{challengeLinkScenario.ruleSummary} </> : null}
                <span className="pitch-sub__meta font-cond text-[16px] font-bold" role="status">
                  {challengeBannerText(challenge)}
                </span>
                <span className="pitch-sub__meta">Same spins · unranked</span>
              </>
            ) : archiveScenario ? (
              <>
                {archiveScenario.ruleSummary}
                <span className="pitch-sub__meta">
                  Practice: same spins as on the day.
                </span>
              </>
            ) : subtitle ? (
              subtitle
            ) : undefined
          }
        />
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
          {/* Daily / Weekly guests need the log-in rule before they play; Classic guests get it
              under the pitch so the pitch sits higher. */}
          {dailyChallengeMode || weeklyChallengeMode ? (
            <GuestNotice variant="play" dailyChallenge={dailyChallengeMode} />
          ) : null}

        <div className="mb-3 sm:mb-4">
          <RunProgress
            stage={runProgressStage}
            filledCount={filledCount}
            totalSlots={TOTAL_SLOTS}
          />
        </div>

        {resumedFromSave && phase === "pitch" && runInProgress ? (
          <div
            className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-theme-primary/30 bg-theme-primary/10 px-3 py-2 text-center text-sm text-white"
            role="status"
          >
            <span>
              Welcome back. {filledCount}/{TOTAL_SLOTS} signed
              {pendingSpin ? `, ${squad.find((x) => x.slotIndex === pendingSpin.slotIndex)?.label ?? "a"} spin waiting` : ""}.
            </span>
            {!dailyChallengeMode && !weeklyChallengeMode ? (
              <button
                type="button"
                className={`${LINK.subtle} text-xs`}
                onClick={() => {
                  playUiClick();
                  if (resumeModeKey) clearRunResume(resumeModeKey);
                  resetRun();
                }}
              >
                Start over
              </button>
            ) : null}
          </div>
        ) : null}

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
            chemistryBonus={chemistry.bonus}
            chemistryLinks={chemistry.links.length}
            showChemistry={showChemistry}
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
                "No route for this boost here."}
            </p>
            <p className={`${TYPO.bodySm} text-amber-100/80`}>
              Try another position or skip the boost.
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
                      ? "90+ boost still ready. Pick another position."
                      : "Legend boost still ready. Pick another position."
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
                Skip boost
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
              Super Sam Hallas Mode activated
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
              GOAT Mode activated
            </p>
          </motion.div>
        )}

        {phase === "pitch" && squadComplete && (
          <motion.section
            className={`mt-4 ${CARD.base} border-theme-primary/40 bg-pitch-900 px-4 py-4 text-center`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            aria-labelledby="squad-complete-title"
          >
            <p id="squad-complete-title" className={`${TYPO.eyebrow} text-theme-primary`}>
              Squad complete
            </p>
            <p className="mt-1 text-[15px] font-bold text-white">
              Your 13 is set.
              {difficulty !== "HARD" ? (
                <>
                  {" "}Rating{" "}
                  <span className="tabular-nums text-theme-primary">{averageSquadRating.toFixed(1)}</span>
                  {showChemistry ? (
                    <>
                      {" · "}Chemistry{" "}
                      <span className="tabular-nums text-lime-300">{formatChemistryBonus(chemistry.bonus)}</span>
                      <span className="text-[color:var(--fl-muted)]">
                        {" "}({chemistry.links.length} {chemistry.links.length === 1 ? "link" : "links"})
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
            <GameButton
              variant="theme"
              size="lg"
              className="mt-3 w-full"
              onClick={kickOffSeason}
            >
              {gauntletMode ? "Take on the Gauntlet" : "Kick off the season"}
            </GameButton>
          </motion.section>
        )}

        {phase === "pitch" &&
          isSlotRecruitMode &&
          filledCount < TOTAL_SLOTS && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
            <p className={`w-full text-center ${TYPO.bodySm} font-semibold text-white`}>
              {clubChoiceSpin
                ? pendingSpin
                  ? `Your ${suggestedSlotLabel ?? "last"} spin is waiting. Press Spin to sign.`
                  : filledCount === 0
                    ? "Press Spin for a position"
                    : `${TOTAL_SLOTS - filledCount} to go`
                : pendingSpin
                  ? `Your ${suggestedSlotLabel ?? "last"} spin is waiting. Tap it to sign.`
                  : filledCount === 0
                    ? "Tap a position to spin"
                    : `${TOTAL_SLOTS - filledCount} to go${suggestedSlotLabel ? ` · next: ${suggestedSlotLabel}` : ""}`}
            </p>
            {clubChoiceSpin && filledCount === 0 && !pendingSpin && difficulty !== "HARD" ? (
              <p className="w-full text-center text-xs text-[color:var(--fl-muted)]">
                Pick 1 of 3 players from 3 clubs. Same club side by side = chemistry.
              </p>
            ) : null}
            {showChemistry && difficulty !== "HARD" && filledCount > 0 && chemistry.links.length > 0 ? (
              <p className="w-full text-center text-xs text-lime-300">
                Chemistry {formatChemistryBonus(chemistry.bonus)}:{" "}
                {chemistry.links
                  .map((l) => {
                    const a = squad.find((x) => x.slotIndex === l.slotA)?.label ?? "";
                    const b = squad.find((x) => x.slotIndex === l.slotB)?.label ?? "";
                    return `${a}–${b} (${l.label})`;
                  })
                  .join(" · ")}
              </p>
            ) : null}
            {dailyChallengeMode && autofillAllowed && dailyAttemptCounts ? (
              <p className="w-full text-center text-xs text-gray-400">
                Auto-fill counts as today&apos;s attempt.
              </p>
            ) : null}
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
                hardMode={difficulty === "HARD"}
                selectedSlot={
                  phase === "pitch" && !isDraftMode
                    ? selectedSlotIndex ?? undefined
                    : undefined
                }
                highlightSlot={suggestedSlotIndex ?? undefined}
                interactive={
                  !clubChoiceSpin &&
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

          {/* Secondary draft controls live under the pitch: the pitch and the Spin bar come first. */}
          {phase === "pitch" && isSlotRecruitMode && filledCount < TOTAL_SLOTS && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={quickSpins}
                onClick={toggleQuickSpins}
                className="rounded-full border border-white/10 bg-pitch-950 px-2.5 py-1 text-[11px] font-bold text-gray-300 transition hover:text-white"
              >
                Quick spins: {quickSpins ? "On" : "Off"}
              </button>
              {!dailyChallengeMode && difficulty !== "HARD" &&
                (normalEraMode ? (
                  <EraRatingExplanation compact className="w-full" />
                ) : (
                  <CurrentRatingExplanation compact className="w-full" />
                ))}
            </div>
          )}
          {phase === "pitch" && !dailyChallengeMode && !weeklyChallengeMode ? (
            <div className="mt-3">
              <GuestNotice variant="play" />
            </div>
          ) : null}

          {phase === "simulation" && gauntletResult && (
            <div className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}>
              <GauntletRun
                result={gauntletResult}
                era={normalEraMode}
                record={gauntletRecord?.record ?? null}
                newBest={gauntletRecord?.newBest ?? false}
                onPlayAgain={resetRun}
              />
            </div>
          )}

          {phase === "simulation" && seasonResult && (
            <div className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}>
              <SeasonSimulation
                result={seasonResult}
                onComplete={handleSimulationComplete}
                halfwayCall={halfwayCall}
                onHalfwayCall={handleHalfwayCall}
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
              positionReel={positionReel}
              positionRespin={
                clubChoiceSpin && respinsAllowed && difficulty !== "HARD"
                  ? { left: respinsRemaining, onRespin: () => void handleSlotRespin() }
                  : null
              }
              spinVariant={spinVariant}
              boostStatus={spinBoostStatus}
              boostDetail={spinBoostDetail}
              slotLabel={
                selectedSlotIndex !== null
                  ? squad.find((s) => s.slotIndex === selectedSlotIndex)?.label
                  : undefined
              }
              quickSpin={quickSpins}
              onComplete={handleRevealComplete}
            />
          )}

          <AnimatePresence initial={false}>
            {phase === "choice" &&
              isSlotRecruitMode &&
              activeSpinTarget && (
              <BodyPortal key={slotChoiceKey}>
                <motion.div
                  className={`recruitment-choice-backdrop recruitment-choice-overlay ${uiLayerClass("modalBackdrop")}`}
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 1 }}
                >
                  <motion.div
                    ref={slotPickerRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Pick your ${
                      selectedSlotIndex !== null
                        ? squad.find((x) => x.slotIndex === selectedSlotIndex)?.label ?? "player"
                        : "player"
                    }`}
                    className="recruitment-choice-panel outline-none"
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
                    {pickerNotice && (
                      <p className="mb-2 rounded-lg bg-amber-500/15 px-3 py-1.5 text-center text-xs font-semibold text-amber-100" role="status">
                        {pickerNotice}
                      </p>
                    )}
                    <SlotTeamYearPicker
                      target={activeSpinTarget}
                      entries={slotRecruitEntries}
                      onSelect={handleSlotTeamYearPick}
                      onBack={handleBackToPitch}
                      onRespin={handleSlotRespin}
                      respinsRemaining={respinsAllowed ? respinsRemaining : 0}
                      maxRespins={respinsAllowed ? MAX_RESPINS_PER_RUN : 0}
                      disabled={choosing}
                      hardMode={difficulty === "HARD"}
                      boosted={Boolean(boostNotice)}
                      eraMode={normalEraMode}
                      showChemistry={showChemistry}
                      clubChoice={clubChoiceSpin}
                      hideRatingNote={dailyChallengeMode || difficulty === "HARD"}
                      slot={
                        selectedSlotIndex !== null
                          ? squad.find((s) => s.slotIndex === selectedSlotIndex) ?? null
                          : null
                      }
                      squad={squad}
                      autoSignSingle={
                        difficulty === "HARD" ||
                        !respinsAllowed ||
                        respinsRemaining <= 0
                      }
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
                className={`recruitment-choice-backdrop recruitment-choice-overlay ${uiLayerClass("modalBackdrop")}`}
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <motion.div
                  ref={pairPickerRef}
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Pick a player"
                  className={`${CARD.panel} recruitment-choice-panel outline-none ${MODAL.panelPadding}`}
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
              onClick={(e) => {
                playUiClick();
                // Confirm before walking away from a half-built run (it is saved either way).
                if (runInProgress) {
                  e.preventDefault();
                  setLeaveConfirmOpen(true);
                }
              }}
              className={`${BTN.base} ${BTN.secondary} min-h-[var(--mobile-tap-target)] shrink-0 px-3 text-xs`}
            >
              Leave run
            </Link>
            {/* Ranked Daily: Auto-fill is a quiet secondary option, never the main call to action. */}
            {phase === "pitch" && filledCount < TOTAL_SLOTS && autofillAllowed && !pendingSpin && (
              <GameButton
                variant={dailyChallengeMode || weeklyChallengeMode ? "ghost" : "secondary"}
                size="sm"
                fullWidth={false}
                onClick={handleAutofill}
                disabled={choosing || hideActionBar}
                className="min-h-[var(--mobile-tap-target)] shrink-0 px-3 text-xs"
              >
                Auto-fill<span className="sr-only"> squad</span>
              </GameButton>
            )}
            {phase === "pitch" &&
              !squadComplete &&
              (suggestedSlotIndex !== null || (clubChoiceSpin && !superSamHallasMode)) && (
              <GameButton
                variant="theme"
                size="sm"
                fullWidth={false}
                onClick={() => {
                  if (clubChoiceSpin) startPositionSpin();
                  else if (suggestedSlotIndex !== null) startSlotRecruitSpin(suggestedSlotIndex);
                }}
                disabled={choosing || hideActionBar}
                className="min-h-[var(--mobile-tap-target)] flex-1 px-3 text-xs"
              >
                {pendingSpin
                  ? `Back to ${suggestedSlotLabel ?? "spin"}`
                  : clubChoiceSpin
                    ? "Spin"
                    : `Spin ${suggestedSlotLabel ?? "next"}`}
              </GameButton>
            )}
            {phase === "pitch" && squadComplete && (
              <GameButton
                variant="theme"
                size="sm"
                fullWidth={false}
                onClick={kickOffSeason}
                disabled={hideActionBar}
                className="min-h-[var(--mobile-tap-target)] flex-1 px-3 text-xs"
              >
                {gauntletMode ? "Take on the Gauntlet" : "Kick off the season"}
              </GameButton>
            )}
        </StickyActionBar>
      )}

      {isReviewPhase &&
        seasonResult &&
        reviewStage === "regular" && (
        <>
        <div className="mb-3 px-1 sm:mb-4">
          <RunProgress stage="season" filledCount={filledCount} totalSlots={TOTAL_SLOTS} />
        </div>
        {dailyScenario ? (
          <DailyRuleBanner scenario={dailyScenario} className="mx-1 mb-3 sm:mb-4" />
        ) : weeklyScenario ? (
          <DailyRuleBanner scenario={weeklyScenario} label="Weekly rule" className="mx-1 mb-3 sm:mb-4" />
        ) : archiveScenario ? (
          <DailyRuleBanner scenario={archiveScenario} label="Past Daily (practice)" className="mx-1 mb-3 sm:mb-4" />
        ) : null}
        {oneClub ? (
          <div
            className={`${CARD.base} mx-1 mb-3 border-theme-primary/40 px-3 py-2 text-center sm:mb-4`}
            role="note"
          >
            <p className={`${TYPO.eyebrow} text-theme-primary`}>One-Club XI · {oneClub}</p>
            <p className="mt-0.5 text-[15px] font-bold text-white">
              {oneClubOutcome
                ? `Your all-time ${oneClub} XI: ${formatOneClubRecord(oneClubOutcome.record)}${
                    oneClubOutcome.newBest && oneClubOutcome.previous ? " (new best)" : ""
                  }`
                : `This season: ${seasonResult.wins}-${seasonResult.losses}`}
            </p>
            <p className={`mt-0.5 ${TYPO.meta}`}>
              {oneClubOutcome && oneClubOutcome.record.seasons > 1
                ? `${oneClubOutcome.record.seasons} seasons played${
                    oneClubOutcome.record.titles > 0 ? ` · ${oneClubOutcome.record.titles} Grand Final${oneClubOutcome.record.titles === 1 ? "" : "s"}` : ""
                  } · `
                : ""}
              Unranked. No Club Funds.
            </p>
          </div>
        ) : null}
        <SeasonReview
          squad={squad}
          mode={mode}
          seed={seed}
          difficulty={difficulty}
          joeMellorMode={joeMellorMode}
          superSamHallasMode={superSamHallasMode}
          normalEraMode={normalEraMode}
          dailyChallengeMode={dailyChallengeMode}
          dailyAttemptCounts={dailyAttemptCounts}
          dailyScenario={dailyScenario}
          weeklyChallengeMode={weeklyChallengeMode}
          weeklyScore={weeklyRunScore}
          weeklyAttemptCounts={weeklyAttemptCounts}
          seasonResult={seasonResult}
          runRank={runRank}
          submittedOnline={submittedOnline}
          boostedRun={usedBoostThisRun}
          clubFundsPayout={clubFundsPayout}
          newSquadBookCards={squadBookNewCards}
          challenge={challenge}
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
        <>
        <div className="mb-3 mt-2 px-1 sm:mb-4">
          <RunProgress stage="playoffs" filledCount={filledCount} totalSlots={TOTAL_SLOTS} />
        </div>
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
        </>
      )}

      {isReviewPhase &&
        seasonResult &&
        seasonResult.playoffResult &&
        reviewStage === "playoffFinal" && (
        <>
        <div className="mt-2 px-1">
          <RunProgress stage="playoffs" filledCount={filledCount} totalSlots={TOTAL_SLOTS} />
        </div>
        {dailyScenario ? (
          <DailyRuleBanner scenario={dailyScenario} className="mx-1 mb-1 mt-2 sm:mt-4" />
        ) : weeklyScenario ? (
          <DailyRuleBanner scenario={weeklyScenario} label="Weekly rule" className="mx-1 mb-1 mt-2 sm:mt-4" />
        ) : archiveScenario ? (
          <DailyRuleBanner scenario={archiveScenario} label="Past Daily (practice)" className="mx-1 mb-1 mt-2 sm:mt-4" />
        ) : null}
        <PlayoffReview
          squad={squad}
          seasonResult={seasonResult}
          playoffResult={seasonResult.playoffResult}
          playoffBracketState={completedPlayoffBracketState}
          playoffFundsPayout={playoffFundsPayout}
          dailyChallengeMode={dailyChallengeMode}
          dailyScenario={dailyScenario}
          dailyAttemptCounts={dailyAttemptCounts}
          weeklyChallengeMode={weeklyChallengeMode}
          weeklyScore={weeklyRunScore}
          weeklyAttemptCounts={weeklyAttemptCounts}
          normalEraMode={normalEraMode}
          difficulty={difficulty}
          submittedOnline={submittedOnline}
          runRank={runRank}
          seed={seed}
          challenge={challenge}
          onFinalizeRun={handleFinalizePlayoffRun}
          onPlayAgain={handlePlayoffReviewDone}
          onClose={() => setPhase("pitch")}
          onReturnHome={resetRun}
        />
        </>
      )}
      </div>
      {leaveConfirmOpen && (
        <BodyPortal>
          <div
            className={`recruitment-choice-backdrop fixed inset-0 flex items-center justify-center bg-black/80 px-4 ${uiLayerClass("modalBackdrop")}`}
            onClick={() => setLeaveConfirmOpen(false)}
          >
            <div
              ref={leaveDialogRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="leave-run-title"
              aria-describedby="leave-run-body"
              className={`${CARD.panel} w-full max-w-sm p-5 text-center outline-none`}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="leave-run-title" className="text-lg font-bold text-white">
                Leave this run?
              </h2>
              <p id="leave-run-body" className={`mt-2 ${TYPO.bodySm} text-gray-300`}>
                {resumeModeKey
                  ? `${filledCount}/${TOTAL_SLOTS} signed. Your squad is saved. Open ${
                      dailyChallengeMode ? "today's Daily" : weeklyChallengeMode ? "this week's Weekly" : normalEraMode ? "Era Classic" : "Classic"
                    } to carry on.`
                  : `${filledCount}/${TOTAL_SLOTS} signed. This run won't be saved.`}
              </p>
              <div className="mt-4 flex gap-2">
                <GameButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    playUiClick();
                    setLeaveConfirmOpen(false);
                  }}
                >
                  Keep playing
                </GameButton>
                <GameButton
                  variant="theme"
                  size="md"
                  fullWidth
                  onClick={() => {
                    playUiClick();
                    setLeaveConfirmOpen(false);
                    router.push("/");
                  }}
                >
                  Leave run
                </GameButton>
              </div>
            </div>
          </div>
        </BodyPortal>
      )}
    </div>
  );
}
