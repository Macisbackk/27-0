"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { UserStatsData } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { EMPTY_STATS, getAllStats } from "@/lib/storage/stats";
import { SHOW_DRAFT_MODE } from "@/lib/feature-flags";
import { getUsername } from "@/lib/storage/user";
import {
  STATS_TABS,
  getDraftModeView,
  getFantasyModeView,
  getHardNormalModeView,
  getOverallView,
  getSuperLeagueView,
  formatRankingOrDash,
  formatRatingOrDash,
  formatRecordOrDash,
  type StatsTabId,
} from "@/lib/stats-views";
import { HardModeBadge } from "./HardModeBadge";
import { RecordWithPercentage } from "./RecordWithPercentage";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { runStatsPageValidation } from "@/lib/validation/stats-page-validation";
import { playTabChange } from "@/lib/sound";
import {
  loadManagerStats,
  EMPTY_MANAGER_STATS,
} from "@/lib/manager/managerStats";
import {
  MANAGER_STATS_TABS,
  getManagerChallengeCupView,
  getManagerOverallView,
  getManagerSuperLeagueView,
  type ManagerStatsTabId,
} from "@/lib/manager/manager-stats-views";
import type { ManagerLifetimeStats } from "@/lib/manager/types";
import {
  getNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
  setNormalEraVariant,
} from "@/lib/storage/preferences";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";

type StatsModeId = "quick" | "manager";

const STATS_MODE_TABS: { id: StatsModeId; label: string }[] = [
  { id: "manager", label: "Manager Mode" },
  { id: "quick", label: "Quick Mode" },
];

export function StatsPanel() {
  const [modeTab, setModeTab] = useState<StatsModeId>("manager");
  const [activeTab, setActiveTab] = useState<StatsTabId>("overall");
  const [managerTab, setManagerTab] =
    useState<ManagerStatsTabId>("overall");
  const [normalStats, setNormalStats] = useState<UserStatsData | null>(null);
  const [hardStats, setHardStats] = useState<UserStatsData | null>(null);
  const [draftNormalStats, setDraftNormalStats] =
    useState<UserStatsData | null>(null);
  const [draftHardStats, setDraftHardStats] = useState<UserStatsData | null>(
    null
  );
  const [fantasyStats, setFantasyStats] = useState<UserStatsData | null>(null);
  const [eraNormalStats, setEraNormalStats] = useState<UserStatsData | null>(
    null
  );
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [managerStats, setManagerStats] = useState(EMPTY_MANAGER_STATS);

  const refresh = () => {
    const stored = getAllStats();
    setNormalStats(stored.normal);
    setHardStats(stored.hard);
    setDraftNormalStats(stored.draftNormal);
    setDraftHardStats(stored.draftHard);
    setFantasyStats(stored.fantasy);
    setEraNormalStats(stored.eraNormal);
    setManagerStats(loadManagerStats());
  };

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    const onNormalEra = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setNormalEraMode(detail.eraMode);
    };
    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalEra);
    return () => {
      window.removeEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalEra);
    };
  }, []);

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
      !fantasyStats ||
      !eraNormalStats
    ) {
      return;
    }
    runStatsPageValidation({
      normal: normalStats,
      hard: hardStats,
      draftNormal: draftNormalStats,
      draftHard: draftHardStats,
    });
  }, [normalStats, hardStats, draftNormalStats, draftHardStats, fantasyStats, eraNormalStats]);

  if (
    !normalStats ||
    !hardStats ||
    !draftNormalStats ||
    !draftHardStats ||
    !fantasyStats ||
    !eraNormalStats
  ) {
    return (
      <div className="card-glass p-12 text-center text-gray-500">
        <p className={TYPO.body}>Loading stats...</p>
      </div>
    );
  }

  const hasAnyRuns =
    normalStats.totalRuns > 0 ||
    eraNormalStats.totalRuns > 0 ||
    hardStats.totalRuns > 0 ||
    (SHOW_DRAFT_MODE && draftNormalStats.totalSeasonsSimulated > 0) ||
    (SHOW_DRAFT_MODE && draftHardStats.totalSeasonsSimulated > 0) ||
    fantasyStats.totalSeasonsSimulated > 0;

  const hasAnyManagerStats =
    managerStats.seasonsCompleted > 0 ||
    managerStats.careersStarted > 0 ||
    managerStats.wins > 0 ||
    managerStats.losses > 0;

  const publicDraftNormal = SHOW_DRAFT_MODE ? draftNormalStats : EMPTY_STATS;
  const publicDraftHard = SHOW_DRAFT_MODE ? draftHardStats : EMPTY_STATS;

  return (
    <div className="space-y-6">
      <nav className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {STATS_MODE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (modeTab !== tab.id) playTabChange();
                setModeTab(tab.id);
              }}
              className={`btn-press shrink-0 min-h-[44px] rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                modeTab === tab.id ? BTN.tabActive : BTN.tabIdle
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {modeTab === "quick" && (
        <>
          <nav className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              {STATS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (activeTab !== tab.id) playTabChange();
                    setActiveTab(tab.id);
                  }}
                  className={`btn-press shrink-0 min-h-[44px] rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
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
              draftNormal={publicDraftNormal}
              draftHard={publicDraftHard}
            />
          )}
          {activeTab === "super-league" && (
            <SuperLeagueTab
              normal={normalStats}
              eraNormal={eraNormalStats}
              hard={hardStats}
              eraMode={normalEraMode}
              onEraModeChange={(era) => {
                setNormalEraMode(era);
                setNormalEraVariant(era);
              }}
            />
          )}
        </>
      )}

      {modeTab === "manager" && (
        <>
          <nav className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              {MANAGER_STATS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (managerTab !== tab.id) playTabChange();
                    setManagerTab(tab.id);
                  }}
                  className={`btn-press shrink-0 min-h-[44px] rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                    managerTab === tab.id ? BTN.tabActive : BTN.tabIdle
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {!hasAnyManagerStats && (
            <div className="card-glass p-6 text-center text-gray-500">
              No manager seasons yet. Start a career in Manager Mode to track
              stats.
            </div>
          )}

          {managerTab === "overall" && (
            <ManagerOverallTab stats={managerStats} />
          )}
          {managerTab === "super-league" && (
            <ManagerSuperLeagueTab stats={managerStats} />
          )}
          {managerTab === "challenge-cup" && (
            <ManagerChallengeCupTab stats={managerStats} />
          )}
        </>
      )}

      <p className="text-center text-xs text-gray-600">
        Statistics saved locally in this browser
      </p>
    </div>
  );
}

function ManagerOverallTab({ stats }: { stats: ManagerLifetimeStats }) {
  const view = getManagerOverallView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Career">
        <StatCard label="Total Seasons" value={String(view.totalSeasons)} />
        <StatCard label="Total Wins" value={String(view.totalWins)} />
        <StatCard label="Total Losses" value={String(view.totalLosses)} />
        <StatCard
          label="Careers Started"
          value={String(view.careersStarted)}
        />
      </StatsSection>

      <StatsSection title="Records">
        <StatCard
          label="Total Record"
          value={formatRecordOrDash(view.totalRecord)}
          highlight={(view.totalRecord?.wins ?? 0) >= 20}
        />
        <StatCard
          label="Worst Season Record"
          value={formatRecordOrDash(view.worstRecord)}
        />
        <StatCard
          label="Biggest Win Margin"
          value={view.biggestWin > 0 ? `${view.biggestWin} pts` : "—"}
          highlight={view.biggestWin >= 20}
        />
        <StatCard
          label="Biggest Defeat Margin"
          value={view.biggestDefeat > 0 ? `${view.biggestDefeat} pts` : "—"}
        />
      </StatsSection>

      <StatsSection title="Achievements">
        <StatCard
          label="League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Super League Titles"
          value={String(view.superLeagueTitles)}
          highlight={view.superLeagueTitles > 0}
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
        <StatCard
          label="Total Trophies"
          value={String(view.trophies)}
          highlight={view.trophies > 0}
        />
      </StatsSection>

      <StatsSection title="Career Highlights">
        <StatCard label="Best League Finish" value={view.bestFinish} />
        <StatCard
          label="Favourite Club"
          value={view.favouriteClub ?? "—"}
        />
        <StatCard
          label="Total Earnings"
          value={
            view.totalEarnings > 0
              ? `£${(view.totalEarnings / 1000).toFixed(0)}k`
              : "—"
          }
          highlight={view.totalEarnings >= 500_000}
        />
      </StatsSection>
    </div>
  );
}

function ManagerSuperLeagueTab({ stats }: { stats: ManagerLifetimeStats }) {
  const view = getManagerSuperLeagueView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Super League">
        <StatCard label="Seasons Completed" value={String(view.seasons)} />
        <StatCard label="Match Wins" value={String(view.wins)} />
        <StatCard label="Match Losses" value={String(view.losses)} />
        <StatCard
          label="Total Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.totalRecord : null
          )}
          highlight={view.totalRecord.wins >= 20}
        />
        <StatCard
          label="Worst Season Record"
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
          label="Super League Titles"
          value={String(view.superLeagueTitles)}
          highlight={view.superLeagueTitles > 0}
        />
        <StatCard
          label="Top-Six Finishes"
          value={String(view.topSixFinishes)}
          highlight={view.topSixFinishes > 0}
        />
        <StatCard label="Best League Finish" value={view.bestFinish} />
        <StatCard
          label="27-0 Seasons"
          value={String(view.perfectSeasons)}
          highlight={view.perfectSeasons > 0}
        />
        <StatCard
          label="0-27 Seasons"
          value={String(view.winlessSeasons)}
        />
        <StatCard
          label="Favourite Club"
          value={view.favouriteClub ?? "—"}
        />
      </StatsSection>
    </div>
  );
}

function ManagerChallengeCupTab({ stats }: { stats: ManagerLifetimeStats }) {
  const view = getManagerChallengeCupView(stats);

  return (
    <div className="space-y-8">
      <StatsSection title="Challenge Cup">
        <StatCard
          label="Seasons Played"
          value={String(view.seasons)}
        />
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
      </StatsSection>

      <StatsSection title="Achievements">
        <StatCard
          label="Total Trophies"
          value={String(view.trophies)}
          highlight={view.trophies > 0}
        />
      </StatsSection>
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
          label="Total Record"
          value={formatRecordOrDash(view.totalRecord)}
          highlight={(view.totalRecord?.wins ?? 0) >= 20}
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

function SuperLeagueTab({
  normal,
  eraNormal,
  eraMode,
  onEraModeChange,
}: {
  normal: UserStatsData;
  eraNormal: UserStatsData;
  hard: UserStatsData;
  eraMode: boolean;
  onEraModeChange: (eraMode: boolean) => void;
}) {
  const activeStats = eraMode ? eraNormal : normal;
  const view = getSuperLeagueView(activeStats);
  const modeLabel = eraMode ? "Era Normal Mode" : "Current Normal Mode";

  return (
    <div className="space-y-8">
      <ChallengeCupVariantToggle
        sectionLabel="Mode Variant"
        useShortLabels
        eraMode={eraMode}
        onEraModeChange={onEraModeChange}
      />

      <StatsSection title={modeLabel}>
        <StatCard label="Normal Mode Runs" value={String(view.runs)} />
        <StatCard label="Normal Mode Wins" value={String(view.wins)} />
        <StatCard label="Normal Mode Losses" value={String(view.losses)} />
        <StatCard
          label="Regular Season Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.regularRecord : null
          )}
        />
        <StatCard
          label="Total Record"
          value={
            view.hasSeasons ? (
              <RecordWithPercentage
                wins={view.totalRecord.wins}
                losses={view.totalRecord.losses}
              />
            ) : (
              "—"
            )
          }
          highlight={view.totalRecord.wins >= 20}
        />
        <StatCard
          label="Play-Off Record"
          value={formatRecordOrDash(
            view.playoffRecord.wins + view.playoffRecord.losses > 0
              ? view.playoffRecord
              : null
          )}
        />
        <StatCard
          label="Worst Normal Mode Record"
          value={formatRecordOrDash(
            view.hasSeasons ? view.worstRecord : null
          )}
        />
        <StatCard
          label="Best Overall Season"
          value={formatRecordOrDash(
            view.bestOverallRecord.wins + view.bestOverallRecord.losses > 0
              ? view.bestOverallRecord
              : null
          )}
        />
        <StatCard
          label="League Titles"
          value={String(view.leagueTitles)}
          highlight={view.leagueTitles > 0}
        />
        <StatCard
          label="Super League Titles"
          value={String(view.superLeagueTitles)}
          highlight={view.superLeagueTitles > 0}
        />
        <StatCard
          label="Top-Six Finishes"
          value={String(view.topSixFinishes)}
          highlight={view.topSixFinishes > 0}
        />
        <StatCard
          label="Play-Off Appearances"
          value={String(view.playoffAppearances)}
        />
        <StatCard
          label="Eliminator Wins"
          value={String(view.playoffEliminatorWins)}
        />
        <StatCard
          label="Semi-Final Wins"
          value={String(view.playoffSemiFinalWins)}
        />
        <StatCard
          label="Grand Final Appearances"
          value={String(view.grandFinalAppearances)}
          highlight={view.grandFinalAppearances > 0}
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

function DraftModeTab({ draftNormal }: { draftNormal: UserStatsData }) {
  const view = getDraftModeView(draftNormal);

  return (
    <div className="space-y-8">
      <StatsSection title="Draft Mode">
        <StatCard label="Draft Mode Runs" value={String(view.runs)} />
        <StatCard label="Draft Mode Wins" value={String(view.wins)} />
        <StatCard label="Draft Mode Losses" value={String(view.losses)} />
        <StatCard
          label="Total Record"
          value={formatRecordOrDash(view.hasSeasons ? view.totalRecord : null)}
          highlight={view.totalRecord.wins >= 20}
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
          label="Total Record"
          value={formatRecordOrDash(view.hasSeasons ? view.totalRecord : null)}
          highlight={view.totalRecord.wins >= 20}
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
  value: ReactNode;
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
