"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { CUP_ROUND_LABELS } from "@/lib/manager/types";
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
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import {
  computeSquadFitness,
  computeSquadForm,
  formLabel,
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import { playSimulateRound, playUiClick } from "@/lib/sound";

interface ManagerHubProps {
  career: ManagerCareer;
  onPlayGame: () => void;
  onSimulate: () => void;
  onSelectFixture?: (fixtureId: string) => void;
  onUpdate?: (career: ManagerCareer) => void;
  onNavigate?: (view: ManagerView) => void;
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

function fixtureRoundLabel(f: ManagerCareer["fixtures"][0]): string {
  if (f.competition === "challenge_cup" && f.meta?.cupRound) {
    return CUP_ROUND_LABELS[f.meta.cupRound] ?? "Challenge Cup";
  }
  return `Round ${f.round} · League`;
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
      <p className={TYPO.sectionLabel}>League Table</p>
      {userRow && (
        <p className={`mt-1 ${TYPO.cardTitle}`}>
          {ordinal(userRow.position)} · {career.club}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
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

function HubResults({
  career,
  onSelectFixture,
  onUpdate,
}: {
  career: ManagerCareer;
  onSelectFixture?: (fixtureId: string) => void;
  onUpdate?: (career: ManagerCareer) => void;
}) {
  const expanded = career.hubResultsExpanded ?? false;
  const results = [...career.fixtures].sort(
    (a, b) => b.round - a.round || b.pointsFor - a.pointsFor
  );
  const lastFive = career.recentForm.slice(-5).join(" ");
  const toggle = () => {
    onUpdate?.({ ...career, hubResultsExpanded: !expanded });
  };

  if (results.length === 0) return null;

  return (
    <div className={`${CARD.base} ${SPACING.cardPadding}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={TYPO.sectionLabel}>Results</p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
            Last 5: {lastFive || "—"}
          </p>
        </div>
        <GameButton variant="secondary" size="sm" onClick={toggle}>
          {expanded ? "Collapse" : "Expand"}
        </GameButton>
      </div>

      {expanded && (
        <ul className={`mt-3 ${SPACING.stackSm}`}>
          {results.map((f) => {
            const homeTeam = f.isHome ? career.club : f.opponent;
            const awayTeam = f.isHome ? f.opponent : career.club;
            const homeScore = f.isHome ? f.pointsFor : f.pointsAgainst;
            const awayScore = f.isHome ? f.pointsAgainst : f.pointsFor;
            const badgeClass =
              f.result === "W"
                ? "text-theme-primary"
                : f.result === "L"
                  ? "text-red-300"
                  : "text-pitch-300";
            const fixtureId = f.fixtureId ?? `round-${f.round}`;
            const attendance = f.meta?.attendance?.attendance;

            return (
              <li key={fixtureId}>
                <button
                  type="button"
                  onClick={() => onSelectFixture?.(fixtureId)}
                  className={`${CARD.inset} w-full px-3 py-2 text-left transition hover:border-theme-primary/30`}
                >
                  <p className={`${TYPO.bodySm} text-pitch-400`}>
                    {fixtureRoundLabel(f)}
                  </p>
                  <p className="mt-0.5 font-medium text-white">
                    {homeTeam} {homeScore} - {awayScore} {awayTeam}
                  </p>
                  <p className={`mt-0.5 ${TYPO.bodySm}`}>
                    <span className={`font-bold ${badgeClass}`}>{f.result}</span>
                    {attendance != null && (
                      <span className="text-pitch-400">
                        {" "}
                        · Attendance: {attendance.toLocaleString()}
                      </span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ManagerHub({
  career,
  onPlayGame,
  onSimulate,
  onSelectFixture,
  onUpdate,
  onNavigate,
}: ManagerHubProps) {
  const club = getClubByName(career.club);
  const nextFixture = getNextManagerFixture(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const teamRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions,
    career
  );
  const squadForm = computeSquadForm(career);
  const fitness = computeSquadFitness(career);
  const injuryCount = career.squad.filter(
    (p) => p.injury && isPlayerUnavailable(p)
  ).length;
  const topScorer = getTopTryScorer(career.playerSeasonStats);
  const topKicker = getTopGoalScorer(career.playerSeasonStats);
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
      {nextFixture && !career.isSeasonComplete && (
        <div className={`${CARD.elevated} ${CARD.featured} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Next Fixture</p>
          <p className={`mt-1 text-xl font-bold text-white sm:text-2xl`}>
            {career.club} {nextFixture.isHome ? "vs" : "@"}{" "}
            {nextFixture.opponent}
          </p>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            {nextFixture.label ?? `Round ${nextFixture.round}`} ·{" "}
            {nextFixture.competition === "challenge_cup"
              ? "Challenge Cup"
              : "League"}{" "}
            · {nextFixture.isHome ? "Home" : "Away"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-pitch-500 text-xs">Your rating</p>
              <p className="font-semibold text-theme-primary">{teamRating}</p>
            </div>
            {oppRating !== null && (
              <div>
                <p className="text-pitch-500 text-xs">Opponent rating</p>
                <p className="font-semibold">{oppRating}</p>
              </div>
            )}
            <div>
              <p className="text-pitch-500 text-xs">Game week</p>
              <p>
                {career.gameWeek}/{career.schedule.length}
              </p>
            </div>
            {prediction && (
              <div>
                <p className="text-pitch-500 text-xs">Prediction</p>
                <p className="text-theme-tertiary">{prediction}</p>
              </div>
            )}
          </div>
          {!squadCheck.valid && (
            <div
              className={`mt-3 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-3 py-2 ${TYPO.bodySm} text-accent-gold whitespace-pre-line`}
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

      <HubLeagueTable career={career} />

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Season Progress</p>
        <p className={`mt-1 ${TYPO.cardTitle}`}>
          Game Week {career.gameWeek} of {career.schedule.length}
        </p>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Season {career.seasonYear} · {ordinal(position)} in the table ·{" "}
          {cupStatus}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-pitch-800">
          <div
            className="h-full bg-theme-primary transition-all"
            style={{
              width: `${Math.min(100, (career.gameWeek / Math.max(1, career.schedule.length)) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Team Status</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-pitch-500 text-xs">Squad form</p>
            <p>
              {formLabel(squadForm)} ({squadForm})
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

      <HubResults
        career={career}
        onSelectFixture={onSelectFixture}
        onUpdate={onUpdate}
      />

      {ts.played > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-2`}>Scoring Leaders</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <span>
              Record: {ts.wins}W-{ts.losses}L
            </span>
            <span>
              Tries: {ts.triesFor} scored / {ts.triesAgainst} conceded
            </span>
          </div>
          {topScorer && (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-200`}>
              Top try scorer:{" "}
              <span className="font-semibold text-white">
                {getManagerPlayer(career, topScorer.playerId)?.name ?? "—"}
              </span>{" "}
              ({topScorer.tries})
            </p>
          )}
          {topKicker && topKicker.goals > 0 && (
            <p className={`${TYPO.bodySm} text-pitch-200`}>
              Top goal scorer:{" "}
              <span className="font-semibold text-white">
                {getManagerPlayer(career, topKicker.playerId)?.name ?? "—"}
              </span>{" "}
              ({topKicker.goals})
            </p>
          )}
        </div>
      )}

      {(expiringCount > 0 || injuryCount > 0) && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.sectionLabel}>Contracts & Injuries</p>
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

      <div
        className={`${CARD.base} ${SPACING.cardPadding} border-l-4`}
        style={{ borderLeftColor: club?.primaryColor ?? "var(--theme-primary)" }}
      >
        <p className={TYPO.sectionLabel}>Board · Budget · Attendance</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
            <p className="text-pitch-500 text-xs">Wage Bill</p>
            <p className={overBudget ? "text-red-300" : ""}>
              {formatWage(career.wageBill)}
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

      {onNavigate && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-3`}>Quick Actions</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigate("squad")}
            >
              Squad & Tactics
            </GameButton>
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigate("reserves")}
            >
              Reserves
            </GameButton>
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigate("fixtures")}
            >
              Fixtures
            </GameButton>
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigate("contracts")}
            >
              Contracts
            </GameButton>
          </div>
        </div>
      )}
    </div>
  );
}
