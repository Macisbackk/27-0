/**
 * Validate strict team-year spin pools.
 * Run: npm run validate:team-years
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import { buildTeamYearId } from "../src/lib/game/team-year-pools";
import { getPlayerById } from "../src/lib/players";
import {
  describeTeamYearMembershipMismatch,
  playerBelongsToTeamYear,
} from "../src/lib/players/team-year-membership";
import { isSuperLeagueSeason } from "../src/lib/players/super-league-club-years";
import {
  getTeamYearRosterMeta,
  type TeamYearRosterMeta,
} from "../src/lib/players/team-year-roster-meta";
import {
  getCurrentCalendarYear,
  getTeamYearRosters,
  hasTeamYearRoster,
  MIN_TEAM_YEAR_ROSTER_PLAYERS,
} from "../src/lib/players/team-year-rosters";
import { isPlayableTeamYearRoster } from "../src/lib/players/team-year-roster-playable";

const ROOT = join(__dirname, "..");
const REPORT_PATH = join(ROOT, "data", "team-years-validation-report.json");

const BLOCKED_SPIN_CLUBS = new Set([
  "Paris Saint-Germain RL",
  "Gateshead Thunder",
  "PSG",
]);

type Issue = {
  severity: "error" | "warning";
  code: string;
  team: string;
  year: string;
  playerId?: string;
  message: string;
};

function main(): void {
  const issues: Issue[] = [];
  const rosters = getTeamYearRosters();
  const currentYear = getCurrentCalendarYear();
  const playableClubs = new Set(getPlayableClubNames());

  const hiddenNonSl: Array<{ team: string; year: string }> = [];
  const hiddenIncomplete: Array<{ team: string; year: string; reason: string }> = [];
  const currentLeaksFixed: Array<{ team: string; year: string; playerId: string }> = [];
  const membershipMismatches: Array<{
    team: string;
    year: string;
    playerId: string;
    message: string;
  }> = [];
  const unsupportedRemoved: Array<{ team: string; year: string }> = [];

  for (const [team, years] of Object.entries(rosters)) {
    if (BLOCKED_SPIN_CLUBS.has(team) || !playableClubs.has(team)) {
      for (const year of Object.keys(years)) {
        unsupportedRemoved.push({ team, year });
        issues.push({
          severity: "error",
          code: "UNSUPPORTED_CLUB_IN_ROSTERS",
          team,
          year,
          message: `${team} must not appear in team-year rosters`,
        });
      }
      continue;
    }

    for (const [year, playerIds] of Object.entries(years)) {
      const meta = getTeamYearRosterMeta(team, year);
      const y = Number.parseInt(year, 10);

      if (!isSuperLeagueSeason(team, year)) {
        hiddenNonSl.push({ team, year });
        issues.push({
          severity: "error",
          code: "NON_SL_SEASON_PLAYABLE",
          team,
          year,
          message: `${team} ${year} is not a Super League season but appears in rosters`,
        });
      }

      if (!meta) {
        issues.push({
          severity: "error",
          code: "MISSING_META",
          team,
          year,
          message: "team-year missing from team-year-rosters-meta.json",
        });
      } else {
        validateMeta(team, year, meta, issues, hiddenNonSl, hiddenIncomplete);
      }

      if (!hasTeamYearRoster(team, year)) {
        if (playerIds.length > 0) {
          hiddenIncomplete.push({
            team,
            year,
            reason: `raw roster has ${playerIds.length} players but failed playability gate`,
          });
        }
        continue;
      }

      if (playerIds.length < MIN_TEAM_YEAR_ROSTER_PLAYERS) {
        issues.push({
          severity: "error",
          code: "INVALID_ROSTER_SIZE",
          team,
          year,
          message: `playable roster must have at least ${MIN_TEAM_YEAR_ROSTER_PLAYERS} players (has ${playerIds.length})`,
        });
      }

      const unique = new Set(playerIds);
      if (unique.size !== playerIds.length) {
        issues.push({
          severity: "error",
          code: "DUPLICATE_PLAYERS",
          team,
          year,
          message: "duplicate player IDs in team-year roster",
        });
      }

      const playable = isPlayableTeamYearRoster(team, year, playerIds, getPlayerById);
      if (!playable) {
        issues.push({
          severity: "error",
          code: "NOT_PLAYABLE_ROSTER",
          team,
          year,
          message: "roster marked playable but failed position coverage gate",
        });
      }

      for (const playerId of playerIds) {
        const player = getPlayerById(playerId);
        if (!player) {
          issues.push({
            severity: "error",
            code: "MISSING_PLAYER",
            team,
            year,
            playerId,
            message: "roster references unknown player id",
          });
          continue;
        }

        if (player.category === "current" && y < currentYear) {
          currentLeaksFixed.push({ team, year, playerId });
          issues.push({
            severity: "error",
            code: "CURRENT_PLAYER_HISTORIC_LEAK",
            team,
            year,
            playerId,
            message: `current player ${player.name} in historic pool ${team} ${year}`,
          });
        }

        if (!playerBelongsToTeamYear(player, team, year)) {
          const message =
            describeTeamYearMembershipMismatch(player, team, year) ??
            "player-year mismatch";
          membershipMismatches.push({
            team,
            year,
            playerId,
            message,
          });
          issues.push({
            severity: "error",
            code: "MEMBERSHIP_MISMATCH",
            team,
            year,
            playerId,
            message,
          });
        }

        const expectedPoolId = buildTeamYearId(team, year);
        if (!playerId) continue;
        void expectedPoolId;
      }
    }
  }

  for (const team of Object.keys(rosters)) {
    for (const year of Object.keys(rosters[team] ?? {})) {
      if (!isSuperLeagueSeason(team, year)) {
        if (!hiddenNonSl.some((e) => e.team === team && e.year === year)) {
          hiddenNonSl.push({ team, year });
        }
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      playableTeamYears: Object.entries(rosters).reduce((count, [team, years]) => {
        return (
          count +
          Object.keys(years).filter((year) => hasTeamYearRoster(team, year)).length
        );
      }, 0),
      errors: errors.length,
      warnings: issues.filter((i) => i.severity === "warning").length,
    },
    hiddenNonSuperLeagueSeasons: hiddenNonSl,
    hiddenIncompleteRosters: hiddenIncomplete,
    currentPlayerLeaks: currentLeaksFixed,
    playerYearMismatches: membershipMismatches,
    unsupportedClubsInRosters: unsupportedRemoved,
    issues,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Playable team-years: ${report.summary.playableTeamYears}`);
  console.log(`Errors: ${report.summary.errors} | Warnings: ${report.summary.warnings}`);

  if (errors.length > 0) {
    console.error("\nValidation failed:");
    for (const issue of errors.slice(0, 20)) {
      console.error(
        `  [${issue.code}] ${issue.team} ${issue.year}${issue.playerId ? ` (${issue.playerId})` : ""}: ${issue.message}`
      );
    }
    if (errors.length > 20) {
      console.error(`  ... and ${errors.length - 20} more`);
    }
    process.exit(1);
  }

  console.log("validate:team-years passed");
}

function validateMeta(
  team: string,
  year: string,
  meta: TeamYearRosterMeta,
  issues: Issue[],
  hiddenNonSl: Array<{ team: string; year: string }>,
  hiddenIncomplete: Array<{ team: string; year: string; reason: string }>
): void {
  if (meta.playableInEra && !meta.isSuperLeagueSeason) {
    issues.push({
      severity: "error",
      code: "ERA_WITHOUT_SL",
      team,
      year,
      message: "playableInEra requires isSuperLeagueSeason",
    });
  }
  if (meta.playableInNormalSpin && !meta.isSuperLeagueSeason) {
    issues.push({
      severity: "error",
      code: "SPIN_WITHOUT_SL",
      team,
      year,
      message: "playableInNormalSpin requires isSuperLeagueSeason",
    });
  }
  if (!meta.isSuperLeagueSeason) {
    hiddenNonSl.push({ team, year });
  }
  if (
    !meta.playableInNormalSpin &&
    !meta.playableInEra &&
    meta.playerCount > 0
  ) {
    hiddenIncomplete.push({
      team,
      year,
      reason: "marked unplayable in meta",
    });
  }
}

main();
