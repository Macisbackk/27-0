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
import { SHOW_DAILY_CHALLENGE_UI, SHOW_WEEKLY_CHALLENGE_UI } from "@/lib/feature-flags";
import { buildPlayHref } from "@/lib/play-links";
import { getNormalEraVariant, setNormalEraVariant } from "@/lib/storage/preferences";
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
import { PitchHero } from "@/components/ui/PitchHero";
import { loadRunResume } from "@/lib/game/run-resume";
import { TOTAL_SLOTS } from "@/lib/positions";

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
  career: { club: string; short: string; primary: string; secondary: string; detail: string; next: string } | null;
  classicBest: string | null;
  eraBest: string | null;
  wordleDone: boolean;
  /** Players signed in a half-built Classic / Era Classic run on this device (null: none). */
  resume: { classic: number | null; era: number | null };
  /** No Classic / Era Classic run and no Manager career on this device yet. */
  firstRun: boolean;
}

function greeting(hour: number): string {
  if (hour < 5) return "Late one, coach";
  if (hour < 12) return "Morning, coach";
  if (hour < 18) return "Afternoon, coach";
  return "Evening, coach";
}

/**
 * Where the career is, for the Resume card: "Round 12 · 3rd", "Pre-season", "Summer window".
 * Kept inline (no engine import) so the home page stays light.
 */
function careerNextLine(s: NonNullable<ReturnType<typeof loadLocalCareer>>): string {
  if (s.phase === "review") return "Season review";
  if (s.phase === "departures" || s.phase === "transfers") return "Summer window";
  if (s.matchdayIndex === 0 && !(s.preseason?.year === s.year && s.preseason.done)) return "Pre-season";
  const md = s.calendar[s.matchdayIndex];
  const rows = [...(s.tables[s.clubs[s.userClubId]!.division] ?? [])].sort(
    (a, b) => b.pts - a.pts || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf || a.clubId.localeCompare(b.clubId)
  );
  const i = rows.findIndex((r) => r.clubId === s.userClubId);
  const n = i + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  const pos = i >= 0 && (rows[i]?.p ?? 0) > 0 ? ` · ${n}${suffix}` : "";
  return `${md?.label ?? "Season"}${pos}`;
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
        next: careerNextLine(s),
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
  const signed = (key: "classic" | "era") => {
    const snap = loadRunResume(key);
    return snap ? snap.squad.filter((slot) => slot.player).length : null;
  };
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
    weekly: SHOW_DAILY_CHALLENGE_UI && SHOW_WEEKLY_CHALLENGE_UI
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
    resume: { classic: signed("classic"), era: signed("era") },
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

/** A plain shield in the club's colours with its short name: Manager Mode's crest. */
function Crest({ primary, secondary, label }: { primary: string; secondary: string; label: string }) {
  return (
    <span aria-hidden className="relative flex h-[40px] w-[35px] shrink-0 items-center justify-center">
      <svg width="35" height="40" viewBox="0 0 56 64" className="absolute inset-0">
        <path d="M4 6 28 2l24 4v24c0 16-10 26-24 32C14 56 4 46 4 30z" fill={primary} stroke={secondary} strokeWidth="3" />
        <path d="M4 26h48" stroke={secondary} strokeOpacity="0.55" strokeWidth="3" />
      </svg>
      <span className="relative mt-0.5 font-display text-[10px] leading-none" style={{ color: secondary }}>
        {label}
      </span>
    </span>
  );
}

export function HomeModeSelector() {
  const [hub, setHub] = useState<HubState | null>(null);
  const [untilReset, setUntilReset] = useState<string | null>(null);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [era, setEra] = useState(false);
  const missions = useDailyMissions();
  useEffect(() => {
    try {
      // Daily welcome bonus: once per UK day, grows with consecutive days. It's paid straight into
      // Club Funds; the chip just shows the new balance (no "+" badge, owner v1.39).
      claimDailyBonus();
    } catch {
      /* storage blocked: no bonus today, the hub still shows */
    }
    try {
      setEra(getNormalEraVariant());
    } catch {
      /* storage blocked: Current squads */
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
    // Still runs with the Weekly hidden, so a top-10 prize already earned is paid out.
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

  const best = era ? (hub?.eraBest ?? null) : (hub?.classicBest ?? null);
  const resumeSigned = (era ? hub?.resume.era : hub?.resume.classic) ?? null;
  const startClassic = (eraMode: boolean) => () => {
    setNormalEraVariant(eraMode);
    playModeClassicStart("NORMAL");
  };

  return (
    <section className="mx-auto flex w-full max-w-[44rem] flex-col gap-3" aria-labelledby="play-heading">
      {/* Top strip: greeting, then the streak and Club Funds as chips on the same line. */}
      <div className="flex min-h-11 items-center gap-2">
        <h2 id="play-heading" className="min-w-0 flex-1 truncate py-1 !text-left font-cond text-[24px] font-bold leading-tight text-white">
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
            aria-label={`Club Funds ${formatClubFunds(hub.funds)}. Open the Store`}
            className={`relative -my-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-pitch-900 pl-2 pr-3.5 font-display text-[16px] leading-none text-theme-primary hover:bg-pitch-800 ${FOCUS}`}
          >
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-theme-primary/15">
              <Glyph size={17}>
                <CoinGlyph />
              </Glyph>
            </span>
            {formatClubFunds(hub.funds)}
          </Link>
        ) : null}
      </div>

      {/* The main event: Classic, with a Current / Era switch and one Play button.
          This card is the pitch look the whole site shares (src/styles/pitch.css). */}
      <PitchHero
        size="feature"
        aria-label={firstRun ? "New here? Start with Classic" : "Classic"}
        icon={era ? <ProgrammeGlyph /> : <BallGlyph />}
        eyebrow="Classic"
        badge={resumeSigned != null ? "Run in progress" : best ? `Best ${best}` : undefined}
        titleAs="p"
        title={
          firstRun ? (
            <>
              Sign a 13.
              <br />
              Win all 27.
            </>
          ) : (
            "Chase 27-0"
          )
        }
      >
        <div role="group" aria-label="Squads" className="pitch-seg">
          {([false, true] as const).map((v) => {
            const on = era === v;
            return (
              <button
                key={String(v)}
                type="button"
                aria-pressed={on}
                data-tone={v ? "era" : undefined}
                onClick={() => {
                  playUiClick();
                  setEra(v);
                  try {
                    setNormalEraVariant(v);
                  } catch {
                    /* storage blocked: the choice still applies to this visit */
                  }
                }}
              >
                <Glyph size={16}>{v ? <ProgrammeGlyph /> : <BallGlyph />}</Glyph>
                {v ? "Every era" : "2026 squads"}
              </button>
            );
          })}
        </div>
        <Link
          href={buildPlayHref("classic", era)}
          onClick={() => {
            playUiClick();
            startClassic(era)();
          }}
          className="pitch-cta btn-press fl-pressable"
        >
          {resumeSigned != null
            ? `Resume run · ${resumeSigned}/${TOTAL_SLOTS}`
            : firstRun
              ? "Start Classic"
              : era
                ? "Play Era Classic"
                : "Play Classic"}
        </Link>
      </PitchHero>

      {/* Manager Mode: the second mode, a proper card straight under the Classic hero (bigger
          than the Today tiles, still plain so Classic stays the one coloured card). */}
      <Link
        href="/manager"
        onClick={() => playUiClick()}
        aria-label={hub?.career ? `Manager Mode: resume ${hub.career.club}, ${hub.career.detail}` : "Manager Mode: start a career"}
        className={`btn-press fl-pressable flex min-h-[84px] items-center gap-3.5 rounded-card bg-pitch-900 px-4 py-3.5 text-left text-white transition hover:bg-pitch-800 ${FOCUS}`}
      >
        {hub?.career ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-white/[0.06]">
            <Crest primary={hub.career.primary} secondary={hub.career.secondary} label={hub.career.short.slice(0, 3).toUpperCase()} />
          </span>
        ) : (
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-theme-primary/10 text-theme-primary">
            <Glyph size={24}>
              <BoardGlyph />
            </Glyph>
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-cond text-[21px] font-bold leading-tight">Manager Mode</span>
          <span className="truncate text-[13px] text-[color:var(--fl-muted)]">
            {hub?.career ? `${hub.career.club} · ${hub.career.next}` : "Run a real club."}
          </span>
        </span>
        <span
          aria-hidden
          className="flex h-10 shrink-0 items-center rounded-full bg-white px-4 font-cond text-[16px] font-bold text-[#0a0f0d]"
        >
          {hub?.career ? "Resume" : "Start"}
        </span>
      </Link>

      {/* Today: the Daily, the Weekly and missions, compact and secondary. */}
      {SHOW_DAILY_CHALLENGE_UI || missions ? (
        <section aria-labelledby="today-heading" className="mt-1 flex flex-col gap-2">
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
      {SHOW_WEEKLY_CHALLENGE_UI || missions ? (
        <div className={SHOW_WEEKLY_CHALLENGE_UI ? "grid grid-cols-1 gap-2 min-[360px]:grid-cols-2" : "flex flex-col"}>
          {SHOW_WEEKLY_CHALLENGE_UI && SHOW_DAILY_CHALLENGE_UI ? (
            <div className="relative min-w-0 rounded-tile bg-pitch-900">
              <Link
                href={weeklyHref}
                onClick={() => playUiClick()}
                aria-label={`Weekly Challenge: ${weekly?.scenario.ruleTitle ?? "this week's rule"}. ${weeklyStatus}${weekly ? `, ${weekly.resetsIn} left` : ""}`}
                className={`btn-press fl-pressable flex h-full min-h-[72px] flex-col justify-center gap-1 rounded-tile p-3 pr-12 text-left hover:bg-pitch-800 ${FOCUS}`}
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
              } ${FOCUS}`}
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
      <nav aria-label="More games" className="grid grid-cols-3 gap-2 min-[360px]:grid-cols-6 min-[360px]:gap-3">
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
