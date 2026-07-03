"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, PAGE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getNextManagerFixture, isManagerSeasonComplete } from "@/lib/manager/managerSimulation";
import { syncBracketProgress } from "@/lib/manager/managerBracketSync";
import { getCupHubStatus } from "@/lib/manager/managerChallengeCup";
import { PlayoffBracketDisplay } from "@/components/PlayoffBracketDisplay";
import {
  ensurePlayoffsReady,
  getPlayoffHubStatus,
  isManagerPlayoffsActive,
  needsPlayoffsIntro,
} from "@/lib/manager/managerPlayoffs";
import { getPlayoffRoundLabel } from "@/lib/game/playoff-bracket";
import {
  countExpiringContracts,
} from "@/lib/manager/managerContracts";
import {
  fanMoodTrend,
  getHomeFixtureAttendanceOutlook,
  getLastHomeGate,
} from "@/lib/manager/managerAttendance";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { getClubIndicatorColor } from "@/lib/clubs";
import { getFriendlyDualBorderStyle } from "@/lib/manager/managerFriendlyUi";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getManagerOpponentPoolOptions } from "@/lib/manager/managerLeagueRosters";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import {
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import { playSeasonComplete, playSimulateRound, playUiClick } from "@/lib/sound";
import { autoFixMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { isWageOverBudget } from "@/lib/manager/managerFinance";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerClubSquadSheet } from "@/components/manager/ManagerClubSquadSheet";
import { getHubNewsItems } from "@/lib/manager/managerNews";
import { formatWage } from "@/lib/manager/managerContracts";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  ManagerClubFinancesPanel,
  ManagerFormStrip,
  ManagerNewsItem,
  ManagerSectionCard,
  ManagerStat,
  ManagerStatGrid,
  boardConfidenceTone,
  fanMoodTone,
  leaguePositionTone,
  matchPredictionTone,
} from "@/components/manager/manager-ui";
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
  onPlayoffsContinue?: () => void;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function HubBoardBudgetAttendance({
  career,
  lastGate,
  wageOverBudget,
}: {
  career: ManagerCareer;
  lastGate: ReturnType<typeof getLastHomeGate>;
  wageOverBudget: boolean;
}) {
  return (
    <div
      className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4`}
      style={{ borderLeftColor: getClubIndicatorColor(career.club) }}
    >
      <p className={TYPO.sectionLabel}>Board · Attendance · Wages</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <ManagerStat
          label="Board Confidence"
          value={`${career.boardConfidence}%`}
          tone={boardConfidenceTone(career.boardConfidence)}
        />
        <ManagerStat
          label="Wage Bill"
          value={`${formatWage(career.wageBill)} / ${formatWage(career.wageBudget)}`}
          tone={wageOverBudget ? "amber" : "muted"}
        />
        <ManagerStat
          label="Avg Attendance"
          value={career.attendanceData.currentAverageAttendance.toLocaleString()}
          tone="sky"
        />
        <ManagerStat
          label="Fan Mood"
          value={fanMoodTrend(career.attendanceData.fanMood)}
          tone={fanMoodTone(career.attendanceData.fanMood)}
        />
      </div>
      {lastGate && (
        <p className={`mt-2 ${TYPO.bodySm}`}>
          <span className="text-pitch-500">Last home gate: </span>
          <span className="font-semibold text-sky-300">
            {lastGate.attendance.toLocaleString()}
          </span>
          <span className="text-pitch-500"> · </span>
          <span className="font-semibold text-accent-gold">
            {formatWage(lastGate.income)}
          </span>
          <span className="text-pitch-500">
            {" "}
            ({formatWage(lastGate.transferAllocation)} → transfer ·{" "}
            {formatWage(lastGate.operatingAllocation)} → operations)
          </span>
        </p>
      )}
    </div>
  );
}

function HubPlayoffsGateCard({
  career,
  onContinue,
}: {
  career: ManagerCareer;
  onContinue: () => void;
}) {
  const ready = ensurePlayoffsReady(career);
  const bracket = ready.playoffs;
  const position = getUserLeaguePosition(career.leagueTable, career.club);

  useEffect(() => {
    if (position > 1) playSeasonComplete();
  }, [position]);

  return (
    <div
      className={`${CARD.elevated} ${SPACING.cardPadding} border-2 border-theme-primary/50 bg-gradient-to-b from-theme-primary/12 to-pitch-950/90`}
    >
      <span className="inline-flex rounded-full border border-theme-primary/45 bg-theme-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-theme-primary">
        Regular season complete
      </span>
      <h2 className={`mt-3 ${TYPO.pageTitle} text-xl sm:text-2xl`}>
        Play-Offs await
      </h2>
      <p className={`mt-2 ${TYPO.bodySm} leading-relaxed text-pitch-200`}>
        {career.club} finished{" "}
        <span className="font-semibold text-theme-primary">
          {ordinal(position)}
        </span>{" "}
        in the league — you&apos;ve qualified for the top-six play-offs. The
        league table is now frozen; only play-off results decide the title.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ManagerStat
          label="League finish"
          value={ordinal(position)}
          tone={position <= 2 ? "gold" : "primary"}
        />
        <ManagerStat
          label="Record"
          value={`${career.wins}W-${career.losses}L`}
          tone="default"
        />
        <ManagerStat
          label="Season"
          value={String(career.seasonYear)}
          tone="muted"
        />
      </div>
      {bracket && (
        <div className="mt-4">
          <p className={`${TYPO.sectionLabel} text-accent-gold`}>Bracket preview</p>
          <div className="mt-2">
            <PlayoffBracketDisplay state={bracket} />
          </div>
        </div>
      )}
      <GameButton
        variant="theme"
        className="mt-5"
        onClick={() => {
          playUiClick();
          onContinue();
        }}
      >
        Continue to Play-Offs
      </GameButton>
    </div>
  );
}

function HubPlayoffBracketPanel({
  playoffs,
}: {
  playoffs: NonNullable<ManagerCareer["playoffs"]>;
}) {
  const activeRound = playoffs.matches.find(
    (m) => m.isUserMatch && m.status === "ready"
  )?.round;

  return (
    <div
      className={`${CARD.elevated} ${SPACING.cardPadding} border-2 border-accent-gold/55 bg-accent-gold/10`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className={`${TYPO.sectionLabel} text-accent-gold`}>Play-Off Bracket</p>
        {activeRound != null && (
          <span className="rounded-full border border-accent-gold/40 bg-accent-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-gold">
            {getPlayoffRoundLabel(activeRound)}
          </span>
        )}
      </div>
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
        League table frozen — every play-off tie counts towards the title.
      </p>
      <div className="mt-3">
        <PlayoffBracketDisplay state={playoffs} />
      </div>
    </div>
  );
}

function HubPlayoffsCampaignCard({ career }: { career: ManagerCareer }) {
  const playoffStatus = getPlayoffHubStatus(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);

  return (
    <ManagerSectionCard title="Play-Off Campaign" variant="elevated" accent="gold">
      <p className={`mt-1 ${TYPO.cardTitle}`}>
        <span className="text-accent-gold">{playoffStatus}</span>
      </p>
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
        Finished the league in{" "}
        <span className="font-semibold text-theme-primary">
          {ordinal(position)}
        </span>{" "}
        · Season {career.seasonYear}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-gold">
          Play-Offs live
        </span>
      </div>
    </ManagerSectionCard>
  );
}

function HubStandingsPanel({
  career,
  onViewClub,
}: {
  career: ManagerCareer;
  onViewClub?: (club: string) => void;
}) {
  return <HubLeagueTable career={career} onViewClub={onViewClub} />;
}

function HubLeagueTable({
  career,
  title = "League Table",
  subtitle,
  onViewClub,
}: {
  career: ManagerCareer;
  title?: string;
  subtitle?: string;
  onViewClub?: (club: string) => void;
}) {
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
        <p className={TYPO.sectionLabel}>{title}</p>
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
      {subtitle && (
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{subtitle}</p>
      )}
      {userRow && (
        <p className={`mt-1 ${TYPO.cardTitle}`}>
          <span
            className={
              userRow.position <= 3
                ? "text-accent-gold"
                : userRow.position <= 6
                  ? "text-theme-primary"
                  : userRow.position >= 12
                    ? "text-red-300"
                    : "text-white"
            }
          >
            {ordinal(userRow.position)}
          </span>
          <span className="text-pitch-400"> · </span>
          <span className="text-theme-primary">{career.club}</span>
        </p>
      )}
      <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <table className="w-full max-sm:min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-pitch-700/50 text-pitch-400">
              <th className={SPACING.tableCell}>#</th>
              <th className={SPACING.tableCell}>Club</th>
              <th className={`${SPACING.tableCell} text-center`}>P</th>
              <th className={`${SPACING.tableCell} text-center`}>W</th>
              <th className={`${SPACING.tableCell} text-center`}>L</th>
              <th className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                PF
              </th>
              <th className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                PA
              </th>
              <th className={`hidden md:table-cell ${SPACING.tableCell} text-center`}>
                +/-
              </th>
              <th className={`${SPACING.tableCell} text-center`}>Pts</th>
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
                  <td className={`${SPACING.tableCell} font-mono text-pitch-400`}>
                    {row.position}
                  </td>
                  <td className={SPACING.tableCell}>
                    {onViewClub ? (
                      <button
                        type="button"
                        onClick={() => {
                          playUiClick();
                          onViewClub(row.team);
                        }}
                        className="flex w-full items-center gap-2 text-left transition hover:text-theme-primary"
                      >
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
                      </button>
                    ) : (
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
                    )}
                  </td>
                  <td className={`${SPACING.tableCell} text-center`}>{row.played}</td>
                  <td className={`${SPACING.tableCell} text-center`}>{row.wins}</td>
                  <td className={`${SPACING.tableCell} text-center`}>{row.losses}</td>
                  <td className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                    {row.pointsFor}
                  </td>
                  <td className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                    {row.pointsAgainst}
                  </td>
                  <td className={`hidden md:table-cell ${SPACING.tableCell} text-center`}>
                    {row.pointsDifference > 0 ? "+" : ""}
                    {row.pointsDifference}
                  </td>
                  <td className={`${SPACING.tableCell} text-center font-semibold text-accent-gold`}>
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
  onPlayoffsContinue,
}: ManagerHubProps) {
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(
    null
  );
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);

  const hubCareer = syncBracketProgress(career);
  const clubSheetModal =
    viewClubSheet != null ? (
      <ManagerClubSquadSheet
        career={career}
        club={viewClubSheet}
        onClose={() => setViewClubSheet(null)}
        onViewUserSquad={
          onNavigate ? () => onNavigate("squad") : undefined
        }
      />
    ) : null;

  const nextFixture = getNextManagerFixture(hubCareer);
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
  const playoffsPending = needsPlayoffsIntro(career);
  const playoffsActive = isManagerPlayoffsActive(hubCareer);
  const seasonComplete = isManagerSeasonComplete(hubCareer);
  const canPlay = squadCheck.valid && !seasonComplete && !playoffsPending;
  const isPlayoffFixture = nextFixture?.competition === "playoffs";
  const isCupFixture = nextFixture
    ? isChallengeCupFixture(nextFixture.competition)
    : false;

  const oppRating =
    nextFixture && !seasonComplete
      ? nextFixture.competition === "friendly" &&
        career.preSeason.activeFriendly
        ? career.preSeason.activeFriendly.teamRating
        : Math.round(
            getOpponentMatchRating(
              nextFixture.opponent,
              hubCareer.seed,
              nextFixture.round,
              getManagerOpponentPoolOptions(hubCareer, nextFixture.opponent)
            )
          )
      : null;

  const prediction =
    nextFixture && !seasonComplete
      ? getMatchPrediction(teamRating, oppRating ?? 70, nextFixture.isHome)
      : null;

  const homeAttendanceOutlook =
    nextFixture?.isHome && !seasonComplete
      ? getHomeFixtureAttendanceOutlook(career, nextFixture)
      : null;

  const expiringCount = countExpiringContracts(career.contracts);
  const lastGate = getLastHomeGate(career.gateIncomeHistory);
  const cupStatus = getCupHubStatus(hubCareer);
  const playoffStatus = getPlayoffHubStatus(hubCareer);
  const wageOverBudget = isWageOverBudget(career);
  const wagePressure = career.wagePressureWeeks ?? 0;
  const newsItems = getHubNewsItems(career);

  const handleAutoFix = () => {
    const result = autoFixMatchdaySquad(career);
    onUpdate?.(result.career);
    if (!result.ok) {
      setDialog({ title: "Auto-fix failed", message: result.message });
    }
  };

  const alertDialog = (
    <ManagerDialog
      open={dialog !== null}
      title={dialog?.title ?? ""}
      message={dialog?.message ?? ""}
      onConfirm={() => setDialog(null)}
      onCancel={() => setDialog(null)}
    />
  );

  const isFriendlyFixture = nextFixture?.competition === "friendly";

  const nextFixtureCard =
    nextFixture && !seasonComplete && !playoffsPending ? (
      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} ${
          isCupFixture || isPlayoffFixture
            ? "border-2 border-accent-gold/55 bg-accent-gold/12"
            : isFriendlyFixture
              ? "border border-pitch-700/40"
              : CARD.featured
        }`}
        style={
          isFriendlyFixture
            ? getFriendlyDualBorderStyle(career.club, nextFixture.opponent)
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className={TYPO.sectionLabel}>
            {isPlayoffFixture ? "Next Play-Off Fixture" : "Next Fixture"}
          </p>
          <ManagerCompetitionBadge
            competition={nextFixture.competition}
            cupRound={nextFixture.cupRound}
          />
        </div>
        {(isCupFixture || isPlayoffFixture) && (
          <p className="mt-1 text-sm font-semibold text-accent-gold">
            {getManagerScheduledFixtureHeadline(nextFixture)}
          </p>
        )}
        <p className="mt-2 text-lg font-bold leading-snug text-white sm:mt-1 sm:text-2xl">
          <span className="block sm:inline">{career.club}</span>{" "}
          <span className="text-pitch-500">
            {nextFixture.isHome ? "vs" : "@"}
          </span>{" "}
          <span className="block sm:inline">{nextFixture.opponent}</span>
        </p>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          {getManagerScheduledFixtureHeadline(nextFixture)} ·{" "}
          {nextFixture.isHome ? "Home" : "Away"}
        </p>
        {homeAttendanceOutlook && (
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-500`}>
            {homeAttendanceOutlook.label}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
            Recent Form
          </p>
          <ManagerFormStrip
            results={career.recentForm.slice(-5) as ("W" | "L" | "D")[]}
          />
        </div>
        <ManagerStatGrid cols={4} className="mt-3 text-sm">
          <ManagerStat label="Your rating" value={String(teamRating)} tone="primary" />
          {oppRating !== null && (
            <ManagerStat label="Opponent rating" value={String(oppRating)} tone="default" />
          )}
          <ManagerStat
            label={isPlayoffFixture ? "Play-off round" : "Game week"}
            value={
              isPlayoffFixture && nextFixture.playoffRound
                ? getPlayoffRoundLabel(nextFixture.playoffRound)
                : `${career.gameWeek}/${career.schedule.length}`
            }
            tone="muted"
          />
          {homeAttendanceOutlook && (
            <ManagerStat
              label="Expected gate"
              value={`~${homeAttendanceOutlook.predictedAttendance.toLocaleString()}`}
              tone="sky"
            />
          )}
          {prediction && (
            <ManagerStat
              label="Prediction"
              value={prediction}
              tone={matchPredictionTone(prediction)}
            />
          )}
        </ManagerStatGrid>
        {!squadCheck.valid && (
          <div
            className={`mt-3 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-4 py-2.5 sm:px-3 sm:py-2 ${TYPO.bodySm} text-accent-gold whitespace-pre-line`}
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
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GameButton
            variant="theme"
            disabled={!canPlay}
            onClick={() => {
              playUiClick();
              onPlayGame();
            }}
          >
            {isPlayoffFixture ? "Play Play-Off Tie" : "Play Game"}
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
    ) : null;

  const newsSection =
    newsItems.length > 0 ? (
      <ManagerSectionCard title="Latest News" variant="inset">
        <ul className={`mt-2 ${SPACING.stackSm}`}>
          {newsItems.map((item) => (
            <ManagerNewsItem key={item.id} item={item} />
          ))}
        </ul>
      </ManagerSectionCard>
    ) : null;

  const scoringLeadersCard =
    ts.played > 0 ? (
      <ManagerSectionCard title="Scoring Leaders">
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <span>
            <span className="text-pitch-500">Record: </span>
            <span className="font-semibold text-theme-primary">{ts.wins}W</span>
            <span className="text-pitch-500">-</span>
            <span className="font-semibold text-red-300">{ts.losses}L</span>
          </span>
          <span>
            <span className="text-pitch-500">Tries: </span>
            <span className="font-semibold text-theme-primary">{ts.triesFor}</span>
            <span className="text-pitch-500"> scored / </span>
            <span className="font-semibold text-red-300">{ts.triesAgainst}</span>
            <span className="text-pitch-500"> conceded</span>
          </span>
        </div>
        {topScorer && (
          <p className={`mt-2 ${TYPO.bodySm}`}>
            <span className="text-pitch-500">Top try scorer: </span>
            <span className="font-semibold text-white">
              {getManagerPlayer(career, topScorer.playerId)?.name ?? "—"}
            </span>
            <span className="font-semibold text-accent-gold">
              {" "}
              ({topScorer.tries})
            </span>
          </p>
        )}
        {topKicker && topKicker.goals > 0 && (
          <p className={TYPO.bodySm}>
            <span className="text-pitch-500">Top goal scorer: </span>
            <span className="font-semibold text-white">
              {getManagerPlayer(career, topKicker.playerId)?.name ?? "—"}
            </span>
            <span className="font-semibold text-sky-300">
              {" "}
              ({topKicker.goals})
            </span>
          </p>
        )}
      </ManagerSectionCard>
    ) : null;

  const contractsCard =
    expiringCount > 0 || injuryCount > 0 ? (
      <ManagerSectionCard
        title="Contracts & Injuries"
        variant="inset"
        accent={injuryCount > 0 ? "red" : "amber"}
      >
        {expiringCount > 0 && (
          <p className={`mt-1 ${TYPO.bodySm} text-accent-gold`}>
            {expiringCount} contract{expiringCount > 1 ? "s" : ""} expiring soon
          </p>
        )}
        {injuryCount > 0 && (
          <p className={`${TYPO.bodySm} text-red-300`}>
            {injuryCount} player{injuryCount > 1 ? "s" : ""} unavailable
          </p>
        )}
      </ManagerSectionCard>
    ) : null;

  const quickActionsCard =
    onNavigate ? (
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
    ) : null;

  const seasonProgressCard = (
    <ManagerSectionCard title="Season Progress">
      <p className={`mt-1 ${TYPO.cardTitle}`}>
        Game Week{" "}
        <span className="text-theme-primary">{career.gameWeek}</span>
        <span className="text-pitch-500"> of </span>
        {career.schedule.length}
      </p>
      <p className={`mt-1 ${TYPO.bodySm}`}>
        <span className="text-pitch-500">Season {career.seasonYear} · </span>
        <span
          className={
            leaguePositionTone(position) === "gold"
              ? "text-accent-gold font-semibold"
              : leaguePositionTone(position) === "primary"
                ? "text-theme-primary font-semibold"
                : leaguePositionTone(position) === "red"
                  ? "text-red-300 font-semibold"
                  : "text-white font-semibold"
          }
        >
          {ordinal(position)}
        </span>
        <span className="text-pitch-500"> in the table</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-gold">
          {cupStatus}
        </span>
        <span className="rounded-full border border-theme-primary/40 bg-theme-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-theme-primary">
          {playoffStatus}
        </span>
      </div>
      {wageOverBudget && (
        <p className={`mt-2 ${TYPO.bodySm} text-amber-300`}>
          Wage bill over budget
          {wagePressure >= 4
            ? " — board demanding sales or renewals at lower wages"
            : ""}
        </p>
      )}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-pitch-800">
        <div
          className="h-full bg-gradient-to-r from-theme-primary/80 to-theme-primary transition-all"
          style={{
            width: `${Math.min(100, (career.gameWeek / Math.max(1, career.schedule.length)) * 100)}%`,
          }}
        />
      </div>
    </ManagerSectionCard>
  );

  if (playoffsPending && onPlayoffsContinue) {
    return (
      <>
        <div className={PAGE.section}>
          <HubPlayoffsGateCard career={career} onContinue={onPlayoffsContinue} />
          {newsSection}
          <HubLeagueTable
            career={career}
            title="Final League Standings"
            subtitle="Frozen — play-off results now decide the title"
            onViewClub={setViewClubSheet}
          />
          <HubBoardBudgetAttendance
            career={career}
            lastGate={lastGate}
            wageOverBudget={wageOverBudget}
          />
          <ManagerClubFinancesPanel career={career} />
          {quickActionsCard}
        </div>
        {alertDialog}
        {clubSheetModal}
      </>
    );
  }

  if (playoffsActive && hubCareer.playoffs) {
    return (
      <>
        <div className={PAGE.section}>
          {nextFixtureCard}
          <HubPlayoffBracketPanel playoffs={hubCareer.playoffs} />
          {newsSection}
          <HubPlayoffsCampaignCard career={hubCareer} />
          <HubBoardBudgetAttendance
            career={career}
            lastGate={lastGate}
            wageOverBudget={wageOverBudget}
          />
          <ManagerClubFinancesPanel career={career} />
          {scoringLeadersCard}
          {contractsCard}
          {quickActionsCard}
        </div>
        {alertDialog}
        {clubSheetModal}
      </>
    );
  }

  return (
    <>
      <div className={PAGE.section}>
      {seasonProgressCard}

      {nextFixtureCard}

      <HubStandingsPanel career={career} onViewClub={setViewClubSheet} />

      <ManagerClubFinancesPanel career={career} />

      <HubBoardBudgetAttendance
        career={career}
        lastGate={lastGate}
        wageOverBudget={wageOverBudget}
      />

      {newsSection}

      {scoringLeadersCard}

      {contractsCard}

      {quickActionsCard}
    </div>
    {alertDialog}
    {clubSheetModal}
    </>
  );
}
