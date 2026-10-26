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
  career: { club: string } | null;
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
    if (s && club) career = { club: club.name };
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

/** Mown stripes and pitch markings behind the Daily card. */
function PitchMarkings() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 220">
      {Array.from({ length: 10 }, (_, i) => (i % 2 ? <rect key={i} x={i * 40} y="0" width="40" height="220" fill="white" fillOpacity="0.022" /> : null))}
      <g stroke="white" strokeOpacity="0.07" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke">
        <line x1="280" y1="0" x2="280" y2="220" vectorEffect="non-scaling-stroke" />
        <line x1="360" y1="0" x2="360" y2="220" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
        <line x1="200" y1="0" x2="200" y2="220" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
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
        <h2 id="play-heading" className="min-w-0 flex-1 truncate text-left font-cond text-[24px] font-bold leading-none text-white">
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

      {/* New players: one line and one button before anything else. */}
      {firstRun ? (
        <section
          className="relative overflow-hidden rounded-card bg-theme-primary px-4 pb-4 pt-5 text-[color:var(--theme-text-on-primary)]"
          aria-label="New here? Start with Classic"
        >
          <p className="relative font-display text-[30px] leading-[1.02]">
            Sign a 13.
            <br />
            Win all 27.
          </p>
          <Link
            href={buildPlayHref("classic", false)}
            onClick={() => {
              playUiClick();
              startClassic(false)();
            }}
            className="btn-press fl-pressable relative mt-4 flex h-[54px] items-center justify-center gap-2 rounded-control bg-pitch-950 font-cond text-[20px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span className="text-theme-primary">
              <Glyph size={22}>
                <BallGlyph />
              </Glyph>
            </span>
            Start Classic
          </Link>
        </section>
      ) : null}

      {/* Today: the Daily rule is the headline, one button plays it. */}
      {SHOW_DAILY_CHALLENGE_UI ? (
        <section className="relative overflow-hidden rounded-card bg-pitch-900" aria-label="Daily Challenge">
          <PitchMarkings />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-theme-primary/[0.07] blur-2xl" />
          <div className="relative p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-cond text-[15px] font-bold text-theme-primary">
                <Glyph size={18}>
                  <FixtureGlyph />
                </Glyph>
                Daily{daily?.scenario.eraMode ? " · Era" : ""}
              </span>
              {daily?.done ? (
                <span className="rounded-full bg-theme-primary/15 px-2 py-0.5 text-[11px] font-bold text-theme-primary">Done ✓</span>
              ) : daily?.used ? (
                <span className="rounded-full bg-pitch-800 px-2 py-0.5 text-[11px] font-bold text-[color:var(--fl-muted)]">Played</span>
              ) : null}
              {untilReset ? (
                <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums text-[color:var(--fl-muted)]">
                  <span className="sr-only">{daily?.used || daily?.done ? "Next Daily in" : "Resets in"}</span>
                  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {untilReset}
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-[38px] leading-[0.98] text-white [overflow-wrap:anywhere]">
              {daily?.scenario.ruleTitle ?? "Today's rule"}
            </p>
            <p className="mt-2 line-clamp-1 text-[14px] text-[color:var(--fl-muted)]">
              {daily?.scenario.ruleSummary ?? "A new twist every day."}
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href={getDailyChallengeHref()}
                onClick={() => playUiClick()}
                className={`btn-press fl-pressable flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-control font-cond text-[18px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  firstRun ? "bg-pitch-700 text-white" : "bg-theme-primary text-[color:var(--theme-text-on-primary)]"
                }`}
              >
                {daily?.done ? "Play again for practice" : daily?.used ? "Practice today's Daily" : "Play today's Daily"}
              </Link>
              <Link
                href={DAILY_ARCHIVE_PAGE}
                onClick={() => playUiClick()}
                aria-label="Past Dailies"
                title="Past Dailies"
                className={`btn-press fl-pressable flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-control bg-pitch-800 text-white hover:bg-pitch-700 ${FOCUS}`}
              >
                <Glyph size={22}>
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v4.5h4.5M12 7.5V12l3 2" />
                </Glyph>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Weekly + missions: two compact tiles side by side; missions open into a list. */}
      {SHOW_DAILY_CHALLENGE_UI || missions ? (
        <div className="grid grid-cols-2 gap-3">
          {SHOW_DAILY_CHALLENGE_UI ? (
            <div className="relative min-w-0 rounded-tile bg-pitch-900">
              <Link
                href={weeklyHref}
                onClick={() => playUiClick()}
                aria-label={`Weekly Challenge: ${weekly?.scenario.ruleTitle ?? "this week's rule"}. ${weeklyStatus}${weekly ? `, ${weekly.resetsIn} left` : ""}`}
                className={`btn-press fl-pressable flex h-full min-h-[96px] flex-col justify-between gap-2 rounded-tile p-3 pr-12 text-left hover:bg-pitch-800 ${FOCUS}`}
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
                className={`absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-control text-accent-gold hover:bg-pitch-800 ${FOCUS}`}
              >
                <Glyph size={18}>
                  <path d="M3.5 20.5h17M5 20.5V14h4.5v6.5M9.5 20.5V9.5h5v11M14.5 20.5v-8.5H19v8.5" />
                </Glyph>
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
              className={`btn-press fl-pressable flex min-h-[96px] min-w-0 items-center gap-3 rounded-tile p-3 text-left transition ${
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

      {/* Modes: the three big games on top, puzzles and side modes below. */}
      <nav aria-label="Game modes" className="grid grid-cols-6 gap-3">
        <ModeTile
          href={buildPlayHref("classic", false)}
          label="Classic"
          icon={<BallGlyph />}
          tint="bg-mode-current/10 text-mode-current"
          onClick={startClassic(false)}
          badge={hub?.classicBest ? <Badge tone="primary">Best {hub.classicBest}</Badge> : <Badge>2026 squads</Badge>}
        />
        <ModeTile
          href={buildPlayHref("classic", true)}
          label="Era Classic"
          icon={<ProgrammeGlyph />}
          tint="bg-mode-era/10 text-mode-era"
          onClick={startClassic(true)}
          badge={hub?.eraBest ? <Badge tone="primary">Best {hub.eraBest}</Badge> : <Badge>Legends</Badge>}
        />
        <ModeTile
          href="/manager"
          label="Manager"
          ariaLabel={hub?.career ? `Manager Mode: resume with ${hub.career.club}` : "Manager Mode"}
          icon={<BoardGlyph />}
          tint="bg-theme-primary/10 text-theme-primary"
          badge={hub?.career ? <Badge tone="primary">Resume</Badge> : <Badge>New club</Badge>}
        />
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
