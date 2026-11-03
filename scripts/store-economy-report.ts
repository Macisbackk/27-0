/**
 * Store economy report: typical Club Funds per day for three kinds of player, and how many days
 * each Store price tier takes. Reward amounts come straight from the game code; only the player
 * behaviour (how often they win, how far they get in the quiz) is assumed, in PROFILES below.
 *
 * Run: bun scripts/store-economy-report.ts   (bun: it stubs the Supabase client module)
 * Findings are written up in docs/store-economy.md.
 */
import { mock } from "bun:test";

mock.module("../src/lib/supabase", () => ({ isSupabaseConfigured: false, supabase: {} }));

type Profile = {
  name: string;
  /** Opens the game every day (daily welcome bonus ladder). */
  dailyBonus: boolean;
  /** Expected first-run Golden Point Quiz prize. */
  quiz: number;
  /** Chance to solve the Wordle. */
  wordleWin: number;
  /** Average Grid squares filled (of 9). */
  gridCells: number;
  /** Plays the Daily Challenge (a Classic run with the day's rule + its bonuses). */
  dailyChallenge: boolean;
  /** Extra ranked Classic / Era Classic runs per day (not counting the Daily). */
  classicRuns: number;
  /** Outcome odds for a Classic run. */
  run: RunOdds;
  /** Daily Challenge odds (the rule makes it harder). */
  dailyRun: { leagueLeaders: number; grandFinal: number };
  /** Chance each mission is completed when the player does that kind of thing. */
  missionDone: number;
  /** Weekly Challenge top-10 chance (paid once a week). */
  weeklyTop10: number;
};

type RunOdds = {
  wins: number;
  topSix: number;
  leagueLeaders: number;
  twentyWins: number;
  perfect: number;
  eliminatorWin: number;
  semiWin: number;
  grandFinalWin: number;
  grandFinalLoss: number;
};

const TYPICAL_RUN: RunOdds = { wins: 20, topSix: 0.95, leagueLeaders: 0.6, twentyWins: 0.55, perfect: 0.03, eliminatorWin: 0.2, semiWin: 0.6, grandFinalWin: 0.4, grandFinalLoss: 0.2 };
const STRONG_RUN: RunOdds = { wins: 23, topSix: 1, leagueLeaders: 0.85, twentyWins: 0.85, perfect: 0.08, eliminatorWin: 0.1, semiWin: 0.8, grandFinalWin: 0.6, grandFinalLoss: 0.2 };

const PROFILES: Profile[] = [
  {
    name: "Casual (dailies only)",
    dailyBonus: true,
    quiz: 20_000,
    wordleWin: 0.8,
    gridCells: 6.5,
    dailyChallenge: false,
    classicRuns: 0,
    run: TYPICAL_RUN,
    dailyRun: { leagueLeaders: 0, grandFinal: 0 },
    missionDone: 0.85,
    weeklyTop10: 0,
  },
  {
    name: "Regular (dailies + Daily + 2 runs)",
    dailyBonus: true,
    quiz: 30_000,
    wordleWin: 0.85,
    gridCells: 7.5,
    dailyChallenge: true,
    classicRuns: 2,
    run: TYPICAL_RUN,
    dailyRun: { leagueLeaders: 0.5, grandFinal: 0.3 },
    missionDone: 0.8,
    weeklyTop10: 0,
  },
  {
    name: "Heavy (dailies + Daily + 6 runs)",
    dailyBonus: true,
    quiz: 45_000,
    wordleWin: 0.95,
    gridCells: 8.5,
    dailyChallenge: true,
    classicRuns: 6,
    run: STRONG_RUN,
    dailyRun: { leagueLeaders: 0.7, grandFinal: 0.45 },
    missionDone: 0.95,
    weeklyTop10: 0.5,
  },
];

const fmt = (n: number) => (n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : `£${Math.round(n / 1000)}k`);

async function main() {
  const { CLUB_FUNDS_REWARDS: R, CLUB_FUNDS_STARTER_GRANT } = await import("../src/lib/club-funds");
  const { DAILY_BONUS_LADDER } = await import("../src/lib/daily-bonus");
  const { DAILY_RULE_BONUSES } = await import("../src/lib/daily-challenge");
  const { getDailyMissions, DAILY_MISSIONS_ALL_BONUS } = await import("../src/lib/daily-missions");
  const { WORDLE_WIN_REWARD, GRID_REWARD_PER_CELL } = await import("../src/lib/mini-games/reward-amounts");
  const { QUIZ_TOP_PRIZE } = await import("../src/lib/quiz/prizes");
  const { WEEKLY_TOP10_REWARD } = await import("../src/lib/weekly-challenge");
  const { LOGIN_WELCOME_AMOUNT } = await import("../src/lib/storage/login-welcome");
  const { COSMETICS } = await import("../src/lib/cosmetics");
  const { STYLE_UI_THEMES, uiThemePrice } = await import("../src/lib/ui-themes");

  const runValue = (o: RunOdds) =>
    R.seasonComplete +
    o.wins * R.regularSeasonWin +
    o.topSix * R.topSixFinish +
    o.leagueLeaders * R.leagueLeaders +
    o.twentyWins * R.twentyWins +
    o.perfect * R.perfectSeason +
    o.eliminatorWin * R.playoffEliminatorWin +
    o.semiWin * R.playoffSemiFinalWin +
    o.grandFinalWin * R.superLeagueTitle +
    o.grandFinalLoss * R.playoffFinalRunnerUp;

  // Daily rule bonuses: the Daily rules (not the Weekly themes) average.
  const rules = Object.values(DAILY_RULE_BONUSES);
  const avgLL = rules.reduce((s, r) => s + r.leagueLeadersBonus, 0) / rules.length;
  const avgGF = rules.reduce((s, r) => s + r.playoffTitleBonus, 0) / rules.length;

  // Missions: sample a year of real mission days.
  const days: string[] = [];
  for (let i = 0; i < 365; i++) days.push(new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
  const missionDays = days.map((d) => getDailyMissions(d));
  const missionValue = (p: Profile) => {
    let total = 0;
    for (const ms of missionDays) {
      // Casual players only finish puzzle missions (Wordle / Grid); runs need a Classic season.
      const doable = ms.filter((m) => p.classicRuns > 0 || p.dailyChallenge || m.category === "puzzle");
      total += doable.reduce((s, m) => s + m.reward * p.missionDone, 0);
      if (doable.length === ms.length) total += DAILY_MISSIONS_ALL_BONUS * p.missionDone ** ms.length;
    }
    return total / missionDays.length;
  };

  const perDay = (p: Profile) => {
    const lines: Record<string, number> = {
      quiz: Math.min(QUIZ_TOP_PRIZE, p.quiz),
      wordle: p.wordleWin * WORDLE_WIN_REWARD,
      grid: p.gridCells * GRID_REWARD_PER_CELL,
      missions: missionValue(p),
      daily: p.dailyChallenge ? runValue(p.run) * 0.8 + p.dailyRun.leagueLeaders * avgLL + p.dailyRun.grandFinal * avgGF : 0,
      runs: p.classicRuns * runValue(p.run),
      weekly: (p.weeklyTop10 * WEEKLY_TOP10_REWARD) / 7,
    };
    return lines;
  };

  const bonusOn = (day: number) => DAILY_BONUS_LADDER[Math.min(DAILY_BONUS_LADDER.length - 1, day - 1)]!;
  const start = CLUB_FUNDS_STARTER_GRANT + LOGIN_WELCOME_AMOUNT;
  /** First day the running total reaches `price` (0 = affordable from the starting grant). */
  const daysTo = (p: Profile, price: number) => {
    const rest = Object.values(perDay(p)).reduce((s, v) => s + v, 0);
    let bal = start;
    if (bal >= price) return 0;
    for (let d = 1; d < 5000; d++) {
      bal += rest + (p.dailyBonus ? bonusOn(d) : 0);
      if (bal >= price) return d;
    }
    return Infinity;
  };

  console.log(`Typical Classic run: ${fmt(runValue(TYPICAL_RUN))} · strong run: ${fmt(runValue(STRONG_RUN))}`);
  console.log(`Daily rule bonus average: League Leaders ${fmt(avgLL)}, Grand Final ${fmt(avgGF)}`);
  console.log(`Start balance: ${fmt(start)} (starter grant + login welcome)\n`);

  console.log("| Player | Quiz | Wordle | Grid | Missions | Daily + runs | Bonus (day 7+) | Per day |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const p of PROFILES) {
    const l = perDay(p);
    const total = Object.values(l).reduce((s, v) => s + v, 0) + DAILY_BONUS_LADDER[DAILY_BONUS_LADDER.length - 1]!;
    console.log(`| ${p.name} | ${fmt(l.quiz)} | ${fmt(l.wordle)} | ${fmt(l.grid)} | ${fmt(l.missions)} | ${fmt(l.daily + l.runs + l.weekly)} | ${fmt(DAILY_BONUS_LADDER[6]!)} | **${fmt(total)}** |`);
  }

  // Price tiers: every distinct price in the Store (cosmetics + themes).
  const forSale = [
    ...COSMETICS.filter((c) => !c.notForSale).map((c) => ({ name: c.name, price: c.price })),
    ...STYLE_UI_THEMES.map((t) => ({ name: `${t.label} theme`, price: uiThemePrice(t.id) })),
  ];
  const tiers: [string, number, number][] = [
    ["Starter", 0, 199_999],
    ["Cheap", 200_000, 999_999],
    ["Mid", 1_000_000, 2_999_999],
    ["Premium", 3_000_000, 9_999_999],
    ["Top", 10_000_000, Infinity],
  ];
  console.log("\n| Tier | Items | Price range | Casual | Regular | Heavy |");
  console.log("|---|---|---|---|---|---|");
  for (const [label, lo, hi] of tiers) {
    const items = forSale.filter((i) => i.price >= lo && i.price <= hi);
    if (!items.length) continue;
    const min = Math.min(...items.map((i) => i.price));
    const max = Math.max(...items.map((i) => i.price));
    const cell = (p: Profile) => {
      const a = daysTo(p, min);
      const b = daysTo(p, max);
      return a === b ? `${a}d` : `${a}–${b}d`;
    };
    console.log(`| ${label} | ${items.length} | ${fmt(min)}–${fmt(max)} | ${PROFILES.map(cell).join(" | ")} |`);
  }
  const everything = forSale.reduce((s, i) => s + i.price, 0);
  console.log(`| Everything | ${forSale.length} | ${fmt(everything)} total | ${PROFILES.map((p) => `${daysTo(p, everything)}d`).join(" | ")} |`);
  const themes = forSale.filter((i) => i.name.endsWith(" theme"));
  console.log(`\nThemes: ${themes.map((t) => `${t.name.replace(/ theme$/, "")} ${fmt(t.price)}`).join(", ")}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
