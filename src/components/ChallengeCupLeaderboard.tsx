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
  const currentUser = getUsername();

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
  const currentUser = getUsername();
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

export function ChallengeCupLeaderboard() {
  const [profiles, setProfiles] = useState<CupLeaderboardProfile[]>([]);

  useEffect(() => {
    const stored = getAllStats();
    const username = getUsername();
    ensureCupLeaderboardSynced(username, stored.normal, stored.hard);
    setProfiles(getAllCupLeaderboardProfiles());
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
        All-time Challenge Cup records saved locally in this browser.
      </p>

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
