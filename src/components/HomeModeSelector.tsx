"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  getDailyChallengeAttemptUsed,
  getDailyChallengeHref,
  getDailyChallengeProgress,
  getDailyChallengeScenario,
  type DailyChallengeScenario,
} from "@/lib/daily-challenge";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { buildPlayHref } from "@/lib/play-links";
import { setNormalEraVariant } from "@/lib/storage/preferences";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { formatClubFunds } from "@/lib/club-funds";
import { loadLocalCareer } from "@/lib/career/storage";
import { DIVISION_LABEL } from "@/lib/career/clubs";
import { getAllStats } from "@/lib/storage/stats";
import { getPaidRunIds } from "@/lib/storage/club-funds";
import { getLocalDateKey } from "@/lib/mini-games/date";

/** Everything on the home hub that depends on this device (filled in after mount). */
interface HubState {
  greeting: string;
  daily: { scenario: DailyChallengeScenario; done: boolean; used: boolean } | null;
  career: { club: string; detail: string } | null;
  classicBest: string | null;
  eraBest: string | null;
  wordleDone: boolean;
}

function greeting(hour: number): string {
  if (hour < 5) return "Late one, coach";
  if (hour < 12) return "Morning, coach";
  if (hour < 18) return "Afternoon, coach";
  return "Evening, coach";
}

function readHub(): HubState {
  let career: HubState["career"] = null;
  try {
    const s = loadLocalCareer();
    const club = s ? s.clubs[s.userClubId] : null;
    if (s && club) career = { club: club.name, detail: `${s.year} · ${DIVISION_LABEL[club.division]}` };
  } catch {
    career = null;
  }
  const stats = getAllStats();
  const rec = (w: number, l: number) => (w + l > 0 ? `Best: ${w}-${l}` : null);
  const progress = getDailyChallengeProgress();
  return {
    greeting: greeting(new Date().getHours()),
    daily: SHOW_DAILY_CHALLENGE_UI
      ? {
          scenario: getDailyChallengeScenario(),
          done: Boolean(progress.leagueLeaders && progress.playoffTitle),
          used: getDailyChallengeAttemptUsed(),
        }
      : null,
    career,
    classicBest: rec(stats.normal.bestRecordWins, stats.normal.bestRecordLosses),
    eraBest: rec(stats.eraNormal.bestRecordWins, stats.eraNormal.bestRecordLosses),
    wordleDone: getPaidRunIds().includes(`wordle_win:${getLocalDateKey()}`),
  };
}

function Tile({ href, onClick, children, className = "" }: { href: string; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      onClick={() => {
        playUiClick();
        onClick?.();
      }}
      className={`btn-press block rounded-[20px] bg-pitch-900 p-4 text-left text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60 ${className}`}
    >
      {children}
    </Link>
  );
}

export function HomeModeSelector() {
  const [hub, setHub] = useState<HubState | null>(null);
  useEffect(() => {
    try {
      setHub(readHub());
    } catch {
      setHub(null);
    }
  }, []);

  const daily = hub?.daily ?? null;
  const dailyStatus = !daily ? null : daily.done ? "Done today" : daily.used ? "Attempt used · practice only" : "1 attempt left today";

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3 text-left" aria-labelledby="play-heading">
      <h2 id="play-heading" className="px-0.5 text-[22px] font-bold tracking-tight text-white">
        {hub?.greeting ?? "Welcome, coach"}
      </h2>

      {SHOW_DAILY_CHALLENGE_UI ? (
        <section className="relative overflow-hidden rounded-[20px] bg-pitch-900 p-[18px]" aria-label="Daily Challenge">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-theme-primary/10" />
          <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-300">
            <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" />
            Daily Challenge{daily?.scenario.eraMode ? " · Era" : ""}{dailyStatus ? ` · ${dailyStatus}` : ""}
          </p>
          <p className="mt-3 text-sm text-[color:var(--fl-muted)]">Every opponent is</p>
          <p className="mt-0.5 text-[30px] font-bold leading-tight tracking-tight">
            {daily?.scenario.forceOpponentClub ?? "Today's club"}
          </p>
          {daily ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="fl-pill">
                Top the table <span className="text-theme-primary">+{formatClubFunds(daily.scenario.leagueLeadersBonus)}</span>
              </span>
              <span className="fl-pill">
                Grand Final <span className="text-theme-primary">+{formatClubFunds(daily.scenario.playoffTitleBonus)}</span>
              </span>
            </div>
          ) : null}
          <Link
            href={getDailyChallengeHref()}
            onClick={() => playUiClick()}
            className="btn-press mt-4 flex h-[50px] items-center justify-center rounded-[14px] bg-theme-primary text-base font-bold text-[color:var(--theme-text-on-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {daily?.done ? "Play again for practice" : daily?.used ? "Practice today's Daily" : "Play today's Daily"}
          </Link>
        </section>
      ) : null}

      <Tile href="/manager" className="flex items-center gap-3.5">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-pitch-950 text-theme-primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold">Manager Mode</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">
            {hub?.career ? `${hub.career.club} · ${hub.career.detail}` : "Run a real club. Go up, win the Grand Final."}
          </span>
        </span>
        <span className="text-[13px] font-bold text-theme-primary">{hub?.career ? "Resume" : "Start"}</span>
      </Tile>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          href={buildPlayHref("classic", false)}
          onClick={() => {
            setNormalEraVariant(false);
            playModeClassicStart("NORMAL");
          }}
        >
          <span className="fl-number block text-[30px] text-theme-primary">13</span>
          <span className="mt-2 block text-base font-bold">Classic</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">{hub?.classicBest ?? "2026 squads"}</span>
        </Tile>
        <Tile
          href={buildPlayHref("classic", true)}
          onClick={() => {
            setNormalEraVariant(true);
            playModeClassicStart("NORMAL");
          }}
        >
          <span className="fl-number block text-[30px] text-amber-300">&rsquo;96</span>
          <span className="mt-2 block text-base font-bold">Era Classic</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">{hub?.eraBest ?? "Every era, legends too"}</span>
        </Tile>
      </div>

      <Tile href="/mini-games" className="flex items-center gap-3.5">
        <span aria-hidden className="fl-number flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-pitch-950 text-2xl text-amber-300">
          ?
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold">Puzzles</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">
            Millionaire · Wordle{hub ? (hub.wordleDone ? " · Wordle done today" : " · Wordle not played") : ""}
          </span>
        </span>
        <span aria-hidden className="text-xl text-[color:var(--fl-muted)]">›</span>
      </Tile>
    </section>
  );
}
