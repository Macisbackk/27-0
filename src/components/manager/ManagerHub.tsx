"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { ProgrammePanel } from "@/components/ui/ProgrammePanel";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type {
  ManagerCareer,
  ManagerScheduledFixture,
  ManagerView,
} from "@/lib/manager/types";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getNextManagerFixture, isManagerSeasonComplete } from "@/lib/manager/managerSimulation";
import {
  canAdvanceMatchWeek,
  canPlayNextMatch,
  getAdvanceWeekButtonLabel,
  getAdvanceWeekHint,
} from "@/lib/manager/managerMatchWeek";
import { getHubOpponentRating } from "@/lib/manager/managerOpponentRating";
import { syncBracketProgress } from "@/lib/manager/managerBracketSync";
import { getCupHubStatus, shouldShowChallengeCupBracketOnHub } from "@/lib/manager/managerChallengeCup";
import { ManagerChallengeCupBracket } from "@/components/manager/ManagerChallengeCupBracket";
import { PlayoffBracketDisplay } from "@/components/PlayoffBracketDisplay";
import {
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
import { getManagerHubAlerts } from "@/lib/manager/managerHubAlerts";
import { getManagerDifficultyPressure } from "@/lib/manager/managerDifficulty";
import { ManagerHubAlertsPanel } from "@/components/manager/ManagerHubAlertsPanel";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import {
  getUnavailableSquadPlayers,
} from "@/lib/manager/managerSquad";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import {
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { getHubNewsItems } from "@/lib/manager/managerNews";
import { playSimulateRound, playUiClick } from "@/lib/sound";
import {
  getManagerCupRoundLabel,
  getManagerScheduledFixtureHeadline,
  getManagerScheduledFixtureVenueLabel,
} from "@/lib/manager/managerFixtureDisplay";
import { getManagerMatchOccasionPresentation } from "@/lib/manager/managerMatchOccasion";
import {
  managerClubAccentCardClass,
  managerClubAccentCardStyle,
  managerCompetitionPanelClass,
  managerFixtureCardStyle,
  managerPillClass,
  managerCalloutClass,
} from "@/lib/manager/managerSurfaces";
import { MANAGER_HUB_SCROLL_TARGET_ID } from "@/lib/manager/managerHubScroll";
import { autoFixMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { isWageOverBudget } from "@/lib/manager/managerFinance";
import { ManagerClubFinancesPanel } from "@/components/manager/manager-ui";
  ManagerFormStrip,
  ManagerNewsItem,
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
  ManagerStat,
  ManagerStatGrid,
  boardConfidenceTone,
  fanMoodTone,
  leaguePositionTone,
  matchPredictionTone,
} from "@/components/manager/manager-ui";

interface ManagerHubProps {
  career: ManagerCareer;
  onPlayGame: () => void;
  onSimulate: () => void;
  onAdvanceWeek: () => void;
  advancingWeek?: boolean;
  onUpdate?: (career: ManagerCareer) => void;
  onNavigate?: (view: ManagerView) => void;
  onOpenCupFixtures?: () => void;
  onOpenMatchReview?: (fixtureId: string) => void;
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
  const pressure = getManagerDifficultyPressure(career);
  const pressureToneClass =
    pressure.tone === "red"
      ? "text-red-300"
      : pressure.tone === "amber"
        ? "text-amber-300"
        : pressure.tone === "gold"
          ? "text-accent-gold"
          : pressure.tone === "primary"
            ? "text-theme-primary"
            : "text-pitch-400";

  return (
    <div
      className={managerClubAccentCardClass()}
      style={managerClubAccentCardStyle(career.club)}
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
      <p className={`mt-2 ${TYPO.bodySm}`}>
        <span className={`font-semibold ${pressureToneClass}`}>
          {pressure.label}:{" "}
        </span>
        <span className="text-pitch-300">{pressure.detail}</span>
      </p>
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

function HubChallengeCupBracketPanel({
  career,
  cupStatus,
  nextFixture,
  onViewFullBracket,
  onOpenMatchReview,
  onOpenMatchPrep,
}: {
  career: ManagerCareer;
  cupStatus: string;
  nextFixture?: ManagerScheduledFixture;
  onViewFullBracket?: () => void;
  onOpenMatchReview?: (fixtureId: string) => void;
  onOpenMatchPrep?: () => void;
}) {
  return (
    <ManagerChallengeCupBracket
      career={career}
      variant="hub-compact"
      statusLine={cupStatus}
      nextFixture={nextFixture}
      onViewFullBracket={onViewFullBracket}
      onOpenMatchReview={onOpenMatchReview}
      onOpenMatchPrep={onOpenMatchPrep}
    />
  );
}

function HubPlayoffBracketPanel({
  playoffs,
  career,
}: {
  playoffs: NonNullable<ManagerCareer["playoffs"]>;
  career: ManagerCareer;
}) {
  const activeRound = playoffs.matches.find(
    (m) => m.isUserMatch && m.status === "ready"
  )?.round;
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const playoffStatus = getPlayoffHubStatus(career);

  return (
    <div className={managerCompetitionPanelClass("playoffs")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${TYPO.sectionLabel} text-theme-primary`}>
              Play-Off Bracket
            </p>
            {activeRound != null && (
              <span className={managerPillClass("primary")}>
                {getPlayoffRoundLabel(activeRound)}
              </span>
            )}
          </div>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
            Finished{" "}
            <span className="font-semibold text-theme-primary">
              {ordinal(position)}
            </span>{" "}
            in the league ·{" "}
            <span className="text-accent-gold">{playoffStatus}</span>
          </p>
        </div>
      </div>
      <div className="mt-3">
        <PlayoffBracketDisplay state={playoffs} embedded />
      </div>
    </div>
  );
}

export function ManagerHub({
  career,
  onPlayGame,
  onSimulate,
  onAdvanceWeek,
  advancingWeek = false,
  onUpdate,
  onNavigate,
  onOpenCupFixtures,
  onOpenMatchReview,
}: ManagerHubProps) {
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(
    null
  );
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);

  const hubAlerts = getManagerHubAlerts(career);

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
  const unavailablePlayers = getUnavailableSquadPlayers(career);
  const injuredCount = unavailablePlayers.filter(
    (p) => p.injury?.type !== "suspension"
  ).length;
  const suspendedCount = unavailablePlayers.filter(
    (p) => p.injury?.type === "suspension"
  ).length;
  const injuryCount = unavailablePlayers.length;
  const topScorer = getTopTryScorer(career.playerSeasonStats, career);
  const topKicker = getTopGoalScorer(career.playerSeasonStats, career);
  const ts = career.teamSeasonStats;
  const squadCheck = validateFitMatchdaySquad(simCareer);
  const playoffsPending = needsPlayoffsIntro(career);
  const playoffsActive = isManagerPlayoffsActive(hubCareer);
  const seasonComplete = isManagerSeasonComplete(hubCareer);
  const canPlay =
    canPlayNextMatch(career) &&
    squadCheck.valid &&
    !seasonComplete &&
    !playoffsPending;
  const canAdvance = canAdvanceMatchWeek(career) && !advancingWeek;
  const advanceLabels = getAdvanceWeekButtonLabel(career, advancingWeek);
  const advanceHint = getAdvanceWeekHint(career);
  const isPlayoffFixture = nextFixture?.competition === "playoffs";
  const matchOccasion = nextFixture
    ? getManagerMatchOccasionPresentation(nextFixture)
    : null;

  const oppRating =
    nextFixture && !seasonComplete
      ? getHubOpponentRating(hubCareer, nextFixture)
      : null;

  const prediction =
    nextFixture && !seasonComplete
      ? getMatchPrediction(
          teamRating,
          oppRating ?? 70,
          nextFixture.isNeutral ? true : nextFixture.isHome
        )
      : null;

  const homeAttendanceOutlook =
    nextFixture && !seasonComplete
      ? getHomeFixtureAttendanceOutlook(career, nextFixture)
      : null;

  const expiringCount = countExpiringContracts(career.contracts);
  const lastGate = getLastHomeGate(career.gateIncomeHistory);
  const cupStatus = getCupHubStatus(hubCareer);
  const playoffStatus = getPlayoffHubStatus(hubCareer);
  const wageOverBudget = isWageOverBudget(career);
  const wagePressure = career.wagePressureWeeks ?? 0;

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


  const hubNews = getHubNewsItems(career);

  const nextFixtureCard =
    nextFixture && !seasonComplete && !playoffsPending && matchOccasion ? (
      <div id={MANAGER_HUB_SCROLL_TARGET_ID} className="scroll-mt-28">
      <ScoreboardPanel
        variant="elevated"
        padded
        className={`matchday-scoreboard ${matchOccasion.surfaceClass} ${matchOccasion.matchdayModifier}`.trim()}
        style={managerFixtureCardStyle(
          nextFixture.competition,
          career.club,
          nextFixture.opponent
        )}
      >
        <GameSectionHeader
          label={matchOccasion.weekLabel}
          title={
            <span className="fixture-matchup-title">
              <span>{career.club}</span>{" "}
              <span className="text-pitch-500">
                {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
              </span>{" "}
              <span>{nextFixture.opponent}</span>
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {matchOccasion.occasion !== "wcc" ? (
                <ManagerCompetitionBadge
                  competition={nextFixture.competition}
                  cupRound={nextFixture.cupRound}
                  playoffRound={nextFixture.playoffRound}
                  isNeutral={nextFixture.isNeutral}
                  venue={nextFixture.venue}
                  detailed={matchOccasion.isShowcase}
                />
              ) : null}
              <span>{getManagerScheduledFixtureVenueLabel(nextFixture)}</span>
            </span>
          }
        />
        {matchOccasion.momentLine ? (
          <p
            className={`mt-2 text-sm font-semibold ${matchOccasion.momentTextClass}`}
          >
            {matchOccasion.momentLine}
          </p>
        ) : null}
        <p className={`mt-1 sm:hidden ${TYPO.bodySm}`}>
          <span className="text-pitch-500">Week </span>
          <span className="font-semibold text-theme-primary">
            {career.gameWeek}/{career.schedule.length}
          </span>
          <span className="text-pitch-500"> · </span>
          <span className="font-semibold text-white">{ordinal(position)}</span>
          <span className="text-pitch-500"> · S{career.seasonYear}</span>
        </p>
        {homeAttendanceOutlook && (
          <p className={`mt-1 hidden ${TYPO.bodySm} text-pitch-500 sm:block`}>
            {homeAttendanceOutlook.label}
          </p>
        )}
        <div className="mt-2 hidden flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
            Form streak
          </p>
          <ManagerFormStrip
            results={career.recentForm.slice(-5) as ("W" | "L" | "D")[]}
          />
        </div>
        <ManagerStatGrid cols={4} className="mt-3 text-sm [&>*:nth-child(n+5)]:hidden sm:[&>*:nth-child(n+5)]:block">
          <ManagerStat label="Your rating" value={String(teamRating)} tone="primary" />
          {oppRating !== null && (
            <ManagerStat label="Opponent rating" value={String(oppRating)} tone="default" />
          )}
          <ManagerStat
            label={matchOccasion.roundStatLabel}
            value={
              matchOccasion.occasion === "grand_final" ||
              matchOccasion.occasion === "cup_final"
                ? matchOccasion.badgeLabel
                : matchOccasion.occasion === "wcc"
                  ? "Club World Title"
                : isPlayoffFixture && nextFixture.playoffRound
                  ? getPlayoffRoundLabel(nextFixture.playoffRound)
                  : matchOccasion.occasion === "challenge_cup" && nextFixture.cupRound
                    ? getManagerCupRoundLabel(nextFixture.cupRound)
                    : `${career.gameWeek}/${career.schedule.length}`
            }
            tone={matchOccasion.isShowcase ? "gold" : "muted"}
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
            className={`mt-3 ${managerCalloutClass("amber")} px-4 py-2.5 sm:px-3 sm:py-2 ${TYPO.bodySm} whitespace-pre-line`}
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
        <div className="mt-4 hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-2">
          <GameButton
            variant="theme"
            disabled={!canPlay}
            onClick={() => {
              playUiClick();
              onPlayGame();
            }}
          >
            {matchOccasion.playCta}
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
            {matchOccasion.simulateCta}
          </GameButton>
        </div>
      </ScoreboardPanel>
      </div>
    ) : null;

  const newsTickerCard =
    hubNews.length > 0 ? (
      <ProgrammePanel padded label="PROGRAMME TICKER">
        <ul className={`mt-1 ${SPACING.stackSm}`}>
          {hubNews.slice(0, 5).map((item) => (
            <ManagerNewsItem key={item.id} item={item} />
          ))}
        </ul>
      </ProgrammePanel>
    ) : null;

  const showStickyPlayBar =
    Boolean(nextFixture && !seasonComplete && !playoffsPending);

  const hubMobilePad = showStickyPlayBar
    ? "manager-mobile-hub-pad sm:pb-0"
    : "manager-mobile-nav-pad sm:pb-0";

  const scoringLeadersCard =
    ts.played > 0 ? (
      <ManagerSectionCard title="Scoring Leaders">
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <span>
            <span className="text-pitch-500">Record: </span>
            <span className="font-semibold text-theme-primary">{ts.wins}W</span>
            <span className="text-pitch-500">-</span>
            <span className="font-semibold text-gray-300">{ts.draws ?? 0}D</span>
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
    expiringCount > 0 ? (
      <ManagerSectionCard
        title="Contracts"
        variant="inset"
        accent="amber"
      >
        <p className={`mt-1 ${TYPO.bodySm} text-accent-gold`}>
          {expiringCount} contract{expiringCount > 1 ? "s" : ""} expiring soon
        </p>
      </ManagerSectionCard>
    ) : null;

  const squadAvailabilityCard =
    injuryCount > 0 ? (
      <ManagerSectionCard
        title="Squad Availability"
        variant="inset"
        accent="red"
      >
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
          {injuryCount} unavailable
          {injuredCount > 0 ? ` · ${injuredCount} injured` : ""}
          {suspendedCount > 0 ? ` · ${suspendedCount} suspended` : ""}
        </p>
        <ul className="mt-2 space-y-1">
          {unavailablePlayers.map((ps) => {
            const player = getManagerPlayer(career, ps.playerId);
            if (!player || !ps.injury) return null;
            return (
              <li key={ps.playerId} className={`${TYPO.bodySm} text-pitch-300`}>
                <span className="font-medium text-white">{player.name}</span>
                <span className="text-pitch-500"> — </span>
                <span
                  className={
                    ps.injury.type === "suspension"
                      ? "text-amber-300"
                      : "text-red-300"
                  }
                >
                  {formatInjuryLabel(ps.injury)}
                </span>
              </li>
            );
          })}
        </ul>
        {onNavigate && (
          <GameButton
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => onNavigate("squad")}
          >
            View Squad
          </GameButton>
        )}
      </ManagerSectionCard>
    ) : null;

  const quickActionsCard =
    onNavigate ? (
      <div className={`hidden sm:block ${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-3`}>Quick Actions</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <GameButton
            variant="secondary"
            size="sm"
            onClick={() => onNavigate("squad")}
          >
            Squad
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

  const commandCentre = (
    <ManagerHubAlertsPanel alerts={hubAlerts} onNavigate={onNavigate} />
  );

  const seasonProgressCard = (
    <div className={showStickyPlayBar ? "hidden sm:block" : undefined}>
      <ProgrammePanel padded>
        <GameSectionHeader
          label="Club office"
          title="Season Progress"
          subtitle={`Season ${career.seasonYear}`}
          action={
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <GameButton
                variant="secondary"
                size="sm"
                onClick={onAdvanceWeek}
                disabled={!canAdvance}
                fullWidth={false}
                className="min-h-9 w-full px-3 text-xs sm:w-auto"
              >
                <span className="sm:hidden">{advanceLabels.short}</span>
                <span className="hidden sm:inline">{advanceLabels.full}</span>
              </GameButton>
              {advanceHint ? (
                <p className="max-w-[14rem] text-[10px] leading-snug text-[var(--app-muted)] sm:text-right">
                  {advanceHint}
                </p>
              ) : null}
            </div>
          }
        />
        <p className={`mt-2 ${TYPO.cardTitle}`}>
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
          <span className={managerPillClass("gold")}>{cupStatus}</span>
          <span className={managerPillClass("primary")}>{playoffStatus}</span>
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
              width: `${Math.min(
                100,
                (career.gameWeek / Math.max(1, career.schedule.length)) * 100
              )}%`,
            }}
          />
        </div>
      </ProgrammePanel>
    </div>
  );

  const leagueTableCard = (
    <div className={SPACING.stackSm}>
      <GameSectionHeader
        label="Results"
        title="League Table"
        subtitle={`Season ${career.seasonYear} · Week ${career.gameWeek}`}
      />
      <ManagerLeagueTable
        career={career}
        subtitle={`Season ${career.seasonYear} · Week ${career.gameWeek}`}
        onViewClub={setViewClubSheet}
      />
    </div>
  );

  const showPlayoffBracket =
    hubCareer.playoffs &&
    career.playoffsIntroAcknowledged &&
    (playoffsActive || isPlayoffFixture);

  const hubStandingsCard =
    shouldShowChallengeCupBracketOnHub(hubCareer, nextFixture) ? (
      <div className={SPACING.stackSm}>
        <GameSectionHeader label="Results" title="Challenge Cup" />
        <HubChallengeCupBracketPanel
          career={hubCareer}
          cupStatus={cupStatus}
          nextFixture={nextFixture ?? undefined}
          onViewFullBracket={
            onOpenCupFixtures ??
            (onNavigate ? () => onNavigate("fixtures") : undefined)
          }
          onOpenMatchReview={onOpenMatchReview}
          onOpenMatchPrep={
            onNavigate ? () => onNavigate("hub") : undefined
          }
        />
      </div>
    ) : showPlayoffBracket ? (
      <div className={SPACING.stackSm}>
        <GameSectionHeader label="Results" title="Play-Offs" />
        <HubPlayoffBracketPanel
          playoffs={hubCareer.playoffs!}
          career={hubCareer}
        />
      </div>
    ) : (
      leagueTableCard
    );

  const stickyActions = (
    <ManagerHubStickyActions
      visible={showStickyPlayBar}
      canPlay={canPlay}
      playLabel={matchOccasion?.playCtaShort ?? "Play Match"}
      simulateLabel={
        matchOccasion?.isShowcase
          ? matchOccasion.simulateCta.replace(/^Simulate /, "")
          : "Simulate"
      }
      onPlayGame={onPlayGame}
      onSimulate={onSimulate}
    />
  );

  const clubDetailsSections = (
    <div className="stat-section-stack">
      <ManagerClubFinancesPanel career={career} collapsible />
      <HubBoardBudgetAttendance
        career={career}
        lastGate={lastGate}
        wageOverBudget={wageOverBudget}
      />
      {scoringLeadersCard}
      {contractsCard}
    </div>
  );

  if (playoffsActive && hubCareer.playoffs) {
    return (
      <>
        <ManagerPage className={hubMobilePad}>
          <ManagerSection>
          <div className="space-y-4">
            {seasonProgressCard}
            {nextFixtureCard}
            {newsTickerCard}
            {hubStandingsCard}
            {squadAvailabilityCard}
          </div>
          {commandCentre}
          <GameSectionHeader label="Club office" title="Club details" className="sm:hidden" />
          <MobileDetailsAccordion title="Club details">
            <div className="stat-section-stack">
            <HubBoardBudgetAttendance
              career={career}
              lastGate={lastGate}
              wageOverBudget={wageOverBudget}
            />
            <ManagerClubFinancesPanel career={career} />
            {scoringLeadersCard}
            {contractsCard}
            </div>
          </MobileDetailsAccordion>
          {quickActionsCard}
          </ManagerSection>
        </ManagerPage>
        {stickyActions}
        {alertDialog}
        {clubSheetModal}
      </>
    );
  }

  return (
    <>
      <ManagerPage className={hubMobilePad}>
      <ManagerSection>
      <div className="space-y-4">
        {seasonProgressCard}
        {nextFixtureCard}
        {newsTickerCard}
        {hubStandingsCard}
        {squadAvailabilityCard}
      </div>

      {commandCentre}

      <GameSectionHeader label="Club office" title="Club details" className="sm:hidden" />
      <MobileDetailsAccordion title="Club details">
        {clubDetailsSections}
      </MobileDetailsAccordion>

      {quickActionsCard}
      </ManagerSection>
    </ManagerPage>
    {stickyActions}
    {alertDialog}
    {clubSheetModal}
    </>
  );
}
