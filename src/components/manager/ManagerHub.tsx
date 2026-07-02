"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getNextManagerFixture } from "@/lib/manager/managerSimulation";
import { ensureCupBracketReady, getCupHubStatus } from "@/lib/manager/managerChallengeCup";
import { ensurePlayoffsReady, getPlayoffHubStatus } from "@/lib/manager/managerPlayoffs";
import {
  countExpiringContracts,
} from "@/lib/manager/managerContracts";
import {
  fanMoodTrend,
  getHomeFixtureAttendanceOutlook,
  getLastHomeGate,
} from "@/lib/manager/managerAttendance";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { getClubByName, getClubColors, getClubIndicatorColor } from "@/lib/clubs";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import {
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import { playSimulateRound, playUiClick } from "@/lib/sound";
import { autoFixMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { getHubNewsItems } from "@/lib/manager/managerNews";
import { formatWage } from "@/lib/manager/managerContracts";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  getManagerScheduledFixtureHeadline,
  isChallengeCupFixture,
} from "@/lib/manager/managerFixtureDisplay";

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

function HubBoardBudgetAttendance({
  career,
  club,
  transferBudget,
  lastGate,
}: {
  career: ManagerCareer;
  club: ReturnType<typeof getClubByName>;
  transferBudget: number;
  lastGate: ReturnType<typeof getLastHomeGate>;
}) {
  return (
    <div
      className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4`}
      style={{ borderLeftColor: getClubIndicatorColor(career.club) }}
    >
      <p className={TYPO.sectionLabel}>Board · Budget · Attendance</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-pitch-500 text-xs">Board Confidence</p>
          <p className="font-semibold text-white">{career.boardConfidence}%</p>
        </div>
        <div>
          <p className="text-pitch-500 text-xs">Transfer Budget</p>
          <p className="font-semibold text-accent-gold">
            {formatFunds(transferBudget)}
          </p>
        </div>
        <div>
          <p className="text-pitch-500 text-xs">Club Funds</p>
          <p className="font-semibold text-pitch-200">
            {formatFunds(career.budget)}
          </p>
        </div>
        <div>
          <p className="text-pitch-500 text-xs">Wage Bill</p>
          <p className="font-semibold text-pitch-200">
            {formatWage(career.wageBill)}
            <span className="text-pitch-500 font-normal">
              {" "}
              / {formatWage(career.wageBudget)}
            </span>
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
  );
}

function HubLeagueTable({ career }: { career: ManagerCareer }) {
  const [expanded, setExpanded] = useState(false);
  const rows = career.leagueTable;
  if (rows.length === 0) return null;

  const userRow = rows.find((r) => r.isUserTeam);
  const showCompact =
    !expanded && rows.length > 8 && userRow && userRow.position > 5;
  const displayRows = showCompact
    ? [...rows.slice(0, 5), ...(userRow.position > 5 ? [userRow] : [])]
    : rows;

  return (
    <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={TYPO.sectionLabel}>League Table</p>
        {rows.length > 6 && (
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setExpanded((e) => !e);
            }}
            className="text-xs text-theme-primary hover:underline"
          >
            {expanded ? "Show less" : "Show full table"}
          </button>
        )}
      </div>
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
              const indicatorColor = getClubIndicatorColor(row.team);
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
                        style={{ backgroundColor: indicatorColor }}
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

export function ManagerHub({
  career,
  onPlayGame,
  onSimulate,
  onUpdate,
  onNavigate,
}: ManagerHubProps) {
  const club = getClubByName(career.club);
  const nextFixture = getNextManagerFixture(
    ensurePlayoffsReady(ensureCupBracketReady(career))
  );
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const simCareer = resolveCareerForMatchSimulation(career);
  const teamRating = computeManagerTeamRating(
    simCareer.matchdayXiii,
    simCareer.matchdayInterchange,
    simCareer.xiiiSlotPositions,
    simCareer
  );
  const injuryCount = career.squad.filter(
    (p) => p.injury && isPlayerUnavailable(p)
  ).length;
  const topScorer = getTopTryScorer(career.playerSeasonStats);
  const topKicker = getTopGoalScorer(career.playerSeasonStats);
  const ts = career.teamSeasonStats;
  const squadCheck = validateFitMatchdaySquad(simCareer);
  const canPlay = squadCheck.valid && !career.isSeasonComplete;

  const oppRating =
    nextFixture && !career.isSeasonComplete
      ? nextFixture.competition === "friendly" &&
        career.preSeason.activeFriendly
        ? career.preSeason.activeFriendly.teamRating
        : Math.round(
            getOpponentMatchRating(
              nextFixture.opponent,
              career.seed,
              nextFixture.round,
              { currentSeasonOnly: nextFixture.competition !== "friendly" }
            )
          )
      : null;

  const prediction =
    nextFixture && !career.isSeasonComplete
      ? getMatchPrediction(teamRating, oppRating ?? 70, nextFixture.isHome)
      : null;

  const homeAttendanceOutlook =
    nextFixture?.isHome && !career.isSeasonComplete
      ? getHomeFixtureAttendanceOutlook(career, nextFixture)
      : null;

  const formDisplay =
    career.recentForm.length > 0
      ? career.recentForm.slice(-5).join(" ")
      : "—";

  const expiringCount = countExpiringContracts(career.contracts);
  const lastGate = getLastHomeGate(career.gateIncomeHistory);
  const cupStatus = getCupHubStatus(career);
  const playoffStatus = getPlayoffHubStatus(career);
  const wageOverBudget = career.wageBill > career.wageBudget;
  const wagePressure = career.wagePressureWeeks ?? 0;
  const newsItems = getHubNewsItems(career);
  const transferBudget = career.managerFinance?.transferBudget ?? career.budget;

  const handleAutoFix = () => {
    const result = autoFixMatchdaySquad(career);
    onUpdate?.(result.career);
    if (!result.ok) window.alert(result.message);
  };

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-3">
      {nextFixture && !career.isSeasonComplete && (
        <div
          className={`${CARD.elevated} ${CARD.featured} ${SPACING.cardPadding} ${
            isChallengeCupFixture(nextFixture.competition)
              ? "border-2 border-accent-gold/55 bg-accent-gold/12 ring-2 ring-accent-gold/30"
              : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={TYPO.sectionLabel}>Next Fixture</p>
            <ManagerCompetitionBadge
              competition={nextFixture.competition}
              cupRound={nextFixture.cupRound}
            />
          </div>
          {isChallengeCupFixture(nextFixture.competition) && (
            <p className={`mt-1 text-sm font-semibold text-accent-gold`}>
              {getManagerScheduledFixtureHeadline(nextFixture)}
            </p>
          )}
          <p className={`mt-1 text-xl font-bold text-white sm:text-2xl`}>
            {career.club} {nextFixture.isHome ? "vs" : "@"}{" "}
            {nextFixture.opponent}
          </p>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            {getManagerScheduledFixtureHeadline(nextFixture)} ·{" "}
            {nextFixture.isHome ? "Home" : "Away"}
          </p>
          {homeAttendanceOutlook && (
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
              {homeAttendanceOutlook.label} · ~
              {homeAttendanceOutlook.predictedAttendance.toLocaleString()} expected
            </p>
          )}
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
              {onUpdate && (
                <GameButton
                  variant="theme"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    playUiClick();
                    handleAutoFix();
                  }}
                >
                  Auto Fix Squad
                </GameButton>
              )}
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

      <HubBoardBudgetAttendance
        career={career}
        club={club}
        transferBudget={transferBudget}
        lastGate={lastGate}
      />

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Season Progress</p>
        <p className={`mt-1 ${TYPO.cardTitle}`}>
          Game Week {career.gameWeek} of {career.schedule.length}
        </p>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Season {career.seasonYear} · {ordinal(position)} in the table ·{" "}
          {cupStatus} · {playoffStatus}
        </p>
        {wageOverBudget && (
          <p className={`mt-1 ${TYPO.bodySm} text-amber-300`}>
            Wage bill over budget
            {wagePressure >= 4
              ? " — board demanding sales or renewals at lower wages"
              : ""}
          </p>
        )}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-pitch-800">
          <div
            className="h-full bg-theme-primary transition-all"
            style={{
              width: `${Math.min(100, (career.gameWeek / Math.max(1, career.schedule.length)) * 100)}%`,
            }}
          />
        </div>
      </div>

      <HubLeagueTable career={career} />

      {newsItems.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Latest News</p>
          <ul className={`mt-2 ${SPACING.stackSm}`}>
            {newsItems.map((item) => (
              <li
                key={item.id}
                className={`${TYPO.bodySm} text-pitch-200 before:mr-2 before:text-theme-primary before:content-['•']`}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Team Status</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-2">
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
