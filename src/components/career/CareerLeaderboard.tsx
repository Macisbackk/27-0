"use client";

import { useEffect, useState } from "react";
import { LeaderboardTabBar } from "@/components/LeaderboardTabBar";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
import {
  CAREER_BOARDS,
  fetchCareerBoard,
  localCareerBoardEntry,
  type CareerBoard,
  type CareerBoardEntry,
} from "@/lib/storage/career-leaderboard";
import { TYPO } from "@/lib/ui/typography";
import { CoachNameplate, frameRowClass, useCoachFlairs } from "@/lib/coach-flair";
import { getAuthUserId } from "@/lib/auth-session";
import { loadLocalLegacy } from "@/lib/career/storage";
import { titleName } from "@/lib/cosmetics";
import { useCosmetics } from "@/lib/storage/cosmetics-store";

function formatScore(board: CareerBoard, e: CareerBoardEntry): string {
  if (board === "career-glory") return `${e.score} season${e.score === 1 ? "" : "s"}`;
  if (board === "career-season") return e.losses != null ? `${e.wins ?? e.score}–${e.losses}` : `${e.score} wins`;
  return `${e.score}`;
}

/** Manager Mode online boards (own section on the leaderboard page). */
export function CareerLeaderboard() {
  const [board, setBoard] = useState<CareerBoard>("career-trophies");
  const [entries, setEntries] = useState<CareerBoardEntry[] | null>(null);
  // True when the online board gave nothing and we fell back to this device's legacy.
  const [offline, setOffline] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    setMyUserId(getAuthUserId());
  }, []);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setOffline(false);
    void fetchCareerBoard(board)
      .catch(() => [] as CareerBoardEntry[])
      .then((rows) => {
        if (!alive) return;
        if (rows.length > 0) {
          setEntries(rows);
          return;
        }
        // Fetch failed or the board is empty: show what this device has saved.
        const local = localCareerBoardEntry(board, loadLocalLegacy());
        setEntries(local ? [local] : []);
        setOffline(Boolean(local));
      });
    return () => {
      alive = false;
    };
  }, [board]);

  const meta = CAREER_BOARDS.find((b) => b.id === board)!;
  // Store titles and frames, same as the Classic and Daily boards.
  const flairs = useCoachFlairs((entries ?? []).map((e) => e.username));
  const myCosmetics = useCosmetics();
  const isMe = (e: CareerBoardEntry) =>
    Boolean(myUserId && e.userId && e.userId === myUserId);
  // Your own row shows what you have equipped right now, even before it syncs.
  const flairFor = (e: CareerBoardEntry) =>
    isMe(e)
      ? { title: titleName(myCosmetics.equipped.title) ?? undefined, frame: myCosmetics.equipped.frame ?? undefined }
      : flairs[e.username] ?? {};

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
              const flair = flairFor(e);
              const framed = frameRowClass(flair.frame);
              const mine = isMe(e);
              return (
              <li
                key={e.userId ?? e.username}
                className={`flex items-center justify-between gap-3 rounded-tile px-3 py-2.5 ${
                  framed || (mine ? "bg-theme-primary/5" : "")
                }`}
                aria-current={mine ? "true" : undefined}
              >
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
      {offline ? (
        <p className="text-center text-xs text-gray-600">Offline: showing records saved on this device</p>
      ) : null}
    </section>
  );
}
