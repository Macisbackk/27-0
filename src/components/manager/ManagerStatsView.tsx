"use client";

import { useMemo, useState } from "react";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { TYPO } from "@/lib/ui/typography";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import type { ManagerCareer, RetiredPlayer } from "@/lib/manager/types";
import { getManagerPlayer, getRetiredPlayerDisplayAge } from "@/lib/manager/managerPlayers";
import { getRetiredPlayerSaveStats } from "@/lib/manager/managerRetirement";
import {
  computeSquadFitness,
  computeSquadForm,
  formLabel,
  getTopGoalScorer,
  getTopTryScorer,
} from "@/lib/manager/managerCareerStats";
import { isInvalidPlayerName } from "@/lib/manager/managerPlayerNameGuards";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getManagerCareerSaveView } from "@/lib/manager/managerCareerSaveStats";
import {
  getManagerCareerMilestones,
} from "@/lib/manager/managerCareerMilestones";
import {
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
  ManagerStat,
  ManagerViewHeader,
  leaguePositionTone,
} from "@/components/manager/manager-ui";
import { playUiClick } from "@/lib/sound";

type StatsTab = "season" | "career" | "retired";

type RetiredSortKey =
  | "name"
  | "club"
  | "position"
  | "age"
  | "peak"
  | "apps"
  | "tries"
  | "season";

interface ManagerStatsViewProps {
  career: ManagerCareer;
}

export function ManagerStatsView({ career }: ManagerStatsViewProps) {
  const [tab, setTab] = useState<StatsTab>("season");

  return (
    <ManagerPage>
      <ManagerSection>
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
      </ManagerSection>
    </ManagerPage>
  );
}

function SeasonStatsPanel({ career }: { career: ManagerCareer }) {
  const ts = career.teamSeasonStats;
  const topScorer = getTopTryScorer(career.playerSeasonStats, career);
  const topKicker = getTopGoalScorer(career.playerSeasonStats, career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);

  const playerRows = Object.values(career.playerSeasonStats)
    .filter(
      (p) =>
        p.appearances > 0 &&
        !isInvalidPlayerName(p.playerId) &&
        Boolean(getManagerPlayer(career, p.playerId)?.name)
    )
    .sort((a, b) => b.tries - a.tries || b.appearances - a.appearances);

  return (
    <>
      <div className="stat-section-stack">
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
          <table className="mt-2 w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-700/50 text-pitch-400">
                <th className="px-3 py-2 sm:px-5">Player</th>
                <th className="px-3 py-2 text-center">Apps</th>
                <th className="px-3 py-2 text-center">Tries</th>
                <th className="px-3 py-2 text-center">Goals</th>
                <th className="px-3 py-2 text-center sm:px-5">POTM</th>
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
      </div>
    </>
  );
}

function CareerStatsPanel({ career }: { career: ManagerCareer }) {
  const careerSave = getManagerCareerSaveView(career);
  const milestones = getManagerCareerMilestones(career);

  return (
    <>
      <div className="stat-section-stack">
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
          <table className="mt-2 w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-700/50 text-pitch-400">
                <th className="px-3 py-2 sm:px-5">Season</th>
                <th className="px-3 py-2 text-center">Finish</th>
                <th className="px-3 py-2 text-center">Record</th>
                <th className="px-3 py-2 sm:px-5">Trophies</th>
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
      </div>
    </>
  );
}

function RetiredPlayersPanel({ career }: { career: ManagerCareer }) {
  const [sortKey, setSortKey] = useState<RetiredSortKey>("season");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const retired = useMemo(() => {
    const rows = [...(career.retiredPlayers ?? [])];
    const dir = sortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const clubA = a.club ?? career.club;
      const clubB = b.club ?? career.club;
      const statsA = getRetiredPlayerSaveStats(career, a);
      const statsB = getRetiredPlayerSaveStats(career, b);

      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.playerName.localeCompare(b.playerName);
          break;
        case "club":
          cmp = clubA.localeCompare(clubB);
          break;
        case "position":
          cmp = a.positionLabel.localeCompare(b.positionLabel);
          break;
        case "age": {
          const ageA = getRetiredPlayerDisplayAge(career, a);
          const ageB = getRetiredPlayerDisplayAge(career, b);
          const unknownA = !Number.isFinite(ageA) || ageA <= 0;
          const unknownB = !Number.isFinite(ageB) || ageB <= 0;
          if (unknownA !== unknownB) return unknownA ? 1 : -1;
          cmp = ageA - ageB;
          break;
        }
        case "peak":
          cmp = a.peakRating - b.peakRating;
          break;
        case "apps":
          cmp = statsA.appearances - statsB.appearances;
          break;
        case "tries":
          cmp = statsA.tries - statsB.tries;
          break;
        case "season":
        default:
          cmp = a.seasonRetired - b.seasonRetired;
          break;
      }

      if (cmp !== 0) return cmp * dir;
      return a.playerName.localeCompare(b.playerName);
    });

    return rows;
  }, [career, sortDir, sortKey]);

  const leagueRetirements = retired.filter(
    (player) => (player.club ?? career.club) !== career.club
  ).length;

  const toggleSort = (key: RetiredSortKey) => {
    playUiClick();
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" || key === "club" || key === "position" ? "asc" : "desc");
  };

  const sortIndicator = (key: RetiredSortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const thButton = (
    key: RetiredSortKey,
    label: string,
    align: "left" | "center" = "left"
  ) => (
    <th
      className={`px-3 py-2 font-semibold ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-0.5 rounded-sm transition hover:text-theme-primary ${
          align === "center" ? "justify-center" : ""
        } ${sortKey === key ? "text-theme-primary" : "text-pitch-500"}`}
        aria-sort={
          sortKey === key
            ? sortDir === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        {label}
        <span aria-hidden className="tabular-nums">
          {sortIndicator(key)}
        </span>
      </button>
    </th>
  );

  return (
    <>
      <div className="stat-section-stack">
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
                <tr className="border-b border-pitch-700/50 text-[10px] uppercase tracking-wider">
                  {thButton("name", "Player")}
                  {thButton("club", "Club")}
                  {thButton("position", "Pos", "center")}
                  {thButton("age", "Age", "center")}
                  {thButton("peak", "Peak", "center")}
                  {thButton("apps", "Apps", "center")}
                  {thButton("tries", "Tries", "center")}
                  {thButton("season", "Season", "center")}
                </tr>
              </thead>
              <tbody>
                {retired.map((player: RetiredPlayer) => {
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
      </div>
    </>
  );
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
