"use client";

import { useState } from "react";
import {
  SPACING,
} from "@/lib/ui/design-system";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { TYPO } from "@/lib/ui/typography";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer, getRetiredPlayerDisplayAge } from "@/lib/manager/managerPlayers";
import { getRetiredPlayerSaveStats } from "@/lib/manager/managerRetirement";
import {
  computeSquadFitness,
  computeSquadForm,
  formLabel,
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getManagerCareerSaveView } from "@/lib/manager/managerCareerSaveStats";
import {
  getManagerCareerMilestones,
} from "@/lib/manager/managerCareerMilestones";
import {
  ManagerSectionCard,
  ManagerStat,
  ManagerViewHeader,
  leaguePositionTone,
} from "@/components/manager/manager-ui";

type StatsTab = "season" | "career" | "retired";

interface ManagerStatsViewProps {
  career: ManagerCareer;
}

export function ManagerStatsView({ career }: ManagerStatsViewProps) {
  const [tab, setTab] = useState<StatsTab>("season");

  return (
    <div className={SPACING.stackLg}>
      <ManagerViewHeader
        title="Stats"
        subtitle={
          tab === "season"
            ? `${career.seasonYear} season statistics`
            : tab === "career"
              ? `All-time career record at ${career.club}`
              : "Players who have retired during this save"
        }
        tabs={
          <ManagerSubTabBar
            tabs={[
              { id: "season", label: "Season" },
              { id: "career", label: "Career" },
              { id: "retired", label: "Retired" },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {tab === "season" ? (
        <SeasonStatsPanel career={career} />
      ) : tab === "career" ? (
        <CareerStatsPanel career={career} />
      ) : (
        <RetiredPlayersPanel career={career} />
      )}
    </div>
  );
}

function SeasonStatsPanel({ career }: { career: ManagerCareer }) {
  const ts = career.teamSeasonStats;
  const topScorer = getTopTryScorer(career.playerSeasonStats);
  const topKicker = getTopGoalScorer(career.playerSeasonStats);
  const position = getUserLeaguePosition(career.leagueTable, career.club);

  const playerRows = Object.values(career.playerSeasonStats)
    .filter((p) => p.appearances > 0)
    .sort((a, b) => b.tries - a.tries || b.appearances - a.appearances);

  return (
    <>
      <ManagerSectionCard title="Team" variant="elevated" accent="primary">
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <ManagerStat
            label="League position"
            value={ordinal(position)}
            tone={leaguePositionTone(position)}
            large
          />
          <ManagerStat label="Played" value={String(ts.played)} />
          <ManagerStat label="Wins" value={String(ts.wins)} tone="primary" />
          <ManagerStat label="Losses" value={String(ts.losses)} tone="red" />
          <ManagerStat label="Points for" value={String(ts.pointsFor)} tone="primary" />
          <ManagerStat
            label="Points against"
            value={String(ts.pointsAgainst)}
            tone="red"
          />
          <ManagerStat
            label="Points difference"
            value={`${ts.pointsDifference > 0 ? "+" : ""}${ts.pointsDifference}`}
            tone={
              ts.pointsDifference > 0
                ? "primary"
                : ts.pointsDifference < 0
                  ? "red"
                  : "default"
            }
          />
          <ManagerStat label="Tries for" value={String(ts.triesFor)} tone="primary" />
          <ManagerStat
            label="Tries against"
            value={String(ts.triesAgainst)}
            tone="red"
          />
          <ManagerStat
            label="League points"
            value={String(ts.leaguePoints)}
            tone="gold"
          />
          <ManagerStat
            label="Squad form"
            value={formLabel(computeSquadForm(career))}
            tone="sky"
          />
          <ManagerStat
            label="Fitness"
            value={`${computeSquadFitness(career)}%`}
            tone="primary"
          />
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
              <span className="font-semibold text-accent-gold">
                {" "}
                ({topScorer.tries})
              </span>
            </p>
          )}
          {topKicker && (
            <p className={TYPO.bodySm}>
              <span className="text-pitch-500">Top goal scorer: </span>
              <span className="font-semibold text-white">
                {getManagerPlayer(career, topKicker.playerId)?.name}
              </span>
              <span className="font-semibold text-sky-300">
                {" "}
                ({topKicker.goals})
              </span>
            </p>
          )}
        </ManagerSectionCard>
      )}

      {playerRows.length > 0 ? (
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
                    idx === 0
                      ? "bg-accent-gold/5"
                      : idx < 3
                        ? "bg-theme-primary/5"
                        : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span
                      className={
                        idx === 0
                          ? "font-semibold text-accent-gold"
                          : idx < 3
                            ? "font-medium text-theme-primary"
                            : "text-pitch-200"
                      }
                    >
                      {getManagerPlayer(career, row.playerId)?.name ??
                        row.playerId}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-pitch-300">
                    {row.appearances}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-theme-primary">
                    {row.tries}
                  </td>
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
      ) : (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No player stats yet — play or simulate a match.
        </p>
      )}
    </>
  );
}

function CareerStatsPanel({ career }: { career: ManagerCareer }) {
  const careerSave = getManagerCareerSaveView(career);
  const milestones = getManagerCareerMilestones(career);

  return (
    <>
      <ManagerSectionCard title="Milestones" variant="inset">
        <div className="mt-2 flex flex-wrap gap-2">
          {milestones.map((m) => (
            <span
              key={m.id}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                m.earned
                  ? "border-accent-gold/50 bg-accent-gold/10 text-accent-gold"
                  : "border-pitch-600 text-pitch-500"
              }`}
            >
              {m.label}
              {m.detail ? ` · ${m.detail}` : ""}
            </span>
          ))}
        </div>
      </ManagerSectionCard>

      <ManagerSectionCard
        title={`Career — ${career.club}`}
        variant="featured"
        accent="gold"
      >
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          All-time stats for this save
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <ManagerStat
            label="Seasons"
            value={String(careerSave.seasons)}
            tone="gold"
            large
          />
          <ManagerStat
            label="Career record"
            value={careerSave.totalRecordLabel}
            tone="primary"
          />
          <ManagerStat
            label="Best finish"
            value={careerSave.bestFinishLabel}
            tone="gold"
          />
          <ManagerStat
            label="League titles"
            value={String(careerSave.leagueTitles)}
            tone={careerSave.leagueTitles > 0 ? "gold" : "muted"}
          />
          <ManagerStat
            label="Super League titles"
            value={String(careerSave.superLeagueTitles)}
            tone={careerSave.superLeagueTitles > 0 ? "gold" : "muted"}
          />
          <ManagerStat
            label="Challenge Cups"
            value={String(careerSave.challengeCups)}
            tone={careerSave.challengeCups > 0 ? "gold" : "muted"}
          />
          <ManagerStat
            label="Total trophies"
            value={String(careerSave.trophies)}
            tone={careerSave.trophies > 0 ? "gold" : "muted"}
          />
          <ManagerStat
            label="Top-six finishes"
            value={String(careerSave.topSixFinishes)}
            tone="primary"
          />
          <ManagerStat
            label="Worst season"
            value={careerSave.worstRecordLabel}
            tone="red"
          />
          <ManagerStat
            label="Club earnings"
            value={careerSave.earningsLabel}
            tone="gold"
          />
          <ManagerStat
            label="Biggest win"
            value={
              careerSave.biggestWinMargin > 0
                ? `+${careerSave.biggestWinMargin}`
                : "—"
            }
            tone="primary"
          />
          <ManagerStat
            label="Biggest defeat"
            value={
              careerSave.biggestDefeatMargin > 0
                ? `-${careerSave.biggestDefeatMargin}`
                : "—"
            }
            tone="red"
          />
          <ManagerStat
            label="Perfect seasons"
            value={String(careerSave.perfectSeasons)}
            tone={careerSave.perfectSeasons > 0 ? "gold" : "muted"}
          />
        </div>
      </ManagerSectionCard>

      {careerSave.seasonRows.length > 0 ? (
        <ManagerSectionCard title="Season History" className="overflow-x-auto !p-0">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-700/50 text-pitch-400">
                <th className="px-3 py-2">Season</th>
                <th className="px-3 py-2 text-center">Finish</th>
                <th className="px-3 py-2 text-center">Record</th>
                <th className="px-3 py-2">Trophies</th>
              </tr>
            </thead>
            <tbody>
              {careerSave.seasonRows.map((row) => (
                <tr
                  key={`${row.seasonYear}-${row.inProgress ? "current" : "done"}`}
                  className={`border-b border-pitch-800/40 ${
                    row.inProgress ? "bg-theme-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.inProgress
                          ? "font-semibold text-theme-primary"
                          : "text-pitch-200"
                      }
                    >
                      {row.seasonYear}
                      {row.inProgress ? " (current)" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-medium text-accent-gold">
                    {ordinal(row.position)}
                  </td>
                  <td className="px-3 py-2 text-center text-pitch-300">
                    {row.wins}W-{row.losses}L
                  </td>
                  <td className="px-3 py-2 text-pitch-300">
                    {row.trophies.length > 0 ? row.trophies.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ManagerSectionCard>
      ) : (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          Complete a season to build your career history.
        </p>
      )}
    </>
  );
}

function RetiredPlayersPanel({ career }: { career: ManagerCareer }) {
  const retired = [...(career.retiredPlayers ?? [])].sort((a, b) => {
    if (b.seasonRetired !== a.seasonRetired) {
      return b.seasonRetired - a.seasonRetired;
    }
    return a.playerName.localeCompare(b.playerName);
  });

  const leagueRetirements = retired.filter(
    (player) => (player.club ?? career.club) !== career.club
  ).length;

  return (
    <>
      <ManagerSectionCard title="League retirements" variant="featured" accent="gold">
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          {retired.length} player{retired.length === 1 ? "" : "s"} have retired
          across Super League during this save
          {leagueRetirements > 0
            ? ` (${leagueRetirements} from other clubs)`
            : ""}
          . Apps and tries are totals from this career save.
        </p>
      </ManagerSectionCard>

      {retired.length > 0 ? (
        <ManagerSectionCard title="Retired players" variant="elevated">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-pitch-700/50 text-[10px] uppercase tracking-wider text-pitch-500">
                  <th className="px-3 py-2 font-semibold">Player</th>
                  <th className="px-3 py-2 font-semibold">Club</th>
                  <th className="px-3 py-2 text-center font-semibold">Pos</th>
                  <th className="px-3 py-2 text-center font-semibold">Age</th>
                  <th className="px-3 py-2 text-center font-semibold">Peak</th>
                  <th className="px-3 py-2 text-center font-semibold">Apps</th>
                  <th className="px-3 py-2 text-center font-semibold">Tries</th>
                  <th className="px-3 py-2 text-center font-semibold">Season</th>
                </tr>
              </thead>
              <tbody>
                {retired.map((player) => {
                  const club = player.club ?? career.club;
                  const isUserClub = club === career.club;
                  const saveStats = getRetiredPlayerSaveStats(career, player);
                  return (
                    <tr
                      key={`${player.playerId}-${player.seasonRetired}`}
                      className={`border-b border-pitch-800/60 last:border-0 ${
                        isUserClub ? "bg-theme-primary/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium text-white">
                        {player.playerName}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <ClubDualSwatch club={club} size="xs" />
                          <span
                            className={`truncate text-xs ${
                              isUserClub
                                ? "font-semibold text-theme-primary"
                                : "text-pitch-300"
                            }`}
                          >
                            {club}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-pitch-300">
                        {player.positionLabel}
                      </td>
                      <td className="px-3 py-2.5 text-center text-pitch-300">
                        {getRetiredPlayerDisplayAge(career, player)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-accent-gold">
                        {player.peakRating}
                      </td>
                      <td className="px-3 py-2.5 text-center text-pitch-300">
                        {saveStats.appearances}
                      </td>
                      <td className="px-3 py-2.5 text-center text-theme-primary">
                        {saveStats.tries}
                      </td>
                      <td className="px-3 py-2.5 text-center text-pitch-400">
                        {player.seasonRetired}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ManagerSectionCard>
      ) : (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No retirements yet. Veterans aged 34+ across the league may retire at
          the end of each season.
        </p>
      )}
    </>
  );
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
