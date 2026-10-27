"use client";

import { useEffect, useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { LeaderboardTabBar } from "./LeaderboardTabBar";
import { WeeklyLeaderboard } from "./WeeklyLeaderboard";
import { CareerLeaderboard } from "./career/CareerLeaderboard";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";

type Board = "classic" | "daily" | "weekly" | "manager";

/** The boards: Classic, Manager Mode, Daily and Weekly. */
export function LeaderboardBoards() {
  const [board, setBoard] = useState<Board>("classic");
  // Links like /leaderboard?tracker=daily open on that tab (read after mount, so the
  // server-rendered page and the first client render match). daily_streak is the old Daily link.
  useEffect(() => {
    const tracker = new URLSearchParams(window.location.search).get("tracker");
    if (SHOW_DAILY_CHALLENGE_UI && (tracker === "daily_streak" || tracker === "daily")) setBoard("daily");
    if (SHOW_DAILY_CHALLENGE_UI && tracker === "weekly") setBoard("weekly");
    if (tracker === "manager") setBoard("manager");
  }, []);
  // Keep the tab in the URL so Back and shared links land on the same board.
  const selectBoard = (next: Board) => {
    setBoard(next);
    try {
      const url = new URL(window.location.href);
      const current = url.searchParams.get("tracker");
      if (next === "classic") url.searchParams.delete("tracker");
      else if (!(next === "daily" && current === "daily_streak")) url.searchParams.set("tracker", next);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    } catch {
      // ignore
    }
  };
  const tabs = [
    { id: "classic" as const, label: "Classic", accent: "green" as const },
    // Same order as the game: Classic, then Manager Mode, then the Daily / Weekly.
    { id: "manager" as const, label: "Manager", accent: "gold" as const },
    ...(SHOW_DAILY_CHALLENGE_UI
      ? [
          { id: "daily" as const, label: "Daily", accent: "amber" as const },
          { id: "weekly" as const, label: "Weekly", accent: "gold" as const },
        ]
      : []),
  ];
  return (
    <div>
      <nav className="mb-5" aria-label="Leaderboards">
        <LeaderboardTabBar<Board> tier="mode" tabs={tabs} active={board} onChange={selectBoard} ariaLabel="Leaderboards" />
      </nav>
      {board === "manager" ? (
        <CareerLeaderboard />
      ) : board === "weekly" ? (
        <WeeklyLeaderboard />
      ) : (
        <LeaderboardTable mode={board === "daily" ? "daily" : "super-league"} />
      )}
    </div>
  );
}
