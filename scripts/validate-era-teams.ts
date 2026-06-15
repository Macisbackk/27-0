/**
 * Validate Era team database — single source of truth audit.
 * Run: npm run validate:era-teams
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { getClubByName } from "../src/lib/clubs";
import { getFilledCount, SQUAD_STRUCTURE } from "../src/lib/positions";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import { getSquadValue } from "../src/lib/positions";
import {
  ERA_CHALLENGE_CLUBS,
  ERA_26_YEAR,
  buildEraSquadFromRoster,
  buildEraTeamForYear,
  formatEraDisplayName,
  getAllEraTeams,
  getEraSquadYear,
  getEraYearsForClubUnified,
  MIN_ERA_ROSTER_PLAYERS,
  FULL_ERA_SQUAD_SIZE,
} from "../src/lib/players/era-teams";
import {
  getEraWikipediaSquads,
  getEraWikipediaYearsForClub,
} from "../src/lib/players/era-wikipedia-squads";
import { getCurrentCalendarYear } from "../src/lib/players/team-year-rosters";
import { getPlayerById } from "../src/lib/players";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const REPORT_PATH = join(ROOT, "data", "era-teams-validation-report.json");

type IssueSeverity = "error" | "warning" | "info";

interface EraTeamIssue {
  club: string;
  year: string;
  severity: IssueSeverity;
  code: string;
  message: string;
}

function auditRawSquads(): EraTeamIssue[] {
  const issues: EraTeamIssue[] = [];
  const currentYear = getCurrentCalendarYear();
  const squads = getEraWikipediaSquads();
  const seenClubYear = new Set<string>();

  for (const [club, years] of Object.entries(squads)) {
    for (const [year, entry] of Object.entries(years)) {
      const key = `${club}|${year}`;
      if (seenClubYear.has(key)) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "DUPLICATE_CLUB_YEAR",
          message: "Duplicate club-year record in era-wikipedia-squads.json",
        });
      }
      seenClubYear.add(key);

      if (Number(year) > currentYear) {
        issues.push({
          club,
          year,
          severity: "warning",
          code: "FUTURE_YEAR",
          message: `Year ${year} is in the future (filtered at runtime)`,
        });
      }

      const playerCount = entry?.playerIds?.length ?? 0;
      if (playerCount !== FULL_ERA_SQUAD_SIZE) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "INVALID_ROSTER_SIZE",
          message: `Roster has ${playerCount}/${FULL_ERA_SQUAD_SIZE} players`,
        });
      }

      if (playerCount === FULL_ERA_SQUAD_SIZE) {
        for (const id of entry.playerIds) {
          if (!getPlayerById(id)) {
            issues.push({
              club,
              year,
              severity: "error",
              code: "MISSING_PLAYER",
              message: `Player ID not found: ${id}`,
            });
          }
        }

        if (entry.positions.length !== FULL_ERA_SQUAD_SIZE) {
          issues.push({
            club,
            year,
            severity: "error",
            code: "INVALID_POSITIONS",
            message: `Position list has ${entry.positions.length}/${FULL_ERA_SQUAD_SIZE} entries`,
          });
        }
      }
    }
  }

  return issues;
}

function auditBuiltTeams(): {
  issues: EraTeamIssue[];
  validTeams: ReturnType<typeof getAllEraTeams>;
  skipped: { club: string; year: string }[];
} {
  const issues: EraTeamIssue[] = [];
  const skipped: { club: string; year: string }[] = [];
  const currentYear = getCurrentCalendarYear();

  for (const club of ERA_CHALLENGE_CLUBS) {
    const wikiYears = getEraWikipediaYearsForClub(club);
    for (const year of wikiYears) {
      const built = buildEraTeamForYear(club, year);
      if (!built) {
        skipped.push({ club, year });
        issues.push({
          club,
          year,
          severity: "warning",
          code: "BUILD_FAILED",
          message: "Wikipedia squad exists but buildEraTeamForYear returned null",
        });
      }
    }

    for (const year of getEraYearsForClubUnified(club)) {
      if (Number(year) > currentYear && year !== ERA_26_YEAR) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "FUTURE_YEAR_EXPOSED",
          message: `Future year ${year} exposed via getEraYearsForClubUnified`,
        });
      }
    }
  }

  const validTeams = getAllEraTeams();

  const displayNames = new Map<string, string>();
  const clubYears = new Map<string, string[]>();

  for (const team of validTeams) {
    if (displayNames.has(team.displayName)) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "DUPLICATE_DISPLAY_NAME",
        message: `Duplicate display name: ${team.displayName}`,
      });
    }
    displayNames.set(team.displayName, team.id);

    const years = clubYears.get(team.clubName) ?? [];
    years.push(team.year);
    clubYears.set(team.clubName, years);

    if (!getClubByName(team.clubName)) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "MISSING_CLUB_COLOURS",
        message: "Club not found in clubs registry",
      });
    }

    if (team.displayName !== formatEraDisplayName(team.clubName, team.year)) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "INVALID_DISPLAY_NAME",
        message: `Expected ${formatEraDisplayName(team.clubName, team.year)}, got ${team.displayName}`,
      });
    }

    if (team.playerIds.length < MIN_ERA_ROSTER_PLAYERS) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "ROSTER_TOO_SMALL",
        message: `Only ${team.playerIds.length} players`,
      });
    }

    const squad = buildEraSquadFromRoster(
      team.playerIds,
      team.slotPositions.length ? (team.slotPositions as Position[]) : undefined,
      getEraSquadYear(team)
    );
    const filled = getFilledCount(squad);
    if (filled < FULL_ERA_SQUAD_SIZE) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "SQUAD_STRUCTURE_INCOMPLETE",
        message: `Squad fills ${filled}/${FULL_ERA_SQUAD_SIZE} slots`,
      });
    }

    for (const { position, count } of SQUAD_STRUCTURE) {
      const positionFilled = squad.filter(
        (slot) => slot.position === position && slot.player
      ).length;
      if (positionFilled < count) {
        issues.push({
          club: team.clubName,
          year: team.year,
          severity: "error",
          code: "MISSING_POSITION",
          message: `Missing ${position} (${positionFilled}/${count})`,
        });
      }
    }

    const computedRating = getAverageSquadRating(squad);
    const computedValue = getSquadValue(squad);
    if (
      !Number.isFinite(team.teamRating) ||
      Math.abs(team.teamRating - computedRating) > 0.1
    ) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "warning",
        code: "RATING_MISMATCH",
        message: `Stored ${team.teamRating}, computed ${computedRating.toFixed(1)}`,
      });
    }
    if (
      !Number.isFinite(team.teamValue) ||
      team.teamValue !== computedValue
    ) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "warning",
        code: "VALUE_MISMATCH",
        message: `Stored ${team.teamValue}, computed ${computedValue}`,
      });
    }
  }

  return { issues, validTeams, skipped };
}

function main(): void {
  const rawIssues = auditRawSquads();
  const { issues: builtIssues, validTeams, skipped } = auditBuiltTeams();
  const allIssues = [...rawIssues, ...builtIssues];

  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  const clubsRepresented = new Set(validTeams.map((t) => t.clubName));
  const onePerClubReady = clubsRepresented.size >= 14;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      validTeams: validTeams.length,
      clubsRepresented: clubsRepresented.size,
      onePerClubReady,
      skippedBuilds: skipped.length,
      errors: errors.length,
      warnings: warnings.length,
    },
    validTeams: validTeams.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      clubName: t.clubName,
      year: t.year,
      category: t.category,
      teamRating: t.teamRating,
      teamValue: t.teamValue,
      tier: t.tier,
    })),
    skipped,
    issues: allIssues,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("🏉 Era Teams Validation\n");
  console.log(`Valid teams: ${validTeams.length}`);
  console.log(`Clubs represented: ${clubsRepresented.size}`);
  console.log(`One-per-club ready (≥14 clubs): ${onePerClubReady ? "yes" : "no"}`);
  console.log(`Skipped builds: ${skipped.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors.slice(0, 25)) {
      console.log(`  ✗ ${e.club} ${e.year} [${e.code}]: ${e.message}`);
    }
    if (errors.length > 25) {
      console.log(`  … and ${errors.length - 25} more`);
    }
    process.exit(1);
  }

  console.log("\n✓ Era teams validation passed");
}

main();
