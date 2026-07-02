"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ManagerLanding } from "@/components/manager/ManagerLanding";
import { ManagerClubSelect } from "@/components/manager/ManagerClubSelect";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { ManagerHub } from "@/components/manager/ManagerHub";
import { ManagerSquad } from "@/components/manager/ManagerSquad";
import { ManagerContracts } from "@/components/manager/ManagerContracts";
import { ManagerReserves } from "@/components/manager/ManagerReserves";
import { ManagerInbox } from "@/components/manager/ManagerInbox";
import { ManagerTransfers } from "@/components/manager/ManagerTransfers";
import { ManagerFixtures } from "@/components/manager/ManagerFixtures";
import { ManagerStatsView } from "@/components/manager/ManagerStatsView";
import { ManagerPlayGame } from "@/components/manager/ManagerPlayGame";
import { ManagerMatchReview } from "@/components/manager/ManagerMatchReview";
import { ManagerSeasonReview } from "@/components/manager/ManagerSeasonReview";
import { ManagerDevelopmentReview } from "@/components/manager/ManagerDevelopmentReview";
import { ManagerSeasonRewards } from "@/components/manager/ManagerSeasonRewards";
import { ManagerPlayoffsIntroModal } from "@/components/manager/ManagerPlayoffsIntroModal";
import { ManagerTrophyModal } from "@/components/manager/ManagerTrophyModal";
import { ManagerFriendlySelect } from "@/components/manager/ManagerFriendlySelect";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import {
  loadManagerCareer,
  saveManagerCareer,
  deleteManagerCareer,
  createNewCareer,
  advanceToNextSeason,
  hasManagerCareer,
  hydrateManagerCareer,
} from "@/lib/manager/managerState";
import { simulateManagerNextMatch } from "@/lib/manager/managerSimulation";
import { ensureCupBracketReady } from "@/lib/manager/managerChallengeCup";
import { ensurePlayoffsReady, needsPlayoffsIntro, acknowledgePlayoffsIntro } from "@/lib/manager/managerPlayoffs";
import {
  recordCareerStarted,
  recordMatchResult,
  recordSeasonComplete,
} from "@/lib/manager/managerStats";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playUiClick,
} from "@/lib/sound";
import { PageShell } from "@/components/ui/PageShell";
import {
  ensureFriendlyChoices,
  isAwaitingFriendlyChoice,
  selectFriendlyOpponent,
} from "@/lib/manager/managerFriendlies";
import { countUnreadInbox } from "@/lib/manager/managerInbox";

const NAV_VIEWS: ManagerView[] = [
  "hub",
  "inbox",
  "squad",
  "reserves",
  "contracts",
  "transfers",
  "fixtures",
  "stats",
];

export default function ManagerPage() {
  const router = useRouter();
  const [view, setView] = useState<ManagerView>("landing");
  const [career, setCareer] = useState<ManagerCareer | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [reviewFixtureId, setReviewFixtureId] = useState<string | null>(null);
  const [playGameOpen, setPlayGameOpen] = useState(false);
  const [trophyModalOpen, setTrophyModalOpen] = useState(false);
  const [pendingTrophyCelebration, setPendingTrophyCelebration] = useState(false);

  useEffect(() => {
    setHasSave(hasManagerCareer());
    const saved = loadManagerCareer();
    if (saved) setCareer(hydrateManagerCareer(saved));
  }, []);

  const persist = useCallback((next: ManagerCareer) => {
    const hydrated = hydrateManagerCareer(next);
    setCareer(hydrated);
    saveManagerCareer(hydrated);
    setHasSave(true);
  }, []);

  const handleStartNew = () => setView("club-select");

  const handleContinue = () => {
    const saved = loadManagerCareer();
    if (!saved) return;
    const hydrated = hydrateManagerCareer(saved);
    setCareer(hydrated);
    if (hydrated.isSeasonComplete) {
      setView(
        hydrated.seasonRewardClaimedForYear === hydrated.seasonYear
          ? "season-rewards"
          : "season-review"
      );
      return;
    }
    setView("hub");
  };

  const handleDelete = () => {
    deleteManagerCareer();
    setCareer(null);
    setHasSave(false);
    setView("landing");
  };

  const handleSelectClub = (club: string) => {
    const next = createNewCareer(club);
    recordCareerStarted(club);
    setCareer(next);
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
    persist(next);

    const wonTitle =
      next.isSeasonComplete &&
      next.playoffs?.finish === "Super League Champions" &&
      !next.trophyCelebrationShown;

    if (next.isSeasonComplete) {
      recordSeasonComplete(next);
      if (fixture) {
        setReviewFixtureId(fixture.fixtureId ?? `round-${fixture.round}`);
        setView("match-review");
        setPendingTrophyCelebration(wonTitle);
      } else if (wonTitle) {
        setTrophyModalOpen(true);
      } else {
        setView("season-review");
      }
    } else if (fixture) {
      setReviewFixtureId(fixture.fixtureId ?? `round-${fixture.round}`);
      setView("match-review");
    }
  };

  const handleMatchReviewClose = () => {
    if (!career) {
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

  const handlePlayoffsIntroContinue = () => {
    if (!career) return;
    persist(acknowledgePlayoffsIntro(career));
  };

  const handleTrophyModalContinue = () => {
    if (!career) return;
    persist({ ...career, trophyCelebrationShown: true });
    setTrophyModalOpen(false);
    setView("season-review");
  };

  const handleSimulate = () => {
    if (!career) return;
    const working = resolveCareerForMatchSimulation(career);
    const check = validateFitMatchdaySquad(working);
    if (!check.valid) return;
    const ready = ensurePlayoffsReady(ensureCupBracketReady(working));
    if (ready !== working) persist(ready);
    afterMatch(simulateManagerNextMatch(ready));
  };

  const handlePlayGame = () => {
    if (!career) return;
    const working = resolveCareerForMatchSimulation(career);
    const check = validateFitMatchdaySquad(working);
    if (!check.valid) return;
    const ready = ensurePlayoffsReady(ensureCupBracketReady(working));
    if (ready !== working) persist(ready);
    if (working !== career) persist(working);
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
    setCareer(hydrated);
    saveManagerCareer(hydrated);
    setView("hub");
  };

  const showNav =
    career && NAV_VIEWS.includes(view as (typeof NAV_VIEWS)[number]);

  return (
    <PageShell withLights compact width="wide">
      {view === "landing" && (
        <ManagerLanding
          hasSave={hasSave}
          onStartNew={handleStartNew}
          onContinue={handleContinue}
          onDelete={handleDelete}
        />
      )}

      {view === "club-select" && (
        <ManagerClubSelect
          onSelect={handleSelectClub}
          onBack={() => {
            playUiClick();
            setView("landing");
          }}
        />
      )}

      {showNav && career && (
        <div className="flex flex-col gap-4 lg:gap-3">
          <ManagerNav
            active={view}
            club={career.club}
            onNavigate={setView}
            disabled={playGameOpen}
            unreadInbox={countUnreadInbox(career)}
          />

          <div className="flex flex-col gap-4 lg:gap-3">
            {view === "hub" && (
              <>
                {isAwaitingFriendlyChoice(career) ? (
                  <ManagerFriendlySelect
                    career={career}
                    friendlyNumber={career.preSeason.friendliesPlayed + 1}
                    choices={career.preSeason.currentChoices}
                    onSelect={(choiceId) => {
                      persist(
                        ensureFriendlyChoices(
                          selectFriendlyOpponent(career, choiceId)
                        )
                      );
                    }}
                  />
                ) : (
                  <ManagerHub
                    career={career}
                    onPlayGame={handlePlayGame}
                    onSimulate={handleSimulate}
                    onSelectFixture={(fixtureId) => {
                      setReviewFixtureId(fixtureId);
                      setView("match-review");
                    }}
                    onUpdate={persist}
                    onNavigate={setView}
                  />
                )}
              </>
            )}

            {view === "inbox" && (
              <ManagerInbox
                career={career}
                onUpdate={persist}
                onNavigate={(v) => {
                  if (v === "season-rewards") setView("season-rewards");
                  else setView(v);
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
                  setView("match-review");
                }}
              />
            )}
            {view === "stats" && <ManagerStatsView career={career} />}
          </div>
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
        <div className="space-y-4">
          <ManagerNav
            active="hub"
            club={career.club}
            onNavigate={setView}
          />
          <ManagerMatchReview
            career={career}
            fixtureId={reviewFixtureId}
            onClose={handleMatchReviewClose}
          />
        </div>
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
      {career && needsPlayoffsIntro(career) && (
        <ManagerPlayoffsIntroModal
          career={career}
          onContinue={handlePlayoffsIntroContinue}
        />
      )}

      {career && trophyModalOpen && (
        <ManagerTrophyModal
          career={career}
          onContinue={handleTrophyModalContinue}
        />
      )}
    </PageShell>
  );
}
