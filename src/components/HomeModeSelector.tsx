"use client";

import { BallGlyph, BoardGlyph, ProgrammeGlyph, TilesGlyph } from "@/components/icons/rugby-icons";
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
import { BALL_KNOWER_ID } from "@/lib/cosmetics";
import { useCosmetics } from "@/lib/storage/cosmetics-store";

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

/** A mode plate: a rounded card for the game it opens. */
function Tile({
  href,
  onClick,
  children,
  className = "",
}: {
  href: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        playUiClick();
        onClick?.();
      }}
      className={`btn-press fl-pressable fl-lift flex flex-col items-start rounded-card bg-pitch-900 p-4 text-left text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60 ${className}`}
    >
      {children}
    </Link>
  );
}

function TileIcon({ children, tone = "text-theme-primary" }: { children: ReactNode; tone?: string }) {
  return (
    <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-pitch-950 ${tone}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

/** Small tag under a plate: best record, or what the mode is when there isn't one yet. */
function TilePill({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span className={`mt-3 inline-flex rounded-full bg-pitch-950 px-3 py-1 text-xs font-bold ${accent ? "text-theme-primary" : "text-[color:var(--fl-muted)]"}`}>
      {children}
    </span>
  );
}

function TileTitle({ children }: { children: ReactNode }) {
  return <span className="mt-3 block font-cond text-[21px] font-bold leading-tight">{children}</span>;
}

function TileSub({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block text-[14px] leading-snug text-[color:var(--fl-muted)]">{children}</span>;
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

  const cosmetics = useCosmetics();
  const ownsBallKnower = cosmetics.owned.includes(BALL_KNOWER_ID);
  const daily = hub?.daily ?? null;
  const dailyStatus = !daily ? null : daily.done ? "Done today" : daily.used ? "Attempt used · practice only" : "1 attempt left today";

  return (
    <section className="fl-stagger mx-auto flex w-full max-w-xl flex-col gap-3 text-left" aria-labelledby="play-heading">
      <h2 id="play-heading" className="!text-left font-cond text-[30px] font-bold leading-none text-white">
        {hub?.greeting ?? "Welcome, coach"}
      </h2>

      {SHOW_DAILY_CHALLENGE_UI ? (
        <section className="relative overflow-hidden rounded-card bg-pitch-900 p-[18px]" aria-label="Daily Challenge">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-theme-primary/[0.06]" />
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-cond text-[16px] font-bold text-theme-primary">
              Daily Challenge{daily?.scenario.eraMode ? " · Era" : ""}
            </p>
            {dailyStatus ? <p className="shrink-0 text-xs text-[color:var(--fl-muted)]">{dailyStatus}</p> : null}
          </div>
          <p className="mt-2 font-cond text-[32px] font-bold leading-[1.05]">
            {daily?.scenario.ruleTitle ?? "Today's rule"}
          </p>
          <p className="mt-1 max-w-sm text-[15px] text-[color:var(--fl-muted)]">
            {daily?.scenario.ruleSummary ?? "A new twist every day."}
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
            className="btn-press fl-pressable relative mt-4 flex h-[52px] items-center justify-center rounded-control bg-theme-primary font-cond text-[18px] font-bold text-[color:var(--theme-text-on-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {daily?.done ? "Play again for practice" : daily?.used ? "Practice today's Daily" : "Play today's Daily"}
          </Link>
        </section>
      ) : null}

      <Tile href="/manager">
        <TileIcon>
          <BoardGlyph />
        </TileIcon>
        <TileTitle>Manager Mode</TileTitle>
        <TileSub>{hub?.career ? `${hub.career.club} · ${hub.career.detail}` : "Run a real club. Go up, win the Grand Final."}</TileSub>
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
          <TileIcon tone="text-mode-current">
            <BallGlyph />
          </TileIcon>
          <TileTitle>Classic</TileTitle>
          <TileSub>This season&rsquo;s squads</TileSub>
          <TilePill accent={Boolean(hub?.classicBest)}>{hub?.classicBest ?? "Chase 27-0"}</TilePill>
        </Tile>
        <Tile
          href={buildPlayHref("classic", true)}
         
          onClick={() => {
            setNormalEraVariant(true);
            playModeClassicStart("NORMAL");
          }}
        >
          <TileIcon tone="text-mode-era">
            <ProgrammeGlyph />
          </TileIcon>
          <TileTitle>Era Classic</TileTitle>
          <TileSub>Every era, legends too</TileSub>
          <TilePill accent={Boolean(hub?.eraBest)}>{hub?.eraBest ?? "Chase 27-0"}</TilePill>
        </Tile>
      </div>

      {ownsBallKnower ? (
        <Tile href="/play?bk=1">
          <TileIcon>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" />
          </TileIcon>
          <TileTitle>Ball Knower</TileTitle>
          <TileSub>Classic with every rating hidden.</TileSub>
          <TilePill accent>Prove it</TilePill>
        </Tile>
      ) : null}

      <Tile href="/mini-games">
        <TileIcon tone="text-[color:var(--fl-text)]">
          <TilesGlyph />
        </TileIcon>
        <TileTitle>Puzzles</TileTitle>
        <TileSub>Millionaire, Wordle and the Grid</TileSub>
        {hub ? <TilePill accent={!hub.wordleDone}>{hub.wordleDone ? "Wordle done today" : "Today's Wordle is waiting"}</TilePill> : null}
      </Tile>
    </section>
  );
}
