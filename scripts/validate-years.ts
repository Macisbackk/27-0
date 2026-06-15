/**
 * Audit year references across player and roster data.
 * Run: npm run validate:years
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_POOL } from "../src/lib/players";
import { getCurrentCalendarYear } from "../src/lib/players/team-year-rosters";
import { getEraWikipediaSquads } from "../src/lib/players/era-wikipedia-squads";
import { getTeamYearRosters } from "../src/lib/players/team-year-rosters";

const ROOT = join(__dirname, "..");
const REPORT_PATH = join(ROOT, "data", "years-validation-report.json");

type YearIssue = {
  source: string;
  id: string;
  field: string;
  value: string | number;
  severity: "error" | "warning";
  message: string;
};

function extractEndYear(yearsActive: string): number | undefined {
  if (/present/i.test(yearsActive)) return getCurrentCalendarYear();
  const years = [...yearsActive.matchAll(/(\d{4})/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  return years.length > 1 ? years[years.length - 1] : years[0];
}

function main(): void {
  const currentYear = getCurrentCalendarYear();
  const issues: YearIssue[] = [];

  for (const player of PLAYER_POOL) {
    if (player.primeYear !== undefined && player.primeYear > currentYear) {
      issues.push({
        source: "player",
        id: player.id,
        field: "primeYear",
        value: player.primeYear,
        severity: "warning",
        message: `primeYear ${player.primeYear} is in the future`,
      });
    }

    if (player.eraYear !== undefined && player.eraYear > currentYear) {
      issues.push({
        source: "player",
        id: player.id,
        field: "eraYear",
        value: player.eraYear,
        severity: "warning",
        message: `eraYear ${player.eraYear} is in the future`,
      });
    }

    if (player.cardYear !== undefined && player.cardYear > currentYear) {
      issues.push({
        source: "player",
        id: player.id,
        field: "cardYear",
        value: player.cardYear,
        severity: "warning",
        message: `cardYear ${player.cardYear} is in the future`,
      });
    }

    const endYear = extractEndYear(player.yearsActive);
    if (endYear !== undefined && endYear > currentYear && !/present/i.test(player.yearsActive)) {
      issues.push({
        source: "player",
        id: player.id,
        field: "yearsActive",
        value: player.yearsActive,
        severity: "warning",
        message: `yearsActive end year ${endYear} exceeds ${currentYear}`,
      });
    }
  }

  const teamYearRosters = getTeamYearRosters();
  for (const [team, years] of Object.entries(teamYearRosters)) {
    for (const year of Object.keys(years)) {
      if (Number(year) > currentYear) {
        issues.push({
          source: "team-year-rosters",
          id: team,
          field: "year",
          value: year,
          severity: "warning",
          message: `Future roster year ${year} in JSON (filtered at display)`,
        });
      }
    }
  }

  const eraSquads = getEraWikipediaSquads();
  for (const [club, years] of Object.entries(eraSquads)) {
    for (const year of Object.keys(years)) {
      if (Number(year) > currentYear) {
        issues.push({
          source: "era-wikipedia-squads",
          id: club,
          field: "year",
          value: year,
          severity: "warning",
          message: `Future era squad year ${year} in JSON (filtered at build)`,
        });
      }
    }
  }

  const exposedTeamYears: string[] = [];
  for (const [team, years] of Object.entries(teamYearRosters)) {
    for (const year of Object.keys(years)) {
      if (Number(year) <= currentYear) exposedTeamYears.push(`${team}:${year}`);
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const report = {
    generatedAt: new Date().toISOString(),
    currentYear,
    summary: {
      playerIssues: issues.filter((i) => i.source === "player").length,
      rosterFutureYears: issues.filter((i) => i.source === "team-year-rosters")
        .length,
      eraFutureYears: issues.filter((i) => i.source === "era-wikipedia-squads")
        .length,
      errors: errors.length,
      warnings: warnings.length,
      exposedTeamYearCount: exposedTeamYears.length,
    },
    issues,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("🏉 Year Data Validation\n");
  console.log(`Current calendar year: ${currentYear}`);
  console.log(`Player year issues: ${report.summary.playerIssues}`);
  console.log(`Future team-year roster keys: ${report.summary.rosterFutureYears}`);
  console.log(`Future era squad keys: ${report.summary.eraFutureYears}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (warnings.length > 0) {
    console.log("\nWarnings (sample):");
    for (const w of warnings.slice(0, 15)) {
      console.log(`  ⚠ ${w.source} ${w.id} ${w.field}: ${w.message}`);
    }
    if (warnings.length > 15) {
      console.log(`  … and ${warnings.length - 15} more`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n✗ ${errors.length} year validation error(s)`);
    process.exit(1);
  }

  console.log("\n✓ Year validation complete (warnings are informational)");
}

main();
