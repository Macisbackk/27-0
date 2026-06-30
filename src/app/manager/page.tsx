"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ManagerLanding } from "@/components/manager/ManagerLanding";
import { ManagerClubSelect } from "@/components/manager/ManagerClubSelect";
import { ManagerHub } from "@/components/manager/ManagerHub";
import { ManagerSquad } from "@/components/manager/ManagerSquad";
import { ManagerTactics } from "@/components/manager/ManagerTactics";
import { ManagerTransfers } from "@/components/manager/ManagerTransfers";
import { ManagerFixtures } from "@/components/manager/ManagerFixtures";
import { ManagerTable } from "@/components/manager/ManagerTable";
import { ManagerMatchReview } from "@/components/manager/ManagerMatchReview";
import { ManagerSeasonReview } from "@/components/manager/ManagerSeasonReview";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import {
  loadManagerCareer,
  saveManagerCareer,
  deleteManagerCareer,
  createNewCareer,
  advanceToNextSeason,
  hasManagerCareer,
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

export default function ManagerPage() {
  const router = useRouter();
  const [view, setView] = useState<ManagerView>("landing");
  const [career, setCareer] = useState<ManagerCareer | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [reviewRound, setReviewRound] = useState<number | null>(null);

  useEffect(() => {
    setHasSave(hasManagerCareer());
    const saved = loadManagerCareer();
    if (saved) setCareer(saved);
  }, []);

  const persist = useCallback((next: ManagerCareer) => {
    setCareer(next);
    saveManagerCareer(next);
    setHasSave(true);
  }, []);

  const handleStartNew = () => setView("club-select");

  const handleContinue = () => {
    const saved = loadManagerCareer();
    if (!saved) return;
    setCareer(saved);
    setView(saved.isSeasonComplete ? "season-review" : "hub");
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

  const handleSimulate = () => {
    if (!career) return;
    const next = simulateManagerNextMatch(career);
    const fixture = next.fixtures[next.fixtures.length - 1];
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
      setReviewRound(fixture.round);
      setView("match-review");
    }
  };

  const handleContinueSeason = () => {
    if (!career) return;
    const next = advanceToNextSeason(career);
    setCareer(next);
    setView("hub");
  };

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

      {career && view === "hub" && (
        <ManagerHub
          career={career}
          onNavigate={setView}
          onSimulate={handleSimulate}
        />
      )}

      {career && view === "squad" && (
        <ManagerSquad
          career={career}
          onBack={() => {
            playUiClick();
            setView("hub");
          }}
        />
      )}

      {career && view === "tactics" && (
        <ManagerTactics
          career={career}
          onChange={(tactics) => persist({ ...career, tactics })}
          onBack={() => {
            playUiClick();
            setView("hub");
          }}
        />
      )}

      {career && view === "transfers" && (
        <ManagerTransfers
          career={career}
          onUpdate={persist}
          onBack={() => {
            playUiClick();
            setView("hub");
          }}
        />
      )}

      {career && view === "fixtures" && (
        <ManagerFixtures
          career={career}
          onSelectFixture={(round) => {
            setReviewRound(round);
            setView("match-review");
          }}
          onBack={() => {
            playUiClick();
            setView("hub");
          }}
        />
      )}

      {career && view === "table" && (
        <ManagerTable
          career={career}
          onBack={() => {
            playUiClick();
            setView("hub");
          }}
        />
      )}

      {career && view === "match-review" && reviewRound !== null && (
        <ManagerMatchReview
          career={career}
          round={reviewRound}
          onClose={() => {
            playUiClick();
            setView("hub");
          }}
        />
      )}

      {career && view === "season-review" && (
        <ManagerSeasonReview
          career={career}
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
