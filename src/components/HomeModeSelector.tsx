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
      className={`btn-press flex flex-col items-center rounded-[20px] bg-pitch-900 p-4 text-center text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60 ${className}`}
    >
      {children}
    </Link>
  );
}

function TileIcon({ children, tone = "text-theme-primary" }: { children: ReactNode; tone?: string }) {
  return (
    <span aria-hidden className={`flex h-12 w-12 items-center justify-center rounded-[14px] bg-pitch-950 ${tone}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

/** Small pill under a tile: best record, or what the mode is when there isn't one yet. */
function TilePill({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span className={`mt-2.5 inline-flex rounded-full bg-pitch-950 px-3 py-1 text-xs font-bold ${accent ? "text-theme-primary" : "text-[color:var(--fl-muted)]"}`}>
      {children}
    </span>
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
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3 text-center" aria-labelledby="play-heading">
      <h2 id="play-heading" className="text-[22px] font-bold tracking-tight text-white">
        {hub?.greeting ?? "Welcome, coach"}
      </h2>

      {SHOW_DAILY_CHALLENGE_UI ? (
        <section className="relative overflow-hidden rounded-[20px] bg-pitch-900 p-[18px] text-center" aria-label="Daily Challenge">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-theme-primary/[0.06]" />
          <p className="flex items-center justify-center gap-2 text-[13px] font-semibold text-amber-300">
            <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" />
            Daily Challenge{daily?.scenario.eraMode ? " · Era" : ""}
          </p>
          {dailyStatus ? <p className="mt-1 text-xs text-[color:var(--fl-muted)]">{dailyStatus}</p> : null}
          <p className="mt-3 text-sm text-[color:var(--fl-muted)]">Every opponent is</p>
          <p className="mt-0.5 text-[30px] font-bold leading-tight tracking-tight">
            {daily?.scenario.forceOpponentClub ?? "Today's club"}
          </p>
          {daily ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
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

      <Tile href="/manager">
        <TileIcon>
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
          <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
        </TileIcon>
        <span className="mt-2.5 block text-[17px] font-bold">Manager Mode</span>
        <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">
          {hub?.career ? `${hub.career.club} · ${hub.career.detail}` : "Run a real club. Go up, win the Grand Final."}
        </span>
        <TilePill accent>{hub?.career ? "Resume career" : "Start a career"}</TilePill>
      </Tile>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          href={buildPlayHref("classic", false)}
          onClick={() => {
            setNormalEraVariant(false);
            playModeClassicStart("NORMAL");
          }}
        >
          <TileIcon>
            <path d="M8 3 4 5 2 10l3 2 1-1v10h12V11l1 1 3-2-2-5-4-2c-1 2-7 2-8 0z" />
          </TileIcon>
          <span className="mt-2.5 block text-base font-bold">Classic</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">This season&rsquo;s squads</span>
          <TilePill accent={Boolean(hub?.classicBest)}>{hub?.classicBest ?? "Chase 27-0"}</TilePill>
        </Tile>
        <Tile
          href={buildPlayHref("classic", true)}
          onClick={() => {
            setNormalEraVariant(true);
            playModeClassicStart("NORMAL");
          }}
        >
          <TileIcon tone="text-amber-300">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </TileIcon>
          <span className="mt-2.5 block text-base font-bold">Era Classic</span>
          <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">Every era, legends too</span>
          <TilePill accent={Boolean(hub?.eraBest)}>{hub?.eraBest ?? "Chase 27-0"}</TilePill>
        </Tile>
      </div>

      <Tile href="/mini-games">
        <TileIcon tone="text-amber-300">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </TileIcon>
        <span className="mt-2.5 block text-[17px] font-bold">Puzzles</span>
        <span className="mt-0.5 block text-[13px] text-[color:var(--fl-muted)]">Millionaire · Wordle · Grid</span>
        {hub ? <TilePill accent={!hub.wordleDone}>{hub.wordleDone ? "Wordle done today" : "Today's Wordle is waiting"}</TilePill> : null}
      </Tile>
    </section>
  );
}
