"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { UserStatsData } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { getAllStats } from "@/lib/storage/stats";
import {
  STATS_TABS,
  getChallengeCupView,
  getHardModeView,
  getOverallView,
  getSuperLeagueView,
  formatRankingOrDash,
  formatWinPercentageOrDash,
  getChallengeCupPersonalBests,
  formatRatingOrDash,
  formatRecordOrDash,
  type StatsTabId,
} from "@/lib/stats-views";
import { HardModeBadge } from "./HardModeBadge";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";

export function StatsPanel() {
  const [activeTab, setActiveTab] = useState<StatsTabId>("overall");
  const [normalStats, setNormalStats] = useState<UserStatsData | null>(null);
  const [hardStats, setHardStats] = useState<UserStatsData | null>(null);

  const refresh = () => {
    const stored = getAllStats();
    setNormalStats(stored.normal);
    setHardStats(stored.hard);
  };

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  if (!normalStats || !hardStats) {
    return (
      <div className="card-glass p-12 text-center text-gray-500">
        Loading stats...
      </div>
    );
  }

  const hasAnyRuns = normalStats.totalRuns > 0 || hardStats.totalRuns > 0;

  return (
    <div className="space-y-6">
      <nav className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {STATS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                activeTab === tab.id
                  ? "bg-accent-green text-pitch-950"
                  : "border border-pitch-600 text-gray-400 hover:border-pitch-500 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {!hasAnyRuns && (
        <div className="card-glass p-6 text-center text-gray-500">
          No runs yet. Play a game to start tracking your stats.
        </div>
      )}

      {activeTab === "overall" && (
        <OverallTab normal={normalStats} hard={hardStats} />
      )}
      {activeTab === "super-league" && <SuperLeagueTab stats={normalStats} />}
      {activeTab === "hard-mode" && <HardModeTab stats={hardStats} />}
      {activeTab === "challenge-cup" && (
        <ChallengeCupTab normal={normalStats} hard={hardStats} />
      )}

      <p className="text-center text-xs text-gray-600">
        Statistics saved locally in this browser
      </p>
    </div>
  );
}

function OverallTab({
  normal,
  hard,
}: {
  normal: UserStatsData;
  hard: UserStatsData;
}) {
  const view = getOverallView(normal, hard);

  return (
    <div className="space-y-8">
      <StatsSection title="Career">
        <StatCard label="Total Runs" value={String(view.totalRuns)} />
        <StatCard label="Total Wins" value={String(view.totalWins)} />
        <StatCard label="Total Losses" value={String(view.totalLosses)} />
        <StatCard
          label="Total Seasons Simulated"
          value={String(view.totalSeasons)}
        />
      </StatsSection>

      <StatsSection title="Records">
        <StatCard
          label="Best Record"
          value={formatRecordOrDash(view.bestRecord)}
          highlight={(view.bestRecord?.wins ?? 0) >= 20}
        />
        <StatCard
          label="Worst Record"
          value={formatRecordOrDash(view.worstRecord)}
        />
        <StatCard
          label="Longest Unbeaten Run"
          value={
            view.longestUnbeatenRun > 0
              ? `${view.longestUnbeatenRun} games`
              : "—"
          }
          highlight={view.longestUnbeatenRun >= 10}
        />
        <StatCard
          label="Longest Losing Streak"
          value={
            view.longestLosingStreak > 0
              ? `${view.longestLosingStreak} games`
              : "—"
          }
        />
      </StatsSection>

      <StatsSection title="Achievements">
        <StatCard
          label="League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Challenge Cups"
          value={String(view.challengeCups)}
          highlight={view.challengeCups > 0}
        />
        <StatCard
          label="Total 27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="Total 0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
      </StatsSection>

      <StatsSection title="Squads">
        <StatCard
          label="Highest Squad Value"
          value={formatValue(view.highestSquadValue)}
          highlight
        />
        <StatCard
          label="Lowest Squad Value"
          value={
            view.lowestSquadValue !== null
              ? formatValue(view.lowestSquadValue)
              : "—"
          }
        />
        <StatCard
          label="Best National Ranking"
          value={formatRankingOrDash(view.bestNationalRanking)}
          highlight={view.bestNationalRanking === 1}
        />
      </StatsSection>

      <StatsSection title="Player Records">
        <StatCard
          label="Most Valuable Player Drafted"
          value={view.mostValuablePlayer.name ?? "—"}
          sub={
            view.mostValuablePlayer.value
              ? formatValue(view.mostValuablePlayer.value)
              : undefined
          }
          highlight
        />
        <StatCard
          label="Most Selected Player"
          value={view.mostSelected?.name ?? "—"}
          sub={
            view.mostSelected
              ? `${view.mostSelected.count} selections`
              : undefined
          }
        />
        <StatCard
          label="Most Successful Player"
          value={view.mostSuccessful?.name ?? "—"}
          sub={
            view.mostSuccessful
              ? `${view.mostSuccessful.wins} season wins`
              : undefined
          }
        />
        <StatCard
          label="Worst Performing Player"
          value={view.worstPerforming?.name ?? "—"}
          sub={
            view.worstPerforming
              ? `${view.worstPerforming.losses} season losses`
              : undefined
          }
        />
      </StatsSection>

      {view.totalRerollsUsed > 0 && (
        <StatsSection title="Recruitment">
          <StatCard
            label="Total Rerolls Used"
            value={String(view.totalRerollsUsed)}
          />
          <StatCard
            label="Most Rerolls In A Run"
            value={String(view.mostRerollsInRun)}
          />
          <StatCard
            label="Average Rerolls Per Run"
            value={String(view.averageRerollsPerRun)}
          />
        </StatsSection>
      )}
    </div>
  );
}

function SuperLeagueTab({ stats }: { stats: UserStatsData }) {
  const view = getSuperLeagueView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Super League">
        <StatCard label="Super League Runs" value={String(view.runs)} />
        <StatCard label="Super League Wins" value={String(view.wins)} />
        <StatCard label="Super League Losses" value={String(view.losses)} />
        <StatCard
          label="Best Super League Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.bestRecord : null
          )}
          highlight={view.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Super League Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.worstRecord : null
          )}
        />
        <StatCard
          label="Super League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Super League 27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="Super League 0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
        <StatCard
          label="Best Super League Ranking"
          value={formatRankingOrDash(view.bestRanking)}
          highlight={view.bestRanking === 1}
        />
      </StatsSection>
    </div>
  );
}

function HardModeTab({ stats }: { stats: UserStatsData }) {
  const view = getHardModeView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Hard Mode Records" headerExtra={<HardModeBadge />}>
        <StatCard label="Hard Mode Runs" value={String(view.runs)} />
        <StatCard
          label="Hard Mode Wins"
          value={String(view.wins)}
          highlight={view.wins > 0}
        />
        <StatCard label="Hard Mode Losses" value={String(view.losses)} />
        <StatCard
          label="Best Hard Mode Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.bestRecord : null
          )}
          highlight={view.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Hard Mode Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.worstRecord : null
          )}
        />
        <StatCard
          label="Hard Mode League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Hard Mode Challenge Cups"
          value={String(view.challengeCups)}
          highlight={view.challengeCups > 0}
        />
        <StatCard
          label="Hard Mode 27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="Hard Mode 0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
        <StatCard
          label="Best Hard Mode Ranking"
          value={formatRankingOrDash(view.bestRanking)}
          highlight={view.bestRanking === 1}
        />
      </StatsSection>
    </div>
  );
}

function ChallengeCupTab({
  normal,
  hard,
}: {
  normal: UserStatsData;
  hard: UserStatsData;
}) {
  const view = getChallengeCupView(normal, hard);
  const personalBests = getChallengeCupPersonalBests(normal, hard);

  return (
    <div className="space-y-8">
      <StatsSection title="Career">
        <StatCard label="Challenge Cup Runs" value={String(view.runs)} />
        <StatCard
          label="Challenge Cup Match Wins"
          value={String(view.wins)}
          highlight={view.wins > 0}
        />
        <StatCard
          label="Challenge Cup Match Losses"
          value={String(view.losses)}
        />
      </StatsSection>

      <StatsSection title="Achievements">
        <StatCard
          label="Challenge Cups Won"
          value={String(view.cupsWon)}
          highlight={view.cupsWon > 0}
        />
        <StatCard
          label="Finals Reached"
          value={String(view.finals)}
          highlight={view.finals > 0}
        />
        <StatCard
          label="Semi Finals Reached"
          value={String(view.semiFinals)}
        />
        <StatCard
          label="Quarter Finals Reached"
          value={String(view.quarterFinals)}
        />
      </StatsSection>

      <StatsSection title="Records">
        <StatCard
          label="Best Cup Finish"
          value={view.bestFinish ?? "—"}
          highlight={view.bestFinish === "Winners"}
        />
        <StatCard
          label="Most Tournament Wins"
          value={String(view.mostTournamentWins)}
          highlight={view.mostTournamentWins > 0}
        />
        <StatCard
          label="Best Tournament Ranking"
          value={formatRankingOrDash(view.bestRanking)}
          highlight={view.bestRanking === 1}
        />
      </StatsSection>

      <StatsSection title="Challenge Cup Personal Bests">
        <StatCard
          label="Most Cup Match Wins"
          value={String(personalBests.mostCupMatchWins)}
          highlight={personalBests.mostCupMatchWins > 0}
        />
        <StatCard
          label="Best Tournament Finish"
          value={personalBests.bestTournamentFinish ?? "—"}
          highlight={personalBests.bestTournamentFinish === "Winners"}
        />
        <StatCard
          label="Longest Cup Winning Streak"
          value={String(personalBests.longestCupWinningStreak)}
          highlight={personalBests.longestCupWinningStreak > 0}
        />
        <StatCard
          label="Most Cups Won"
          value={String(personalBests.mostCupsWon)}
          highlight={personalBests.mostCupsWon > 0}
        />
        <StatCard
          label="Best Cup Win Percentage"
          value={formatWinPercentageOrDash(
            personalBests.bestCupWinPercentage,
            view.wins + view.losses > 0
          )}
          highlight={personalBests.bestCupWinPercentage >= 75}
        />
      </StatsSection>

      <StatsSection title="Performance">
        <StatCard
          label="Highest Rated Cup Squad"
          value={formatRatingOrDash(view.highestRatedSquad)}
          highlight={view.highestRatedSquad !== null}
        />
        <StatCard
          label="Lowest Rated Cup Squad"
          value={formatRatingOrDash(view.lowestRatedSquad)}
        />
      </StatsSection>
    </div>
  );
}

function StatsSection({
  title,
  children,
  headerExtra,
}: {
  title: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <section className="matchday-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-accent-green">
          {title}
        </h2>
        {headerExtra}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${RL_INFO_BOX_CLASS} p-4`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold ${
          highlight ? "text-accent-gold" : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-sm text-gray-500">{sub}</p>}
    </div>
  );
}
