"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import {
  callUpReserveForNextMatch,
  getPotentialTier,
  getReserveOpponent,
  promoteReserveToSquad,
  releaseReserve,
} from "@/lib/manager/managerReserves";
import { getNextManagerFixture } from "@/lib/manager/managerSimulation";
import { playUiClick } from "@/lib/sound";

type ReserveFilter = "all" | "position" | "potential" | "rating" | "age" | "callup";

interface ManagerReservesProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

export function ManagerReserves({ career, onUpdate }: ManagerReservesProps) {
  const [filter, setFilter] = useState<ReserveFilter>("all");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [message, setMessage] = useState<string | null>(null);

  const nextFixture = getNextManagerFixture(career);
  const upcomingOpp = nextFixture
    ? getReserveOpponent(career.club, nextFixture.round, career.seed)
    : null;

  const rows = useMemo(() => {
    let list = [...career.reserves];
    if (positionFilter !== "all") {
      list = list.filter((r) => r.eligiblePositions.includes(positionFilter));
    }
    if (filter === "potential") {
      list.sort((a, b) => b.potentialRating - a.potentialRating);
    } else if (filter === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (filter === "age") {
      list.sort((a, b) => a.age - b.age);
    } else if (filter === "callup") {
      list = list.filter((r) => !r.calledUpForNextMatch);
    }
    return list;
  }, [career.reserves, filter, positionFilter]);

  const handlePromote = (id: string) => {
    const result = promoteReserveToSquad(career, id);
    if (!result.ok || !result.career) {
      setMessage(result.error ?? "Could not promote player");
      return;
    }
    onUpdate(result.career);
    setMessage("Player signed to first-team squad");
  };

  const handleCallUp = (id: string) => {
    onUpdate(callUpReserveForNextMatch(career, id));
    setMessage("Called up for next match");
  };

  const handleRelease = (id: string, name: string) => {
    if (!window.confirm(`Release ${name} from the reserves?`)) return;
    onUpdate(releaseReserve(career, id));
    setMessage(`${name} released`);
  };

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Reserves</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Youth & reserve squad · {career.reserves.length} players
        </p>
      </div>

      {message && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{message}</p>
      )}

      {(career.lastReserveResult || upcomingOpp) && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          {career.lastReserveResult && (
            <div>
              <p className={TYPO.sectionLabel}>Latest Reserve Result</p>
              <p className={`mt-1 font-medium text-white`}>
                {career.club} Reserves {career.lastReserveResult.userScore} -{" "}
                {career.lastReserveResult.oppScore}{" "}
                {career.lastReserveResult.opponent}
              </p>
              {career.lastReserveResult.topPerformer && (
                <p className={`${TYPO.bodySm} text-pitch-400`}>
                  Top Performer: {career.lastReserveResult.topPerformer}
                </p>
              )}
            </div>
          )}
          {upcomingOpp && !career.isSeasonComplete && (
            <div className={career.lastReserveResult ? "mt-3" : ""}>
              <p className={TYPO.sectionLabel}>Upcoming Reserve Fixture</p>
              <p className={`mt-1 ${TYPO.bodySm} text-white`}>
                {career.club} Reserves vs {upcomingOpp} Reserves
                {nextFixture && ` · Round ${nextFixture.round}`}
              </p>
            </div>
          )}
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Filters</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["potential", "Potential"],
              ["rating", "Rating"],
              ["age", "Age"],
              ["callup", "Available call-up"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg border px-2 py-1 text-xs ${
                filter === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`rounded-lg border px-2 py-1 text-xs ${
              positionFilter === "all"
                ? FILTER.chipActive
                : "border-pitch-600 text-pitch-300"
            }`}
          >
            All positions
          </button>
          {(Object.keys(POSITION_SHORT) as Position[]).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`rounded-lg border px-2 py-1 text-xs ${
                positionFilter === pos
                  ? FILTER.chipActive
                  : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </div>

      <div className={`${SPACING.stackSm}`}>
        {rows.map((r) => (
          <div
            key={r.id}
            className={`${CARD.base} ${SPACING.cardPaddingSm}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-white">
                  {r.name}
                  {r.calledUpForNextMatch && (
                    <span className="ml-2 text-xs text-theme-primary">
                      Called up
                    </span>
                  )}
                </p>
                <p className={`${TYPO.bodySm} text-pitch-400`}>
                  {POSITION_SHORT[r.position]} · Age {r.age} · {r.nationality}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-theme-primary">
                  {r.rating}
                </p>
                <p className={`${TYPO.bodySm} text-pitch-500`}>
                  POT {r.potentialRating}
                </p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-pitch-300 sm:grid-cols-4">
              <span>{getPotentialTier(r.potentialRating)}</span>
              <span>Form {r.form}</span>
              <span>
                {r.reserveAppearances} apps · {r.reserveTries} tries
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <GameButton
                variant="theme"
                size="sm"
                onClick={() => {
                  playUiClick();
                  handlePromote(r.id);
                }}
              >
                Full-Time Contract
              </GameButton>
              <GameButton
                variant="secondary"
                size="sm"
                disabled={r.calledUpForNextMatch}
                onClick={() => {
                  playUiClick();
                  handleCallUp(r.id);
                }}
              >
                Call Up Next Game
              </GameButton>
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  playUiClick();
                  handleRelease(r.id, r.name);
                }}
              >
                Release
              </GameButton>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No reserve players match your filters.
        </p>
      )}
    </div>
  );
}
