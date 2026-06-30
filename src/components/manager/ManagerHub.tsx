"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
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

export function ManagerHub({ career, onPlayGame, onSimulate }: ManagerHubProps) {
  const club = getClubByName(career.club);
  const nextFixture = career.schedule[career.currentFixtureIndex];
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

  const tablePreview = (() => {
    const rows = career.leagueTable;
    if (rows.length === 0) return [];
    const top5 = rows.slice(0, 5);
    const userRow = rows.find((r) => r.isUserTeam);
    if (userRow && userRow.position > 5) {
      return [...top5, userRow];
    }
    return top5;
  })();

  const formDisplay =
    career.recentForm.length > 0
      ? career.recentForm.slice(-5).join(" ")
      : "—";

  return (
    <div className={SPACING.stackLg}>
      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4`}
        style={{ borderLeftColor: club?.primaryColor ?? "var(--theme-primary)" }}
      >
        <p className={TYPO.sectionLabel}>Club Summary</p>
        <h2 className={`mt-1 ${TYPO.cardTitle}`}>{career.club}</h2>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Season {career.seasonYear} · Game Week {career.gameWeek}/
          {career.schedule.length}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-pitch-500 text-xs">League Position</p>
            <p className="font-semibold text-white">{ordinal(position)}</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Board Confidence</p>
            <p className="font-semibold text-white">{career.boardConfidence}%</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Budget</p>
            <p className="font-semibold text-accent-gold">{formatFunds(career.budget)}</p>
          </div>
          <div>
            <p className="text-pitch-500 text-xs">Squad Rating</p>
            <p className="font-semibold text-theme-primary">{teamRating}</p>
          </div>
        </div>
      </div>

      {nextFixture && !career.isSeasonComplete && (
        <div className={`${CARD.base} ${CARD.featured} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Next Fixture</p>
          <p className={`mt-1 ${TYPO.cardTitle}`}>
            {career.club} {nextFixture.isHome ? "vs" : "@"}{" "}
            {nextFixture.opponent}
          </p>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Game Week {nextFixture.round} ·{" "}
            {nextFixture.isHome ? "Home" : "Away"}
            {oppRating !== null && ` · Opponent Rating: ${oppRating}`}
          </p>
          {prediction && (
            <p className={`mt-1 text-sm text-theme-tertiary`}>
              Prediction: {prediction}
            </p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <GameButton
              variant="theme"
              onClick={() => {
                playUiClick();
                onPlayGame();
              }}
            >
              Play Game
            </GameButton>
            <GameButton
              variant="secondary"
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

      {tablePreview.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-2`}>League Table Preview</p>
          <ul className={SPACING.stackSm}>
            {tablePreview.map((row) => (
              <li
                key={row.team}
                className={`flex items-center justify-between text-sm ${
                  row.isUserTeam ? "text-theme-primary font-semibold" : "text-pitch-300"
                }`}
              >
                <span>
                  {row.position}. {row.team}
                </span>
                <span className="text-pitch-500">{row.leaguePoints} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Team Status</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-pitch-500 text-xs">Morale</p>
            <p>{moraleLabel(morale)} ({morale})</p>
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
          <p className={`${TYPO.sectionLabel} mb-2`}>Season Scoring</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <span>Record: {ts.wins}W-{ts.losses}L</span>
            <span>PF: {ts.pointsFor}</span>
            <span>PA: {ts.pointsAgainst}</span>
            <span>+/-: {ts.pointsDifference > 0 ? "+" : ""}{ts.pointsDifference}</span>
            <span>Tries: {ts.triesFor} / {ts.triesAgainst}</span>
            <span>League Pts: {ts.leaguePoints}</span>
          </div>
          {topScorer && (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
              Top try scorer:{" "}
              {getPlayerById(topScorer.playerId)?.name ?? "—"} ({topScorer.tries})
            </p>
          )}
          {topKicker && (
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              Top goal scorer:{" "}
              {getPlayerById(topKicker.playerId)?.name ?? "—"} ({topKicker.goals})
            </p>
          )}
        </div>
      )}

      {last && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.sectionLabel}>Latest Result</p>
          <p className={`mt-1 font-semibold text-white`}>
            {last.isHome ? "vs" : "@"} {last.opponent}: {last.pointsFor}-
            {last.pointsAgainst} ({last.result})
          </p>
          {last.meta?.tacticEffectivenessLine && (
            <p className={`mt-1 ${TYPO.bodySm} italic text-pitch-400`}>
              {last.meta.tacticEffectivenessLine}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
