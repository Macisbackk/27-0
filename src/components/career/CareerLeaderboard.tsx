"use client";

import { useEffect, useState } from "react";
import { LeaderboardTabBar } from "@/components/LeaderboardTabBar";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
import { CAREER_BOARDS, fetchCareerBoard, type CareerBoard, type CareerBoardEntry } from "@/lib/storage/career-leaderboard";
import { TYPO } from "@/lib/ui/typography";
import { CoachNameplate, frameRowClass, useCoachFlairs } from "@/lib/coach-flair";

function formatScore(board: CareerBoard, e: CareerBoardEntry): string {
  if (board === "career-glory") return `${e.score} season${e.score === 1 ? "" : "s"}`;
  if (board === "career-season") return e.losses != null ? `${e.wins ?? e.score}–${e.losses}` : `${e.score} wins`;
  return `${e.score}`;
}

/** Manager Mode online boards (own section on the leaderboard page). */
export function CareerLeaderboard() {
  const [board, setBoard] = useState<CareerBoard>("career-trophies");
  const [entries, setEntries] = useState<CareerBoardEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    void fetchCareerBoard(board).then((rows) => {
      if (alive) setEntries(rows);
    });
    return () => {
      alive = false;
    };
  }, [board]);

  const meta = CAREER_BOARDS.find((b) => b.id === board)!;
  // Store titles and frames, same as the Classic and Daily boards.
  const flairs = useCoachFlairs((entries ?? []).map((e) => e.username));

  return (
    <section className="space-y-3" aria-label="Manager Mode records">
      <LeaderboardTabBar<CareerBoard>
        tier="category"
        tabs={CAREER_BOARDS.map((b) => ({ id: b.id, label: b.label, accent: "gold" as const }))}
        active={board}
        onChange={setBoard}
        ariaLabel="Manager Mode records"
      />
      <p className={`text-center ${TYPO.bodySm}`}>{meta.blurb}.</p>
      <GamePanel variant="elevated" className="overflow-hidden p-0">
        {entries === null ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400" role="status">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-gray-300">No records yet. Be the first on the board.</p>
            <GameButton size="sm" fullWidth={false} href="/manager">Play Manager Mode</GameButton>
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5 p-2">
            {entries.map((e, i) => {
              const flair = flairs[e.username] ?? {};
              return (
              <li key={e.userId ?? e.username} className={`flex items-center justify-between gap-3 rounded-tile px-3 py-2.5 ${frameRowClass(flair.frame)}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`w-6 text-right font-display font-bold tabular-nums ${i < 3 ? "text-accent-gold" : "text-gray-500"}`}>{i + 1}</span>
                  <CoachNameplate className="text-white" name={e.username} title={flair.title} />
                </span>
                <span className="shrink-0 font-display font-bold tabular-nums text-white">{formatScore(board, e)}</span>
              </li>
              );
            })}
          </ol>
        )}
      </GamePanel>
    </section>
  );
}
