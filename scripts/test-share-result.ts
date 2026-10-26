/**
 * Spoiler-free share text (src/lib/share-result.ts).
 * Run: bun scripts/test-share-result.ts  (or npx tsx scripts/test-share-result.ts)
 */
import {
  buildShareResultText,
  formatShareDate,
  formatShareWeek,
  resultGridLines,
  type ShareMatchResult,
} from "../src/lib/share-result";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}`, detail ?? "");
  }
}
function eq(name: string, actual: unknown, expected: unknown): void {
  check(name, actual === expected, { actual, expected });
}

const squares = (line: string) => [...line].length;

const season: ShareMatchResult[] = Array.from({ length: 27 }, (_, i) => (i === 17 ? "L" : "W"));

console.log("grid");
{
  const lines = resultGridLines(season);
  eq("two lines", lines.length, 2);
  eq("first line 14 squares", squares(lines[0]!), 14);
  eq("second line 13 squares", squares(lines[1]!), 13);
  eq("loss in round 18 is the 4th square of line 2", [...lines[1]!][3], "🟥");
  const draws = resultGridLines(["W", "D", "L"]);
  eq("draw is yellow", draws.join(""), "🟩🟨🟥");
  eq("empty season has no grid", resultGridLines([]).length, 0);
}

console.log("dates");
eq("26 Oct", formatShareDate("2026-10-26"), "26 Oct");
eq("1 Jan", formatShareDate("2027-01-01"), "1 Jan");
eq("Week 43", formatShareWeek("2026-W43"), "Week 43");
eq("Week 5", formatShareWeek("2026-W05"), "Week 5");

console.log("daily champion (the brief's example)");
{
  const text = buildShareResultText({
    kind: "daily",
    dateKey: "2026-10-26",
    ruleTitle: "No respins",
    results: season,
    leaguePosition: 1,
    playoffResults: ["W", "W"],
    playoffFinish: "Super League Champions",
    streak: 6,
    href: "/play?daily=1",
  });
  const expected = [
    "27-0 Daily · 26 Oct · No respins",
    "🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩",
    "🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩🟩",
    "Play-offs: 🟩🟩🏆",
    "26-1 · League Leaders · 🏆 Grand Final",
    "🔥 6-day streak",
    "www.27-0.co.uk/play?daily=1",
  ].join("\n");
  eq("full text", text, expected);
}

console.log("classic, missed play-offs");
{
  const results: ShareMatchResult[] = Array.from({ length: 27 }, (_, i) =>
    i % 3 === 0 ? "L" : i === 4 ? "D" : "W"
  );
  const text = buildShareResultText({
    kind: "classic",
    results,
    leaguePosition: 7,
    playoffFinish: "Missed Play-Offs",
    streak: 9,
    href: "/play?daily=1",
  });
  const lines = text.split("\n");
  eq("title", lines[0], "27-0 Classic");
  check("no play-off line", !text.includes("Play-offs:"), text);
  eq("summary with draws", lines[3], "17-9-1 · 7th · Missed play-offs");
  check("no streak outside the Daily", !text.includes("🔥"), text);
  eq("classic links to the site only", lines[lines.length - 1], "www.27-0.co.uk");
}

console.log("era classic, semi-final exit");
{
  const text = buildShareResultText({
    kind: "classic",
    era: true,
    results: season,
    leaguePosition: 2,
    playoffResults: ["W", "L"],
    playoffFinish: "Eliminated in Semi-Final",
  });
  const lines = text.split("\n");
  eq("title", lines[0], "27-0 Era Classic");
  eq("play-off line", lines[3], "Play-offs: 🟩🟥");
  eq("summary", lines[4], "26-1 · 2nd · Semi-final");
}

console.log("era weekly practice, runner-up");
{
  const text = buildShareResultText({
    kind: "weekly",
    era: true,
    weekKey: "2026-W43",
    ruleTitle: "One club: Wigan",
    practice: true,
    results: season,
    leaguePosition: 3,
    playoffResults: ["W", "W", "L"],
    playoffFinish: "Grand Final Runner-Up",
    weeklyScore: 12345,
    streak: 4,
    href: "/play?weekly=1&era=1",
  });
  const lines = text.split("\n");
  eq("title", lines[0], "27-0 Era Weekly · Week 43 · One club: Wigan · practice");
  eq("play-off line has no trophy", lines[3], "Play-offs: 🟩🟩🟥");
  eq("summary", lines[4], "26-1 · 3rd · Grand Final runners-up");
  eq("score", lines[5], "⭐ 12,345 pts");
  check("no daily streak on the Weekly", !text.includes("🔥"), text);
  eq("weekly link", lines[lines.length - 1], "www.27-0.co.uk/play?weekly=1&era=1");
}

console.log("spoiler-free");
{
  const text = buildShareResultText({ kind: "daily", results: season, leaguePosition: 1, dateKey: "2026-10-26" });
  check("no letters beyond the fixed words", /^[\s\S]*$/.test(text) && !/[A-Z][a-z]+ [A-Z][a-z]+/.test(text.replace("League Leaders", "")), text);
}

if (failures > 0) {
  console.error(`\n${failures} share-result check(s) failed`);
  process.exit(1);
}
console.log("\nshare-result: all checks passed");
