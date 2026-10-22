"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";
import { getLocalDateKey } from "@/lib/mini-games/date";
import { GRID_REWARD_PER_CELL, WORDLE_WIN_REWARD } from "@/lib/mini-games/rewards";
import { QUIZ_TOP_PRIZE } from "@/lib/quiz/prizes";
import { CLUB_FUNDS_CHANGED_EVENT, getPaidRunIds } from "@/lib/storage/club-funds";
import { formatClubFunds } from "@/lib/club-funds";

type GameId = "quiz" | "wordle" | "grid";

const GAMES: {
  id: GameId;
  href: string;
  title: string;
  blurb: string;
  reward: string;
  glyph: string;
  accent: string;
}[] = [
  {
    id: "quiz",
    href: "/mini-games/quiz",
    title: "Super League Millionaire",
    blurb: "15 questions, four lifelines, one million.",
    reward: `Up to ${formatClubFunds(QUIZ_TOP_PRIZE)} a day`,
    glyph: "?",
    accent: "from-amber-400/25 to-amber-500/5 text-amber-300 border-amber-400/40",
  },
  {
    id: "wordle",
    href: "/mini-games/wordle",
    title: "Rugby League Wordle",
    blurb: "Guess the player from club, position, age and more.",
    reward: `${formatClubFunds(WORDLE_WIN_REWARD)} a day`,
    glyph: "W",
    accent: "from-amber-400/25 to-amber-500/5 text-amber-300 border-amber-400/40",
  },
  {
    id: "grid",
    href: "/mini-games/grid",
    title: "Rugby League Grid",
    blurb: "Fill a 3×3 grid with players who fit each club, nation and position.",
    reward: `Up to ${formatClubFunds(GRID_REWARD_PER_CELL * 9)} a day`,
    glyph: "#",
    accent: "from-amber-400/25 to-amber-500/5 text-amber-300 border-amber-400/40",
  },
];

/** Which daily rewards are already banked today (client only). */
function useBankedToday(): Partial<Record<GameId, boolean>> {
  const [banked, setBanked] = useState<Partial<Record<GameId, boolean>>>({});
  useEffect(() => {
    const read = () => {
      const today = getLocalDateKey();
      const ids = getPaidRunIds();
      setBanked({
        wordle: ids.includes(`wordle_win:${today}`),
        grid: ids.includes(`grid_win:${today}`),
      });
    };
    read();
    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, read);
    return () => window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, read);
  }, []);
  return banked;
}

export function MiniGamesHub() {
  const banked = useBankedToday();
  return (
    <StandardPageShell>
      <div className={`${PAGE.section} mini-game-arena mx-auto flex w-full max-w-xl flex-col text-center`}>
        <p className={TYPO.sectionLabel}>Play</p>
        <h1 className={`mt-1.5 ${TYPO.pageTitle}`}>Puzzles</h1>
        <p className="mt-2 text-sm text-gray-400">Quick rugby league puzzles that pay Club Funds. Rewards reset at midnight UK time.</p>

        <ul className="fl-stagger mt-5 grid w-full gap-3 sm:grid-cols-2">
          {GAMES.map((game) => {
            const done = banked[game.id];
            return (
              <li key={game.id}>
                <Link
                  href={game.href}
                  onClick={() => playUiClick()}
                  className="btn-press fl-pressable fl-lift group flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-pitch-900/80 p-3 text-left transition hover:border-theme-primary/50 hover:bg-pitch-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60 sm:flex-col sm:items-start sm:p-4"
                >
                  <span
                    aria-hidden
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br font-display text-2xl font-black ${game.accent}`}
                  >
                    {game.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-bold leading-tight text-white">{game.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-gray-400">{game.blurb}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-accent-gold/10 px-2 py-0.5 text-[11px] font-bold text-accent-gold">
                        {game.reward}
                      </span>
                      {done ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                          ✓ Banked today
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span aria-hidden className="text-xl text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-theme-primary sm:hidden">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </StandardPageShell>
  );
}
