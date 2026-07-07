"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ManagerLanding } from "@/components/manager/ManagerLanding";
import { ManagerClubSelect } from "@/components/manager/ManagerClubSelect";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { ManagerMobileBottomNav } from "@/components/manager/ManagerMobileBottomNav";
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
const ManagerPlayGame = dynamic(
  () =>
    import("@/components/manager/ManagerPlayGame").then((m) => ({
      default: m.ManagerPlayGame,
    })),
  { ssr: false }
);
import { ManagerMatchReview } from "@/components/manager/ManagerMatchReview";
import { ManagerSeasonReview } from "@/components/manager/ManagerSeasonReview";
import { ManagerDevelopmentReview } from "@/components/manager/ManagerDevelopmentReview";
import { ManagerSeasonRewards } from "@/components/manager/ManagerSeasonRewards";
import { ManagerTrophyModal } from "@/components/manager/ManagerTrophyModal";
import { ManagerLeagueWinnersModal } from "@/components/manager/ManagerLeagueWinnersModal";
import { ManagerChallengeCupWinModal } from "@/components/manager/ManagerChallengeCupWinModal";
import { ManagerClubStarRiseModal } from "@/components/manager/ManagerClubStarRiseModal";
import { ManagerSeasonRecordModal } from "@/components/manager/ManagerSeasonRecordModal";
import { ManagerIncomingBidModal } from "@/components/manager/ManagerIncomingBidModal";
import { ManagerRetirementIntentModal } from "@/components/manager/ManagerRetirementIntentModal";
import { ManagerContractExpiryModal } from "@/components/manager/ManagerContractExpiryModal";
import { ManagerReserveReportModal } from "@/components/manager/ManagerReserveReportModal";
import { ManagerPlayoffsIntroModal } from "@/components/manager/ManagerPlayoffsIntroModal";
import { ManagerObjectivesIntroModal } from "@/components/manager/ManagerObjectivesIntroModal";
import { ManagerOnboardingModal } from "@/components/manager/ManagerOnboardingModal";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerFriendlySelect } from "@/components/manager/ManagerFriendlySelect";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
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
import {
  getNextManagerFixture,
  prepareCareerForNextMatch,
  simulateManagerNextMatch,
} from "@/lib/manager/managerSimulation";
import { scrollToManagerHubNextFixture } from "@/lib/manager/managerHubScroll";
import { shouldShowManagerObjectivesIntro } from "@/lib/manager/managerBoardObjectives";
import { acknowledgePlayoffsIntro, needsPlayoffsIntro, shouldShowLeagueWinnersCelebration } from "@/lib/manager/managerPlayoffs";
import { shouldShowChallengeCupCelebration } from "@/lib/manager/managerChallengeCup";
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
  recordSeasonComplete,
  recordLeaguePhaseAchievementsIfNeeded,
} from "@/lib/manager/managerStats";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playUiClick,
} from "@/lib/sound";
import { PageShell } from "@/components/ui/PageShell";
import { PAGE } from "@/lib/ui/design-system";
import {
  ensureFriendlyChoices,
  isAwaitingFriendlyChoice,
  selectFriendlyOpponent,
} from "@/lib/manager/managerFriendlies";
import { countUnreadInbox } from "@/lib/manager/managerInbox";
import {
  acknowledgeContractExpiryPopup,
  getPendingContractExpiryPopup,
} from "@/lib/manager/managerInbox";
import {
  acceptIncomingOffer,
  getPendingUnsolicitedOffer,
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
  downloadManagerCareerExport,
  importManagerCareerFromFile,
} from "@/lib/manager/managerSaveExport";
import { readManagerCareerRaw } from "@/lib/manager/managerSaveStorage";
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
];

function scrollManagerPageToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
  const [view, setView] = useState<ManagerView>("landing");
  /** Forward nav only — cleared synchronously when pathname changes (browser back). */
  const pendingForwardNavRef = useRef<{ path: string; view: ManagerView } | null>(
    null
  );
  const prevPathnameForNavRef = useRef(pathname);
  const displayView = useMemo(() => {
    if (prevPathnameForNavRef.current !== pathname) {
      pendingForwardNavRef.current = null;
      prevPathnameForNavRef.current = pathname;
    }

    const resolved = resolveManagerDisplayView(pathname, view);
    const pending = pendingForwardNavRef.current;
    if (
      pending &&
      pathname !== pending.path &&
      view === pending.view
    ) {
      return pending.view;
    }
    return resolved;
  }, [pathname, view]);
  const squadSubTab = useMemo(
    () => resolveSquadSubTabDisplay(pathname),
    [pathname]
  );
  const [career, setCareer] = useState<ManagerCareer | null>(null);
  const [activeSlot, setActiveSlot] = useState(0);
  const [saveSlots, setSaveSlots] = useState<ManagerSaveSlotSummary[]>([]);
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
  const [postMatchReviewFlow, setPostMatchReviewFlow] = useState(false);
  const [matchReviewReturnView, setMatchReviewReturnView] =
    useState<ManagerView>("hub");
  const [pendingHubNextFixtureScroll, setPendingHubNextFixtureScroll] =
    useState(false);
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
        next === "season-rewards"
      ) {
        setManagerView(setView, next);
        return;
      }
      if (next === "landing") {
        const target = "/manager";
        pendingForwardNavRef.current = { path: target, view: "landing" };
        setManagerView(setView, "landing");
        router.replace(target);
        return;
      }

      if (next === "club-select") {
        const target = managerPathForView("club-select");
        pendingForwardNavRef.current = { path: target, view: "club-select" };
        setManagerView(setView, "club-select");
        router.replace(target);
        return;
      }

      if (isManagerNavView(next)) {
        const target = managerPathForView(next);
        pendingForwardNavRef.current = { path: target, view: next };
        setManagerView(setView, next);
        if (target !== pathname) {
          router.push(target);
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

  useEffect(() => {
    refreshSaveSlots();
    setActiveSlot(getActiveSaveSlot());
  }, [refreshSaveSlots]);

  /** Load career from disk once per save slot — not on every tab change. */
  useLayoutEffect(() => {
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
  }, [pathname, setCareerState]);

  const persist = useCallback(
    (next: ManagerCareer) => {
      const slot = getActiveSaveSlot();
      const prepared = prepareManagerCareerForSave(next);
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

  const continueCelebrationQueue = useCallback(
    (
      fromStep: "cup" | "seasonRecord" | "leagueWinners" | "trophy" = "cup",
      nextCareer?: ManagerCareer | null
    ) => {
      const steps = ["cup", "seasonRecord", "leagueWinners", "trophy"] as const;
      const start = steps.indexOf(fromStep);

      for (let i = start; i < steps.length; i++) {
        const step = steps[i];
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
      const result = flushManagerCareerToDisk(current, getActiveSaveSlot());
      if (!result.ok) {
        flushErrorRef.current = result.error;
      } else {
        flushErrorRef.current = null;
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
      const fromPath = managerViewFromPathname(pathname);
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
  }, [pathname, refreshSaveSlots, setCareerState]);

  const awaitingFriendlyChoice =
    career != null && isAwaitingFriendlyChoice(career);

  useLayoutEffect(() => {
    if (!awaitingFriendlyChoice) return;
    if (MANAGER_NAV_VIEWS.includes(displayView) && displayView !== "hub") {
      goToView("hub");
    }
  }, [awaitingFriendlyChoice, displayView, goToView]);

  useEffect(() => {
    if (!career || !awaitingFriendlyChoice) return;
    if (career.preSeason.currentChoices.length >= 3) return;
    persist(ensureFriendlyChoices(career));
  }, [career, awaitingFriendlyChoice, persist]);

  useEffect(() => {
    if (!SCROLL_TOP_VIEWS.includes(view)) return;
    requestAnimationFrame(() => {
      scrollManagerPageToTop();
    });
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
      if (career && isAwaitingFriendlyChoice(career) && next !== "hub") {
        goToView("hub");
        return;
      }
      goToView(next);
    },
    [career, goToView]
  );

  const handleSquadSubTabChange = useCallback(
    (tab: SquadSubTab) => {
      router.push(managerPathForSquadTab(tab));
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

  const handleStartNew = (slot: number) => {
    setActiveSlot(slot);
    setActiveSaveSlot(slot);
    careerSlotRef.current = null;
    setCareerState(null);
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
    const unsolicited = getPendingUnsolicitedOffer(saved);
    const contractExpiry = getPendingContractExpiryPopup(saved);
    const retirementIntent = getPendingRetirementIntentPopup(saved);
    if (unsolicited) {
      setPendingIncomingBidId(unsolicited.id);
      setIncomingBidModalOpen(true);
    } else if (contractExpiry) {
      setPendingContractExpiryId(contractExpiry.id);
      setContractExpiryModalOpen(true);
    } else if (retirementIntent) {
      setPendingRetirementIntentId(retirementIntent.id);
      setRetirementIntentModalOpen(true);
    } else {
      const reserveReport = getPendingReserveReportPopup(saved);
      if (reserveReport) {
        setPendingReserveReportId(reserveReport.id);
        setReserveReportModalOpen(true);
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
    }
    if (next.preSeason.friendliesPlayed >= 2) {
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
    persist(withLeagueStats);

    const wonTitle =
      withLeagueStats.isSeasonComplete &&
      withLeagueStats.playoffs?.finish === "Super League Champions" &&
      !withLeagueStats.trophyCelebrationShown;

    const seasonRecord = resolvePendingSeasonRecordCelebration(withLeagueStats);
    const wonLeagueTable =
      !seasonRecord && shouldShowLeagueWinnersCelebration(withLeagueStats);
    const wonChallengeCup = shouldShowChallengeCupCelebration(withLeagueStats);
    const unsolicited = getPendingUnsolicitedOffer(withLeagueStats);
    const contractExpiry = getPendingContractExpiryPopup(withLeagueStats);
    const retirementIntent = getPendingRetirementIntentPopup(withLeagueStats);
    const reserveReport = getPendingReserveReportPopup(withLeagueStats);
    setPendingIncomingBidId(unsolicited?.id ?? null);
    setPendingContractExpiryId(contractExpiry?.id ?? null);
    setPendingRetirementIntentId(retirementIntent?.id ?? null);
    setPendingReserveReportId(reserveReport?.id ?? null);

    if (withLeagueStats.isSeasonComplete) {
      recordSeasonComplete(withLeagueStats);
      if (fixture) {
        setReviewFixtureId(managerFixtureDisplayId(fixture));
        setPostMatchReviewFlow(true);
        setMatchReviewReturnView("hub");
        goToView("match-review", { syncUrl: false });
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
      setPendingChallengeCupCelebration(wonChallengeCup);
      setPendingSeasonRecordCelebration(seasonRecord);
      setPendingLeagueWinnersCelebration(wonLeagueTable);
    }
  };

  const continueAfterMatchReview = () => {
    if (!career) {
      goToView("hub");
      return;
    }

    if (pendingIncomingBidId) {
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

    if (pendingReserveReportId) {
      setReserveReportModalOpen(true);
      goToView("hub");
      return;
    }

    continueCelebrationQueue("cup");
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
        Boolean(pendingReserveReportId) ||
        pendingChallengeCupCelebration ||
        pendingSeasonRecordCelebration ||
        pendingLeagueWinnersCelebration ||
        pendingTrophyCelebration ||
        !career.isSeasonComplete;
      continueAfterMatchReview();
      if (landsOnHub) {
        setPendingHubNextFixtureScroll(true);
      }
      return;
    }
    goToView(matchReviewReturnView);
    if (matchReviewReturnView === "hub") {
      setPendingHubNextFixtureScroll(true);
    }
  };

  const handleIncomingBidResolved = (nextCareer: ManagerCareer) => {
    setIncomingBidModalOpen(false);
    setPendingIncomingBidId(null);
    persist(nextCareer);

    const contractExpiry = getPendingContractExpiryPopup(nextCareer);
    if (contractExpiry) {
      setPendingContractExpiryId(contractExpiry.id);
      setContractExpiryModalOpen(true);
      goToView("hub");
      return;
    }

    const retirementIntent = getPendingRetirementIntentPopup(nextCareer);
    if (retirementIntent) {
      setPendingRetirementIntentId(retirementIntent.id);
      setRetirementIntentModalOpen(true);
      goToView("hub");
      return;
    }

    const reserveReport = getPendingReserveReportPopup(nextCareer);
    if (reserveReport) {
      setPendingReserveReportId(reserveReport.id);
      setReserveReportModalOpen(true);
      goToView("hub");
      return;
    }

    continueCelebrationQueue("cup", nextCareer);
  };

  const handleIncomingBidAccept = () => {
    if (!career || !pendingIncomingBidId) return;
    const result = acceptIncomingOffer(career, pendingIncomingBidId);
    if (!result.ok || !result.career) {
      setAlertDialog({
        title: "Transfer failed",
        message: result.error ?? "Could not complete this transfer.",
      });
      if (result.error?.includes("no longer")) {
        setIncomingBidModalOpen(false);
        setPendingIncomingBidId(null);
        persist(
          rejectIncomingOffer(career, pendingIncomingBidId)
        );
      }
      return;
    }
    handleIncomingBidResolved(result.career);
  };

  const handleIncomingBidReject = () => {
    if (!career || !pendingIncomingBidId) return;
    handleIncomingBidResolved(rejectIncomingOffer(career, pendingIncomingBidId));
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
    const next = acknowledgeContractExpiryPopup(
      career,
      pendingContractExpiryId
    );
    persist(next);
    continueAfterContractExpiry(next);
  };

  const handleContractExpiryViewContracts = () => {
    if (!career || !pendingContractExpiryId) return;
    const next = acknowledgeContractExpiryPopup(
      career,
      pendingContractExpiryId
    );
    persist(next);
    setPendingContractExpiryId(null);
    setContractExpiryModalOpen(false);

    const hasQueue =
      pendingChallengeCupCelebration ||
      pendingSeasonRecordCelebration ||
      pendingLeagueWinnersCelebration ||
      pendingTrophyCelebration ||
      pendingIncomingBidId ||
      !!getPendingUnsolicitedOffer(next) ||
      !!getPendingContractExpiryPopup(next) ||
      !!getPendingRetirementIntentPopup(next) ||
      !!getPendingReserveReportPopup(next) ||
      next.isSeasonComplete;

    if (hasQueue) {
      continueAfterContractExpiry(next);
      return;
    }
    goToView("contracts");
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

    const reserveReport = getPendingReserveReportPopup(nextCareer);
    if (reserveReport) {
      setPendingReserveReportId(reserveReport.id);
      setReserveReportModalOpen(true);
      goToView("hub");
      return;
    }

    setPendingReserveReportId(null);
    setReserveReportModalOpen(false);

    continueCelebrationQueue("cup", nextCareer);
  };

  const handleRetirementIntentConvinceToStay = () => {
    if (!career || !pendingRetirementIntentId || !retirementIntentMessage?.playerId) {
      return;
    }
    const convinced = convincePlayerToStay(
      career,
      retirementIntentMessage.playerId
    );
    const next = acknowledgeRetirementIntentPopup(
      convinced,
      pendingRetirementIntentId
    );
    persist(next);
    continueAfterRetirementIntent(next);
  };

  const handleRetirementIntentAcknowledge = () => {
    if (!career || !pendingRetirementIntentId) return;
    const next = acknowledgeRetirementIntentPopup(
      career,
      pendingRetirementIntentId
    );
    persist(next);
    continueAfterRetirementIntent(next);
  };

  const handleReserveReportDismiss = () => {
    if (!career || !pendingReserveReportId) return;
    const next = acknowledgeReserveReportPopup(career, pendingReserveReportId);
    persist(next);
    setPendingReserveReportId(null);
    setReserveReportModalOpen(false);
    continueAfterRetirementIntent(next);
  };

  const handleReserveReportViewReserves = () => {
    if (!career || !pendingReserveReportId) return;
    const next = acknowledgeReserveReportPopup(career, pendingReserveReportId);
    persist(next);
    setPendingReserveReportId(null);
    setReserveReportModalOpen(false);

    const hasQueue =
      pendingChallengeCupCelebration ||
      pendingSeasonRecordCelebration ||
      pendingLeagueWinnersCelebration ||
      pendingTrophyCelebration ||
      pendingIncomingBidId ||
      !!getPendingUnsolicitedOffer(next) ||
      !!getPendingContractExpiryPopup(next) ||
      !!getPendingRetirementIntentPopup(next) ||
      !!getPendingReserveReportPopup(next) ||
      next.isSeasonComplete;

    if (hasQueue) {
      continueAfterRetirementIntent(next);
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
    recordCareerStarted(career.club);
    persist({ ...career, objectivesIntroShown: true });
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

  const handleTrophyModalContinue = () => {
    if (!career) return;
    persist({ ...career, trophyCelebrationShown: true });
    setTrophyModalOpen(false);
    goToView("season-review", { syncUrl: false });
  };

  const handleSimulate = () => {
    if (!career) return;
    const snapshot = career;
    const ready = prepareCareerForNextMatch(career);
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
    afterMatch(result.career);
  };

  const handlePlayGame = () => {
    if (!career) return;
    const ready = prepareCareerForNextMatch(career);
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
  };

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

  const handleClubStarRiseModalContinue = () => {
    if (!career) return;
    persist(acknowledgeClubStarRiseCelebration(career));
    setClubStarRiseModalOpen(false);
    goToView("hub");
  };

  const managerOverlayActive = isManagerStateOverlayView(view);

  const showNav =
    career &&
    !managerOverlayActive &&
    MANAGER_NAV_VIEWS.includes(displayView as (typeof MANAGER_NAV_VIEWS)[number]);

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

  const managerCelebrationModalsOpen =
    incomingBidModalOpen ||
    contractExpiryModalOpen ||
    retirementIntentModalOpen ||
    reserveReportModalOpen ||
    challengeCupWinModalOpen ||
    leagueWinnersModalOpen ||
    trophyModalOpen ||
    clubStarRiseModalOpen ||
    seasonRecordModalOpen;

  const canShowManagerHubIntroModals =
    displayView === "hub" && !managerCelebrationModalsOpen;

  return (
    <PageShell withLights compact width="wide">
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

      {showNav && career && (
        <div className={`flex flex-col manager-mobile-nav-pad sm:pb-0 ${PAGE.section}`}>
          <ManagerNav
            active={awaitingFriendlyChoice ? "hub" : displayView}
            club={career.club}
            seasonYear={career.seasonYear}
            gameWeek={career.gameWeek}
            onNavigate={handleNavNavigate}
            disabled={playGameOpen || awaitingFriendlyChoice}
            unreadInbox={countUnreadInbox(career)}
            contextTabs={
              displayView === "squad" && !awaitingFriendlyChoice
                ? {
                    tabs: SQUAD_SUB_TAB_OPTIONS,
                    active: squadSubTab,
                    onChange: (tab) =>
                      handleSquadSubTabChange(tab as SquadSubTab),
                    ariaLabel: "Squad sections",
                  }
                : undefined
            }
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
                friendlyNumber={career.preSeason.friendliesPlayed + 1}
                choices={career.preSeason.currentChoices}
                onSelect={handleFriendlySelect}
              />
            ) : (
              <>
                {displayView === "hub" && (
                  <ManagerHub
                    career={career}
                    onPlayGame={handlePlayGame}
                    onSimulate={handleSimulate}
                    onUpdate={persist}
                    onNavigate={handleNavNavigate}
                  />
                )}

                {displayView === "inbox" && (
                  <ManagerInbox
                    career={career}
                    onUpdate={persist}
                    onNavigate={(v) => {
                      if (v === "season-rewards") goToView("season-rewards", { syncUrl: false });
                      else handleNavNavigate(v);
                    }}
                  />
                )}
                {displayView === "squad" && (
                  <ManagerSquad
                    career={career}
                    onUpdate={persist}
                    subTab={squadSubTab}
                  />
                )}
                {displayView === "reserves" && (
                  <ManagerReserves career={career} onUpdate={persist} />
                )}
                {displayView === "contracts" && (
                  <ManagerContracts career={career} onUpdate={persist} />
                )}
                {displayView === "transfers" && (
                  <ManagerTransfers career={career} onUpdate={persist} />
                )}
                {displayView === "club" && (
                  <ManagerClub career={career} onUpdate={persist} />
                )}
                {displayView === "fixtures" && (
                  <ManagerFixtures
                    career={career}
                    onSelectFixture={(fixtureId) => {
                      setReviewFixtureId(fixtureId);
                      setPostMatchReviewFlow(false);
                      setMatchReviewReturnView("fixtures");
                      goToView("match-review", { syncUrl: false });
                    }}
                  />
                )}
                {displayView === "across-league" && (
                  <ManagerAcrossLeague
                    career={career}
                    onNavigate={handleNavNavigate}
                  />
                )}
                {displayView === "stats" && <ManagerStatsView career={career} />}
              </>
            )}
          </div>
          <ManagerMobileBottomNav
            active={awaitingFriendlyChoice ? "hub" : displayView}
            onNavigate={handleNavNavigate}
            disabled={playGameOpen || awaitingFriendlyChoice}
          />
        </div>
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
          onHome={() => {
            playUiClick();
            router.push("/");
          }}
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
        reserveReportModalOpen &&
        reserveReportMessage && (
          <ManagerReserveReportModal
            career={career}
            message={reserveReportMessage}
            onDismiss={handleReserveReportDismiss}
            onViewReserves={handleReserveReportViewReserves}
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
