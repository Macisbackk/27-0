"use client";

import { useMemo, useState } from "react";
import { BracketRecap } from "@/components/BracketRecap";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import type { ManagerCareer, ManagerScheduledFixture } from "@/lib/manager/types";
import {
  getCupBracketForDisplay,
  getManagerBracketRoundLabel,
} from "@/lib/manager/managerChallengeCup";
import { getManagerCupRoundLabel } from "@/lib/manager/managerFixtureDisplay";
import { getActiveRound } from "@/lib/game/challenge-cup-bracket";
import {
  isExpandedChallengeCup,
} from "@/lib/manager/championship/championshipChallengeCup";
import { managerCompetitionPanelClass, managerPillClass } from "@/lib/manager/managerSurfaces";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

export type ChallengeCupBracketVariant = "full" | "hub-compact" | "mobile-round";

interface ManagerChallengeCupBracketProps {
  career: ManagerCareer;
  variant?: ChallengeCupBracketVariant;
  /** Hub status line (e.g. "Next: Quarter-Final"). */
  statusLine?: string;
  nextFixture?: ManagerScheduledFixture | null;
  onViewFullBracket?: () => void;
  /** Open Match Review for a completed user cup fixture. */
  onOpenMatchReview?: (fixtureId: string) => void;
  /** Navigate to match prep / hub for an upcoming user cup tie. */
  onOpenMatchPrep?: (cupMatchId: string) => void;
}

function resolveCompletedUserFixtureId(
  career: ManagerCareer,
  cupMatchId: string
): string | null {
  const match = career.challengeCup?.matches.find((m) => m.id === cupMatchId);
  const direct = career.fixtures.find(
    (f) =>
      f.competition === "challenge_cup" &&
      (f.fixtureId === `cup-${cupMatchId}` ||
        f.fixtureId === cupMatchId ||
        f.fixtureId?.includes(cupMatchId))
  );
  if (direct?.fixtureId) return direct.fixtureId;

  if (match?.status === "complete" && match.isUserMatch) {
    const byOpponent = career.fixtures.find(
      (f) =>
        f.competition === "challenge_cup" &&
        (f.opponent === match.homeTeam || f.opponent === match.awayTeam) &&
        f.result != null
    );
    if (byOpponent?.fixtureId) return byOpponent.fixtureId;
    return `cup-${cupMatchId}`;
  }
  return null;
}

/**
 * Single Challenge Cup bracket surface for Fixtures (full) and Hub (compact).
 * Always reads saved `career.challengeCup` — never redraws the tournament.
 */
export function ManagerChallengeCupBracket({
  career,
  variant = "full",
  statusLine,
  nextFixture,
  onViewFullBracket,
  onOpenMatchReview,
  onOpenMatchPrep,
}: ManagerChallengeCupBracketProps) {
  const cup = getCupBracketForDisplay(career);
  const [aiDetail, setAiDetail] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const activeRound = useMemo(
    () => (cup ? getActiveRound(cup) : 1),
    [cup]
  );

  if (!cup) return null;

  const roundLabel = nextFixture?.cupRound
    ? getManagerCupRoundLabel(nextFixture.cupRound)
    : getManagerBracketRoundLabel(cup, activeRound);
  const compact = variant === "hub-compact";

  return (
    <div
      className={
        compact
          ? managerCompetitionPanelClass("challenge_cup")
          : "min-w-0"
      }
    >
      {compact ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`${TYPO.sectionLabel} text-sky-300`}>
                Challenge Cup Bracket
              </p>
              <span className={managerPillClass("sky")}>{roundLabel}</span>
            </div>
            {statusLine ? (
              <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
                <span className="text-sky-200">{statusLine}</span>
              </p>
            ) : null}
          </div>
          {onViewFullBracket ? (
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => {
                playUiClick();
                onViewFullBracket();
              }}
            >
              View Full Bracket
            </GameButton>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          compact
            ? "min-w-0 overflow-x-auto"
            : "min-w-0"
        }
      >
        <BracketRecap
          matches={cup.matches}
          userClub={cup.userClub}
          byeTeams={cup.byeTeams}
          expandedMeta={
            isExpandedChallengeCup(cup) ? cup.expandedMeta : undefined
          }
          variant={variant}
          focusRound={compact ? activeRound : undefined}
          onSelectCompletedUserMatch={(cupMatchId) => {
            const fixtureId = resolveCompletedUserFixtureId(career, cupMatchId);
            if (fixtureId && onOpenMatchReview) {
              onOpenMatchReview(fixtureId);
            }
          }}
          onSelectUpcomingUserMatch={(cupMatchId) => {
            onOpenMatchPrep?.(cupMatchId);
          }}
          onSelectAiMatch={(cupMatchId) => {
            const match = cup.matches.find((m) => m.id === cupMatchId);
            if (!match || match.status !== "complete") return;
            setAiDetail({
              title: "Challenge Cup result",
              message: `${match.homeTeam ?? "TBD"} ${match.homeScore ?? "–"}–${match.awayScore ?? "–"} ${match.awayTeam ?? "TBD"}${
                match.winner ? `\nWinner: ${match.winner}` : ""
              }`,
            });
          }}
        />
      </div>

      {aiDetail ? (
        <ManagerDialog
          open
          title={aiDetail.title}
          message={aiDetail.message}
          onConfirm={() => setAiDetail(null)}
          onCancel={() => setAiDetail(null)}
        />
      ) : null}
    </div>
  );
}
