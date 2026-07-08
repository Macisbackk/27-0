"use client";

import { useCallback, useEffect, useMemo } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerInboxBadge,
  ManagerSectionCard,
  ManagerStat,
} from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { InboxMessage, ManagerCareer } from "@/lib/manager/types";
import { getReserveReportPeriod } from "@/lib/manager/managerReserveReports";
import { getPotentialTier } from "@/lib/manager/managerReserves";
import { POSITION_SHORT } from "@/lib/positions";
import {
  managerClubAccentCardStyle,
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { playMenuOpen, playUiClick } from "@/lib/sound";

interface ManagerReserveReportModalProps {
  career: ManagerCareer;
  message: InboxMessage;
  onDismiss: () => void;
  onViewReserves?: () => void;
}

export function ManagerReserveReportModal({
  career,
  message,
  onDismiss,
  onViewReserves,
}: ManagerReserveReportModalProps) {
  const handleDismiss = useCallback(() => {
    playUiClick();
    onDismiss();
  }, [onDismiss]);

  const panelRef = useModalA11y(true, handleDismiss);

  useEffect(() => {
    playMenuOpen();
  }, []);

  const month = getReserveReportMonth(career);
  const bodyLines = useMemo(
    () => message.body.split("\n").filter((line) => line.trim().length > 0),
    [message.body]
  );

  const topReserves = useMemo(
    () => [...career.reserves].sort((a, b) => b.rating - a.rating).slice(0, 3),
    [career.reserves]
  );

  const recentResults = career.reserveResults.slice(-4);
  const recentWins = recentResults.filter((r) => r.userWon).length;

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} ${SPACING.safeBottom} backdrop-blur-sm sm:items-center sm:py-6`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-report-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="card-glass my-auto flex w-full max-w-lg max-h-[min(92dvh,900px)] flex-col overflow-hidden outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${SPACING.cardPadding}`}>
          <div className={managerModalHeaderClass("primary", { centered: true })}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-indigo-400/50 bg-indigo-500/20 shadow-inner">
              <span
                className="font-display text-xl font-black text-indigo-100"
                aria-hidden
              >
                Y
              </span>
            </div>
            <div className="mt-3 flex justify-center">
              <ManagerInboxBadge type="reserve_report" />
            </div>
            <h2 id="reserve-report-title" className={`mt-3 ${TYPO.cardTitle}`}>
              {message.title}
            </h2>
            <p className={`mx-auto mt-2 max-w-sm ${TYPO.bodySm} text-pitch-300`}>
              Month {month} academy and reserve update for {career.seasonYear}.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ManagerStat
              label="Registered"
              value={String(career.reserves.length)}
              tone="default"
            />
            <ManagerStat
              label="Recent form"
              value={
                recentResults.length > 0
                  ? `${recentWins}/${recentResults.length}`
                  : "—"
              }
              tone={recentWins >= 2 ? "primary" : "muted"}
            />
            <ManagerStat
              label="Season"
              value={`Y${career.seasonYear}`}
              tone="muted"
            />
          </div>

          {bodyLines.length > 0 && (
            <div className="mt-4 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2.5">
              {bodyLines.map((line) => (
                <p
                  key={line}
                  className={`${TYPO.bodySm} leading-relaxed text-indigo-100${
                    line !== bodyLines[0] ? " mt-2" : ""
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          )}

          {topReserves.length > 0 && (
            <ManagerSectionCard
              variant="inset"
              className="mt-4 !p-0 overflow-hidden border-indigo-400/25"
              style={managerClubAccentCardStyle(career.club)}
            >
              <div className="border-b border-pitch-700/40 px-4 py-2.5">
                <span className={managerPillClass("sky")}>Top prospects</span>
              </div>
              <ul className="divide-y divide-pitch-700/35">
                {topReserves.map((player, index) => (
                  <li
                    key={player.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {index + 1}. {player.name}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-pitch-500">
                        {POSITION_SHORT[player.position]} ·{" "}
                        {getPotentialTier(player.potentialRating).toLowerCase()}{" "}
                        potential
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-sm font-bold text-indigo-200">
                      {player.rating}
                    </span>
                  </li>
                ))}
              </ul>
            </ManagerSectionCard>
          )}

          {recentResults.length > 0 && (
            <div className="mt-4">
              <p className={`mb-2 ${TYPO.sectionLabel} text-pitch-500`}>
                Recent reserve results
              </p>
              <ul className="space-y-1.5">
                {recentResults.map((result) => (
                  <li
                    key={`${result.round}-${result.opponentClub}`}
                    className="flex items-center justify-between rounded-lg border border-pitch-700/45 bg-pitch-950/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-pitch-300">
                      vs {result.opponent}
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        result.userWon ? "text-theme-primary" : "text-pitch-500"
                      }`}
                    >
                      {result.walkover
                        ? result.walkoverReason ?? "Walkover"
                        : `${result.userScore}-${result.oppScore}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          className={`shrink-0 border-t border-pitch-700/50 bg-pitch-950/90 ${SPACING.cardPadding} pt-4`}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {onViewReserves && (
              <GameButton
                variant="theme"
                onClick={() => {
                  playUiClick();
                  onViewReserves();
                }}
              >
                View reserves
              </GameButton>
            )}
            <GameButton
              variant={onViewReserves ? "secondary" : "theme"}
              className={onViewReserves ? undefined : "sm:col-span-2"}
              onClick={handleDismiss}
            >
              Got it
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}
