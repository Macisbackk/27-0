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
  ERA_26_CURRENT_CLUBS,
  ERA_HISTORIC_ONLY_CLUBS,
  ERA_HISTORIC_ROSTER_SIZE,
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
  ERA_BENCH_FROM_STARTING_17,
  ERA_STARTING_17_SIZE,
  ERA_XIII_FROM_STARTING_17,
  getEraStarting17Entries,
  getEraStarting17YearsForClub,
  hasCompleteEraStarting17Squad,
  resolveEraStarting17Squad,
} from "../src/lib/players/era-starting-17s";
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

function auditEraStarting17s(): EraTeamIssue[] {
  const issues: EraTeamIssue[] = [];
  const currentYear = getCurrentCalendarYear();
  const entries = getEraStarting17Entries();
  const seenClubYear = new Set<string>();

  for (const entry of entries) {
    const year = String(entry.year);
    const { club } = entry;
    const key = `${club}|${year}`;

    if (seenClubYear.has(key)) {
      issues.push({
        club,
        year,
        severity: "error",
        code: "DUPLICATE_CLUB_YEAR",
        message: "Duplicate club-year record in era-starting-17s.json",
      });
    }
    seenClubYear.add(key);

    if (entry.year > currentYear) {
      issues.push({
        club,
        year,
        severity: "warning",
        code: "FUTURE_YEAR",
        message: `Year ${year} is in the future (filtered at runtime)`,
      });
    }

    const squadSize = entry.squad?.length ?? 0;
    if (squadSize !== ERA_STARTING_17_SIZE) {
      issues.push({
        club,
        year,
        severity: "error",
        code: "INVALID_ROSTER_SIZE",
        message: `Squad has ${squadSize}/${ERA_STARTING_17_SIZE} players`,
      });
      continue;
    }

    const numbers = entry.squad.map((m) => m.number).sort((a, b) => a - b);
    for (let n = 1; n <= ERA_STARTING_17_SIZE; n++) {
      if (numbers[n - 1] !== n) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "MISSING_SQUAD_NUMBER",
          message: `Missing jersey number ${n} in starting 17`,
        });
      }
    }

    if (!hasCompleteEraStarting17Squad(entry)) {
      issues.push({
        club,
        year,
        severity: "error",
        code: "INCOMPLETE_STARTING_17",
        message: "Squad is not a complete 1–17 roster",
      });
    }

    for (const member of entry.squad) {
      if (!member.name?.trim()) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "MISSING_PLAYER_NAME",
          message: `Jersey ${member.number} has no player name`,
        });
      }
      if (/NOT_FOUND|INCOMPLETE|UNRESOLVED/i.test(member.name)) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "UNRESOLVED_PLAYER",
          message: `Jersey ${member.number} is unresolved: ${member.name}`,
        });
      }
    }

    const resolved = resolveEraStarting17Squad(club, year);
    if (!resolved) continue;

    if (resolved.playerIds.length !== ERA_STARTING_17_SIZE) {
      issues.push({
        club,
        year,
        severity: "error",
        code: "UNRESOLVED_PLAYERS",
        message: `Only ${resolved.playerIds.length}/${ERA_STARTING_17_SIZE} players resolved (${resolved.missingNames.join(", ")})`,
      });
    }

    const uniqueIds = new Set(resolved.playerIds);
    if (
      uniqueIds.size !== resolved.playerIds.length &&
      uniqueIds.size < ERA_STARTING_17_SIZE - 1
    ) {
      issues.push({
        club,
        year,
        severity: "error",
        code: "DUPLICATE_PLAYER_ID",
        message: "Excessive duplicate player IDs in resolved roster",
      });
    }

    for (const id of resolved.playerIds) {
      const player = getPlayerById(id);
      if (!player) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "MISSING_PLAYER_ID",
          message: `Resolved player ID not found: ${id}`,
        });
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
    const starting17Years = getEraStarting17YearsForClub(club);
    for (const year of starting17Years) {
      const built = buildEraTeamForYear(club, year);
      if (!built) {
        skipped.push({ club, year });
        issues.push({
          club,
          year,
          severity: "error",
          code: "BUILD_FAILED",
          message:
            "Verified starting 17 exists but buildEraTeamForYear returned null",
        });
        continue;
      }

      if (built.playerIds.length !== ERA_HISTORIC_ROSTER_SIZE) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "HISTORIC_ROSTER_SIZE",
          message: `Historic roster has ${built.playerIds.length}/${ERA_HISTORIC_ROSTER_SIZE} players`,
        });
      }
      if (built.xiiiPlayerIds.length !== ERA_XIII_FROM_STARTING_17) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "XIII_SIZE",
          message: `XIII has ${built.xiiiPlayerIds.length}/${ERA_XIII_FROM_STARTING_17} players`,
        });
      }
      if (built.benchPlayerIds.length !== ERA_BENCH_FROM_STARTING_17) {
        issues.push({
          club,
          year,
          severity: "error",
          code: "BENCH_SIZE",
          message: `Bench has ${built.benchPlayerIds.length}/${ERA_BENCH_FROM_STARTING_17} players`,
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

    const minRoster = team.category === "historic" ? ERA_HISTORIC_ROSTER_SIZE : MIN_ERA_ROSTER_PLAYERS;
    if (team.playerIds.length < minRoster) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "ROSTER_TOO_SMALL",
        message: `Only ${team.playerIds.length} players (need ${minRoster})`,
      });
    }

    const uniqueIds = new Set(team.playerIds);
    if (
      team.category === "historic" &&
      uniqueIds.size !== team.playerIds.length &&
      uniqueIds.size < ERA_HISTORIC_ROSTER_SIZE - 1
    ) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "DUPLICATE_PLAYER_ID",
        message: "Excessive duplicate player IDs in built era team",
      });
    } else if (
      team.category !== "historic" &&
      uniqueIds.size !== team.playerIds.length
    ) {
      issues.push({
        club: team.clubName,
        year: team.year,
        severity: "error",
        code: "DUPLICATE_PLAYER_ID",
        message: "Duplicate player IDs in built era team",
      });
    }

    for (const id of team.playerIds) {
      const player = getPlayerById(id);
      if (!player) {
        issues.push({
          club: team.clubName,
          year: team.year,
          severity: "error",
          code: "MISSING_PLAYER_ID",
          message: `Player ID not found: ${id}`,
        });
      }
    }

    const matchIds =
      team.xiiiPlayerIds.length > 0
        ? team.xiiiPlayerIds
        : team.playerIds.slice(0, FULL_ERA_SQUAD_SIZE);
    const squad = buildEraSquadFromRoster(
      matchIds,
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
  const rawIssues = auditEraStarting17s();
  const { issues: builtIssues, validTeams, skipped } = auditBuiltTeams();
  const allIssues = [...rawIssues, ...builtIssues];

  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  const clubsRepresented = new Set(validTeams.map((t) => t.clubName));
  const historicTeams = validTeams.filter((t) => t.category === "historic");
  const era26Teams = validTeams.filter((t) => t.category === "26");
  const onePerClubReady = clubsRepresented.size >= 14;

  for (const club of ERA_HISTORIC_ONLY_CLUBS) {
    const invalid26 = era26Teams.find((t) => t.clubName === club);
    if (invalid26) {
      errors.push({
        club,
        year: ERA_26_YEAR,
        severity: "error" as const,
        code: "HISTORIC_ONLY_AS_CURRENT",
        message: `${club} must not appear as a 2026/current Era team`,
      });
    }
  }

  if (era26Teams.length !== ERA_26_CURRENT_CLUBS.length) {
    errors.push({
      club: "*",
      year: ERA_26_YEAR,
      severity: "error" as const,
      code: "ERA_26_COUNT",
      message: `Expected ${ERA_26_CURRENT_CLUBS.length} current Era teams, found ${era26Teams.length}`,
    });
  }

  for (const club of ERA_26_CURRENT_CLUBS) {
    if (!era26Teams.some((t) => t.clubName === club)) {
      errors.push({
        club,
        year: ERA_26_YEAR,
        severity: "error" as const,
        code: "MISSING_ERA_26_TEAM",
        message: `Missing approved 2026/current Era team for ${club}`,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      validTeams: validTeams.length,
      historicTeams: historicTeams.length,
      era26Teams: era26Teams.length,
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
      rosterSize: t.playerIds.length,
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
  console.log(`Historic teams: ${historicTeams.length}`);
  console.log(`2026 teams: ${era26Teams.length}`);
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
