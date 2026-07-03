"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ManagerFixtures } from "@/components/manager/ManagerFixtures";
import { ManagerAcrossLeague } from "@/components/manager/ManagerAcrossLeague";
import { ManagerStatsView } from "@/components/manager/ManagerStatsView";
import { ManagerPlayGame } from "@/components/manager/ManagerPlayGame";
import { ManagerMatchReview } from "@/components/manager/ManagerMatchReview";
import { ManagerSeasonReview } from "@/components/manager/ManagerSeasonReview";
import { ManagerDevelopmentReview } from "@/components/manager/ManagerDevelopmentReview";
import { ManagerSeasonRewards } from "@/components/manager/ManagerSeasonRewards";
import { ManagerTrophyModal } from "@/components/manager/ManagerTrophyModal";
import { ManagerLeagueWinnersModal } from "@/components/manager/ManagerLeagueWinnersModal";
import { ManagerChallengeCupWinModal } from "@/components/manager/ManagerChallengeCupWinModal";
import { ManagerIncomingBidModal } from "@/components/manager/ManagerIncomingBidModal";
import { ManagerRetirementIntentModal } from "@/components/manager/ManagerRetirementIntentModal";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerFriendlySelect } from "@/components/manager/ManagerFriendlySelect";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import {
  loadManagerCareer,
  saveManagerCareer,
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
import { acknowledgePlayoffsIntro, shouldShowLeagueWinnersCelebration } from "@/lib/manager/managerPlayoffs";
import { shouldShowChallengeCupCelebration } from "@/lib/manager/managerChallengeCup";
import { recordManagerCupTeamWin } from "@/lib/storage/cup-team-wins";
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
  acceptIncomingOffer,
  getPendingUnsolicitedOffer,
  rejectIncomingOffer,
} from "@/lib/manager/managerTransferLeague";
import {
  acknowledgeRetirementIntentPopup,
  getPendingRetirementIntentPopup,
} from "@/lib/manager/managerRetirement";
import {
  downloadManagerCareerExport,
  importManagerCareerFromFile,
} from "@/lib/manager/managerSaveExport";
import { readManagerCareerRaw } from "@/lib/manager/managerSaveStorage";
import { markOnboardingStepComplete } from "@/lib/manager/managerOnboarding";
import { shouldShowSaveMigrationNotice } from "@/lib/manager/managerSaveMigration";
import { ManagerSaveMigrationNotice } from "@/components/manager/ManagerSaveMigrationNotice";

const NAV_VIEWS: ManagerView[] = [
  "hub",
  "inbox",
  "squad",
  "reserves",
  "contracts",
  "transfers",
  "fixtures",
  "across-league",
  "stats",
];

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

export default function ManagerPage() {
  const router = useRouter();
  const [view, setView] = useState<ManagerView>("landing");
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
  const [pendingIncomingBidId, setPendingIncomingBidId] = useState<string | null>(
    null
  );
  const [incomingBidModalOpen, setIncomingBidModalOpen] = useState(false);
  const [pendingRetirementIntentId, setPendingRetirementIntentId] = useState<
    string | null
  >(null);
  const [retirementIntentModalOpen, setRetirementIntentModalOpen] =
    useState(false);
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

  const refreshSaveSlots = useCallback(() => {
    setSaveSlots(listManagerSaveSlots());
  }, []);

  useEffect(() => {
    const slot = getActiveSaveSlot();
    setActiveSlot(slot);
    refreshSaveSlots();
    const raw = readManagerCareerRaw(slot);
    if (!raw) return;
    const previousVersion = raw.saveVersion;
    const saved = hydrateManagerCareer(raw);
    setCareer(saved);
    setShowSaveMigration(shouldShowSaveMigrationNotice(previousVersion));
  }, [refreshSaveSlots]);

  const persist = useCallback(
    (next: ManagerCareer) => {
      const prepared = prepareManagerCareerForSave(next);
      setCareer(prepared);
      saveManagerCareer(prepared, activeSlot);
      refreshSaveSlots();
    },
    [activeSlot, refreshSaveSlots]
  );

  const awaitingFriendlyChoice =
    career != null && isAwaitingFriendlyChoice(career);

  useEffect(() => {
    if (!awaitingFriendlyChoice) return;
    if (NAV_VIEWS.includes(view as ManagerView) && view !== "hub") {
      setView("hub");
    }
  }, [awaitingFriendlyChoice, view]);

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
    if (view !== "hub" || !pendingHubNextFixtureScroll) return;
    setPendingHubNextFixtureScroll(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToManagerHubNextFixture();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, pendingHubNextFixtureScroll]);

  useEffect(() => {
    if (view === "hub" || !pendingHubNextFixtureScroll) return;
    setPendingHubNextFixtureScroll(false);
  }, [view, pendingHubNextFixtureScroll]);

  const handleNavNavigate = useCallback(
    (next: ManagerView) => {
      if (career && isAwaitingFriendlyChoice(career) && next !== "hub") {
        setView("hub");
        return;
      }
      setView(next);
    },
    [career]
  );

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
    setView("club-select");
  };

  const continueCareer = (saved: ManagerCareer) => {
    setCareer(saved);
    if (saved.isSeasonComplete) {
      if (shouldShowChallengeCupCelebration(saved)) {
        recordManagerCupTeamWin(saved.club, activeSlot, saved.seasonYear);
        setChallengeCupWinModalOpen(true);
        setView("hub");
        return;
      }
      if (
        saved.playoffs?.finish === "Super League Champions" &&
        !saved.trophyCelebrationShown
      ) {
        setTrophyModalOpen(true);
        setView("hub");
        return;
      }
      setView(
        saved.seasonRewardClaimedForYear === saved.seasonYear
          ? "season-rewards"
          : "season-review"
      );
      return;
    }
    const unsolicited = getPendingUnsolicitedOffer(saved);
    const retirementIntent = getPendingRetirementIntentPopup(saved);
    if (unsolicited) {
      setPendingIncomingBidId(unsolicited.id);
      setIncomingBidModalOpen(true);
    } else if (retirementIntent) {
      setPendingRetirementIntentId(retirementIntent.id);
      setRetirementIntentModalOpen(true);
    } else if (shouldShowChallengeCupCelebration(saved)) {
      recordManagerCupTeamWin(saved.club, activeSlot, saved.seasonYear);
      setChallengeCupWinModalOpen(true);
    } else if (shouldShowLeagueWinnersCelebration(saved)) {
      setLeagueWinnersModalOpen(true);
    }
    setView("hub");
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
    continueCareer(saved);
  };

  const handleDelete = (slot: number) => {
    setDeleteSlot(slot);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteSlot == null) return;
    deleteManagerCareer(deleteSlot);
    if (deleteSlot === activeSlot) {
      setCareer(null);
    }
    refreshSaveSlots();
    setView("landing");
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
      saveManagerCareer(imported, slot);
      refreshSaveSlots();
      setImportMessage(`Imported ${imported.club} into save ${slot + 1}.`);
    } catch (err) {
      setImportMessage(
        err instanceof Error ? err.message : "Could not import save file."
      );
    }
  };

  const handleSelectClub = (club: string) => {
    const next = createNewCareer(club, activeSlot);
    recordCareerStarted(club);
    setCareer(next);
    refreshSaveSlots();
    setView("hub");
  };

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

    const wonLeagueTable = shouldShowLeagueWinnersCelebration(withLeagueStats);
    const wonChallengeCup = shouldShowChallengeCupCelebration(withLeagueStats);
    if (wonChallengeCup) {
      recordManagerCupTeamWin(withLeagueStats.club, activeSlot, withLeagueStats.seasonYear);
    }
    const unsolicited = getPendingUnsolicitedOffer(withLeagueStats);
    const retirementIntent = getPendingRetirementIntentPopup(withLeagueStats);
    setPendingIncomingBidId(unsolicited?.id ?? null);
    setPendingRetirementIntentId(retirementIntent?.id ?? null);

    if (withLeagueStats.isSeasonComplete) {
      recordSeasonComplete(withLeagueStats);
      if (fixture) {
        setReviewFixtureId(fixture.fixtureId ?? `round-${fixture.round}`);
        setPostMatchReviewFlow(true);
        setMatchReviewReturnView("hub");
        setView("match-review");
        setPendingChallengeCupCelebration(wonChallengeCup);
        setPendingLeagueWinnersCelebration(wonLeagueTable);
        setPendingTrophyCelebration(wonTitle);
      } else if (wonTitle) {
        setTrophyModalOpen(true);
      } else {
        setView("season-review");
      }
    } else if (fixture) {
      setReviewFixtureId(fixture.fixtureId ?? `round-${fixture.round}`);
      setPostMatchReviewFlow(true);
      setMatchReviewReturnView("hub");
      setView("match-review");
      setPendingChallengeCupCelebration(wonChallengeCup);
      setPendingLeagueWinnersCelebration(wonLeagueTable);
    }
  };

  const continueAfterMatchReview = () => {
    if (!career) {
      setView("hub");
      return;
    }

    if (pendingIncomingBidId) {
      setIncomingBidModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingRetirementIntentId) {
      setRetirementIntentModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingChallengeCupCelebration) {
      setPendingChallengeCupCelebration(false);
      setChallengeCupWinModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingLeagueWinnersCelebration) {
      setPendingLeagueWinnersCelebration(false);
      setLeagueWinnersModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingTrophyCelebration) {
      setPendingTrophyCelebration(false);
      setTrophyModalOpen(true);
      setView("hub");
      return;
    }

    if (career.isSeasonComplete) {
      setView("season-review");
      return;
    }

    setView("hub");
  };

  const handleMatchReviewClose = () => {
    setReviewFixtureId(null);
    if (postMatchReviewFlow) {
      setPostMatchReviewFlow(false);
      const landsOnHub =
        !career ||
        Boolean(pendingIncomingBidId) ||
        Boolean(pendingRetirementIntentId) ||
        pendingChallengeCupCelebration ||
        pendingLeagueWinnersCelebration ||
        pendingTrophyCelebration ||
        !career.isSeasonComplete;
      continueAfterMatchReview();
      if (landsOnHub) {
        setPendingHubNextFixtureScroll(true);
      }
      return;
    }
    setView(matchReviewReturnView);
    if (matchReviewReturnView === "hub") {
      setPendingHubNextFixtureScroll(true);
    }
  };

  const handleIncomingBidResolved = (nextCareer: ManagerCareer) => {
    setIncomingBidModalOpen(false);
    setPendingIncomingBidId(null);
    persist(nextCareer);

    const retirementIntent = getPendingRetirementIntentPopup(nextCareer);
    if (retirementIntent) {
      setPendingRetirementIntentId(retirementIntent.id);
      setRetirementIntentModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingChallengeCupCelebration) {
      setPendingChallengeCupCelebration(false);
      setChallengeCupWinModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingLeagueWinnersCelebration) {
      setPendingLeagueWinnersCelebration(false);
      setLeagueWinnersModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingTrophyCelebration) {
      setPendingTrophyCelebration(false);
      setTrophyModalOpen(true);
      setView("hub");
      return;
    }

    if (nextCareer.isSeasonComplete) {
      setView("season-review");
      return;
    }

    setView("hub");
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

  const continueAfterRetirementIntent = (nextCareer: ManagerCareer) => {
    const nextIntent = getPendingRetirementIntentPopup(nextCareer);
    if (nextIntent) {
      setPendingRetirementIntentId(nextIntent.id);
      setRetirementIntentModalOpen(true);
      setView("hub");
      return;
    }

    setPendingRetirementIntentId(null);
    setRetirementIntentModalOpen(false);

    if (pendingChallengeCupCelebration) {
      setPendingChallengeCupCelebration(false);
      setChallengeCupWinModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingLeagueWinnersCelebration) {
      setPendingLeagueWinnersCelebration(false);
      setLeagueWinnersModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingTrophyCelebration) {
      setPendingTrophyCelebration(false);
      setTrophyModalOpen(true);
      setView("hub");
      return;
    }

    if (nextCareer.isSeasonComplete) {
      setView("season-review");
      return;
    }

    setView("hub");
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

  const handleRetirementIntentViewContracts = () => {
    if (!career || !pendingRetirementIntentId) return;
    const next = acknowledgeRetirementIntentPopup(
      career,
      pendingRetirementIntentId
    );
    persist(next);
    setPendingRetirementIntentId(null);
    setRetirementIntentModalOpen(false);

    const hasQueue =
      pendingChallengeCupCelebration ||
      pendingLeagueWinnersCelebration ||
      pendingTrophyCelebration ||
      pendingIncomingBidId ||
      !!getPendingUnsolicitedOffer(next) ||
      !!getPendingRetirementIntentPopup(next) ||
      next.isSeasonComplete;

    if (hasQueue) {
      continueAfterRetirementIntent(next);
      return;
    }
    setView("contracts");
  };

  const handlePlayoffsIntroContinue = () => {
    if (!career) return;
    persist(acknowledgePlayoffsIntro(career));
  };

  const handleLeagueWinnersModalContinue = () => {
    if (!career) return;
    persist({ ...career, leagueWinnersCelebrationShown: true });
    setLeagueWinnersModalOpen(false);
    setView("hub");
  };

  const handleChallengeCupWinModalContinue = () => {
    if (!career) return;
    const updated = { ...career, challengeCupCelebrationShown: true };
    persist(updated);
    setChallengeCupWinModalOpen(false);

    if (pendingLeagueWinnersCelebration) {
      setPendingLeagueWinnersCelebration(false);
      setLeagueWinnersModalOpen(true);
      setView("hub");
      return;
    }

    if (pendingTrophyCelebration) {
      setPendingTrophyCelebration(false);
      setTrophyModalOpen(true);
      setView("hub");
      return;
    }

    if (updated.isSeasonComplete) {
      setView("season-review");
      return;
    }

    setView("hub");
  };

  const handleTrophyModalContinue = () => {
    if (!career) return;
    persist({ ...career, trophyCelebrationShown: true });
    setTrophyModalOpen(false);
    setView("season-review");
  };

  const handleSimulate = () => {
    if (!career) return;
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
    setCareer(ready);
    const result = simulateManagerNextMatch(ready);
    if (!result.ok) {
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
    setCareer(ready);
    setPlayGameOpen(true);
  };

  const handlePlayComplete = (next: ManagerCareer) => {
    setPlayGameOpen(false);
    afterMatch(next);
  };

  const handleContinueSeason = () => {
    if (!career) return;
    const next = advanceToNextSeason(career);
    const hydrated = hydrateManagerCareer(next);
    persist(hydrated);
    setView("hub");
  };

  const showNav =
    career && NAV_VIEWS.includes(view as (typeof NAV_VIEWS)[number]);

  const incomingBidOffer =
    career && pendingIncomingBidId
      ? career.inboxMessages.find((m) => m.id === pendingIncomingBidId)
      : undefined;

  const retirementIntentMessage =
    career && pendingRetirementIntentId
      ? career.inboxMessages.find((m) => m.id === pendingRetirementIntentId)
      : undefined;

  return (
    <PageShell withLights compact width="wide">
      {view === "landing" && (
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

      {view === "club-select" && (
        <ManagerClubSelect
          onSelect={handleSelectClub}
          onBack={() => {
            playUiClick();
            refreshSaveSlots();
            setView("landing");
          }}
        />
      )}

      {showNav && career && (
        <div className={`flex flex-col pb-20 sm:pb-0 ${PAGE.section}`}>
          <ManagerNav
            active={awaitingFriendlyChoice ? "hub" : view}
            club={career.club}
            seasonYear={career.seasonYear}
            gameWeek={career.gameWeek}
            onNavigate={handleNavNavigate}
            disabled={playGameOpen || awaitingFriendlyChoice}
            unreadInbox={countUnreadInbox(career)}
          />

          <div className={`flex flex-col ${PAGE.section}`}>
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
                {view === "hub" && (
                  <ManagerHub
                    career={career}
                    onPlayGame={handlePlayGame}
                    onSimulate={handleSimulate}
                    onPlayoffsContinue={handlePlayoffsIntroContinue}
                    onSelectFixture={(fixtureId) => {
                      setReviewFixtureId(fixtureId);
                      setPostMatchReviewFlow(false);
                      setMatchReviewReturnView("hub");
                      setView("match-review");
                    }}
                    onUpdate={persist}
                    onNavigate={handleNavNavigate}
                  />
                )}

                {view === "inbox" && (
                  <ManagerInbox
                    career={career}
                    onUpdate={persist}
                    onNavigate={(v) => {
                      if (v === "season-rewards") setView("season-rewards");
                      else handleNavNavigate(v);
                    }}
                  />
                )}
                {view === "squad" && (
                  <ManagerSquad career={career} onUpdate={persist} />
                )}
                {view === "reserves" && (
                  <ManagerReserves career={career} onUpdate={persist} />
                )}
                {view === "contracts" && (
                  <ManagerContracts career={career} onUpdate={persist} />
                )}
                {view === "transfers" && (
                  <ManagerTransfers career={career} onUpdate={persist} />
                )}
                {view === "fixtures" && (
                  <ManagerFixtures
                    career={career}
                    onSelectFixture={(fixtureId) => {
                      setReviewFixtureId(fixtureId);
                      setPostMatchReviewFlow(false);
                      setMatchReviewReturnView("fixtures");
                      setView("match-review");
                    }}
                  />
                )}
                {view === "across-league" && (
                  <ManagerAcrossLeague
                    career={career}
                    onNavigate={handleNavNavigate}
                  />
                )}
                {view === "stats" && <ManagerStatsView career={career} />}
              </>
            )}
          </div>
          <ManagerMobileBottomNav
            active={awaitingFriendlyChoice ? "hub" : view}
            onNavigate={handleNavNavigate}
            disabled={playGameOpen || awaitingFriendlyChoice}
            unreadInbox={countUnreadInbox(career)}
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
          onViewRewards={() => setView("development-review")}
          onHome={() => {
            playUiClick();
            router.push("/");
          }}
        />
      )}

      {career && view === "development-review" && (
        <ManagerDevelopmentReview
          career={career}
          onContinue={() => setView("season-rewards")}
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
            onViewContracts={handleRetirementIntentViewContracts}
          />
        )}

      {career && leagueWinnersModalOpen && (
        <ManagerLeagueWinnersModal
          career={career}
          onContinue={handleLeagueWinnersModalContinue}
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
