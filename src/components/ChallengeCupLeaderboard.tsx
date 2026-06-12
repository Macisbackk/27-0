"use client";

import { useEffect, useState } from "react";
import {
  CUP_LEADERBOARD_CATEGORIES,
  getCupWinPercentage,
  rankProfilesByCategory,
} from "@/lib/cup-ranking";
import type { CupLeaderboardProfile } from "@/lib/storage/cup-leaderboard";
import {
  ensureCupLeaderboardSynced,
  getAllCupLeaderboardProfiles,
} from "@/lib/storage/cup-leaderboard";
import {
  getCupWinsLeaderboardAsync,
  type CupWinsLeaderboardRow,
} from "@/lib/storage/leaderboard";
import {
  getCupTeamWinsLeaderboardAsync,
  type CupTeamWinsLeaderboardRow,
} from "@/lib/storage/cup-team-wins";
import { getAllStats } from "@/lib/storage/stats";
import { getUsername } from "@/lib/storage/user";

const FEATURE_LIMIT = 10;
const CATEGORY_LIMIT = 5;

function FeaturedList({
  title,
  profiles,
  formatValue,
}: {
  title: string;
  profiles: CupLeaderboardProfile[];
  formatValue: (profile: CupLeaderboardProfile) => string;
}) {
  const currentUser = getUsername() ?? "";

  return (
    <section className="matchday-panel overflow-hidden">
      <h2 className="border-b border-pitch-600/50 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-accent-gold">
        {title}
      </h2>
      {profiles.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          No entries yet. Complete a Challenge Cup run to appear here.
        </p>
      ) : (
        <ol className="divide-y divide-pitch-700/30">
          {profiles.slice(0, FEATURE_LIMIT).map((profile, index) => (
            <li
              key={`${title}-${profile.username}`}
              className={`flex items-center justify-between px-4 py-3 ${
                profile.username === currentUser ? "bg-accent-green/5" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 font-bold ${
                    index < 3 ? "text-accent-gold" : "text-gray-400"
                  }`}
                >
                  {index + 1}.
                </span>
                <span className="font-medium">{profile.username}</span>
              </div>
              <span className="font-semibold text-accent-gold">
                {formatValue(profile)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CategoryTable({
  title,
  profiles,
  formatValue,
}: {
  title: string;
  profiles: CupLeaderboardProfile[];
  formatValue: (profile: CupLeaderboardProfile) => string;
}) {
  const currentUser = getUsername() ?? "";
  const ranked = profiles.slice(0, CATEGORY_LIMIT);

  return (
    <div className="matchday-panel overflow-hidden">
      <h3 className="border-b border-pitch-600/50 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-accent-green">
        {title}
      </h3>
      {ranked.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-gray-500">—</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {ranked.map((profile, index) => (
              <tr
                key={`${title}-${profile.username}`}
                className={`border-b border-pitch-700/30 last:border-0 ${
                  profile.username === currentUser ? "bg-accent-green/5" : ""
                }`}
              >
                <td className="w-10 px-3 py-2 font-bold text-gray-400">
                  {index + 1}
                </td>
                <td className="px-3 py-2 font-medium">{profile.username}</td>
                <td className="px-3 py-2 text-right font-semibold text-accent-gold">
                  {formatValue(profile)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CupTeamWinsGraph({
  entries,
  totalCups,
}: {
  entries: CupTeamWinsLeaderboardRow[];
  totalCups: number;
}) {
  const hasWins = entries.some((entry) => entry.tournamentWins > 0);

  return (
    <section className="matchday-panel overflow-hidden">
      <div className="border-b border-pitch-600/50 px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-accent-gold">
          Challenge Cup Team Wins
        </h2>
        {totalCups > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {totalCups} cup{totalCups !== 1 ? "s" : ""} won across all teams
          </p>
        )}
      </div>

      {!hasWins ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          No team wins recorded yet. Win a Challenge Cup tournament to appear
          here.
        </p>
      ) : (
        <ul className="space-y-2 px-3 py-4 sm:px-4">
          {entries.map((entry) => (
            <li key={entry.teamName} className="grid grid-cols-[1.4rem_1fr_auto] items-center gap-2 sm:grid-cols-[2rem_7.5rem_1fr_auto] sm:gap-3">
              <span
                className={`text-right text-xs font-bold sm:text-sm ${
                  entry.isLeader ? "text-accent-green" : "text-gray-500"
                }`}
              >
                {entry.rank}
              </span>
              <span className="truncate text-xs font-medium text-white sm:text-sm">
                {entry.teamName}
              </span>
              <div className="col-span-1 min-w-0 sm:col-span-1">
                <div className="h-5 overflow-hidden rounded-md bg-pitch-900/80 sm:h-6">
                  <div
                    className={`flex h-full items-center rounded-md px-2 text-[10px] font-bold text-pitch-950 transition-all sm:text-xs ${
                      entry.isLeader
                        ? "bg-accent-green"
                        : "bg-pitch-600/90 text-gray-200"
                    }`}
                    style={{
                      width: `${Math.max(entry.barPercent, entry.tournamentWins > 0 ? 12 : 0)}%`,
                      minWidth: entry.tournamentWins > 0 ? "2.25rem" : undefined,
                    }}
                  >
                    {entry.tournamentWins > 0 ? entry.tournamentWins : ""}
                  </div>
                </div>
              </div>
              <span className="w-6 text-right text-xs font-semibold text-accent-gold sm:text-sm">
                {entry.tournamentWins}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OnlineCupWinsList({ entries }: { entries: CupWinsLeaderboardRow[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="matchday-panel overflow-hidden">
      <h2 className="border-b border-pitch-600/50 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-accent-gold">
        Online Challenge Cup Wins
      </h2>
      <ol className="divide-y divide-pitch-700/30">
        {entries.slice(0, 10).map((entry, index) => (
          <li
            key={entry.username}
            className={`flex items-center justify-between px-4 py-3 ${
              entry.isCurrentUser ? "bg-accent-green/5" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-6 font-bold ${
                  index < 3 ? "text-accent-gold" : "text-gray-400"
                }`}
              >
                {entry.rank}.
              </span>
              <span className="font-medium">{entry.username}</span>
            </div>
            <span className="font-semibold text-accent-gold">
              {entry.totalWins}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ChallengeCupLeaderboard() {
  const [profiles, setProfiles] = useState<CupLeaderboardProfile[]>([]);
  const [onlineWins, setOnlineWins] = useState<CupWinsLeaderboardRow[]>([]);
  const [teamWins, setTeamWins] = useState<CupTeamWinsLeaderboardRow[]>([]);
  const [teamWinsTotal, setTeamWinsTotal] = useState(0);

  useEffect(() => {
    const stored = getAllStats();
    const username = getUsername();
    if (username) {
      ensureCupLeaderboardSynced(username, stored.normal, stored.hard);
    }
    setProfiles(getAllCupLeaderboardProfiles());
    void getCupWinsLeaderboardAsync().then(setOnlineWins);
    void getCupTeamWinsLeaderboardAsync().then((result) => {
      setTeamWins(result.rows);
      setTeamWinsTotal(result.totalCups);
    });
  }, []);

  const matchWins = rankProfilesByCategory(profiles, "cupMatchWins");
  const cupsWon = rankProfilesByCategory(profiles, "cupsWon");
  const winPct = rankProfilesByCategory(profiles, "winPercentage");
  const matchStreak = [...profiles]
    .filter((p) => p.longestCupMatchWinStreak > 0)
    .sort(
      (a, b) => b.longestCupMatchWinStreak - a.longestCupMatchWinStreak
    );
  const tournamentStreak = [...profiles]
    .filter((p) => p.longestTournamentWinsInRow > 0)
    .sort(
      (a, b) => b.longestTournamentWinsInRow - a.longestTournamentWinsInRow
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Challenge Cup records updated online across all players. Detailed
        category stats also sync from your local career data.
      </p>

      <CupTeamWinsGraph entries={teamWins} totalCups={teamWinsTotal} />

      <OnlineCupWinsList entries={onlineWins} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FeaturedList
          title="Challenge Cup Wins"
          profiles={matchWins}
          formatValue={(p) => String(p.cupMatchWins)}
        />
        <FeaturedList
          title="Most Challenge Cups Won"
          profiles={cupsWon}
          formatValue={(p) => String(p.cupsWon)}
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-accent-green">
          Performance
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <CategoryTable
            title="Best Cup Win Percentage"
            profiles={winPct}
            formatValue={(p) =>
              `${getCupWinPercentage(p.cupMatchWins, p.cupMatchLosses)}%`
            }
          />
          <CategoryTable
            title="Most Consecutive Cup Match Wins"
            profiles={matchStreak}
            formatValue={(p) => String(p.longestCupMatchWinStreak)}
          />
          <CategoryTable
            title="Most Tournament Wins In A Row"
            profiles={tournamentStreak}
            formatValue={(p) => String(p.longestTournamentWinsInRow)}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-accent-green">
          All Categories
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CUP_LEADERBOARD_CATEGORIES.map((category) => (
            <CategoryTable
              key={category.id}
              title={category.label}
              profiles={rankProfilesByCategory(profiles, category.id)}
              formatValue={category.format}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
