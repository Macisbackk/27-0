"use client";

import { useState } from "react";
import { CollapsibleDetails } from "@/components/ui/MobileLayout";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { ManagerClubSquadSheet } from "@/components/manager/ManagerClubSquadSheet";
import { ManagerLeagueTable } from "@/components/manager/ManagerLeagueTable";
import { ManagerHubAlertsPanel } from "@/components/manager/ManagerHubAlertsPanel";
import { MobilePlayoffJourney } from "@/components/manager/mobile/MobilePlayoffJourney";
import {
  MobileEmptyState,
  MobileList,
  MobileListRow,
  MobileMetric,
  MobileScreen,
  MobileSection,
} from "@/components/mobile/MobileKit";
import type {
  ManagerCareer,
  ManagerScheduledFixture,
  ManagerView,
} from "@/lib/manager/types";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import {
  getNextManagerFixture,
  isManagerSeasonComplete,
} from "@/lib/manager/managerSimulation";
import {
  canAdvanceMatchWeek,
  canPlayNextMatch,
  getAdvanceWeekButtonLabel,
} from "@/lib/manager/managerMatchWeek";
import { syncBracketProgress } from "@/lib/manager/managerBracketSync";
import {
  getCupHubStatus,
  shouldShowChallengeCupBracketOnHub,
} from "@/lib/manager/managerChallengeCup";
import {
  getPlayoffHubStatus,
  isManagerPlayoffsActive,
  needsPlayoffsIntro,
} from "@/lib/manager/managerPlayoffs";
import { MILLION_POUND_GAME_NAME } from "@/lib/manager/managerMillionPoundGame";
import { getManagerHubUrgentAlerts } from "@/lib/manager/managerHubAlerts";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { getUnavailableSquadPlayers } from "@/lib/manager/managerSquad";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { getManagerScheduledFixtureVenueLabel } from "@/lib/manager/managerFixtureDisplay";
import { getManagerMatchOccasionPresentation } from "@/lib/manager/managerMatchOccasion";
import { MANAGER_HUB_SCROLL_TARGET_ID } from "@/lib/manager/managerHubScroll";
import {
  autoFixMatchdaySquad,
  resolveCareerForMatchSimulation,
} from "@/lib/manager/managerAutoFix";
import { isWageOverBudget } from "@/lib/manager/managerFinance";
import { getHubNewsItems } from "@/lib/manager/managerNews";
import { managerCalloutClass } from "@/lib/manager/managerSurfaces";
import { leaguePositionTone } from "@/components/manager/manager-ui";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface MobileManagerHubProps {
  career: ManagerCareer;
  onPlayGame: () => void;
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

export function MobileManagerHub({
  career,
  onPlayGame,
  onAdvanceWeek,
  advancingWeek = false,
  onUpdate,
  onNavigate,
  onOpenCupFixtures,
}: MobileManagerHubProps) {
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(
    null
  );
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);

  const hubCareer = syncBracketProgress(career);
  const nextFixture = getNextManagerFixture(hubCareer);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const userRow = career.leagueTable.find((row) => row.isUserTeam);
  const simCareer = resolveCareerForMatchSimulation(career);
  const unavailablePlayers = getUnavailableSquadPlayers(career);
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
  const matchOccasion = nextFixture
    ? getManagerMatchOccasionPresentation(nextFixture)
    : null;
  const hubAlerts = getManagerHubUrgentAlerts(career);
  const hubNews = getHubNewsItems(career);
  const wageOverBudget = isWageOverBudget(career);
  const cupStatus = getCupHubStatus(hubCareer);
  const mpg = hubCareer.millionPoundGame;

  const handleAutoFix = () => {
    const result = autoFixMatchdaySquad(career);
    onUpdate?.(result.career);
    if (!result.ok) {
      setDialog({ title: "Auto-fix failed", message: result.message });
    }
  };

  const showFixture =
    Boolean(nextFixture && !seasonComplete && !playoffsPending && matchOccasion);

  const showPlayoffJourney =
    hubCareer.playoffs &&
    career.playoffsIntroAcknowledged &&
    (playoffsActive || nextFixture?.competition === "playoffs");

  const showChampPlayoffs =
    nextFixture?.competition === "championship_playoffs" &&
    hubCareer.championshipPlayoffs;

  const showMpg =
    nextFixture?.competition === "million_pound_game" ||
    (mpg?.userParticipating && mpg.status !== "complete");

  return (
    <>
      <MobileScreen data-tutorial-target="manager-hub">
        {showFixture && nextFixture && matchOccasion ? (
          <section id={MANAGER_HUB_SCROLL_TARGET_ID} className="m-event scroll-mt-28">
            <p className="m-event__kicker">Next fixture</p>
            <p className="m-event__club">{career.club}</p>
            <p className="m-event__vs">
              {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
            </p>
            <p className="m-event__club">{nextFixture.opponent}</p>
            <p className="m-event__meta">
              {matchOccasion.weekLabel}
              <span> · </span>
              {getManagerScheduledFixtureVenueLabel(nextFixture)}
            </p>
            {matchOccasion.momentLine ? (
              <p className={`m-event__meta ${matchOccasion.momentTextClass}`}>
                {matchOccasion.momentLine}
              </p>
            ) : null}
            {!squadCheck.valid ? (
              <div
                className={`mt-3 text-left ${managerCalloutClass("amber")} px-3 py-2 ${TYPO.bodySm} whitespace-pre-line`}
              >
                {squadCheck.message}
                {onUpdate ? (
                  <GameButton
                    variant="theme"
                    size="sm"
                    className="mt-2 min-h-11 w-full"
                    onClick={() => {
                      playUiClick();
                      handleAutoFix();
                    }}
                  >
                    Auto Fix Squad
                  </GameButton>
                ) : null}
              </div>
            ) : null}
            <GameButton
              variant="theme"
              disabled={!canPlay}
              className="mt-4 min-h-12 w-full text-sm font-semibold"
              onClick={() => {
                playUiClick();
                onPlayGame();
              }}
            >
              {matchOccasion.playCta}
            </GameButton>
          </section>
        ) : seasonComplete ? (
          <MobileSection>
            <p className="m-event__kicker">Season complete</p>
            <GameButton
              variant="theme"
              className="mt-3 min-h-12 w-full"
              disabled={!onNavigate}
              onClick={() => onNavigate?.("season-review")}
            >
              Season Review
            </GameButton>
          </MobileSection>
        ) : canAdvance ? (
          <MobileSection>
            <p className="m-event__kicker">Week complete</p>
            <GameButton
              variant="theme"
              className="mt-3 min-h-12 w-full"
              disabled={!canAdvance}
              onClick={onAdvanceWeek}
            >
              {advanceLabels.full}
            </GameButton>
          </MobileSection>
        ) : null}

        <MobileSection label="Season">
          <p
            className={`m-season-num ${
              leaguePositionTone(position) === "gold"
                ? "text-accent-gold"
                : leaguePositionTone(position) === "primary"
                  ? "text-theme-primary"
                  : leaguePositionTone(position) === "red"
                    ? "text-red-300"
                    : ""
            }`}
          >
            {ordinal(position)}
          </p>
          <div className="mt-2" data-tutorial-target="manager-season-progress">
            <MobileMetric
              label="Played"
              value={`${userRow?.played ?? career.gameWeek} games`}
            />
            <MobileMetric
              label="Points"
              value={userRow?.leaguePoints ?? 0}
            />
            <MobileMetric
              label="Round"
              value={`${career.gameWeek} / ${career.schedule.length}`}
            />
            {wageOverBudget ? (
              <MobileMetric label="Wages" value="Over budget" />
            ) : null}
          </div>
        </MobileSection>

        {hubAlerts.length > 0 ? (
          <MobileSection label="What's new">
            <ManagerHubAlertsPanel alerts={hubAlerts} onNavigate={onNavigate} />
          </MobileSection>
        ) : null}

        {unavailablePlayers.length > 0 ? (
          <MobileSection label="Availability">
            <MobileList>
              {unavailablePlayers.map((ps) => {
                const player = getManagerPlayer(career, ps.playerId);
                if (!player || !ps.injury) return null;
                return (
                  <MobileListRow
                    key={ps.playerId}
                    primary={player.name}
                    secondary={formatInjuryLabel(ps.injury)}
                    onClick={onNavigate ? () => onNavigate("squad") : undefined}
                    chevron={Boolean(onNavigate)}
                  />
                );
              })}
            </MobileList>
          </MobileSection>
        ) : null}

        {shouldShowChallengeCupBracketOnHub(hubCareer, nextFixture) ? (
          <MobileSection label="Challenge Cup">
            <p className="m-row__secondary">{cupStatus}</p>
            {onOpenCupFixtures ? (
              <GameButton
                variant="secondary"
                className="mt-3 min-h-11 w-full"
                onClick={() => {
                  playUiClick();
                  onOpenCupFixtures();
                }}
              >
                View cup
              </GameButton>
            ) : null}
          </MobileSection>
        ) : showChampPlayoffs && hubCareer.championshipPlayoffs ? (
          <MobilePlayoffJourney
            playoffs={hubCareer.championshipPlayoffs}
            title="Championship Playoffs"
          />
        ) : showPlayoffJourney && hubCareer.playoffs ? (
          <MobilePlayoffJourney
            playoffs={hubCareer.playoffs}
            title={getPlayoffHubStatus(career) ?? "Playoffs"}
          />
        ) : showMpg && mpg ? (
          <MobileSection label={MILLION_POUND_GAME_NAME}>
            <p className="m-row__primary">
              {mpg.slClub} vs {mpg.champClub}
            </p>
            <p className="m-row__secondary mt-1">
              {mpg.status === "complete" && mpg.winner
                ? `${mpg.winner} won.`
                : "Winner plays Super League next season."}
            </p>
          </MobileSection>
        ) : (
          <MobileSection>
            <CollapsibleDetails summary="League table">
              <ManagerLeagueTable
                career={career}
                subtitle={`Season ${career.seasonYear}`}
                onViewClub={setViewClubSheet}
              />
            </CollapsibleDetails>
          </MobileSection>
        )}

        {hubNews.length > 0 ? (
          <MobileSection>
            <CollapsibleDetails summary="News">
              <MobileList>
                {hubNews.slice(0, 5).map((item) => (
                  <MobileListRow
                    key={item.id}
                    primary={item.text}
                    secondary={`Week ${item.week}`}
                  />
                ))}
              </MobileList>
            </CollapsibleDetails>
          </MobileSection>
        ) : null}

        {!showFixture && !canAdvance && !seasonComplete ? (
          <MobileEmptyState>Check Squad, then return here to play.</MobileEmptyState>
        ) : null}
      </MobileScreen>

      <ManagerDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        onConfirm={() => setDialog(null)}
        onCancel={() => setDialog(null)}
      />
      {viewClubSheet != null ? (
        <ManagerClubSquadSheet
          career={career}
          club={viewClubSheet}
          onClose={() => setViewClubSheet(null)}
          onViewUserSquad={onNavigate ? () => onNavigate("squad") : undefined}
          onUpdate={onUpdate}
        />
      ) : null}
    </>
  );
}
