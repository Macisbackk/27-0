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
import { ManagerTransfers } from "@/components/manager/ManagerTransfers";
import { ManagerFixtures } from "@/components/manager/ManagerFixtures";
import { ManagerStatsView } from "@/components/manager/ManagerStatsView";
import { ManagerPlayGame } from "@/components/manager/ManagerPlayGame";
import { ManagerMatchReview } from "@/components/manager/ManagerMatchReview";
import { ManagerSeasonReview } from "@/components/manager/ManagerSeasonReview";
import { ManagerSeasonRewards } from "@/components/manager/ManagerSeasonRewards";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
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
import { SPACING } from "@/lib/ui/design-system";

const NAV_VIEWS: ManagerView[] = [
  "hub",
  "squad",
  "contracts",
  "reserves",
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
    setView(hydrated.isSeasonComplete
      ? hydrated.seasonRewardClaimedForYear === hydrated.seasonYear
        ? "season-rewards"
        : "season-review"
      : "hub");
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
    if (next.isSeasonComplete) {
      recordSeasonComplete(next);
      setView("season-review");
    } else if (fixture) {
      setReviewFixtureId(fixture.fixtureId ?? `round-${fixture.round}`);
      setView("match-review");
    }
  };

  const handleSimulate = () => {
    if (!career) return;
    const check = validateFitMatchdaySquad(career);
    if (!check.valid) return;
    afterMatch(simulateManagerNextMatch(career));
  };

  const handlePlayGame = () => {
    if (!career) return;
    const check = validateFitMatchdaySquad(career);
    if (!check.valid) return;
    setView("play-game");
  };

  const handlePlayComplete = (next: ManagerCareer) => {
    afterMatch(next);
  };

  const handleContinueSeason = () => {
    if (!career) return;
    const next = advanceToNextSeason(career);
    setCareer(hydrateManagerCareer(next));
    setView("hub");
  };

  const showNav =
    career && NAV_VIEWS.includes(view as (typeof NAV_VIEWS)[number]);

  return (
    <div className={`mx-auto max-w-4xl ${SPACING.pageX} py-6 sm:py-8`}>
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
        <div className={SPACING.stackLg}>
          <ManagerNav
            active={view}
            club={career.club}
            onNavigate={setView}
          />

          {view === "hub" && (
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

          {view === "squad" && (
            <ManagerSquad career={career} onUpdate={persist} />
          )}
          {view === "contracts" && (
            <ManagerContracts career={career} onUpdate={persist} />
          )}
          {view === "reserves" && (
            <ManagerReserves career={career} onUpdate={persist} />
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
      )}

      {career && view === "play-game" && (
        <div className={SPACING.stackLg}>
          <ManagerNav
            active="hub"
            club={career.club}
            onNavigate={setView}
          />
          <ManagerPlayGame
            career={career}
            onComplete={handlePlayComplete}
            onCancel={() => setView("hub")}
          />
        </div>
      )}

      {career && view === "match-review" && reviewFixtureId !== null && (
        <div className={SPACING.stackLg}>
          <ManagerNav
            active="fixtures"
            club={career.club}
            onNavigate={setView}
          />
          <ManagerMatchReview
            career={career}
            fixtureId={reviewFixtureId}
            onClose={() => setView("hub")}
          />
        </div>
      )}

      {career && view === "season-review" && (
        <ManagerSeasonReview
          career={career}
          onViewRewards={() => setView("season-rewards")}
          onHome={() => {
            playUiClick();
            router.push("/");
          }}
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
    </div>
  );
}
