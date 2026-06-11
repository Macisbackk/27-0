"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { UserStatsData } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { getAllStats } from "@/lib/storage/stats";
import {
  STATS_TABS,
  getChallengeCupView,
  getDraftModeView,
  getHardChallengeCupView,
  getHardDraftModeView,
  getFantasyModeView,
  getHardNormalModeView,
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
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { runStatsPageValidation } from "@/lib/validation/stats-page-validation";

export function StatsPanel() {
  const [activeTab, setActiveTab] = useState<StatsTabId>("overall");
  const [normalStats, setNormalStats] = useState<UserStatsData | null>(null);
  const [hardStats, setHardStats] = useState<UserStatsData | null>(null);
  const [draftNormalStats, setDraftNormalStats] =
    useState<UserStatsData | null>(null);
  const [draftHardStats, setDraftHardStats] = useState<UserStatsData | null>(
    null
  );
  const [fantasyStats, setFantasyStats] = useState<UserStatsData | null>(null);

  const refresh = () => {
    const stored = getAllStats();
    setNormalStats(stored.normal);
    setHardStats(stored.hard);
    setDraftNormalStats(stored.draftNormal);
    setDraftHardStats(stored.draftHard);
    setFantasyStats(stored.fantasy);
  };

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    if (
      !normalStats ||
      !hardStats ||
      !draftNormalStats ||
      !draftHardStats ||
      !fantasyStats
    ) {
      return;
    }
    runStatsPageValidation({
      normal: normalStats,
      hard: hardStats,
      draftNormal: draftNormalStats,
      draftHard: draftHardStats,
    });
  }, [normalStats, hardStats, draftNormalStats, draftHardStats, fantasyStats]);

  if (
    !normalStats ||
    !hardStats ||
    !draftNormalStats ||
    !draftHardStats ||
    !fantasyStats
  ) {
    return (
      <div className="card-glass p-12 text-center text-gray-500">
        <p className={TYPO.body}>Loading stats...</p>
      </div>
    );
  }

  const hasAnyRuns =
    normalStats.totalRuns > 0 ||
    hardStats.totalRuns > 0 ||
    draftNormalStats.totalSeasonsSimulated > 0 ||
    draftHardStats.totalSeasonsSimulated > 0 ||
    fantasyStats.totalSeasonsSimulated > 0;

  return (
    <div className="space-y-6">
      <nav className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {STATS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 min-h-[44px] rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                activeTab === tab.id ? BTN.tabActive : BTN.tabIdle
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
        <OverallTab
          normal={normalStats}
          hard={hardStats}
          draftNormal={draftNormalStats}
          draftHard={draftHardStats}
        />
      )}
      {activeTab === "super-league" && <SuperLeagueTab stats={normalStats} />}
      {activeTab === "hard-mode" && (
        <HardModeTab stats={hardStats} draftHard={draftHardStats} />
      )}
      {activeTab === "draft-mode" && (
        <DraftModeTab draftNormal={draftNormalStats} />
      )}
      {activeTab === "fantasy-mode" && (
        <FantasyModeTab stats={fantasyStats} />
      )}
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
  draftNormal,
  draftHard,
}: {
  normal: UserStatsData;
  hard: UserStatsData;
  draftNormal: UserStatsData;
  draftHard: UserStatsData;
}) {
  const view = getOverallView(normal, hard, draftNormal, draftHard);

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
      <StatsSection title="Normal Mode">
        <StatCard label="Normal Mode Runs" value={String(view.runs)} />
        <StatCard label="Normal Mode Wins" value={String(view.wins)} />
        <StatCard label="Normal Mode Losses" value={String(view.losses)} />
        <StatCard
          label="Win Rate"
          value={formatWinPercentageOrDash(
            view.winPercentage,
            view.wins + view.losses > 0
          )}
          highlight={(view.winPercentage ?? 0) >= 75}
        />
        <StatCard
          label="Best Normal Mode Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.bestRecord : null
          )}
          highlight={view.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Normal Mode Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.worstRecord : null
          )}
        />
        <StatCard
          label="League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Normal Mode 27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="Normal Mode 0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
        <StatCard
          label="Best Normal Mode Ranking"
          value={formatRankingOrDash(view.bestRanking)}
          highlight={view.bestRanking === 1}
        />
      </StatsSection>
    </div>
  );
}

function HardModeTab({
  stats,
  draftHard,
}: {
  stats: UserStatsData;
  draftHard: UserStatsData;
}) {
  const normalView = getHardNormalModeView(stats);
  const draftView = getHardDraftModeView(draftHard);
  const cupView = getHardChallengeCupView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Hard Normal Mode" headerExtra={<HardModeBadge />}>
        <StatCard label="Runs" value={String(normalView.runs)} />
        <StatCard
          label="Wins"
          value={String(normalView.wins)}
          highlight={normalView.wins > 0}
        />
        <StatCard label="Losses" value={String(normalView.losses)} />
        <StatCard
          label="Win %"
          value={formatWinPercentageOrDash(
            normalView.winPercentage,
            normalView.wins + normalView.losses > 0
          )}
          highlight={(normalView.winPercentage ?? 0) >= 75}
        />
        <StatCard
          label="Best Record"
          value={formatRecordOrDash(
            normalView.hasSeasons ? normalView.bestRecord : null
          )}
          highlight={normalView.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Record"
          value={formatRecordOrDash(
            normalView.hasSeasons ? normalView.worstRecord : null
          )}
        />
        <StatCard
          label="League Titles"
          value={String(normalView.leagueTitles)}
          highlight={normalView.leagueTitles > 0}
        />
        <StatCard
          label="27-0 Seasons"
          value={String(normalView.perfectSeasons)}
          highlight={normalView.perfectSeasons > 0}
        />
        <StatCard
          label="0-27 Seasons"
          value={String(normalView.winlessSeasons)}
        />
      </StatsSection>

      <StatsSection title="Hard Draft Mode" headerExtra={<HardModeBadge />}>
        <StatCard label="Runs" value={String(draftView.runs)} />
        <StatCard
          label="Wins"
          value={String(draftView.wins)}
          highlight={draftView.wins > 0}
        />
        <StatCard label="Losses" value={String(draftView.losses)} />
        <StatCard
          label="Win %"
          value={formatWinPercentageOrDash(
            draftView.winPercentage,
            draftView.wins + draftView.losses > 0
          )}
          highlight={(draftView.winPercentage ?? 0) >= 75}
        />
        <StatCard
          label="Best Record"
          value={formatRecordOrDash(
            draftView.hasSeasons ? draftView.bestRecord : null
          )}
          highlight={draftView.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Record"
          value={formatRecordOrDash(
            draftView.hasSeasons ? draftView.worstRecord : null
          )}
        />
        <StatCard
          label="League Titles"
          value={String(draftView.leagueTitles)}
          highlight={draftView.leagueTitles > 0}
        />
        <StatCard
          label="27-0 Seasons"
          value={String(draftView.perfectSeasons)}
          highlight={draftView.perfectSeasons > 0}
        />
        <StatCard
          label="0-27 Seasons"
          value={String(draftView.winlessSeasons)}
        />
      </StatsSection>

      <StatsSection title="Hard Challenge Cup" headerExtra={<HardModeBadge />}>
        <StatCard label="Appearances" value={String(cupView.appearances)} />
        <StatCard
          label="Cup Match Wins"
          value={String(cupView.wins)}
          highlight={cupView.wins > 0}
        />
        <StatCard label="Cup Match Losses" value={String(cupView.losses)} />
        <StatCard
          label="Win %"
          value={formatWinPercentageOrDash(
            cupView.winPercentage,
            cupView.hasGames
          )}
          highlight={(cupView.winPercentage ?? 0) >= 75}
        />
        <StatCard
          label="Cups Won"
          value={String(cupView.cupsWon)}
          highlight={cupView.cupsWon > 0}
        />
        <StatCard
          label="Finals Reached"
          value={String(cupView.finals)}
          highlight={cupView.finals > 0}
        />
      </StatsSection>
    </div>
  );
}

function DraftModeTab({ draftNormal }: { draftNormal: UserStatsData }) {
  const view = getDraftModeView(draftNormal);

  return (
    <div className="space-y-8">
      <StatsSection title="Draft Mode">
        <StatCard label="Draft Mode Runs" value={String(view.runs)} />
        <StatCard label="Draft Mode Wins" value={String(view.wins)} />
        <StatCard label="Draft Mode Losses" value={String(view.losses)} />
        <StatCard
          label="Win Rate"
          value={formatWinPercentageOrDash(
            view.winPercentage,
            view.wins + view.losses > 0
          )}
        />
        <StatCard
          label="Best Draft Mode Record"
          value={formatRecordOrDash(view.hasSeasons ? view.bestRecord : null)}
          highlight={view.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Draft Mode Record"
          value={formatRecordOrDash(view.hasSeasons ? view.worstRecord : null)}
        />
        <StatCard
          label="League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Draft Mode 27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="Draft Mode 0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
      </StatsSection>
    </div>
  );
}

function FantasyModeTab({ stats }: { stats: UserStatsData }) {
  const view = getFantasyModeView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Fantasy Mode">
        <StatCard label="Fantasy Mode Runs" value={String(view.runs)} />
        <StatCard label="Fantasy Mode Wins" value={String(view.wins)} />
        <StatCard label="Fantasy Mode Losses" value={String(view.losses)} />
        <StatCard
          label="Win Rate"
          value={formatWinPercentageOrDash(
            view.winPercentage,
            view.wins + view.losses > 0
          )}
        />
        <StatCard
          label="Best Fantasy Mode Record"
          value={formatRecordOrDash(view.hasSeasons ? view.bestRecord : null)}
          highlight={view.bestRecord.wins >= 20}
        />
        <StatCard
          label="Worst Fantasy Mode Record"
          value={formatRecordOrDash(view.hasSeasons ? view.worstRecord : null)}
        />
        <StatCard
          label="League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Fantasy Mode 27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="Fantasy Mode 0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
        <StatCard
          label="Best Squad Value"
          value={
            view.bestSquadValue > 0 ? formatValue(view.bestSquadValue) : "—"
          }
          highlight={view.bestSquadValue >= 2_500_000}
        />
        <StatCard
          label="Best Team Rating"
          value={formatRatingOrDash(view.bestTeamRating)}
          highlight={(view.bestTeamRating ?? 0) >= 88}
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
        <StatCard
          label="Challenge Cup Appearances"
          value={String(view.runs)}
        />
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
