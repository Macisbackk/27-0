"use client";

import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import {
  computeSquadFitness,
  computeSquadForm,
  formLabel,
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";

interface ManagerStatsViewProps {
  career: ManagerCareer;
}

export function ManagerStatsView({ career }: ManagerStatsViewProps) {
  const ts = career.teamSeasonStats;
  const topScorer = getTopTryScorer(career.playerSeasonStats);
  const topKicker = getTopGoalScorer(career.playerSeasonStats);
  const position = getUserLeaguePosition(career.leagueTable, career.club);

  const playerRows = Object.values(career.playerSeasonStats)
    .filter((p) => p.appearances > 0)
    .sort((a, b) => b.tries - a.tries || b.appearances - a.appearances);

  return (
    <div className={SPACING.stackLg}>
      <h2 className={TYPO.cardTitle}>Season Statistics</h2>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Team</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Stat label="League position" value={ordinal(position)} />
          <Stat label="Played" value={String(ts.played)} />
          <Stat label="Wins" value={String(ts.wins)} />
          <Stat label="Losses" value={String(ts.losses)} />
          <Stat label="Points for" value={String(ts.pointsFor)} />
          <Stat label="Points against" value={String(ts.pointsAgainst)} />
          <Stat label="Points difference" value={String(ts.pointsDifference)} />
          <Stat label="Tries for" value={String(ts.triesFor)} />
          <Stat label="Tries against" value={String(ts.triesAgainst)} />
          <Stat label="League points" value={String(ts.leaguePoints)} />
          <Stat label="Squad form" value={formLabel(computeSquadForm(career))} />
          <Stat label="Fitness" value={`${computeSquadFitness(career)}%`} />
        </div>
      </div>

      {(topScorer || topKicker) && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Leaders</p>
          {topScorer && (
            <p className={`mt-1 ${TYPO.bodySm}`}>
              Top try scorer: {getManagerPlayer(career, topScorer.playerId)?.name} (
              {topScorer.tries})
            </p>
          )}
          {topKicker && (
            <p className={TYPO.bodySm}>
              Top goal scorer: {getManagerPlayer(career, topKicker.playerId)?.name} (
              {topKicker.goals})
            </p>
          )}
        </div>
      )}

      {playerRows.length > 0 && (
        <div className={`${CARD.base} overflow-x-auto`}>
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-700/50 text-pitch-400">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2 text-center">Apps</th>
                <th className="px-3 py-2 text-center">Tries</th>
                <th className="px-3 py-2 text-center">Goals</th>
                <th className="px-3 py-2 text-center">POTM</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((row) => (
                <tr
                  key={row.playerId}
                  className="border-b border-pitch-800/40"
                >
                  <td className="px-3 py-2">
                    {getManagerPlayer(career, row.playerId)?.name ?? row.playerId}
                  </td>
                  <td className="px-3 py-2 text-center">{row.appearances}</td>
                  <td className="px-3 py-2 text-center">{row.tries}</td>
                  <td className="px-3 py-2 text-center">
                    {row.goals > 0 ? row.goals : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.playerOfMatch > 0 ? row.playerOfMatch : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {playerRows.length === 0 && (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No player stats yet — play or simulate a match.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-pitch-500">{label}</p>
      <p className="font-medium text-white">{value}</p>
    </div>
  );
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
