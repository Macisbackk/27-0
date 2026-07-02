"use client";

import { SPACING } from "@/lib/ui/design-system";
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
import {
  ManagerSectionCard,
  ManagerStat,
  leaguePositionTone,
} from "@/components/manager/manager-ui";

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

      <ManagerSectionCard title="Team" variant="elevated" accent="primary">
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <ManagerStat label="League position" value={ordinal(position)} tone={leaguePositionTone(position)} large />
          <ManagerStat label="Played" value={String(ts.played)} />
          <ManagerStat label="Wins" value={String(ts.wins)} tone="primary" />
          <ManagerStat label="Losses" value={String(ts.losses)} tone="red" />
          <ManagerStat label="Points for" value={String(ts.pointsFor)} tone="primary" />
          <ManagerStat label="Points against" value={String(ts.pointsAgainst)} tone="red" />
          <ManagerStat
            label="Points difference"
            value={`${ts.pointsDifference > 0 ? "+" : ""}${ts.pointsDifference}`}
            tone={ts.pointsDifference > 0 ? "primary" : ts.pointsDifference < 0 ? "red" : "default"}
          />
          <ManagerStat label="Tries for" value={String(ts.triesFor)} tone="primary" />
          <ManagerStat label="Tries against" value={String(ts.triesAgainst)} tone="red" />
          <ManagerStat label="League points" value={String(ts.leaguePoints)} tone="gold" />
          <ManagerStat label="Squad form" value={formLabel(computeSquadForm(career))} tone="sky" />
          <ManagerStat label="Fitness" value={`${computeSquadFitness(career)}%`} tone="primary" />
        </div>
      </ManagerSectionCard>

      {(topScorer || topKicker) && (
        <ManagerSectionCard title="Leaders" accent="gold">
          {topScorer && (
            <p className={`mt-1 ${TYPO.bodySm}`}>
              <span className="text-pitch-500">Top try scorer: </span>
              <span className="font-semibold text-white">
                {getManagerPlayer(career, topScorer.playerId)?.name}
              </span>
              <span className="font-semibold text-accent-gold"> ({topScorer.tries})</span>
            </p>
          )}
          {topKicker && (
            <p className={TYPO.bodySm}>
              <span className="text-pitch-500">Top goal scorer: </span>
              <span className="font-semibold text-white">
                {getManagerPlayer(career, topKicker.playerId)?.name}
              </span>
              <span className="font-semibold text-sky-300"> ({topKicker.goals})</span>
            </p>
          )}
        </ManagerSectionCard>
      )}

      {playerRows.length > 0 && (
        <ManagerSectionCard title="Player Stats" className="overflow-x-auto !p-0">
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
              {playerRows.map((row, idx) => (
                <tr
                  key={row.playerId}
                  className={`border-b border-pitch-800/40 ${
                    idx === 0 ? "bg-accent-gold/5" : idx < 3 ? "bg-theme-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className={idx === 0 ? "font-semibold text-accent-gold" : idx < 3 ? "font-medium text-theme-primary" : "text-pitch-200"}>
                      {getManagerPlayer(career, row.playerId)?.name ?? row.playerId}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-pitch-300">{row.appearances}</td>
                  <td className="px-3 py-2 text-center font-semibold text-theme-primary">{row.tries}</td>
                  <td className="px-3 py-2 text-center text-sky-300">
                    {row.goals > 0 ? row.goals : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-accent-gold">
                    {row.playerOfMatch > 0 ? row.playerOfMatch : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ManagerSectionCard>
      )}

      {playerRows.length === 0 && (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No player stats yet — play or simulate a match.
        </p>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
