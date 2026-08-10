"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { ProgrammePanel } from "@/components/ui/ProgrammePanel";
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
  getHomeFixtureAttendanceOutlook,
} from "@/lib/manager/managerAttendance";
import { getManagerHubUrgentAlerts } from "@/lib/manager/managerHubAlerts";
import { ManagerHubAlertsPanel } from "@/components/manager/ManagerHubAlertsPanel";
import { ManagerOnboardingStrip } from "@/components/manager/ManagerOnboardingStrip";
import { shouldShowManagerOnboardingStrip } from "@/lib/manager/managerOnboarding";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import {
  getUnavailableSquadPlayers,
} from "@/lib/manager/managerSquad";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import { playSimulateRound, playUiClick } from "@/lib/sound";
import {
  getManagerCupRoundLabel,
  getManagerScheduledFixtureVenueLabel,
} from "@/lib/manager/managerFixtureDisplay";
import { getManagerMatchOccasionPresentation } from "@/lib/manager/managerMatchOccasion";
import {
  managerCompetitionPanelClass,
  managerFixtureCardStyle,
  managerPillClass,
  managerCalloutClass,
} from "@/lib/manager/managerSurfaces";
import { MANAGER_HUB_SCROLL_TARGET_ID } from "@/lib/manager/managerHubScroll";
import { autoFixMatchdaySquad, resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { isWageOverBudget } from "@/lib/manager/managerFinance";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerClubSquadSheet } from "@/components/manager/ManagerClubSquadSheet";
import { ManagerLeagueTable } from "@/components/manager/ManagerLeagueTable";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  ManagerFormStrip,
  ManagerNewsItem,
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
  ManagerStat,
  ManagerStatGrid,
  leaguePositionTone,
  matchPredictionTone,
} from "@/components/manager/manager-ui";
import { getHubNewsItems } from "@/lib/manager/managerNews";

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
  onOpenOnboardingGuide?: () => void;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
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
            <span className="text-accent-gold">{playoffStatus ?? "Play-Offs"}</span>
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
  onOpenOnboardingGuide,
}: ManagerHubProps) {
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(
    null
  );
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);

  const hubAlerts = getManagerHubUrgentAlerts(career);

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
        onUpdate={onUpdate}
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

  const cupStatus = getCupHubStatus(hubCareer);
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
        <p className={`${TYPO.keyLabel} text-pitch-400`}>
          {matchOccasion.weekLabel}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
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
          <span className={`${TYPO.bodySm} text-pitch-400`}>
            {getManagerScheduledFixtureVenueLabel(nextFixture)}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1.5 text-left font-[family-name:var(--font-pitch)] text-[0.7rem] uppercase tracking-wide leading-snug text-white sm:gap-x-2 sm:text-[length:var(--text-section-header)] sm:leading-tight">
          <span
            className="min-w-0 whitespace-normal text-right text-balance sm:truncate sm:whitespace-nowrap"
            title={career.club}
          >
            {career.club}
          </span>
          <span className="shrink-0 px-0.5 text-center text-pitch-500 sm:px-1">
            {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
          </span>
          <span
            className="min-w-0 whitespace-normal text-left text-balance sm:truncate sm:whitespace-nowrap"
            title={nextFixture.opponent}
          >
            {nextFixture.opponent}
          </span>
        </div>
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
    Boolean(nextFixture && !seasonComplete && !playoffsPending) ||
    canAdvance;

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

  const commandCentre =
    hubAlerts.length > 0 ? (
      <ManagerHubAlertsPanel alerts={hubAlerts} onNavigate={onNavigate} />
    ) : null;

  const onboardingStrip =
    onOpenOnboardingGuide && shouldShowManagerOnboardingStrip(career) ? (
      <ManagerOnboardingStrip
        onNavigate={onNavigate}
        onOpenGuide={onOpenOnboardingGuide}
      />
    ) : null;

  const seasonProgressCard = (
    <div className={showStickyPlayBar ? "hidden sm:block" : undefined}>
      <ProgrammePanel padded>
        <GameSectionHeader
          label="Season"
          title="Season Progress"
          subtitle={`Season ${career.seasonYear}`}
        />
        <p className={`mt-2 ${TYPO.cardTitle}`}>
          Week{" "}
          <span className="text-theme-primary">{career.gameWeek}</span>
          <span className="text-pitch-500">/{career.schedule.length}</span>
          <span className="text-pitch-500"> · </span>
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
        </p>
        {wageOverBudget && (
          <p className={`mt-2 ${TYPO.bodySm} text-amber-300`}>
            Wages over budget
            {wagePressure >= 4 ? " — board wants cuts" : ""}
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
        <div className="mt-4 flex flex-col gap-1.5">
          {career.isSeasonComplete ? (
            <GameButton
              variant="theme"
              size="md"
              onClick={() => {
                playUiClick();
                onNavigate?.("season-review");
              }}
              disabled={!onNavigate}
              className="min-h-11 text-sm font-semibold"
            >
              Season Review
            </GameButton>
          ) : (
            <GameButton
              variant="theme"
              size="md"
              onClick={onAdvanceWeek}
              disabled={!canAdvance}
              className="min-h-11 text-sm font-semibold tracking-wide"
            >
              {advanceLabels.full}
            </GameButton>
          )}
          {!career.isSeasonComplete && advanceHint ? (
            <p className="text-[11px] leading-snug text-[var(--app-muted)]">
              {advanceHint}
            </p>
          ) : null}
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

  const hubBody = (
    <>
      <div className="space-y-4">
        {onboardingStrip}
        {commandCentre}
        {nextFixtureCard}
        {seasonProgressCard}
        {newsTickerCard}
        {hubStandingsCard}
        {squadAvailabilityCard}
      </div>
      {quickActionsCard}
    </>
  );

  if (playoffsActive && hubCareer.playoffs) {
    return (
      <>
        <ManagerPage>
          <ManagerSection>{hubBody}</ManagerSection>
        </ManagerPage>
        {alertDialog}
        {clubSheetModal}
      </>
    );
  }

  return (
    <>
      <ManagerPage>
        <ManagerSection>{hubBody}</ManagerSection>
      </ManagerPage>
      {alertDialog}
      {clubSheetModal}
    </>
  );
}
