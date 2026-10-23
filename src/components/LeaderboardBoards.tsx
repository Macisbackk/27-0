"use client";

import { useEffect, useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { LeaderboardTabBar } from "./LeaderboardTabBar";
import { CareerLeaderboard } from "./career/CareerLeaderboard";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";

type Board = "classic" | "daily" | "manager";

/** The three boards: Classic, Daily and Manager Mode. */
export function LeaderboardBoards() {
  const [board, setBoard] = useState<Board>("classic");
  // Links like /leaderboard?tracker=daily_streak open on the Daily tab (read after mount, so the
  // server-rendered page and the first client render match).
  useEffect(() => {
    const tracker = new URLSearchParams(window.location.search).get("tracker");
    if (SHOW_DAILY_CHALLENGE_UI && tracker === "daily_streak") setBoard("daily");
  }, []);
  const tabs = [
    { id: "classic" as const, label: "Classic", accent: "green" as const },
    ...(SHOW_DAILY_CHALLENGE_UI ? [{ id: "daily" as const, label: "Daily", accent: "amber" as const }] : []),
    { id: "manager" as const, label: "Manager", accent: "gold" as const },
  ];
  return (
    <div>
      <nav className="mb-5" aria-label="Leaderboards">
        <LeaderboardTabBar<Board> tier="mode" tabs={tabs} active={board} onChange={setBoard} ariaLabel="Leaderboards" />
      </nav>
      {board === "manager" ? (
        <CareerLeaderboard />
      ) : (
        <LeaderboardTable mode={board === "daily" ? "daily" : "super-league"} />
      )}
    </div>
  );
}
