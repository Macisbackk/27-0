"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getNextManagerFixture } from "@/lib/manager/managerSimulation";
import { getCupHubStatus } from "@/lib/manager/managerChallengeCup";
import {
  countExpiringContracts,
  formatWage,
} from "@/lib/manager/managerContracts";
import {
  fanMoodTrend,
  getLastHomeGate,
} from "@/lib/manager/managerAttendance";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { getClubByName } from "@/lib/clubs";
import { getPlayerById } from "@/lib/players";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import {
  computeSquadFitness,
  computeSquadMorale,
  getTopGoalScorer,
  getTopTryScorer,
  moraleLabel,
} from "@/lib/manager/managerCareerStats";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import { playSimulateRound, playUiClick } from "@/lib/sound";

interface ManagerHubProps {
  career: ManagerCareer;
  onPlayGame: () => void;
  onSimulate: () => void;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function formatFunds(budget: number): string {
  if (budget >= 1_000_000) return `£${(budget / 1_000_000).toFixed(1)}m`;
  return `£${(budget / 1000).toFixed(0)}k`;
}

function HubLeagueTable({ career }: { career: ManagerCareer }) {
  const rows = career.leagueTable;
  if (rows.length === 0) return null;

  const userRow = rows.find((r) => r.isUserTeam);
  const showCompact =
    rows.length > 8 && userRow && userRow.position > 5;
  const displayRows = showCompact
    ? [...rows.slice(0, 5), ...(userRow.position > 5 ? [userRow] : [])]
    : rows;

  return (
    <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className={TYPO.sectionLabel}>League Table</p>
          {userRow && (
            <p className={`mt-1 ${TYPO.cardTitle}`}>
              {ordinal(userRow.position)} · {career.club}
            </p>
          )}
        </div>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Game Week {career.gameWeek}/{career.schedule.length}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-pitch-700/50 text-pitch-400">
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Club</th>
              <th className="px-2 py-1.5 text-center">P</th>
              <th className="px-2 py-1.5 text-center">W</th>
              <th className="px-2 py-1.5 text-center">L</th>
              <th className="px-2 py-1.5 text-center">PF</th>
              <th className="px-2 py-1.5 text-center">PA</th>
              <th className="px-2 py-1.5 text-center">+/-</th>
              <th className="px-2 py-1.5 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const club = getClubByName(row.team);
              return (
                <tr
                  key={row.team}
                  className={`border-b border-pitch-800/40 ${
                    row.isUserTeam ? "bg-theme-primary/10" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 font-mono text-pitch-400">
                    {row.position}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: club?.primaryColor }}
                      />
                      <span
                        className={
                          row.isUserTeam
                            ? "font-semibold text-theme-primary"
                            : "text-pitch-200"
                        }
                      >
                        {row.team}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">{row.played}</td>
                  <td className="px-2 py-1.5 text-center">{row.wins}</td>
                  <td className="px-2 py-1.5 text-center">{row.losses}</td>
                  <td className="px-2 py-1.5 text-center">{row.pointsFor}</td>
                  <td className="px-2 py-1.5 text-center">
                    {row.pointsAgainst}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {row.pointsDifference > 0 ? "+" : ""}
                    {row.pointsDifference}
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold text-accent-gold">
                    {row.leaguePoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ManagerHub({ career, onPlayGame, onSimulate }: ManagerHubProps) {
  const club = getClubByName(career.club);
  const nextFixture = getNextManagerFixture(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const teamRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
  const morale = computeSquadMorale(career);
  const fitness = computeSquadFitness(career);
  const injuryCount = career.squad.filter(
    (p) => p.injury && isPlayerUnavailable(p)
  ).length;
  const topScorer = getTopTryScorer(career.playerSeasonStats);
  const topKicker = getTopGoalScorer(career.playerSeasonStats);
  const last = career.lastMatchFixture;
  const ts = career.teamSeasonStats;
  const squadCheck = validateFitMatchdaySquad(career);
  const canPlay = squadCheck.valid && !career.isSeasonComplete;

  const oppRating =
    nextFixture && !career.isSeasonComplete
      ? Math.round(
          getOpponentMatchRating(
            nextFixture.opponent,
            career.seed,
            nextFixture.round,
            { currentSeasonOnly: true }
          )
        )
      : null;

  const prediction =
    nextFixture && !career.isSeasonComplete
      ? getMatchPrediction(teamRating, oppRating ?? 70, nextFixture.isHome)
      : null;

  const formDisplay =
    career.recentForm.length > 0
      ? career.recentForm.slice(-5).join(" ")
      : "—";

  const expiringCount = countExpiringContracts(career.contracts);
  const lastGate = getLastHomeGate(career.gateIncomeHistory);
  const cupStatus = getCupHubStatus(career);
  const overBudget = career.wageBill > career.wageBudget;

  return (
    <div className={SPACING.stackLg}>
      <HubLeagueTable career={career} />

      {nextFixture && !career.isSeasonComplete && (
        <div className={`${CARD.base} ${CARD.featured} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Next Fixture</p>
          <p className={`mt-1 ${TYPO.cardTitle}`}>
            {career.club} {nextFixture.isHome ? "vs" : "@"}{" "}
            {nextFixture.opponent}
          </p>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            {nextFixture.label ?? `Round ${nextFixture.round}`} ·{" "}
            {nextFixture.isHome ? "Home" : "Away"}
            {oppRating !== null && ` · Opponent Rating: ${oppRating}`}
          </p>
          {prediction && (
            <p className={`mt-1 text-sm text-theme-tertiary`}>
              Prediction: {prediction}
            </p>
          )}
          {!squadCheck.valid && (
            <div
              className={`mt-3 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-3 py-2 ${TYPO.bodySm} text-accent-gold`}
            >
              {squadCheck.message}
            </div>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <GameButton
              variant="theme"
              disabled={!canPlay}
              onClick={() => {
                playUiClick();
                onPlayGame();
              }}
            >
              Play Game
            </GameButton>
            <GameButton
              variant="secondary"
              disabled={!canPlay}
              onClick={() => {
                playSimulateRound();
                playUiClick();
                onSimulate();
              }}
            >
              Simulate Match
            </GameButton>
          </div>
        </div>
      )}

      <div
        className={`${CARD.base} ${SPACING.cardPadding} border-l-4`}
        style={{ borderLeftColor: club?.primaryColor ?? "var(--theme-primary)" }}
      >
        <p className={TYPO.sectionLabel}>Club Summary</p>
        <h2 className={`mt-1 ${TYPO.cardTitle}`}>{career.club}</h2>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Season {career.seasonYear} · {ordinal(position)} in the table
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-pitch-500 text-xs">Board Confidence</p>
            <p className="font-semibold text-white">{career.boardConfidence}%</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Budget</p>
            <p className="font-semibold text-accent-gold">
              {formatFunds(career.budget)}
            </p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Squad Rating</p>
            <p className="font-semibold text-theme-primary">{teamRating}</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Cup Status</p>
            <p className={`${TYPO.bodySm} text-pitch-200`}>{cupStatus}</p>
          </div>
        </div>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Team Status</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-pitch-500 text-xs">Morale</p>
            <p>
              {moraleLabel(morale)} ({morale})
            </p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Fitness</p>
            <p>{fitness}%</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Injuries</p>
            <p>{injuryCount}</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Recent Form</p>
            <p className="font-mono tracking-widest">{formDisplay}</p>
          </div>
        </div>
      </div>

      {ts.played > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-2`}>Scoring Leaders</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <span>
              Record: {ts.wins}W-{ts.losses}L
            </span>
            <span>PF: {ts.pointsFor}</span>
            <span>PA: {ts.pointsAgainst}</span>
            <span>
              +/-: {ts.pointsDifference > 0 ? "+" : ""}
              {ts.pointsDifference}
            </span>
            <span>
              Tries: {ts.triesFor} / {ts.triesAgainst}
            </span>
            <span>League Pts: {ts.leaguePoints}</span>
          </div>
          {topScorer && (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
              Top try scorer:{" "}
              {getPlayerById(topScorer.playerId)?.name ?? "—"} ({topScorer.tries}
              )
            </p>
          )}
          {topKicker && (
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              Top goal scorer:{" "}
              {getPlayerById(topKicker.playerId)?.name ?? "—"} ({topKicker.goals}
              )
            </p>
          )}
        </div>
      )}

      {(expiringCount > 0 || injuryCount > 0) && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.sectionLabel}>Warnings</p>
          {expiringCount > 0 && (
            <p className={`mt-1 ${TYPO.bodySm} text-accent-gold`}>
              {expiringCount} contract{expiringCount > 1 ? "s" : ""} expiring
              soon
            </p>
          )}
          {injuryCount > 0 && (
            <p className={`${TYPO.bodySm} text-red-300`}>
              {injuryCount} player{injuryCount > 1 ? "s" : ""} unavailable
            </p>
          )}
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Wages · Fans · Board</p>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-pitch-500 text-xs">Wage Bill</p>
            <p className={overBudget ? "text-red-300" : ""}>
              {formatWage(career.wageBill)}
            </p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Remaining</p>
            <p>
              {formatWage(Math.max(0, career.wageBudget - career.wageBill))}
            </p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Avg Attendance</p>
            <p>
              {career.attendanceData.currentAverageAttendance.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Fan Mood</p>
            <p>{fanMoodTrend(career.attendanceData.fanMood)}</p>
          </div>
        </div>
        {lastGate && (
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
            Last home gate: {lastGate.attendance.toLocaleString()}
          </p>
        )}
      </div>

      {last && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.sectionLabel}>Latest Result</p>
          <p className={`mt-1 font-semibold text-white`}>
            {last.isHome ? "vs" : "@"} {last.opponent}: {last.pointsFor}-
            {last.pointsAgainst} ({last.result})
          </p>
        </div>
      )}
    </div>
  );
}
