import {
  buildChallengeScenario,
  type DailyChallengeRule,
  type DailyChallengeScenario,
} from "./daily-challenge";

/**
 * Rugby league calendar weeks for the Weekly Challenge. When one of these events falls in a UK
 * week (Monday–Sunday), that week's Weekly plays the themed rule instead of the usual rotation
 * (lib/weekly-challenge.ts) — still one rule and one seed for everyone all week, and still never
 * the same rule as any of that week's Dailies (themes use rule types the Daily never plays).
 *
 * Dates (checked 26 Oct 2026):
 *  - World Cup final, Sun 15 Nov 2026, Suncorp Stadium — 2026 RLWC schedule:
 *    https://www.loverugbyleague.com/post/2026-rugby-league-world-cup-schedule-revealed-in-full
 *  - Boxing Day Festive Challenge (Leeds v Wakefield) — a tradition, not yet fixtured for 2026/27:
 *    https://en.wikipedia.org/wiki/Festive_Challenge  (APPROXIMATE: 26 Dec)
 *  - Season launch 2027 — fixtures not yet published; 2026 opened Thu 12 Feb
 *    (https://www.alloutrugbyleague.co.uk/news/super-league-round-one-fixtures-1526847), so the
 *    same mid-February week is used (APPROXIMATE).
 *  - Las Vegas: Bradford v Leigh, Sat 27 Feb 2027, Allegiant Stadium —
 *    https://www.skysports.com/rugby-league/news/12196/13545829/super-league-in-las-vegas-2027-bradford-bulls-and-leigh-leopards-confirmed-as-two-clubs-in-sin-city-alongside-nrl-contests
 *  - Magic Weekend, Sat 1 – Sun 2 May 2027, Hill Dickinson Stadium (moved from July) —
 *    https://www.loverugbyleague.com/post/magic-weekend-super-league-2027-date
 *  - Challenge Cup final, Sat 5 Jun 2027, Wembley —
 *    https://footballgroundguide.com/news/date-confirmed-for-what-could-be-last-major-final-at-wembley-stadium-as-key-2027-decision-looms.html
 *  - State of Origin II, Wed 16 Jun 2027, Eden Park —
 *    https://www.nswrl.com.au/news/2026/08/18/2027-state-of-origin-date-confirmed-for-auckland-as-packages-go-on-sale-for-westpac-nsw-blues-fans/
 *    Games I and III are not announced: the usual late-May and early-July Wednesdays are used
 *    (APPROXIMATE). The player data has nationality but no NSW/QLD state, so Origin weeks are
 *    "Australians only", not Blues v Maroons.
 *  - Grand Final, Sat 2 Oct 2027, Old Trafford —
 *    https://www.superleague.co.uk/article/6703/super-league-grand-final-returns-to-old-trafford-in-2027-
 *  - Boxing Day 2027 Festive Challenge (APPROXIMATE, as above).
 * Add next season's dates here once they are published.
 */

export interface WeeklyTheme {
  id: string;
  /** The event's day (YYYY-MM-DD, UK). The theme runs the UK week that contains it. */
  date: string;
  /** Event name for the card ("Magic Weekend"). */
  event: string;
  /** True when the date is the usual slot, not a published fixture. */
  approximate: boolean;
  rule: DailyChallengeRule;
  eraMode: boolean;
  /** ≤ 18 characters. */
  ruleTitle: string;
  /** ≤ 60 characters. */
  ruleSummary: string;
}

/**
 * Themes only start from this Monday, so a week already in progress when this shipped keeps
 * the rule its players were given (the World Cup group weeks before it stay on the rotation).
 */
export const WEEKLY_THEMES_FROM = "2026-11-09";

const LEEDS_WAKEFIELD = { type: "clubs", clubs: ["Leeds Rhinos", "Wakefield Trinity"], label: "Leeds & Wakefield" } as const;

export const WEEKLY_THEMES: readonly WeeklyTheme[] = [
  {
    id: "world-cup-final-2026",
    date: "2026-11-15",
    event: "World Cup final",
    approximate: false,
    rule: { type: "internationals" },
    eraMode: false,
    ruleTitle: "World Cup final",
    ruleSummary: "This season's internationals only. Final: Brisbane, 15 Nov.",
  },
  {
    id: "festive-2026",
    date: "2026-12-26",
    event: "Boxing Day Festive Challenge",
    approximate: true,
    rule: { ...LEEDS_WAKEFIELD, clubs: [...LEEDS_WAKEFIELD.clubs] },
    eraMode: true,
    ruleTitle: "Festive Challenge",
    ruleSummary: "Boxing Day derby: Leeds and Wakefield sides only.",
  },
  {
    id: "season-launch-2027",
    date: "2027-02-11",
    event: "Super League season launch",
    approximate: true,
    rule: { type: "clubs", clubs: ["Wakefield Trinity", "Warrington Wolves"], label: "2026 Grand Finalists" },
    eraMode: false,
    ruleTitle: "Season launch",
    ruleSummary: "New season: only the 2026 Grand Finalists' squads.",
  },
  {
    id: "las-vegas-2027",
    date: "2027-02-27",
    event: "Super League in Las Vegas",
    approximate: false,
    rule: { type: "clubs", clubs: ["Bradford Bulls", "Leigh Leopards"], label: "Bradford & Leigh" },
    eraMode: false,
    ruleTitle: "Vegas week",
    ruleSummary: "Bradford v Leigh in Las Vegas: their squads only.",
  },
  {
    id: "magic-weekend-2027",
    date: "2027-05-01",
    event: "Magic Weekend",
    approximate: false,
    rule: { type: "era-night", fromYear: 2007, toYear: 2025, label: "Magic era" },
    eraMode: true,
    ruleTitle: "Magic Weekend",
    ruleSummary: "Every spin is a side from the Magic era, 2007–2025.",
  },
  {
    id: "origin-1-2027",
    date: "2027-05-26",
    event: "State of Origin I",
    approximate: true,
    rule: { type: "nation", nation: "Australia" },
    eraMode: true,
    ruleTitle: "Origin I",
    ruleSummary: "Origin week: Australian players only.",
  },
  {
    id: "challenge-cup-final-2027",
    date: "2027-06-05",
    event: "Challenge Cup final",
    approximate: false,
    rule: { type: "cup-finalists" },
    eraMode: true,
    ruleTitle: "Cup final week",
    ruleSummary: "Every spin is a Challenge Cup finalist's season.",
  },
  {
    id: "origin-2-2027",
    date: "2027-06-16",
    event: "State of Origin II",
    approximate: false,
    rule: { type: "nation", nation: "Australia" },
    eraMode: false,
    ruleTitle: "Origin II",
    ruleSummary: "Origin week: this season's Australians only.",
  },
  {
    id: "origin-3-2027",
    date: "2027-07-07",
    event: "State of Origin III",
    approximate: true,
    rule: { type: "nation", nation: "Australia" },
    eraMode: true,
    ruleTitle: "Origin III",
    ruleSummary: "Origin decider: Australian players only.",
  },
  {
    id: "grand-final-2027",
    date: "2027-10-02",
    event: "Grand Final",
    approximate: false,
    rule: { type: "grand-finalists" },
    eraMode: true,
    ruleTitle: "Grand Final week",
    ruleSummary: "Every spin is a Grand Final side's season.",
  },
  {
    id: "festive-2027",
    date: "2027-12-26",
    event: "Boxing Day Festive Challenge",
    approximate: true,
    rule: { ...LEEDS_WAKEFIELD, clubs: [...LEEDS_WAKEFIELD.clubs] },
    eraMode: false,
    ruleTitle: "Festive Challenge",
    ruleSummary: "Boxing Day derby: this season's Leeds and Wakefield.",
  },
];

/** The theme for a UK week (its seven date keys, Monday first), or null. */
export function getWeeklyThemeForDateKeys(dateKeys: readonly string[]): WeeklyTheme | null {
  const monday = dateKeys[0];
  if (!monday || monday < WEEKLY_THEMES_FROM) return null;
  return WEEKLY_THEMES.find((theme) => dateKeys.includes(theme.date)) ?? null;
}

export type WeeklyThemedScenario = DailyChallengeScenario & { theme?: WeeklyTheme };

export function buildWeeklyThemeScenario(theme: WeeklyTheme): WeeklyThemedScenario {
  const base = buildChallengeScenario(theme.rule, theme.eraMode, theme.ruleTitle, theme.ruleSummary);
  return { ...base, id: `theme-${theme.id}`, theme };
}
