"use client";

import {
  BallGlyph,
  BoardGlyph,
  CoinGlyph,
  FixtureGlyph,
  ProgrammeGlyph,
  TilesGlyph,
} from "@/components/icons/rugby-icons";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  getDailyChallengeAttemptUsed,
  getDailyChallengeBestStreak,
  getDailyChallengeHref,
  getDailyChallengeProgress,
  getDailyChallengeScenario,
  getDailyChallengeStreak,
  type DailyChallengeScenario,
} from "@/lib/daily-challenge";
import { claimDailyBonus, formatCountdown, msUntilUkMidnight } from "@/lib/daily-bonus";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { getClubFundsBalance } from "@/lib/storage/club-funds";
import {
  formatOrdinal,
  formatWeeklyResetCountdown,
  getWeeklyChallengeAttemptUsed,
  getWeeklyChallengeEntry,
  getWeeklyChallengeHref,
  getWeeklyChallengeScenario,
  WEEKLY_TOP10_REWARD,
  type WeeklyChallengeScenario,
} from "@/lib/weekly-challenge";
import {
  checkWeeklyLastWeekFinish,
  flushWeeklyChallengeEntry,
  type WeeklyLastWeekResult,
} from "@/lib/storage/weekly-leaderboard";
import { isCloudHydrated, useAuth } from "@/lib/auth-context";
import { MissionsList, MissionsRing, missionsLeftToEarn, useDailyMissions } from "@/components/DailyMissionsCard";
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
import { DAILY_ARCHIVE_PAGE } from "@/lib/daily-archive";
import { MODES_PAGE } from "@/lib/play-side-modes";

/** Everything on the home hub that depends on this device (filled in after mount). */
interface HubState {
  greeting: string;
  daily: { scenario: DailyChallengeScenario; done: boolean; used: boolean; streak: number; best: number } | null;
  funds: number;
  weekly: {
    scenario: WeeklyChallengeScenario;
    used: boolean;
    score: number | null;
    resetsIn: string;
  } | null;
  career: { club: string; short: string; primary: string; secondary: string; detail: string } | null;
  classicBest: string | null;
  eraBest: string | null;
  wordleDone: boolean;
  /** No Classic / Era Classic run and no Manager career on this device yet. */
  firstRun: boolean;
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
    if (s && club)
      career = {
        club: club.name,
        short: club.short,
        primary: club.primary,
        secondary: club.secondary,
        detail: `${s.year} · ${DIVISION_LABEL[club.division]}`,
      };
  } catch {
    career = null;
  }
  const stats = getAllStats();
  // Same rule as the Coach Profile: a best record only once a season in that mode is finished.
  const rec = (b: { totalSeasonsSimulated: number; bestRecordWins: number; bestRecordLosses: number }) =>
    b.totalSeasonsSimulated > 0 && b.bestRecordWins + b.bestRecordLosses > 0
      ? `${b.bestRecordWins}-${b.bestRecordLosses}`
      : null;
  const progress = getDailyChallengeProgress();
  return {
    greeting: greeting(new Date().getHours()),
    daily: SHOW_DAILY_CHALLENGE_UI
      ? {
          scenario: getDailyChallengeScenario(),
          done: Boolean(progress.leagueLeaders && progress.playoffTitle),
          used: getDailyChallengeAttemptUsed(),
          streak: getDailyChallengeStreak(),
          best: getDailyChallengeBestStreak(),
        }
      : null,
    funds: getClubFundsBalance(),
    weekly: SHOW_DAILY_CHALLENGE_UI
      ? {
          scenario: getWeeklyChallengeScenario(),
          used: getWeeklyChallengeAttemptUsed(),
          score: getWeeklyChallengeEntry()?.score ?? null,
          resetsIn: formatWeeklyResetCountdown(),
        }
      : null,
    career,
    classicBest: rec(stats.normal),
    eraBest: rec(stats.eraNormal),
    wordleDone: getPaidRunIds().includes(`wordle_win:${getLocalDateKey()}`),
    firstRun:
      !career &&
      stats.normal.totalRuns + stats.normal.totalSeasonsSimulated + stats.eraNormal.totalRuns + stats.eraNormal.totalSeasonsSimulated === 0,
  };
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/70";

/** A 24×24 stroke icon from the rugby set. */
function Glyph({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Small status tag on a mode tile. `tone` picks the dot colour; no dot for plain info. */
function Badge({ children, tone, plain = false }: { children: ReactNode; tone?: "primary" | "gold"; plain?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate font-bold text-[color:var(--fl-muted)] ${
        plain ? "text-[12px] leading-4" : "rounded-full bg-pitch-950 px-2 py-0.5 text-[11px] leading-[18px]"
      }`}
    >
      {tone ? <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === "gold" ? "bg-accent-gold" : "bg-theme-primary"}`} /> : null}
      <span className={`truncate ${tone === "gold" ? "text-accent-gold" : tone === "primary" ? "text-theme-primary" : ""}`}>{children}</span>
    </span>
  );
}

/** A mode on the play grid: big icon, short name, one status tag. */
function ModeTile({
  href,
  label,
  ariaLabel,
  icon,
  tint,
  badge,
  wide = false,
  onClick,
}: {
  href: string;
  label: string;
  ariaLabel?: string;
  icon: ReactNode;
  tint: string;
  badge: ReactNode;
  wide?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      onClick={() => {
        playUiClick();
        onClick?.();
      }}
      className={`btn-press fl-pressable group flex min-w-0 rounded-tile bg-pitch-900 text-white transition hover:bg-pitch-800 ${FOCUS} ${
        wide ? "col-span-3 items-center gap-2.5 p-2.5 pr-3 text-left" : "col-span-2 flex-col items-center gap-2 px-1.5 pb-3 pt-3.5 text-center"
      }`}
    >
      <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-control ${tint} ${wide ? "h-11 w-11" : "h-[52px] w-[52px]"}`}>
        <Glyph size={wide ? 22 : 26}>{icon}</Glyph>
      </span>
      <span className={`flex min-w-0 flex-col gap-1 ${wide ? "items-start" : "w-full items-center"}`}>
        <span className="block max-w-full truncate font-cond text-[17px] font-bold leading-none">{label}</span>
        {badge}
      </span>
    </Link>
  );
}

/** Mown stripes and pitch markings behind the Classic hero. */
function PitchMarkings({ tone = "white", opacity = 0.07 }: { tone?: string; opacity?: number }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 220">
      {Array.from({ length: 10 }, (_, i) => (i % 2 ? <rect key={i} x={i * 40} y="0" width="40" height="220" fill={tone} fillOpacity={opacity * 0.5} /> : null))}
      <g stroke={tone} strokeOpacity={opacity} strokeWidth="2" fill="none">
        <line x1="200" y1="0" x2="200" y2="220" vectorEffect="non-scaling-stroke" />
        <line x1="120" y1="0" x2="120" y2="220" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
        <line x1="280" y1="0" x2="280" y2="220" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/** Chalk on the tactics board: Xs, Os and a run, behind the Manager card. */
function ChalkPlay() {
  return (
    <svg aria-hidden className="pointer-events-none absolute -right-2 top-0 h-full w-[46%] max-w-[260px]" viewBox="0 0 200 140" preserveAspectRatio="xMaxYMid meet">
      <g fill="none" stroke="white" strokeOpacity="0.09" strokeWidth="2.5" strokeLinecap="round">
        <path d="M28 30l12 12M40 30 28 42M70 96l12 12M82 96l-12 12M150 24l12 12M162 24l-12 12" />
        <circle cx="120" cy="70" r="8" />
        <circle cx="176" cy="104" r="8" />
        <path d="M44 48c24 30 50 34 68 26" strokeDasharray="6 7" />
        <path d="M128 74c16 8 30 14 40 24" />
        <path d="M160 92l8 6-10 2" />
      </g>
    </svg>
  );
}

/** A plain shield in the club's colours with its short name: Manager Mode's crest. */
function Crest({ primary, secondary, label }: { primary: string; secondary: string; label: string }) {
  return (
    <span aria-hidden className="relative flex h-[64px] w-[56px] shrink-0 items-center justify-center">
      <svg width="56" height="64" viewBox="0 0 56 64" className="absolute inset-0">
        <path d="M4 6 28 2l24 4v24c0 16-10 26-24 32C14 56 4 46 4 30z" fill={primary} stroke={secondary} strokeWidth="3" />
        <path d="M4 26h48" stroke={secondary} strokeOpacity="0.55" strokeWidth="3" />
      </svg>
      <span className="relative mt-1 font-display text-[15px] leading-none" style={{ color: secondary }}>
        {label}
      </span>
    </span>
  );
}

/** One half of the Classic hero: a whole-panel link with its own Play button look. */
function ClassicPanel({
  era,
  best,
  verb,
  onClick,
}: {
  era: boolean;
  best: string | null;
  verb: string;
  onClick: () => void;
}) {
  const name = era ? "Era Classic" : "Classic";
  return (
    <Link
      href={buildPlayHref("classic", era)}
      onClick={() => {
        playUiClick();
        onClick();
      }}
      aria-label={`${verb} ${name}${best ? `, best ${best}` : ""}`}
      className="btn-press fl-pressable group flex min-w-0 flex-col items-center rounded-tile bg-pitch-950/90 px-2 pb-2.5 pt-4 text-center text-white transition hover:bg-pitch-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
    >
      <span aria-hidden className={`flex h-14 w-14 items-center justify-center rounded-full ${era ? "bg-mode-era/10 text-mode-era" : "bg-theme-primary/10 text-theme-primary"}`}>
        <Glyph size={30}>{era ? <ProgrammeGlyph /> : <BallGlyph />}</Glyph>
      </span>
      <span className="mt-2.5 block max-w-full truncate font-display text-[24px] leading-none">{name}</span>
      <span className="mt-1.5 block min-h-[18px] text-[12px] font-bold leading-[18px]">
        {best ? (
          <span className="text-theme-primary">Best {best}</span>
        ) : (
          <span className="text-[color:var(--fl-muted)]">{era ? "Every era, legends" : "2026 squads"}</span>
        )}
      </span>
      <span
        aria-hidden
        className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-control bg-theme-primary font-cond text-[19px] font-bold text-[color:var(--theme-text-on-primary)] transition group-hover:brightness-110"
      >
        {verb}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 4.5v15l13-7.5z" />
        </svg>
      </span>
    </Link>
  );
}

export function HomeModeSelector() {
  const [hub, setHub] = useState<HubState | null>(null);
  const [bonus, setBonus] = useState<{ payout: ClubFundsPayoutResult; day: number } | null>(null);
  const [untilReset, setUntilReset] = useState<string | null>(null);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const missions = useDailyMissions();
  useEffect(() => {
    try {
      // Daily welcome bonus: once per UK day, grows with consecutive days.
      const claimed = claimDailyBonus();
      if (claimed) setBonus(claimed);
    } catch {
      /* storage blocked: no bonus today, the hub still shows */
    }
    try {
      setHub(readHub());
    } catch {
      setHub(null);
    }
    const tick = () => setUntilReset(formatCountdown(msUntilUkMidnight()));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Last week's Weekly finish (top 10 pays once; see storage/weekly-leaderboard.ts). Also
  // retries sending this week's ranked entry if an earlier send didn't land.
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [lastWeek, setLastWeek] = useState<WeeklyLastWeekResult | null>(null);
  useEffect(() => {
    if (!SHOW_DAILY_CHALLENGE_UI || authLoading || !isLoggedIn) return;
    let alive = true;
    let ran = false;
    // Wait for the account's cloud ledger to merge first, so a top-10 prize already paid on
    // another device is seen as paid here.
    const run = () => {
      if (ran || !alive || !isCloudHydrated()) return;
      ran = true;
      void flushWeeklyChallengeEntry();
      void checkWeeklyLastWeekFinish()
        .then((result) => {
          if (alive) setLastWeek(result);
        })
        .catch(() => {
          /* board unreachable: try again next visit */
        });
    };
    run();
    window.addEventListener("auth-state-changed", run);
    return () => {
      alive = false;
      window.removeEventListener("auth-state-changed", run);
    };
  }, [authLoading, isLoggedIn]);

  const cosmetics = useCosmetics();
  const ownsBallKnower = cosmetics.owned.includes(BALL_KNOWER_ID);
  const daily = hub?.daily ?? null;
  const weekly = hub?.weekly ?? null;
  const firstRun = hub?.firstRun === true;
  const streak = daily?.streak ?? 0;

  const weeklyHref = weekly ? getWeeklyChallengeHref() : "/play?weekly=1";
  const weeklyStatus = lastWeek
    ? `${formatOrdinal(lastWeek.rank)} last week`
    : weekly?.score != null
      ? `Score ${weekly.score}`
      : weekly?.used
        ? "Practice"
        : `Top 10 +${formatClubFunds(WEEKLY_TOP10_REWARD)}`;
  const weeklyTag = weekly?.scenario.theme ? `${weekly.scenario.theme.event} week` : weekly?.scenario.eraMode ? "Weekly · Era" : "Weekly";

  const missionsDone = missions ? missions.missions.filter((m) => m.complete).length : 0;
  const missionsLeft = missions ? missionsLeftToEarn(missions) : 0;

  const startClassic = (era: boolean) => () => {
    setNormalEraVariant(era);
    playModeClassicStart("NORMAL");
  };

  return (
    <section className="mx-auto flex w-full max-w-[44rem] flex-col gap-3" aria-labelledby="play-heading">
      {/* Top strip: greeting, then the streak and Club Funds as chips on the same line. */}
      <div className="flex min-h-11 items-center gap-2">
        <h2 id="play-heading" className="min-w-0 flex-1 truncate !text-left font-cond text-[24px] font-bold leading-none text-white">
          {hub?.greeting ?? "Welcome, coach"}
        </h2>
        {streak > 0 ? (
          <span
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-pitch-900 px-3 font-display text-[16px] leading-none text-white"
            aria-label={`${streak}-day Daily streak`}
            title={`${streak}-day Daily streak`}
          >
            <span aria-hidden>🔥</span>
            {streak}
          </span>
        ) : null}
        {hub ? (
          <Link
            href="/store"
            onClick={() => playUiClick()}
            aria-label={`Club Funds ${formatClubFunds(hub.funds)}${bonus ? `, plus ${formatClubFunds(bonus.payout.total)} day ${bonus.day} bonus` : ""}. Open the Store`}
            className={`relative -my-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-pitch-900 pl-2 pr-3.5 font-display text-[16px] leading-none text-theme-primary hover:bg-pitch-800 ${FOCUS}`}
          >
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-theme-primary/15">
              <Glyph size={17}>
                <CoinGlyph />
              </Glyph>
            </span>
            {formatClubFunds(hub.funds)}
            {bonus ? (
              <span
                aria-hidden
                className="absolute -right-1 -top-2 rounded-full bg-accent-gold px-1.5 py-0.5 font-cond text-[11px] font-bold leading-none text-pitch-950"
              >
                +{formatClubFunds(bonus.payout.total)}
              </span>
            ) : null}
          </Link>
        ) : null}
      </div>
      {bonus ? (
        <span className="sr-only" role="status">
          Day {bonus.day} bonus: +{formatClubFunds(bonus.payout.total)} Club Funds
        </span>
      ) : null}

      {/* The main event: Classic and Era Classic side by side on the pitch-green hero. */}
      <section
        className="relative overflow-hidden rounded-card bg-theme-primary p-3 text-[color:var(--theme-text-on-primary)]"
        aria-label={firstRun ? "New here? Start with Classic" : "Classic modes"}
      >
        <PitchMarkings tone="black" opacity={0.09} />
        <div className="relative px-1.5 pb-3 pt-1.5 text-left">
          <p className="font-display text-[32px] leading-[1]">
            {firstRun ? (
              <>
                Sign a 13.
                <br />
                Win all 27.
              </>
            ) : (
              "Chase 27-0"
            )}
          </p>
          {!firstRun ? (
            <p className="mt-1 text-[14px] font-semibold opacity-75">Pick a 13. Go unbeaten over 27 games.</p>
          ) : null}
        </div>
        <div className="relative grid grid-cols-2 gap-2.5">
          <ClassicPanel era={false} best={hub?.classicBest ?? null} verb={firstRun ? "Start" : "Play"} onClick={startClassic(false)} />
          <ClassicPanel era best={hub?.eraBest ?? null} verb={firstRun ? "Start" : "Play"} onClick={startClassic(true)} />
        </div>
      </section>

      {/* Manager Mode: second headline act, in the manager's club colours on a tactics board. */}
      <Link
        href="/manager"
        onClick={() => playUiClick()}
        aria-label={hub?.career ? `Manager Mode: resume ${hub.career.club}, ${hub.career.detail}` : "Manager Mode: start a career"}
        className="btn-press fl-pressable group relative flex min-h-[132px] items-center gap-4 overflow-hidden rounded-card border border-white/10 bg-[#1c2a24] p-4 text-left text-white transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        style={hub?.career ? { background: `linear-gradient(110deg, #17201c 35%, color-mix(in srgb, ${hub.career.primary} 38%, #17201c))` } : undefined}
      >
        <ChalkPlay />
        {hub?.career ? (
          <Crest primary={hub.career.primary} secondary={hub.career.secondary} label={hub.career.short.slice(0, 3).toUpperCase()} />
        ) : (
          <span aria-hidden className="relative flex h-[64px] w-[56px] shrink-0 items-center justify-center text-white">
            <svg width="56" height="64" viewBox="0 0 56 64" className="absolute inset-0">
              <path d="M4 6 28 2l24 4v24c0 16-10 26-24 32C14 56 4 46 4 30z" fill="rgba(255,255,255,0.08)" stroke="white" strokeOpacity="0.5" strokeWidth="2.5" strokeDasharray="5 4" />
            </svg>
            <Glyph size={24}>
              <BoardGlyph />
            </Glyph>
          </span>
        )}
        <span className="relative flex min-w-0 flex-1 flex-col">
          <span className="font-cond text-[14px] font-bold text-white/70">Manager Mode</span>
          <span className="mt-0.5 block truncate font-display text-[26px] leading-[1.05]">
            {hub?.career ? hub.career.club : "Run a real club"}
          </span>
          <span className="mt-1 block truncate text-[13px] font-semibold text-white/70">
            {hub?.career ? hub.career.detail : "Go up. Win the Grand Final."}
          </span>
          <span
            aria-hidden
            className="mt-3 inline-flex h-10 w-max items-center gap-1.5 rounded-control bg-white px-4 font-cond text-[16px] font-bold text-pitch-950 transition group-hover:bg-white/90"
          >
            {hub?.career ? "Resume" : "Start a career"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
        </span>
      </Link>

      {/* Today: the Daily, the Weekly and missions, compact and secondary. */}
      {SHOW_DAILY_CHALLENGE_UI || missions ? (
        <section aria-labelledby="today-heading" className="mt-2 flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 id="today-heading" className="!text-left font-cond text-[18px] font-bold text-white">
              Today
            </h3>
            {untilReset ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums text-[color:var(--fl-muted)]">
                <span className="sr-only">{daily?.used || daily?.done ? "Next Daily in" : "Resets in"}</span>
                <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {untilReset}
              </span>
            ) : null}
          </div>

          {SHOW_DAILY_CHALLENGE_UI ? (
            <div className="flex items-stretch gap-2" role="group" aria-label="Daily Challenge">
              <Link
                href={getDailyChallengeHref()}
                onClick={() => playUiClick()}
                aria-label={`${daily?.done ? "Play again for practice" : daily?.used ? "Practice today's Daily" : "Play today's Daily"}: ${daily?.scenario.ruleTitle ?? "today's rule"}`}
                className={`btn-press fl-pressable flex min-h-[64px] min-w-0 flex-1 items-center gap-3 rounded-tile bg-pitch-900 p-2.5 pl-3 text-left hover:bg-pitch-800 ${FOCUS}`}
              >
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-theme-primary/10 text-theme-primary">
                  <Glyph size={20}>
                    <FixtureGlyph />
                  </Glyph>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-theme-primary">
                    Daily{daily?.scenario.eraMode ? " · Era" : ""}
                    {daily?.done ? <span className="text-[color:var(--fl-muted)]">· Done ✓</span> : daily?.used ? <span className="text-[color:var(--fl-muted)]">· Played</span> : null}
                  </span>
                  <span className="block truncate font-cond text-[18px] font-bold leading-tight text-white">
                    {daily?.scenario.ruleTitle ?? "Today's rule"}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex h-9 shrink-0 items-center rounded-full border border-theme-primary/40 px-3.5 font-cond text-[15px] font-bold text-theme-primary"
                >
                  {daily?.done || daily?.used ? "Practice" : "Play"}
                </span>
              </Link>
              <Link
                href={DAILY_ARCHIVE_PAGE}
                onClick={() => playUiClick()}
                aria-label="Past Dailies"
                title="Past Dailies"
                className={`btn-press fl-pressable flex w-12 shrink-0 items-center justify-center rounded-tile bg-pitch-900 text-[color:var(--fl-muted)] hover:bg-pitch-800 hover:text-white ${FOCUS}`}
              >
                <Glyph size={20}>
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v4.5h4.5M12 7.5V12l3 2" />
                </Glyph>
              </Link>
            </div>
          ) : null}
      {/* Weekly + missions: two compact tiles side by side; missions open into a list. */}
      {SHOW_DAILY_CHALLENGE_UI || missions ? (
        <div className="grid grid-cols-2 gap-2">
          {SHOW_DAILY_CHALLENGE_UI ? (
            <div className="relative min-w-0 rounded-tile bg-pitch-900">
              <Link
                href={weeklyHref}
                onClick={() => playUiClick()}
                aria-label={`Weekly Challenge: ${weekly?.scenario.ruleTitle ?? "this week's rule"}. ${weeklyStatus}${weekly ? `, ${weekly.resetsIn} left` : ""}`}
                className={`btn-press fl-pressable flex h-full min-h-[72px] flex-col justify-between gap-2 rounded-tile p-3 pr-12 text-left hover:bg-pitch-800 ${FOCUS}`}
              >
                <span className="flex items-center gap-1.5 font-cond text-[14px] font-bold text-accent-gold">
                  <Glyph size={16}>
                    <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4.5a2.5 2.5 0 0 0 3 3.6M17 6h2.5a2.5 2.5 0 0 1-3 3.6M12 14v3M8.5 21h7M9.5 17h5l.5 4h-6z" />
                  </Glyph>
                  <span className="truncate">{weeklyTag}</span>
                </span>
                <span className="block truncate font-cond text-[18px] font-bold leading-tight text-white">
                  {weekly?.scenario.ruleTitle ?? "This week's rule"}
                </span>
                <span className="block truncate text-[12px] font-semibold text-[color:var(--fl-muted)]">
                  {weeklyStatus}
                  {weekly ? ` · ${weekly.resetsIn}` : ""}
                </span>
              </Link>
              <Link
                href="/leaderboard?tracker=weekly"
                onClick={() => playUiClick()}
                aria-label="Weekly board"
                title="Weekly board"
                className={`group/board absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-accent-gold ${FOCUS}`}
              >
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold/10 transition group-hover/board:bg-accent-gold/20">
                <Glyph size={17}>
                  <path d="M3.5 20.5h17M5 20.5V14h4.5v6.5M9.5 20.5V9.5h5v11M14.5 20.5v-8.5H19v8.5" />
                </Glyph>
                </span>
              </Link>
            </div>
          ) : null}
          {missions ? (
            <button
              type="button"
              onClick={() => {
                playUiClick();
                setMissionsOpen((o) => !o);
              }}
              aria-expanded={missionsOpen}
              aria-controls="home-missions"
              aria-label={`Today's missions: ${missionsDone} of ${missions.missions.length} done${missionsLeft > 0 ? `, ${formatClubFunds(missionsLeft)} to earn` : ""}`}
              className={`btn-press fl-pressable flex min-h-[72px] min-w-0 items-center gap-3 rounded-tile p-3 text-left transition ${
                missionsOpen ? "bg-pitch-800" : "bg-pitch-900 hover:bg-pitch-800"
              } ${SHOW_DAILY_CHALLENGE_UI ? "" : "col-span-2"} ${FOCUS}`}
            >
              <MissionsRing view={missions} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-cond text-[18px] font-bold leading-none text-white">Missions</span>
                <span className="truncate font-cond text-[15px] font-bold leading-none text-theme-primary">
                  {missionsLeft > 0 ? `+${formatClubFunds(missionsLeft)}` : "All done"}
                </span>
              </span>
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`shrink-0 text-[color:var(--fl-muted)] transition-transform ${missionsOpen ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
          {missions && missionsOpen ? <MissionsList view={missions} id="home-missions" resetIn={untilReset} /> : null}
        </section>
      ) : null}

      {/* Smaller games. */}
      <nav aria-label="More games" className="grid grid-cols-6 gap-3">
        <ModeTile
          wide
          href="/mini-games"
          label="Puzzles"
          icon={<TilesGlyph />}
          tint="bg-accent-gold/10 text-accent-gold"
          badge={hub && !hub.wordleDone ? <Badge plain tone="gold">Wordle waiting</Badge> : <Badge plain>Quiz &amp; Grid</Badge>}
        />
        <ModeTile
          wide
          href={MODES_PAGE}
          label="More modes"
          icon={
            <>
              <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
              <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
              <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
              <path d="M16.75 13.5v6.5M13.5 16.75H20" />
            </>
          }
          tint="bg-white/[0.06] text-white"
          badge={<Badge plain>{ownsBallKnower ? "3 to play" : "Gauntlet & more"}</Badge>}
        />
      </nav>
    </section>
  );
}
