"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ManagerLanding } from "@/components/manager/ManagerLanding";
import { ManagerClubSelect } from "@/components/manager/ManagerClubSelect";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { ManagerMobileBottomNav } from "@/components/manager/ManagerMobileBottomNav";
import { ManagerKeepAlivePane } from "@/components/manager/ManagerKeepAlivePane";
import { ManagerHub } from "@/components/manager/ManagerHub";
import { ManagerSquad } from "@/components/manager/ManagerSquad";
import { ManagerContracts } from "@/components/manager/ManagerContracts";
import { ManagerReserves } from "@/components/manager/ManagerReserves";
import { ManagerInbox } from "@/components/manager/ManagerInbox";
import { ManagerTransfers } from "@/components/manager/ManagerTransfers";
import { ManagerClub } from "@/components/manager/ManagerClub";
import { ManagerFixtures } from "@/components/manager/ManagerFixtures";
import { ManagerAcrossLeague } from "@/components/manager/ManagerAcrossLeague";
import { ManagerStatsView } from "@/components/manager/ManagerStatsView";
import { ManagerSettings } from "@/components/manager/ManagerSettings";
const ManagerPlayGame = dynamic(
  () =>
    import("@/components/manager/ManagerPlayGame").then((m) => ({
      default: m.ManagerPlayGame,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed inset-0 z-[100] bg-black/85"
        aria-busy="true"
        aria-label="Loading live match"
      />
    ),
  }
);
import { ManagerMatchReview } from "@/components/manager/ManagerMatchReview";
import { ManagerSeasonReview } from "@/components/manager/ManagerSeasonReview";
import { ManagerChooseNextClub } from "@/components/manager/ManagerChooseNextClub";
import { ManagerDevelopmentReview } from "@/components/manager/ManagerDevelopmentReview";
import { ManagerSeasonRewards } from "@/components/manager/ManagerSeasonRewards";
import { ManagerTrophyModal } from "@/components/manager/ManagerTrophyModal";
import { ManagerLeagueWinnersModal } from "@/components/manager/ManagerLeagueWinnersModal";
import { ManagerChallengeCupWinModal } from "@/components/manager/ManagerChallengeCupWinModal";
import { ManagerWorldClubChallengeWinModal } from "@/components/manager/ManagerWorldClubChallengeWinModal";
import { ManagerClubStarRiseModal } from "@/components/manager/ManagerClubStarRiseModal";
import { ManagerSeasonRecordModal } from "@/components/manager/ManagerSeasonRecordModal";
import { ManagerIncomingBidModal } from "@/components/manager/ManagerIncomingBidModal";
import { ManagerRetirementIntentModal } from "@/components/manager/ManagerRetirementIntentModal";
import { ManagerContractExpiryModal } from "@/components/manager/ManagerContractExpiryModal";
import { ManagerReserveReportModal } from "@/components/manager/ManagerReserveReportModal";
import { ManagerBoardMessageModal } from "@/components/manager/ManagerBoardMessageModal";
import { triggerManagerMatchAchievements } from "@/lib/achievements/achievementTriggers";
import { ManagerPositionRetrainingCompleteModal } from "@/components/manager/ManagerPositionRetrainingCompleteModal";
import { ManagerPlayoffsIntroModal } from "@/components/manager/ManagerPlayoffsIntroModal";
import { ManagerObjectivesIntroModal } from "@/components/manager/ManagerObjectivesIntroModal";
import { ManagerOnboardingModal } from "@/components/manager/ManagerOnboardingModal";
import {
  getPendingFutureStarReveal,
  ManagerFutureStarRevealModal,
} from "@/components/manager/ManagerFutureStarRevealModal";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerFriendlySelect } from "@/components/manager/ManagerFriendlySelect";
import { ManagerHubStickyActions } from "@/components/manager/ManagerHubStickyActions";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { autoFixMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import {
  loadManagerCareer,
  saveManagerCareer,
  flushManagerCareerToDisk,
  deleteManagerCareer,
  createNewCareer,
  advanceToNextSeason,
  hydrateManagerCareer,
  prepareManagerCareerForSave,
  getActiveSaveSlot,
  setActiveSaveSlot,
  listManagerSaveSlots,
  type ManagerSaveSlotSummary,
} from "@/lib/manager/managerState";
import { takeOverClub } from "@/lib/manager/managerClubChange";
import {
  advanceManagerMatchWeek,
  getNextManagerFixture,
  isManagerSeasonComplete,
  prepareCareerForNextMatch,
  simulateManagerNextMatch,
} from "@/lib/manager/managerSimulation";
import {
  acknowledgeManagerEventId,
  canPlayNextMatch,
  collectWeeklyManagerEventIds,
  hasBlockingManagerDecision,
  withWeeklyManagerEventQueue,
} from "@/lib/manager/managerMatchWeek";
import { scrollToManagerHubNextFixture } from "@/lib/manager/managerHubScroll";
import { getManagerMatchOccasionPresentation } from "@/lib/manager/managerMatchOccasion";
import {
  getDocumentScrollY,
  scrollDocumentTo,
  scrollDocumentToTop,
} from "@/lib/ui/scroll";
import { shouldShowManagerObjectivesIntro } from "@/lib/manager/managerBoardObjectives";
import {
  ensureBoardObjectivesInbox,
  getPendingBoardInboxPopup,
} from "@/lib/manager/managerBoardInbox";
import { acknowledgePlayoffsIntro, needsPlayoffsIntro, shouldShowLeagueWinnersCelebration } from "@/lib/manager/managerPlayoffs";
import { shouldShowChallengeCupCelebration } from "@/lib/manager/managerChallengeCup";
import { shouldShowWorldClubChallengeCelebration } from "@/lib/manager/worldClubChallenge";
import {
  resolvePendingSeasonRecordCelebration,
  shouldShowPerfectSeasonCelebration,
  shouldShowWinlessSeasonCelebration,
  type ManagerSeasonRecordCelebrationKind,
} from "@/lib/manager/managerSeasonRecordCelebration";
import {
  acknowledgeClubStarRiseCelebration,
  getPendingClubStarRiseFrom,
  shouldShowClubStarRiseCelebration,
} from "@/lib/manager/managerDifficulty";
import {
  recordCareerStarted,
  recordMatchResult,
  recordLeaguePhaseAchievementsIfNeeded,
  recordSeasonCompleteIfNeeded,
} from "@/lib/manager/managerStats";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playTransferComplete,
  playManagerAppointed,
  playUiClick,
} from "@/lib/sound";
import { PageShell } from "@/components/ui/PageShell";
import { PAGE } from "@/lib/ui/design-system";
import { useMountDiagnostic } from "@/lib/ui/use-mount-diagnostic";
import {
  confirmFriendlySchedule,
  ensureFriendlyChoices,
  FRIENDLIES_REQUIRED,
  isAwaitingFriendlyChoice,
  isAwaitingFriendlyScheduleConfirm,
  selectFriendlyOpponent,
  undoLastFriendlyDraftPick,
} from "@/lib/manager/managerFriendlies";
import {
  acknowledgeContractExpiryPopup,
  countUnreadInbox,
  getPendingContractExpiryPopup,
  markInboxMessageRead,
} from "@/lib/manager/managerInbox";
import {
  acceptReserveTransferOffer,
  rejectReserveTransferOffer,
} from "@/lib/manager/championshipBidForSlReserves";
import {
  acceptIncomingOffer,
  getPendingIncomingClubBid,
  rejectIncomingOffer,
} from "@/lib/manager/managerTransferLeague";
import {
  acknowledgeRetirementIntentPopup,
  convincePlayerToStay,
  getPendingRetirementIntentPopup,
} from "@/lib/manager/managerRetirement";
import {
  acknowledgeReserveReportPopup,
  getPendingReserveReportPopup,
} from "@/lib/manager/managerReserveReports";
import {
  acknowledgePositionRetrainingPopup,
  getPendingPositionRetrainingPopup,
} from "@/lib/manager/managerPositionRetraining";
import {
  downloadManagerCareerExport,
  importManagerCareerFromFile,
} from "@/lib/manager/managerSaveExport";
import {
  ensureManagerSaveStorageReady,
  readManagerCareerRaw,
} from "@/lib/manager/managerSaveStorage";
import { isLoggedIn } from "@/lib/auth-session";
import {
  flushManagerCareerToCloud,
  MANAGER_SAVES_CHANGED_EVENT,
  refreshManagerCareersFromCloud,
} from "@/lib/storage/manager-career-cloud";
import {
  markOnboardingStepComplete,
  shouldShowManagerOnboarding,
} from "@/lib/manager/managerOnboarding";
import { shouldShowSaveMigrationNotice } from "@/lib/manager/managerSaveMigration";
import { managerFixtureDisplayId } from "@/lib/manager/managerFixtureDisplay";
import { ManagerSaveMigrationNotice } from "@/components/manager/ManagerSaveMigrationNotice";
import {
  MANAGER_NAV_VIEWS,
  isManagerNavView,
  isManagerStateOverlayView,
  managerPathForSquadTab,
  managerPathForView,
  managerPathFromLegacyViewParam,
  managerViewFromPathname,
  resolveManagerDisplayView,
  resolveManagerScreenFromPathname,
  resolveSquadSubTabDisplay,
  SQUAD_SUB_TAB_OPTIONS,
  type SquadSubTab,
} from "@/lib/manager/manager-routes";

/** Full-screen manager views that should open at the top of the page. */
const SCROLL_TOP_VIEWS: ManagerView[] = [
  "match-review",
  "season-review",
  "development-review",
  "season-rewards",
  "choose-next-club",
];

function scrollManagerPageToTop() {
  scrollDocumentToTop();
}

function setManagerView(
  setView: Dispatch<SetStateAction<ManagerView>>,
  next: ManagerView
) {
  setView((current) => (current === next ? current : next));
}

function resolveInitialNavView(pathname: string, saved: ManagerCareer): ManagerView {
  const fromPath = managerViewFromPathname(pathname);
  if (fromPath && isManagerNavView(fromPath)) return fromPath;
  return "hub";
}

export default function ManagerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [view, setView] = useState<ManagerView>("landing");
  /** Forward nav only — cleared synchronously when pathname changes (browser back). */
  const pendingForwardNavRef = useRef<{ path: string; view: ManagerView } | null>(
    null
  );
  const prevPathnameForNavRef = useRef(pathname);
  const displayView = useMemo(() => {
    const pathChanged = prevPathnameForNavRef.current !== pathname;
    const pending = pendingForwardNavRef.current;

    // Optimistic forward tab paint before router pathname catches up.
    if (
      pending &&
      !pathChanged &&
      pathname !== pending.path &&
      view === pending.view
    ) {
      return pending.view;
    }

    if (pathChanged) {
      pendingForwardNavRef.current = null;
      prevPathnameForNavRef.current = pathname;
    }

    return resolveManagerDisplayView(pathname, view);
  }, [pathname, view]);
  const squadSubTab = useMemo(
    () => resolveSquadSubTabDisplay(pathname),
    [pathname]
  );
  const [career, setCareer] = useState<ManagerCareer | null>(null);
  const [activeSlot, setActiveSlot] = useState(0);
  const [saveSlots, setSaveSlots] = useState<ManagerSaveSlotSummary[]>([]);
  const [saveStorageReady, setSaveStorageReady] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [reviewFixtureId, setReviewFixtureId] = useState<string | null>(null);
  const [playGameOpen, setPlayGameOpen] = useState(false);
  const [trophyModalOpen, setTrophyModalOpen] = useState(false);
  const [pendingTrophyCelebration, setPendingTrophyCelebration] = useState(false);
  const [leagueWinnersModalOpen, setLeagueWinnersModalOpen] = useState(false);
  const [pendingLeagueWinnersCelebration, setPendingLeagueWinnersCelebration] =
    useState(false);
  const [challengeCupWinModalOpen, setChallengeCupWinModalOpen] = useState(false);
  const [pendingChallengeCupCelebration, setPendingChallengeCupCelebration] =
    useState(false);
  const [wccWinModalOpen, setWccWinModalOpen] = useState(false);
  const [pendingWccCelebration, setPendingWccCelebration] = useState(false);
  const [clubStarRiseModalOpen, setClubStarRiseModalOpen] = useState(false);
  const [pendingSeasonRecordCelebration, setPendingSeasonRecordCelebration] =
    useState<ManagerSeasonRecordCelebrationKind | null>(null);
  const [seasonRecordModalOpen, setSeasonRecordModalOpen] =
    useState<ManagerSeasonRecordCelebrationKind | null>(null);
  const [pendingIncomingBidId, setPendingIncomingBidId] = useState<string | null>(
    null
  );
  const [incomingBidModalOpen, setIncomingBidModalOpen] = useState(false);
  const [pendingRetirementIntentId, setPendingRetirementIntentId] = useState<
    string | null
  >(null);
  const [retirementIntentModalOpen, setRetirementIntentModalOpen] =
    useState(false);
  const [pendingContractExpiryId, setPendingContractExpiryId] = useState<
    string | null
  >(null);
  const [contractExpiryModalOpen, setContractExpiryModalOpen] = useState(false);
  const [pendingReserveReportId, setPendingReserveReportId] = useState<
    string | null
  >(null);
  const [reserveReportModalOpen, setReserveReportModalOpen] = useState(false);
  const [pendingBoardMessageId, setPendingBoardMessageId] = useState<
    string | null
  >(null);
  const [boardMessageModalOpen, setBoardMessageModalOpen] = useState(false);
  const [pendingPositionRetrainingId, setPendingPositionRetrainingId] =
    useState<string | null>(null);
  const [positionRetrainingCompleteModalOpen, setPositionRetrainingCompleteModalOpen] =
    useState(false);
  const [postMatchReviewFlow, setPostMatchReviewFlow] = useState(false);
  const [matchReviewReturnView, setMatchReviewReturnView] =
    useState<ManagerView>("hub");
  const [pendingHubNextFixtureScroll, setPendingHubNextFixtureScroll] =
    useState(false);
  const [advancingWeek, setAdvancingWeek] = useState(false);
  const [fixturesInitialFilter, setFixturesInitialFilter] = useState<
    "calendar" | "all" | "cup" | null
  >(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSlot, setDeleteSlot] = useState<number | null>(null);
  const [alertDialog, setAlertDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [showSaveMigration, setShowSaveMigration] = useState(false);
  const [onboardingRevision, setOnboardingRevision] = useState(0);
  const [creatingCareer, setCreatingCareer] = useState(false);

  /** Slot whose career is already in React state — skip disk re-hydrate on tab switches. */
  const careerSlotRef = useRef<number | null>(null);
  const careerRef = useRef<ManagerCareer | null>(null);
  const flushErrorRef = useRef<string | null>(null);
  const afterMatchRef = useRef<(next: ManagerCareer) => void>(() => {});

  const setCareerState = useCallback((next: ManagerCareer | null) => {
    careerRef.current = next;
    setCareer(next);
  }, []);

  const goToView = useCallback(
    (next: ManagerView, options?: { syncUrl?: boolean }) => {
      if (options?.syncUrl === false) {
        setManagerView(setView, next);
        return;
      }

      if (
        next === "match-review" ||
        next === "season-review" ||
        next === "development-review" ||
        next === "season-rewards" ||
        next === "choose-next-club"
      ) {
        setManagerView(setView, next);
        return;
      }
      if (next === "landing") {
        const target = "/manager";
        pendingForwardNavRef.current = { path: target, view: "landing" };
        setManagerView(setView, "landing");
        router.replace(target, { scroll: false });
        return;
      }

      if (next === "club-select") {
        const target = managerPathForView("club-select");
        pendingForwardNavRef.current = { path: target, view: "club-select" };
        setManagerView(setView, "club-select");
        router.replace(target, { scroll: false });
        return;
      }

      if (isManagerNavView(next)) {
        const target = managerPathForView(next);
        pendingForwardNavRef.current = { path: target, view: next };
        setManagerView(setView, next);
        if (target !== pathname) {
          router.push(target, { scroll: false });
        }
        return;
      }

      setManagerView(setView, next);
    },
    [router, pathname]
  );

  const prevPathnameRef = useRef<string | null>(null);

  /** Sync view from URL on mount and browser back/forward; dismiss stale overlays. */
  useLayoutEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    const hadPreviousPath = prevPathnameRef.current !== null;
    prevPathnameRef.current = pathname;

    const fromUrl = resolveManagerScreenFromPathname(pathname);
    if (!fromUrl) return;

    if (hadPreviousPath) {
      setReviewFixtureId(null);
      setPostMatchReviewFlow(false);
      setPendingChallengeCupCelebration(false);
      setPendingWccCelebration(false);
      setPendingLeagueWinnersCelebration(false);
      setPendingTrophyCelebration(false);
      setPendingSeasonRecordCelebration(null);
      setManagerView(setView, fromUrl);
      return;
    }

    if (!isManagerStateOverlayView(view)) {
      setManagerView(setView, fromUrl);
    }
  }, [pathname, view]);

  const refreshSaveSlots = useCallback(() => {
    setSaveSlots(listManagerSaveSlots());
  }, []);

  useMountDiagnostic("manager-shell");

  useEffect(() => {
    let cancelled = false;
    void ensureManagerSaveStorageReady().then(() => {
      if (cancelled) return;
      refreshSaveSlots();
      setActiveSlot(getActiveSaveSlot());
      setSaveStorageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSaveSlots]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pullFromCloud = () => {
      if (!isLoggedIn()) return;
      void refreshManagerCareersFromCloud().then(() => {
        refreshSaveSlots();
        const slot = getActiveSaveSlot();
        const fromPath = managerViewFromPathname(pathname);
        if (!fromPath || !isManagerNavView(fromPath)) return;
        if (careerSlotRef.current === slot && careerRef.current) return;
        const raw = readManagerCareerRaw(slot);
        if (!raw) return;
        careerSlotRef.current = slot;
        setCareerState(hydrateManagerCareer(raw));
      });
    };

    const onSavesChanged = () => {
      refreshSaveSlots();
    };

    window.addEventListener("auth-state-changed", pullFromCloud);
    window.addEventListener(MANAGER_SAVES_CHANGED_EVENT, onSavesChanged);

    return () => {
      window.removeEventListener("auth-state-changed", pullFromCloud);
      window.removeEventListener(MANAGER_SAVES_CHANGED_EVENT, onSavesChanged);
    };
  }, [pathname, refreshSaveSlots, setCareerState]);

  /** Load career from disk once per save slot — not on every tab change. */
  useLayoutEffect(() => {
    if (!saveStorageReady) return;
    const slot = getActiveSaveSlot();
    setActiveSlot((prev) => (prev === slot ? prev : slot));

    const fromPath = managerViewFromPathname(pathname);
    if (!fromPath || !isManagerNavView(fromPath)) return;
    if (careerSlotRef.current === slot) return;

    const raw = readManagerCareerRaw(slot);
    if (!raw) return;

    careerSlotRef.current = slot;
    setCareerState(hydrateManagerCareer(raw));
    setShowSaveMigration(
      shouldShowSaveMigrationNotice(raw.saveVersion)
    );
  }, [pathname, saveStorageReady, setCareerState]);

  const persist = useCallback(
    (next: ManagerCareer) => {
      const slot = getActiveSaveSlot();
      const prepared = prepareManagerCareerForSave(next);
      const xiiiFilled = prepared.matchdayXiii.filter(Boolean).length;
      if (xiiiFilled >= 13) {
        markOnboardingStepComplete("lineup");
      }
      const result = saveManagerCareer(prepared, slot);
      if (!result.ok) {
        flushErrorRef.current = result.error;
        setCareerState(prepared);
        setAlertDialog({
          title: "Save failed",
          message: result.error,
        });
        return;
      }
      flushErrorRef.current = null;
      setCareerState(prepared);
      setActiveSlot(slot);
      refreshSaveSlots();
    },
    [refreshSaveSlots, setCareerState]
  );

  /** Persist and open a bid popup if another club has an unresolved offer. */
  const persistAndSurfaceIncomingBids = useCallback(
    (next: ManagerCareer) => {
      persist(next);
      const bid = getPendingIncomingClubBid(next);
      if (!bid) return;
      setPendingIncomingBidId(bid.id);
      setIncomingBidModalOpen(true);
    },
    [persist]
  );

  const continueCelebrationQueue = useCallback(
    (
      fromStep:
        | "wcc"
        | "cup"
        | "seasonRecord"
        | "leagueWinners"
        | "trophy" = "wcc",
      nextCareer?: ManagerCareer | null
    ) => {
      const steps = [
        "wcc",
        "cup",
        "seasonRecord",
        "leagueWinners",
        "trophy",
      ] as const;
      const start = steps.indexOf(fromStep);

      for (let i = start; i < steps.length; i++) {
        const step = steps[i];
        if (step === "wcc" && pendingWccCelebration) {
          setPendingWccCelebration(false);
          setWccWinModalOpen(true);
          goToView("hub");
          return;
        }
        if (step === "cup" && pendingChallengeCupCelebration) {
          setPendingChallengeCupCelebration(false);
          setChallengeCupWinModalOpen(true);
          goToView("hub");
          return;
        }
        if (step === "seasonRecord" && pendingSeasonRecordCelebration) {
          const kind = pendingSeasonRecordCelebration;
          setPendingSeasonRecordCelebration(null);
          setSeasonRecordModalOpen(kind);
          goToView("hub");
          return;
        }
        if (step === "leagueWinners" && pendingLeagueWinnersCelebration) {
          setPendingLeagueWinnersCelebration(false);
          setLeagueWinnersModalOpen(true);
          goToView("hub");
          return;
        }
        if (step === "trophy" && pendingTrophyCelebration) {
          setPendingTrophyCelebration(false);
          setTrophyModalOpen(true);
          goToView("hub");
          return;
        }
      }

      const resolvedCareer = nextCareer ?? career;
      if (resolvedCareer?.isSeasonComplete) {
        goToView("season-review", { syncUrl: false });
        return;
      }

      goToView("hub");
    },
    [
      career,
      goToView,
      pendingWccCelebration,
      pendingChallengeCupCelebration,
      pendingLeagueWinnersCelebration,
      pendingSeasonRecordCelebration,
      pendingTrophyCelebration,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const flush = () => {
      const current = careerRef.current;
      if (!current) return;
      const slot = getActiveSaveSlot();
      const result = flushManagerCareerToDisk(current, slot);
      if (!result.ok) {
        flushErrorRef.current = result.error;
      } else {
        flushErrorRef.current = null;
      }
      if (isLoggedIn()) {
        void flushManagerCareerToCloud(current, slot);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
        return;
      }
      if (flushErrorRef.current) {
        setAlertDialog({
          title: "Save failed",
          message: flushErrorRef.current,
        });
        flushErrorRef.current = null;
      }
      refreshSaveSlots();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const slot = getActiveSaveSlot();
      if (careerSlotRef.current === slot && careerRef.current) return;
      const fromPath = managerViewFromPathname(pathnameRef.current);
      if (!fromPath || !isManagerNavView(fromPath)) return;
      const raw = readManagerCareerRaw(slot);
      if (!raw) return;
      careerSlotRef.current = slot;
      setCareerState(hydrateManagerCareer(raw));
      refreshSaveSlots();
    };

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    const freezeHandler = () => flush();
    window.addEventListener("freeze", freezeHandler);

    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("freeze", freezeHandler);
    };
    // Pathname must not be a dependency — tab switches would flush+rebind and jank.
  }, [refreshSaveSlots, setCareerState]);

  const awaitingFriendlyChoice =
    career != null &&
    (isAwaitingFriendlyChoice(career) ||
      isAwaitingFriendlyScheduleConfirm(career));

  useLayoutEffect(() => {
    if (!awaitingFriendlyChoice) return;
    if (MANAGER_NAV_VIEWS.includes(displayView) && displayView !== "hub") {
      goToView("hub");
    }
  }, [awaitingFriendlyChoice, displayView, goToView]);

  useEffect(() => {
    if (!career || !isAwaitingFriendlyChoice(career)) return;
    const next = ensureFriendlyChoices(career);
    // persist() always yields a new career identity, so re-persisting an
    // unchanged career would re-trigger this effect forever.
    if (next === career) return;
    persist(next);
  }, [career, persist]);

  useEffect(() => {
    if (!SCROLL_TOP_VIEWS.includes(view)) return;
    // useLayoutEffect-equivalent timing via rAF once — avoid double document/window fight.
    const frame = requestAnimationFrame(() => {
      scrollManagerPageToTop();
    });
    return () => cancelAnimationFrame(frame);
  }, [view, reviewFixtureId]);

  useEffect(() => {
    if (displayView !== "hub" || !pendingHubNextFixtureScroll) return;
    setPendingHubNextFixtureScroll(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToManagerHubNextFixture();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [displayView, pendingHubNextFixtureScroll]);

  useEffect(() => {
    if (displayView === "hub" || !pendingHubNextFixtureScroll) return;
    setPendingHubNextFixtureScroll(false);
  }, [displayView, pendingHubNextFixtureScroll]);

  const handleNavNavigate = useCallback(
    (next: ManagerView) => {
      if (next !== "fixtures") {
        setFixturesInitialFilter(null);
      }
      if (career && isAwaitingFriendlyChoice(career) && next !== "hub") {
        goToView("hub");
        return;
      }
      goToView(next);
    },
    [career, goToView]
  );

  /**
   * KeepAlive tabs: preserve each nav view's scroll position instead of
   * yanking to top on every tab press (main source of "page jumps").
   */
  const prevNavViewRef = useRef<ManagerView | null>(null);
  const navScrollYRef = useRef<Partial<Record<ManagerView, number>>>({});
  const lastNavViewRef = useRef<ManagerView>("hub");
  useLayoutEffect(() => {
    if (!isManagerNavView(displayView)) {
      prevNavViewRef.current = displayView;
      return;
    }
    const prev = prevNavViewRef.current;
    if (prev != null && prev !== displayView && isManagerNavView(prev)) {
      navScrollYRef.current[prev] = getDocumentScrollY();
      const restoreY = navScrollYRef.current[displayView] ?? 0;
      scrollDocumentTo(restoreY);
    }
    prevNavViewRef.current = displayView;
  }, [displayView]);

  const handleSquadSubTabChange = useCallback(
    (tab: SquadSubTab) => {
      router.push(managerPathForSquadTab(tab), { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const legacyPath = managerPathFromLegacyViewParam(params.get("view"));
    if (legacyPath && legacyPath !== pathname) {
      router.replace(legacyPath);
    }
  }, [pathname, router]);

  const handleFriendlySelect = useCallback(
    (choiceId: string) => {
      if (!career) return;
      persist(
        ensureFriendlyChoices(selectFriendlyOpponent(career, choiceId))
      );
    },
    [career, persist]
  );

  const handleFriendlyScheduleConfirm = useCallback(() => {
    if (!career) return;
    persist(confirmFriendlySchedule(career));
  }, [career, persist]);

  const handleFriendlyScheduleBack = useCallback(() => {
    if (!career) return;
    persist(undoLastFriendlyDraftPick(career));
  }, [career, persist]);

  const handleStartNew = (slot: number) => {
    setActiveSlot(slot);
    setActiveSaveSlot(slot);
    careerSlotRef.current = null;
    setCareerState(null);
    // Clear leftover celebration UI from a previous save in this SPA session.
    setTrophyModalOpen(false);
    setPendingTrophyCelebration(false);
    setLeagueWinnersModalOpen(false);
    setPendingLeagueWinnersCelebration(false);
    setChallengeCupWinModalOpen(false);
    setPendingChallengeCupCelebration(false);
    setWccWinModalOpen(false);
    setPendingWccCelebration(false);
    setClubStarRiseModalOpen(false);
    setPendingSeasonRecordCelebration(null);
    setSeasonRecordModalOpen(null);
    setIncomingBidModalOpen(false);
    setPendingIncomingBidId(null);
    setRetirementIntentModalOpen(false);
    setPendingRetirementIntentId(null);
    setContractExpiryModalOpen(false);
    setPendingContractExpiryId(null);
    setReserveReportModalOpen(false);
    setPendingReserveReportId(null);
    setPositionRetrainingCompleteModalOpen(false);
    setPendingPositionRetrainingId(null);
    goToView("club-select");
  };

  const continueCareer = (saved: ManagerCareer, slot: number) => {
    careerSlotRef.current = slot;
    setActiveSlot(slot);
    setActiveSaveSlot(slot);
    setCareerState(saved);
    if (saved.isSeasonComplete) {
      if (shouldShowChallengeCupCelebration(saved)) {
        setChallengeCupWinModalOpen(true);
        goToView("hub");
        return;
      }
      if (
        saved.playoffs?.finish === "Super League Champions" &&
        !saved.trophyCelebrationShown
      ) {
        setTrophyModalOpen(true);
        goToView("hub");
        return;
      }
      goToView(
        saved.seasonRewardClaimedForYear === saved.seasonYear
          ? "season-rewards"
          : "season-review",
        { syncUrl: false }
      );
      return;
    }
    const incomingBid = getPendingIncomingClubBid(saved);
    const contractExpiry = getPendingContractExpiryPopup(saved);
    const retirementIntent = getPendingRetirementIntentPopup(saved);
    if (incomingBid) {
      setPendingIncomingBidId(incomingBid.id);
      setIncomingBidModalOpen(true);
    } else if (contractExpiry) {
      setPendingContractExpiryId(contractExpiry.id);
      setContractExpiryModalOpen(true);
    } else if (retirementIntent) {
      setPendingRetirementIntentId(retirementIntent.id);
      setRetirementIntentModalOpen(true);
    } else {
      const retrainingComplete = getPendingPositionRetrainingPopup(saved);
      if (retrainingComplete) {
        setPendingPositionRetrainingId(retrainingComplete.id);
        setPositionRetrainingCompleteModalOpen(true);
      } else {
        const reserveReport = getPendingReserveReportPopup(saved);
        if (reserveReport) {
          setPendingReserveReportId(reserveReport.id);
          setReserveReportModalOpen(true);
        } else if (shouldShowWorldClubChallengeCelebration(saved)) {
          setWccWinModalOpen(true);
        } else if (shouldShowChallengeCupCelebration(saved)) {
          setChallengeCupWinModalOpen(true);
        } else if (shouldShowLeagueWinnersCelebration(saved)) {
          setLeagueWinnersModalOpen(true);
        } else if (shouldShowPerfectSeasonCelebration(saved)) {
          setSeasonRecordModalOpen("perfect");
        } else if (shouldShowWinlessSeasonCelebration(saved)) {
          setSeasonRecordModalOpen("winless");
        } else if (shouldShowClubStarRiseCelebration(saved)) {
          setClubStarRiseModalOpen(true);
        }
      }
    }
    const nextView = resolveInitialNavView(pathname, saved);
    goToView(nextView);
  };

  const handleContinue = (slot: number) => {
    setActiveSlot(slot);
    setActiveSaveSlot(slot);
    const saved = loadManagerCareer(slot);
    if (!saved) {
      setAlertDialog({
        title: "Save unavailable",
        message: `Save ${slot + 1} could not be loaded. The file may be corrupt — delete this slot and start a new career.`,
      });
      return;
    }
    continueCareer(saved, slot);
  };

  const handleDelete = (slot: number) => {
    setDeleteSlot(slot);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteSlot == null) return;
    deleteManagerCareer(deleteSlot);
    if (deleteSlot === activeSlot) {
      careerSlotRef.current = null;
      setCareerState(null);
    }
    refreshSaveSlots();
    goToView("landing");
    setDeleteConfirmOpen(false);
    setDeleteSlot(null);
  };

  const handleExportSave = (slot: number) => {
    const raw = readManagerCareerRaw(slot);
    if (!raw) {
      setImportMessage("Nothing to export in that slot.");
      return;
    }
    downloadManagerCareerExport(hydrateManagerCareer(raw));
    setImportMessage(`Exported save ${slot + 1}.`);
  };

  const handleImportSave = async (slot: number, file: File) => {
    try {
      const imported = await importManagerCareerFromFile(file);
      const result = saveManagerCareer(imported, slot);
      if (!result.ok) {
        setImportMessage(result.error);
        return;
      }
      refreshSaveSlots();
      setImportMessage(`Imported ${imported.club} into save ${slot + 1}.`);
    } catch (err) {
      setImportMessage(
        err instanceof Error ? err.message : "Could not import save file."
      );
    }
  };

  const handleSelectClub = useCallback(
    (club: string) => {
      if (creatingCareer) return;
      setCreatingCareer(true);
      window.setTimeout(() => {
        let next;
        try {
          const slot = getActiveSaveSlot();
          next = createNewCareer(club, slot);
          careerSlotRef.current = slot;
          setCareerState(next);
          refreshSaveSlots();
          playManagerAppointed();
        } catch (err) {
          setAlertDialog({
            title: "Could not start career",
            message:
              err instanceof Error
                ? err.message
                : "Something went wrong creating your save.",
          });
          setCreatingCareer(false);
          return;
        }
        goToView("hub");
        setCreatingCareer(false);
      }, 0);
    },
    [creatingCareer, goToView, refreshSaveSlots, setCareerState]
  );

  const playResultSound = (won: boolean, fixture: ManagerCareer["fixtures"][0]) => {
    if (won) {
      const margin = fixture.pointsFor - fixture.pointsAgainst;
      if (fixture.isUpset) playMatchUpsetVictory();
      else if (fixture.isThrashing || margin >= 20) playMatchBigWin();
      else playMatchNarrowWin();
    } else {
      playMatchDefeat();
    }
  };

  const afterMatch = (next: ManagerCareer) => {
    const fixture = next.lastMatchFixture;
    if (fixture) {
      const won = fixture.result === "W";
      const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
      playResultSound(won, fixture);
      recordMatchResult(won, margin, won ? 25_000 : 10_000);
      triggerManagerMatchAchievements(next, fixture);
    }
    if (next.preSeason.friendliesPlayed >= FRIENDLIES_REQUIRED) {
      markOnboardingStepComplete("friendlies");
    }
    const leagueFixturesPlayed = next.fixtures.filter(
      (f) => (f.competition ?? "league") === "league"
    ).length;
    if (
      fixture &&
      (fixture.competition ?? "league") === "league" &&
      leagueFixturesPlayed >= 1
    ) {
      markOnboardingStepComplete("first-match");
    }
    const withLeagueStats = recordLeaguePhaseAchievementsIfNeeded(next);
    const withSeasonStats = withLeagueStats.isSeasonComplete
      ? recordSeasonCompleteIfNeeded(withLeagueStats)
      : withLeagueStats;
    persist(withSeasonStats);

    const wonTitle =
      withSeasonStats.isSeasonComplete &&
      withSeasonStats.playoffs?.finish === "Super League Champions" &&
      !withSeasonStats.trophyCelebrationShown;

    const seasonRecord = resolvePendingSeasonRecordCelebration(withSeasonStats);
    const wonLeagueTable =
      !seasonRecord && shouldShowLeagueWinnersCelebration(withSeasonStats);
    const wonChallengeCup = shouldShowChallengeCupCelebration(withSeasonStats);
    const wonWorldClubChallenge =
      shouldShowWorldClubChallengeCelebration(withSeasonStats);
    // Weekly popups (transfers, contracts, retraining, reserves) surface after Advance Week.
    setPendingIncomingBidId(null);
    setPendingContractExpiryId(null);
    setPendingRetirementIntentId(null);
    setPendingPositionRetrainingId(null);
    setPendingReserveReportId(null);

    if (withSeasonStats.isSeasonComplete) {
      if (fixture) {
        setReviewFixtureId(managerFixtureDisplayId(fixture));
        setPostMatchReviewFlow(true);
        setMatchReviewReturnView("hub");
        goToView("match-review", { syncUrl: false });
        setPendingWccCelebration(wonWorldClubChallenge);
        setPendingChallengeCupCelebration(wonChallengeCup);
        setPendingSeasonRecordCelebration(seasonRecord);
        setPendingLeagueWinnersCelebration(wonLeagueTable);
        setPendingTrophyCelebration(wonTitle);
      } else if (wonTitle) {
        setTrophyModalOpen(true);
      } else {
        goToView("season-review", { syncUrl: false });
      }
    } else if (fixture) {
      setReviewFixtureId(managerFixtureDisplayId(fixture));
      setPostMatchReviewFlow(true);
      setMatchReviewReturnView("hub");
      goToView("match-review", { syncUrl: false });
      setPendingWccCelebration(wonWorldClubChallenge);
      setPendingChallengeCupCelebration(wonChallengeCup);
      setPendingSeasonRecordCelebration(seasonRecord);
      setPendingLeagueWinnersCelebration(wonLeagueTable);
    }
  };
  afterMatchRef.current = afterMatch;

  const continueAfterMatchReview = () => {
    if (!career) {
      goToView("hub");
      return;
    }

    const incomingBid =
      (pendingIncomingBidId
        ? career.inboxMessages.find((m) => m.id === pendingIncomingBidId)
        : undefined) ?? getPendingIncomingClubBid(career);
    if (incomingBid) {
      setPendingIncomingBidId(incomingBid.id);
      setIncomingBidModalOpen(true);
      goToView("hub");
      return;
    }

    if (pendingContractExpiryId) {
      setContractExpiryModalOpen(true);
      goToView("hub");
      return;
    }

    if (pendingRetirementIntentId) {
      setRetirementIntentModalOpen(true);
      goToView("hub");
      return;
    }

    if (pendingPositionRetrainingId) {
      setPositionRetrainingCompleteModalOpen(true);
      goToView("hub");
      return;
    }

    if (pendingReserveReportId) {
      setReserveReportModalOpen(true);
      goToView("hub");
      return;
    }

    continueCelebrationQueue("wcc");
  };

  const handleMatchReviewClose = () => {
    setReviewFixtureId(null);
    if (postMatchReviewFlow) {
      setPostMatchReviewFlow(false);
      const landsOnHub =
        !career ||
        Boolean(pendingIncomingBidId) ||
        Boolean(pendingContractExpiryId) ||
        Boolean(pendingRetirementIntentId) ||
        Boolean(pendingPositionRetrainingId) ||
        Boolean(pendingReserveReportId) ||
        pendingWccCelebration ||
        pendingChallengeCupCelebration ||
        pendingSeasonRecordCelebration ||
        pendingLeagueWinnersCelebration ||
        pendingTrophyCelebration ||
        !career.isSeasonComplete;
      continueAfterMatchReview();
      if (
        landsOnHub &&
        career?.matchWeekPhase !== "awaiting_advance"
      ) {
        setPendingHubNextFixtureScroll(true);
      }
      return;
    }
    goToView(matchReviewReturnView);
    if (
      matchReviewReturnView === "hub" &&
      career?.matchWeekPhase !== "awaiting_advance"
    ) {
      setPendingHubNextFixtureScroll(true);
    }
  };

  const handleIncomingBidResolved = (nextCareer: ManagerCareer) => {
    const resolvedId = pendingIncomingBidId;
    setIncomingBidModalOpen(false);
    setPendingIncomingBidId(null);
    const cleared = resolvedId
      ? acknowledgeManagerEventId(nextCareer, resolvedId)
      : nextCareer;
    persist(cleared);

    const nextBid = getPendingIncomingClubBid(cleared);
    if (nextBid) {
      setPendingIncomingBidId(nextBid.id);
      setIncomingBidModalOpen(true);
      goToView("hub");
      return;
    }

    const contractExpiry = getPendingContractExpiryPopup(cleared);
    if (contractExpiry) {
      setPendingContractExpiryId(contractExpiry.id);
      setContractExpiryModalOpen(true);
      goToView("hub");
      return;
    }

    const retirementIntent = getPendingRetirementIntentPopup(cleared);
    if (retirementIntent) {
      setPendingRetirementIntentId(retirementIntent.id);
      setRetirementIntentModalOpen(true);
      goToView("hub");
      return;
    }

    continueAfterPositionRetrainingPopup(cleared);
  };

  const handleIncomingBidAccept = () => {
    if (!career || !pendingIncomingBidId) return;
    const offer = career.inboxMessages.find((m) => m.id === pendingIncomingBidId);
    const result = offer?.reserveOffer
      ? acceptReserveTransferOffer(career, pendingIncomingBidId)
      : acceptIncomingOffer(career, pendingIncomingBidId);
    if (!result.ok || !result.career) {
      setAlertDialog({
        title: "Transfer failed",
        message: result.error ?? "Could not complete this transfer.",
      });
      if (result.error?.includes("no longer")) {
        const rejected = offer?.reserveOffer
          ? rejectReserveTransferOffer(career, pendingIncomingBidId)
          : rejectIncomingOffer(career, pendingIncomingBidId);
        handleIncomingBidResolved(rejected);
      }
      return;
    }
    handleIncomingBidResolved(result.career);
    playTransferComplete();
  };

  const handleIncomingBidReject = () => {
    if (!career || !pendingIncomingBidId) return;
    const offer = career.inboxMessages.find((m) => m.id === pendingIncomingBidId);
    handleIncomingBidResolved(
      offer?.reserveOffer
        ? rejectReserveTransferOffer(career, pendingIncomingBidId)
        : rejectIncomingOffer(career, pendingIncomingBidId)
    );
  };

  const continueAfterContractExpiry = (nextCareer: ManagerCareer) => {
    const nextContract = getPendingContractExpiryPopup(nextCareer);
    if (nextContract) {
      setPendingContractExpiryId(nextContract.id);
      setContractExpiryModalOpen(true);
      goToView("hub");
      return;
    }

    setPendingContractExpiryId(null);
    setContractExpiryModalOpen(false);
    continueAfterRetirementIntent(nextCareer);
  };

  const handleContractExpiryDismiss = () => {
    if (!career || !pendingContractExpiryId) return;
    const next = acknowledgeManagerEventId(
      acknowledgeContractExpiryPopup(career, pendingContractExpiryId),
      pendingContractExpiryId
    );
    persist(next);
    continueAfterContractExpiry(next);
  };

  const handleContractExpiryViewContracts = () => {
    if (!career || !pendingContractExpiryId) return;
    const next = acknowledgeManagerEventId(
      acknowledgeContractExpiryPopup(career, pendingContractExpiryId),
      pendingContractExpiryId
    );
    persist(next);
    setPendingContractExpiryId(null);
    setContractExpiryModalOpen(false);

    const hasQueue =
      pendingWccCelebration ||
      pendingChallengeCupCelebration ||
      pendingSeasonRecordCelebration ||
      pendingLeagueWinnersCelebration ||
      pendingTrophyCelebration ||
      pendingIncomingBidId ||
      !!getPendingIncomingClubBid(next) ||
      !!getPendingContractExpiryPopup(next) ||
      !!getPendingRetirementIntentPopup(next) ||
      !!getPendingPositionRetrainingPopup(next) ||
      !!getPendingReserveReportPopup(next) ||
      next.isSeasonComplete;

    if (hasQueue) {
      continueAfterContractExpiry(next);
      return;
    }
    goToView("contracts");
  };

  const continueAfterPositionRetrainingPopup = (nextCareer: ManagerCareer) => {
    const retrainingComplete = getPendingPositionRetrainingPopup(nextCareer);
    if (retrainingComplete) {
      setPendingPositionRetrainingId(retrainingComplete.id);
      setPositionRetrainingCompleteModalOpen(true);
      goToView("hub");
      return;
    }

    setPendingPositionRetrainingId(null);
    setPositionRetrainingCompleteModalOpen(false);

    const reserveReport = getPendingReserveReportPopup(nextCareer);
    if (reserveReport) {
      setPendingReserveReportId(reserveReport.id);
      setReserveReportModalOpen(true);
      goToView("hub");
      return;
    }

    setPendingReserveReportId(null);
    setReserveReportModalOpen(false);

    continueCelebrationQueue("wcc", nextCareer);
  };

  const continueAfterRetirementIntent = (nextCareer: ManagerCareer) => {
    const nextIntent = getPendingRetirementIntentPopup(nextCareer);
    if (nextIntent) {
      setPendingRetirementIntentId(nextIntent.id);
      setRetirementIntentModalOpen(true);
      goToView("hub");
      return;
    }

    setPendingRetirementIntentId(null);
    setRetirementIntentModalOpen(false);
    continueAfterPositionRetrainingPopup(nextCareer);
  };

  const handlePositionRetrainingCompleteContinue = () => {
    if (!career || !pendingPositionRetrainingId) return;
    const next = acknowledgeManagerEventId(
      acknowledgePositionRetrainingPopup(career, pendingPositionRetrainingId),
      pendingPositionRetrainingId
    );
    persist(next);
    continueAfterPositionRetrainingPopup(next);
  };

  const handlePositionRetrainingCompleteViewTactics = () => {
    if (!career || !pendingPositionRetrainingId) return;
    const next = acknowledgeManagerEventId(
      acknowledgePositionRetrainingPopup(career, pendingPositionRetrainingId),
      pendingPositionRetrainingId
    );
    persist(next);
    setPendingPositionRetrainingId(null);
    setPositionRetrainingCompleteModalOpen(false);

    const hasQueue =
      pendingWccCelebration ||
      pendingChallengeCupCelebration ||
      pendingSeasonRecordCelebration ||
      pendingLeagueWinnersCelebration ||
      pendingTrophyCelebration ||
      pendingIncomingBidId ||
      !!getPendingIncomingClubBid(next) ||
      !!getPendingContractExpiryPopup(next) ||
      !!getPendingRetirementIntentPopup(next) ||
      !!getPendingPositionRetrainingPopup(next) ||
      !!getPendingReserveReportPopup(next) ||
      next.isSeasonComplete;

    if (hasQueue) {
      continueAfterPositionRetrainingPopup(next);
      return;
    }

    goToView("squad", { syncUrl: true });
    handleSquadSubTabChange("tactics");
  };

  const handleRetirementIntentConvinceToStay = () => {
    if (!career || !pendingRetirementIntentId || !retirementIntentMessage?.playerId) {
      return;
    }
    const result = convincePlayerToStay(
      career,
      retirementIntentMessage.playerId
    );
    if (!result.ok) {
      setAlertDialog({
        title: "Could not convince",
        message: result.error ?? "This player cannot be convinced to stay.",
      });
      return;
    }
    const next = acknowledgeManagerEventId(
      acknowledgeRetirementIntentPopup(result.career, pendingRetirementIntentId),
      pendingRetirementIntentId
    );
    persist(next);
    setAlertDialog({
      title: result.stayed ? "Player staying on" : "Retirement confirmed",
      message: result.stayed
        ? `${result.playerName} has agreed to stay for one more season at their current wage. They will retire when that final year ends.`
        : `${result.playerName} has turned down your offer and will carry on with their plan to retire at the end of the ${career.seasonYear} season.`,
    });
    continueAfterRetirementIntent(next);
  };

  const handleRetirementIntentAcknowledge = () => {
    if (!career || !pendingRetirementIntentId) return;
    const next = acknowledgeManagerEventId(
      acknowledgeRetirementIntentPopup(career, pendingRetirementIntentId),
      pendingRetirementIntentId
    );
    persist(next);
    continueAfterRetirementIntent(next);
  };

  const continueAfterBoardMessage = (nextCareer: ManagerCareer) => {
    const incomingBid = getPendingIncomingClubBid(nextCareer);
    if (incomingBid) {
      setPendingIncomingBidId(incomingBid.id);
      setIncomingBidModalOpen(true);
      goToView("hub");
      return;
    }
    const contractExpiry = getPendingContractExpiryPopup(nextCareer);
    if (contractExpiry) {
      setPendingContractExpiryId(contractExpiry.id);
      setContractExpiryModalOpen(true);
      goToView("hub");
      return;
    }
    continueAfterContractExpiry(nextCareer);
  };

  const handleBoardMessageDismiss = () => {
    if (!career || !pendingBoardMessageId) return;
    const next = acknowledgeManagerEventId(
      markInboxMessageRead(career, pendingBoardMessageId),
      pendingBoardMessageId
    );
    persist(next);
    setPendingBoardMessageId(null);
    setBoardMessageModalOpen(false);
    continueAfterBoardMessage(next);
  };

  const handleBoardMessageViewInbox = () => {
    if (!career || !pendingBoardMessageId) return;
    const next = acknowledgeManagerEventId(
      markInboxMessageRead(career, pendingBoardMessageId),
      pendingBoardMessageId
    );
    persist(next);
    setPendingBoardMessageId(null);
    setBoardMessageModalOpen(false);
    goToView("inbox");
  };

  const handleReserveReportDismiss = () => {
    if (!career || !pendingReserveReportId) return;
    const next = acknowledgeManagerEventId(
      acknowledgeReserveReportPopup(career, pendingReserveReportId),
      pendingReserveReportId
    );
    persist(next);
    setPendingReserveReportId(null);
    setReserveReportModalOpen(false);
    continueAfterPositionRetrainingPopup(next);
  };

  const handleReserveReportViewReserves = () => {
    if (!career || !pendingReserveReportId) return;
    const next = acknowledgeManagerEventId(
      acknowledgeReserveReportPopup(career, pendingReserveReportId),
      pendingReserveReportId
    );
    persist(next);
    setPendingReserveReportId(null);
    setReserveReportModalOpen(false);

    const hasQueue =
      pendingWccCelebration ||
      pendingChallengeCupCelebration ||
      pendingSeasonRecordCelebration ||
      pendingLeagueWinnersCelebration ||
      pendingTrophyCelebration ||
      pendingIncomingBidId ||
      !!getPendingIncomingClubBid(next) ||
      !!getPendingContractExpiryPopup(next) ||
      !!getPendingRetirementIntentPopup(next) ||
      !!getPendingPositionRetrainingPopup(next) ||
      !!getPendingReserveReportPopup(next) ||
      next.isSeasonComplete;

    if (hasQueue) {
      continueAfterPositionRetrainingPopup(next);
      return;
    }

    goToView("reserves");
  };

  const handlePlayoffsIntroContinue = () => {
    if (!career) return;
    persist(acknowledgePlayoffsIntro(career));
  };

  const handleObjectivesIntroContinue = () => {
    if (!career) return;
    // Persist intro dismissal + Inbox letter so board objectives stay in Club Mail.
    const withObjectives = ensureBoardObjectivesInbox({
      ...career,
      objectivesIntroShown: true,
    });
    persist(withObjectives);
    // Defer unlock so the Continue click cannot hit the achievement overlay.
    window.setTimeout(() => {
      recordCareerStarted(career.club);
    }, 400);
  };

  const handleObjectivesIntroBack = () => {
    if (activeSlot == null) return;
    deleteManagerCareer(activeSlot);
    careerSlotRef.current = null;
    setCareerState(null);
    refreshSaveSlots();
    goToView("club-select");
  };

  const handleLeagueWinnersModalContinue = () => {
    if (!career) return;
    persist({ ...career, leagueWinnersCelebrationShown: true });
    setLeagueWinnersModalOpen(false);
    continueCelebrationQueue("trophy");
  };

  const handleSeasonRecordModalContinue = () => {
    if (!career || !seasonRecordModalOpen) return;
    persist({
      ...career,
      ...(seasonRecordModalOpen === "perfect"
        ? { perfectSeasonCelebrationShown: true }
        : { winlessSeasonCelebrationShown: true }),
    });
    setSeasonRecordModalOpen(null);
    continueCelebrationQueue("leagueWinners");
  };

  const handleChallengeCupWinModalContinue = () => {
    if (!career) return;
    const updated = { ...career, challengeCupCelebrationShown: true };
    persist(updated);
    setChallengeCupWinModalOpen(false);
    continueCelebrationQueue("seasonRecord", updated);
  };

  const handleWccWinModalContinue = () => {
    if (!career) return;
    const updated = { ...career, worldClubChallengeCelebrationShown: true };
    persist(updated);
    setWccWinModalOpen(false);
    continueCelebrationQueue("cup", updated);
  };

  const handleTrophyModalContinue = () => {
    if (!career) return;
    persist({ ...career, trophyCelebrationShown: true });
    setTrophyModalOpen(false);
    goToView("season-review", { syncUrl: false });
  };

  const handleSimulate = useCallback(() => {
    if (!career) return;
    if (career.managerSettings?.confirmBeforeSimulate) {
      const ok = window.confirm(
        "Simulate this fixture? You can turn off this prompt in Contracts → Settings."
      );
      if (!ok) return;
    }
    if (career.matchWeekPhase === "awaiting_advance") {
      setAlertDialog({
        title: "Match Week",
        message: "Continue to the next Match Week before simulating another fixture.",
      });
      return;
    }
    const snapshot = career;
    let ready = prepareCareerForNextMatch(career);
    if (ready.managerSettings?.autoFixSquadBeforeMatch) {
      ready = autoFixMatchdaySquad(ready).career;
    }
    const check = validateFitMatchdaySquad(ready);
    if (!check.valid) {
      setAlertDialog({
        title: "Squad not ready",
        message: check.message || "Fix your matchday squad before simulating.",
      });
      return;
    }
    if (!getNextManagerFixture(ready)) {
      setAlertDialog({
        title: "No fixture",
        message: "There is no match scheduled to simulate.",
      });
      return;
    }
    persist(ready);
    const result = simulateManagerNextMatch(ready);
    if (!result.ok) {
      setCareerState(snapshot);
      setAlertDialog({
        title: "Simulation failed",
        message: result.error,
      });
      return;
    }
    afterMatchRef.current(result.career);
  }, [career, persist, setCareerState]);

  const handlePlayGame = useCallback(() => {
    if (!career) return;
    if (career.matchWeekPhase === "awaiting_advance") {
      setAlertDialog({
        title: "Match Week",
        message: "Continue to the next Match Week before playing another fixture.",
      });
      return;
    }
    let ready = prepareCareerForNextMatch(career);
    if (ready.managerSettings?.autoFixSquadBeforeMatch) {
      ready = autoFixMatchdaySquad(ready).career;
    }
    const check = validateFitMatchdaySquad(ready);
    if (!check.valid) {
      setAlertDialog({
        title: "Squad not ready",
        message: check.message || "Fix your matchday squad before playing.",
      });
      return;
    }
    if (!getNextManagerFixture(ready)) {
      setAlertDialog({
        title: "No fixture",
        message: "There is no match scheduled to play.",
      });
      return;
    }
    persist(ready);
    setPlayGameOpen(true);
  }, [career, persist]);

  const handleAdvanceWeek = useCallback(() => {
    if (!career || advancingWeek) return;
    if (career.matchWeekPhase !== "awaiting_advance") return;
    if (hasBlockingManagerDecision(career)) {
      const blockingBid = getPendingIncomingClubBid(career);
      if (blockingBid) {
        setPendingIncomingBidId(blockingBid.id);
        setIncomingBidModalOpen(true);
        goToView("hub");
        return;
      }
      const retirement = getPendingRetirementIntentPopup(career);
      if (retirement) {
        setPendingRetirementIntentId(retirement.id);
        setRetirementIntentModalOpen(true);
        goToView("hub");
      }
      return;
    }
    setAdvancingWeek(true);
    try {
      const result = advanceManagerMatchWeek(career);
      if (!result.ok) {
        setAlertDialog({
          title: "Advance Week",
          message: result.error,
        });
        return;
      }

      const eventIds = collectWeeklyManagerEventIds(result.career);
      const withQueue = withWeeklyManagerEventQueue(result.career, eventIds);
      persist(withQueue);

      // Weekly popups only — never auto-open or play the next fixture.
      const boardMail = getPendingBoardInboxPopup(withQueue);
      const incomingBid = getPendingIncomingClubBid(withQueue);
      const contractExpiry = getPendingContractExpiryPopup(withQueue);
      const retirementIntent = getPendingRetirementIntentPopup(withQueue);
      const retrainingComplete = getPendingPositionRetrainingPopup(withQueue);
      const reserveReport = getPendingReserveReportPopup(withQueue);

      setPendingBoardMessageId(boardMail?.id ?? null);
      setPendingIncomingBidId(incomingBid?.id ?? null);
      setPendingContractExpiryId(contractExpiry?.id ?? null);
      setPendingRetirementIntentId(retirementIntent?.id ?? null);
      setPendingPositionRetrainingId(retrainingComplete?.id ?? null);
      setPendingReserveReportId(reserveReport?.id ?? null);

      if (withQueue.isSeasonComplete) {
        goToView("season-review", { syncUrl: false });
        return;
      }

      if (boardMail) {
        setBoardMessageModalOpen(true);
      } else if (incomingBid) {
        setIncomingBidModalOpen(true);
      } else if (contractExpiry) {
        setContractExpiryModalOpen(true);
      } else if (retirementIntent) {
        setRetirementIntentModalOpen(true);
      } else if (retrainingComplete) {
        setPositionRetrainingCompleteModalOpen(true);
      } else if (reserveReport) {
        setReserveReportModalOpen(true);
      }

      goToView("hub");
    } finally {
      setAdvancingWeek(false);
    }
  }, [career, advancingWeek, persist, goToView]);

  const handleOpenCupFixtures = useCallback(() => {
    setFixturesInitialFilter("cup");
    handleNavNavigate("fixtures");
  }, [handleNavNavigate]);

  const handleOpenHubMatchReview = useCallback(
    (fixtureId: string) => {
      setReviewFixtureId(fixtureId);
      setPostMatchReviewFlow(false);
      setMatchReviewReturnView("hub");
      goToView("match-review", { syncUrl: false });
    },
    [goToView]
  );

  const handleInboxNavigate = useCallback(
    (v: ManagerView) => {
      if (v === "season-rewards") goToView("season-rewards", { syncUrl: false });
      else handleNavNavigate(v);
    },
    [goToView, handleNavNavigate]
  );

  const handleOpenMatchPrep = useCallback(() => {
    setPendingHubNextFixtureScroll(true);
    handleNavNavigate("hub");
  }, [handleNavNavigate]);

  const handleSelectFixtureReview = useCallback(
    (fixtureId: string) => {
      setReviewFixtureId(fixtureId);
      setPostMatchReviewFlow(false);
      setMatchReviewReturnView("fixtures");
      goToView("match-review", { syncUrl: false });
    },
    [goToView]
  );

  const squadContextTabs = useMemo(
    () =>
      displayView === "squad" && !awaitingFriendlyChoice
        ? {
            tabs: SQUAD_SUB_TAB_OPTIONS,
            active: squadSubTab,
            onChange: (tab: string) =>
              handleSquadSubTabChange(tab as SquadSubTab),
            ariaLabel: "Squad sections",
          }
        : undefined,
    [
      displayView,
      awaitingFriendlyChoice,
      squadSubTab,
      handleSquadSubTabChange,
    ]
  );

  const handlePlayComplete = (next: ManagerCareer) => {
    setPlayGameOpen(false);
    afterMatch(next);
  };

  const handleContinueSeason = () => {
    if (!career) return;
    const next = hydrateManagerCareer(advanceToNextSeason(career));
    persist(next);
    if (shouldShowClubStarRiseCelebration(next)) {
      setClubStarRiseModalOpen(true);
    }
    goToView("hub");
  };

  const handleTakeOverClub = (newClub: string) => {
    if (!career) return;
    let base = career;
    if (base.isSeasonComplete) {
      base = hydrateManagerCareer(advanceToNextSeason(base));
    }
    const next = hydrateManagerCareer(takeOverClub(base, newClub, "sacked"));
    playManagerAppointed();
    persist(next);
    goToView("hub");
  };

  const handleClubStarRiseModalContinue = () => {
    if (!career) return;
    persist(acknowledgeClubStarRiseCelebration(career));
    setClubStarRiseModalOpen(false);
    goToView("hub");
  };

  const managerOverlayActive = isManagerStateOverlayView(view);
  if (
    MANAGER_NAV_VIEWS.includes(displayView as (typeof MANAGER_NAV_VIEWS)[number])
  ) {
    lastNavViewRef.current = displayView;
  }
  const chromeNavView = (
    MANAGER_NAV_VIEWS.includes(displayView as (typeof MANAGER_NAV_VIEWS)[number])
      ? displayView
      : lastNavViewRef.current
  ) as (typeof MANAGER_NAV_VIEWS)[number];

  // Keep Manager chrome + keep-alive panes mounted during overlay views
  // so mobile does not remount the shell when opening match review / season flow.
  const showChrome =
    !!career &&
    (managerOverlayActive ||
      MANAGER_NAV_VIEWS.includes(
        displayView as (typeof MANAGER_NAV_VIEWS)[number]
      ));

  // Keep panes interactive under Play Game and overlay views so KeepAlive does
  // not freeze/unfreeze (that toggle was a major mobile flicker). Chrome is
  // inert/hidden separately while overlays are open.
  const panesInteractive = showChrome;

  const hubSticky = useMemo(() => {
    if (!career) return null;
    const nextFixture = getNextManagerFixture(career);
    const seasonComplete = isManagerSeasonComplete(career);
    const playoffsPending = needsPlayoffsIntro(career);
    const visible = Boolean(nextFixture && !seasonComplete && !playoffsPending);
    if (!visible) return null;
    const simCareer = resolveCareerForMatchSimulation(career);
    const squadCheck = validateFitMatchdaySquad(simCareer);
    const canPlay =
      canPlayNextMatch(career) &&
      squadCheck.valid &&
      !seasonComplete &&
      !playoffsPending;
    const matchOccasion = nextFixture
      ? getManagerMatchOccasionPresentation(nextFixture)
      : null;
    return {
      canPlay,
      playLabel: matchOccasion?.playCtaShort ?? "Play Game",
      simulateLabel:
        matchOccasion?.simulateCtaShort ??
        matchOccasion?.simulateCta ??
        "Simulate Game",
    };
  }, [career]);

  const showHubStickyBar =
    Boolean(hubSticky) &&
    chromeNavView === "hub" &&
    !awaitingFriendlyChoice &&
    !playGameOpen &&
    !managerOverlayActive;

  const incomingBidOffer =
    career && pendingIncomingBidId
      ? career.inboxMessages.find((m) => m.id === pendingIncomingBidId)
      : undefined;

  const retirementIntentMessage =
    career && pendingRetirementIntentId
      ? career.inboxMessages.find((m) => m.id === pendingRetirementIntentId)
      : undefined;

  const contractExpiryMessage =
    career && pendingContractExpiryId
      ? career.inboxMessages.find((m) => m.id === pendingContractExpiryId)
      : undefined;

  const reserveReportMessage =
    career && pendingReserveReportId
      ? career.inboxMessages.find((m) => m.id === pendingReserveReportId)
      : undefined;

  const boardMessage =
    career && pendingBoardMessageId
      ? career.inboxMessages.find((m) => m.id === pendingBoardMessageId)
      : undefined;

  const positionRetrainingMessage =
    career && pendingPositionRetrainingId
      ? career.inboxMessages.find((m) => m.id === pendingPositionRetrainingId)
      : undefined;

  const managerCelebrationModalsOpen =
    boardMessageModalOpen ||
    incomingBidModalOpen ||
    contractExpiryModalOpen ||
    retirementIntentModalOpen ||
    positionRetrainingCompleteModalOpen ||
    reserveReportModalOpen ||
    wccWinModalOpen ||
    challengeCupWinModalOpen ||
    leagueWinnersModalOpen ||
    trophyModalOpen ||
    clubStarRiseModalOpen ||
    seasonRecordModalOpen;

  const canShowManagerHubIntroModals =
    displayView === "hub" && !managerCelebrationModalsOpen;

  const pendingFutureStar = career
    ? getPendingFutureStarReveal(career)
    : null;

  return (
    <PageShell withLights compact>
      {displayView === "landing" && (
        <ManagerLanding
          saveSlots={saveSlots}
          onStartNew={handleStartNew}
          onContinue={handleContinue}
          onDelete={handleDelete}
          onExport={handleExportSave}
          onImport={handleImportSave}
          importMessage={importMessage}
        />
      )}

      {displayView === "club-select" && (
        <ManagerClubSelect
          busy={creatingCareer}
          onSelect={handleSelectClub}
          onBack={() => {
            if (creatingCareer) return;
            playUiClick();
            refreshSaveSlots();
            goToView("landing");
          }}
        />
      )}

      {showChrome && career && (
        <div
          className={`flex flex-col manager-mobile-nav-pad sm:pb-0 ${PAGE.section} ${
            playGameOpen || managerOverlayActive
              ? "invisible pointer-events-none absolute inset-0 -z-10 overflow-hidden"
              : ""
          }`}
          aria-hidden={managerOverlayActive || playGameOpen}
          inert={managerOverlayActive || playGameOpen ? true : undefined}
        >
          <ManagerNav
            active={awaitingFriendlyChoice ? "hub" : chromeNavView}
            club={career.club}
            seasonYear={career.seasonYear}
            gameWeek={career.gameWeek}
            onNavigate={handleNavNavigate}
            disabled={
              playGameOpen || awaitingFriendlyChoice || managerOverlayActive
            }
            unreadInbox={countUnreadInbox(career)}
            contextTabs={squadContextTabs}
          />

          <div className={`flex min-w-0 flex-col ${PAGE.section}`}>
            {showSaveMigration && (
              <ManagerSaveMigrationNotice
                onDismiss={() => setShowSaveMigration(false)}
              />
            )}
            {awaitingFriendlyChoice ? (
              <ManagerFriendlySelect
                career={career}
                friendlyNumber={(career.preSeason.draftSchedule?.length ?? 0) + 1}
                choices={career.preSeason.currentChoices}
                draftSchedule={career.preSeason.draftSchedule}
                awaitingScheduleConfirm={career.preSeason.awaitingScheduleConfirm}
                onSelect={handleFriendlySelect}
                onBack={
                  (career.preSeason.draftSchedule?.length ?? 0) > 0
                    ? handleFriendlyScheduleBack
                    : undefined
                }
                onConfirmSchedule={
                  career.preSeason.awaitingScheduleConfirm
                    ? handleFriendlyScheduleConfirm
                    : undefined
                }
              />
            ) : (
              <>
                <ManagerKeepAlivePane
                  label="manager-tab-hub"
                  active={chromeNavView === "hub" && panesInteractive}
                >
                  <ManagerHub
                    career={career}
                    onPlayGame={handlePlayGame}
                    onSimulate={handleSimulate}
                    onAdvanceWeek={handleAdvanceWeek}
                    advancingWeek={advancingWeek}
                    onUpdate={persist}
                    onNavigate={handleNavNavigate}
                    onOpenCupFixtures={handleOpenCupFixtures}
                    onOpenMatchReview={handleOpenHubMatchReview}
                    onOpenOnboardingGuide={() =>
                      setOnboardingRevision((n) => n + 1)
                    }
                  />
                </ManagerKeepAlivePane>

                <ManagerKeepAlivePane active={chromeNavView === "inbox" && panesInteractive}>
                  <ManagerInbox
                    career={career}
                    onUpdate={persistAndSurfaceIncomingBids}
                    onNavigate={handleInboxNavigate}
                  />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane
                  label="manager-tab-squad"
                  active={chromeNavView === "squad" && panesInteractive}
                >
                  <ManagerSquad
                    career={career}
                    onUpdate={persistAndSurfaceIncomingBids}
                    subTab={squadSubTab}
                  />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "reserves" && panesInteractive}>
                  <ManagerReserves
                    career={career}
                    onUpdate={persistAndSurfaceIncomingBids}
                  />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "contracts" && panesInteractive}>
                  <ManagerContracts career={career} onUpdate={persist} />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "transfers" && panesInteractive}>
                  <ManagerTransfers
                    career={career}
                    onUpdate={persistAndSurfaceIncomingBids}
                  />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "club" && panesInteractive}>
                  <ManagerClub career={career} onUpdate={persist} />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "fixtures" && panesInteractive}>
                  <ManagerFixtures
                    career={career}
                    onUpdate={persist}
                    initialFilter={fixturesInitialFilter ?? "calendar"}
                    onOpenMatchPrep={handleOpenMatchPrep}
                    onSelectFixture={handleSelectFixtureReview}
                  />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "across-league" && panesInteractive}>
                  <ManagerAcrossLeague
                    career={career}
                    onNavigate={handleNavNavigate}
                  />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "stats" && panesInteractive}>
                  <ManagerStatsView career={career} />
                </ManagerKeepAlivePane>
                <ManagerKeepAlivePane active={chromeNavView === "settings" && panesInteractive}>
                  <ManagerSettings career={career} onUpdate={persist} />
                </ManagerKeepAlivePane>
              </>
            )}
          </div>
          <ManagerMobileBottomNav
            active={awaitingFriendlyChoice ? "hub" : chromeNavView}
            onNavigate={handleNavNavigate}
            disabled={
              playGameOpen || awaitingFriendlyChoice || managerOverlayActive
            }
          />
        </div>
      )}

      {career && showChrome && hubSticky && (
        <ManagerHubStickyActions
          visible={showHubStickyBar}
          canPlay={hubSticky.canPlay}
          playLabel={hubSticky.playLabel}
          simulateLabel={hubSticky.simulateLabel}
          onPlayGame={handlePlayGame}
          onSimulate={handleSimulate}
        />
      )}

      {career && playGameOpen && (
        <ManagerPlayGame
          career={career}
          onComplete={handlePlayComplete}
          onCancel={() => setPlayGameOpen(false)}
        />
      )}

      {career && view === "match-review" && reviewFixtureId !== null && (
        <ManagerMatchReview
          career={career}
          fixtureId={reviewFixtureId}
          onClose={handleMatchReviewClose}
        />
      )}

      {career && view === "season-review" && (
        <ManagerSeasonReview
          career={career}
          onViewRewards={() => goToView("development-review", { syncUrl: false })}
          onChooseNextClub={() => goToView("choose-next-club", { syncUrl: false })}
          onCareerUpdate={persist}
          onHome={() => {
            playUiClick();
            router.push("/");
          }}
        />
      )}

      {career && view === "choose-next-club" && (
        <ManagerChooseNextClub
          career={career}
          onTakeOver={handleTakeOverClub}
          onBack={() => goToView("season-review", { syncUrl: false })}
        />
      )}

      {career && view === "development-review" && (
        <ManagerDevelopmentReview
          career={career}
          onContinue={() => goToView("season-rewards", { syncUrl: false })}
        />
      )}

      {career && view === "season-rewards" && (
        <ManagerSeasonRewards
          career={career}
          onClaimed={(next) => persist(next)}
          onContinue={handleContinueSeason}
          onHome={() => {
            playUiClick();
            router.push("/");
          }}
        />
      )}

      {career && incomingBidModalOpen && incomingBidOffer && (
        <ManagerIncomingBidModal
          career={career}
          offer={incomingBidOffer}
          onAccept={handleIncomingBidAccept}
          onReject={handleIncomingBidReject}
        />
      )}

      {career &&
        retirementIntentModalOpen &&
        retirementIntentMessage && (
          <ManagerRetirementIntentModal
            career={career}
            message={retirementIntentMessage}
            onAcknowledge={handleRetirementIntentAcknowledge}
            onConvinceToStay={handleRetirementIntentConvinceToStay}
          />
        )}

      {career &&
        contractExpiryModalOpen &&
        contractExpiryMessage && (
          <ManagerContractExpiryModal
            career={career}
            message={contractExpiryMessage}
            onDismiss={handleContractExpiryDismiss}
            onViewContracts={handleContractExpiryViewContracts}
          />
        )}

      {career &&
        positionRetrainingCompleteModalOpen &&
        positionRetrainingMessage && (
          <ManagerPositionRetrainingCompleteModal
            career={career}
            message={positionRetrainingMessage}
            onContinue={handlePositionRetrainingCompleteContinue}
            onViewTactics={handlePositionRetrainingCompleteViewTactics}
          />
        )}

      {career &&
        reserveReportModalOpen &&
        reserveReportMessage && (
          <ManagerReserveReportModal
            career={career}
            message={reserveReportMessage}
            onDismiss={handleReserveReportDismiss}
            onViewReserves={handleReserveReportViewReserves}
          />
        )}

      {career && boardMessageModalOpen && boardMessage && (
        <ManagerBoardMessageModal
          message={boardMessage}
          onDismiss={handleBoardMessageDismiss}
          onViewInbox={handleBoardMessageViewInbox}
        />
      )}

      {career &&
        canShowManagerHubIntroModals &&
        shouldShowManagerObjectivesIntro(career) && (
        <ManagerObjectivesIntroModal
          career={career}
          onContinue={handleObjectivesIntroContinue}
          onBack={handleObjectivesIntroBack}
        />
      )}

      {career &&
        canShowManagerHubIntroModals &&
        !shouldShowManagerObjectivesIntro(career) &&
        shouldShowManagerOnboarding(career) && (
        <ManagerOnboardingModal
          key={onboardingRevision}
          onNavigate={handleNavNavigate}
          onDismiss={() => setOnboardingRevision((n) => n + 1)}
        />
      )}

      {career &&
        canShowManagerHubIntroModals &&
        !shouldShowManagerObjectivesIntro(career) &&
        !shouldShowManagerOnboarding(career) &&
        needsPlayoffsIntro(career) && (
        <ManagerPlayoffsIntroModal
          career={career}
          onContinue={handlePlayoffsIntroContinue}
        />
      )}

      {career && pendingFutureStar && (
        <ManagerFutureStarRevealModal
          career={career}
          player={pendingFutureStar}
          onAcknowledge={persist}
          onViewInReserves={(next) => {
            persist(next);
            handleNavNavigate("reserves");
          }}
        />
      )}

      {career && leagueWinnersModalOpen && (
        <ManagerLeagueWinnersModal
          career={career}
          onContinue={handleLeagueWinnersModalContinue}
        />
      )}

      {career && seasonRecordModalOpen && (
        <ManagerSeasonRecordModal
          career={career}
          kind={seasonRecordModalOpen}
          onContinue={handleSeasonRecordModalContinue}
        />
      )}

      {career && wccWinModalOpen && (
        <ManagerWorldClubChallengeWinModal
          career={career}
          onContinue={handleWccWinModalContinue}
        />
      )}

      {career && challengeCupWinModalOpen && (
        <ManagerChallengeCupWinModal
          career={career}
          onContinue={handleChallengeCupWinModalContinue}
        />
      )}

      {career && trophyModalOpen && (
        <ManagerTrophyModal
          career={career}
          onContinue={handleTrophyModalContinue}
        />
      )}

      {career && clubStarRiseModalOpen && (
        <ManagerClubStarRiseModal
          career={career}
          previousStars={getPendingClubStarRiseFrom(career)}
          onContinue={handleClubStarRiseModalContinue}
        />
      )}

      <ManagerDialog
        open={deleteConfirmOpen}
        variant="confirm"
        destructive
        title="Delete career"
        message={
          deleteSlot != null
            ? `Delete save slot ${deleteSlot + 1}? This cannot be undone.`
            : "Delete this career save? This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Keep save"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <ManagerDialog
        open={alertDialog !== null}
        title={alertDialog?.title ?? ""}
        message={alertDialog?.message ?? ""}
        onConfirm={() => setAlertDialog(null)}
        onCancel={() => setAlertDialog(null)}
      />
    </PageShell>
  );
}
