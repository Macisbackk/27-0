/**
 * Validate player ages across the database.
 * Run: npm run validate:ages
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { getPlayerById, PLAYER_POOL } from "../src/lib/players";
import { getPlayerAge, resolveBirthYear } from "../src/lib/players/player-age";
import type { Player } from "../src/lib/types";

const DATA_DIR = join(__dirname, "..", "data");
const REPORT_PATH = join(DATA_DIR, "age-validation-report.json");

type AgeIssue = {
  playerId: string;
  name: string;
  category: string;
  birthYear?: number;
  dateOfBirth?: string;
  referenceYear?: number;
  age?: number;
  severity: "error" | "warning" | "info";
  message: string;
};

const CURRENT_YEAR = new Date().getFullYear();

function validatePlayer(player: Player): AgeIssue[] {
  const issues: AgeIssue[] = [];
  const birthYear = resolveBirthYear(player.birthYear, player.dateOfBirth);

  if (player.category === "legend" || player.category === "historic") {
    if (birthYear === undefined) {
      issues.push({
        playerId: player.id,
        name: player.name,
        category: player.category,
        severity: "info",
        message: "Missing birth year for historic/legend player",
      });
      return issues;
    }
  }

  if (birthYear === undefined) return issues;

  if (birthYear > CURRENT_YEAR) {
    issues.push({
      playerId: player.id,
      name: player.name,
      category: player.category,
      birthYear,
      dateOfBirth: player.dateOfBirth,
      severity: "error",
      message: `Future birth year: ${birthYear}`,
    });
    return issues;
  }

  const age = getPlayerAge(player);
  const referenceYear =
    player.eraYear ?? player.primeYear ?? player.cardYear ?? CURRENT_YEAR;

  if (age === undefined) return issues;

  if (age < 0) {
    issues.push({
      playerId: player.id,
      name: player.name,
      category: player.category,
      birthYear,
      referenceYear,
      age,
      severity: "error",
      message: `Negative age: ${age}`,
    });
    return issues;
  }

  if (player.category === "current") {
    if (age > 50) {
      issues.push({
        playerId: player.id,
        name: player.name,
        category: player.category,
        birthYear,
        age,
        severity: "warning",
        message: `Suspicious current player age: ${age}`,
      });
    }
    return issues;
  }

  if (age < 15) {
    issues.push({
      playerId: player.id,
      name: player.name,
      category: player.category,
      birthYear,
      referenceYear,
      age,
      severity: "error",
      message: `Impossibly young at reference year: age ${age}`,
    });
  }

  if (age > 45) {
    issues.push({
      playerId: player.id,
      name: player.name,
      category: player.category,
      birthYear,
      referenceYear,
      age,
      severity: "error",
      message: `Impossibly old at reference year: age ${age}`,
    });
  }

  return issues;
}

function main(): void {
  const issues: AgeIssue[] = [];
  const eraTestIssues: AgeIssue[] = [];

  for (const player of PLAYER_POOL) {
    issues.push(...validatePlayer(player));

    if (player.primeYear) {
      const eraPlayer = { ...player, eraYear: player.primeYear };
      const eraAge = getPlayerAge(eraPlayer);
      if (eraAge !== undefined && eraAge < 0) {
        eraTestIssues.push({
          playerId: player.id,
          name: player.name,
          category: player.category,
          birthYear: player.birthYear,
          referenceYear: player.primeYear,
          age: eraAge,
          severity: "error",
          message: `getPlayerAge fails with eraYear: age ${eraAge}`,
        });
      }
    }
  }

  const allIssues = [...issues, ...eraTestIssues];
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");
  const infos = allIssues.filter((i) => i.severity === "info");

  const withBirth = PLAYER_POOL.filter(
    (p) => resolveBirthYear(p.birthYear, p.dateOfBirth) !== undefined
  );

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlayers: PLAYER_POOL.length,
      withBirthData: withBirth.length,
      withoutBirthData: PLAYER_POOL.length - withBirth.length,
      errors: errors.length,
      warnings: warnings.length,
      informational: infos.length,
    },
    issues: allIssues,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("🏉 Age Validation Report\n");
  console.log(`Players: ${PLAYER_POOL.length}`);
  console.log(`With birth data: ${withBirth.length}`);
  console.log(`Without birth data: ${PLAYER_POOL.length - withBirth.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info: ${infos.length}`);

  if (errors.length > 0) {
    console.log("\nHard errors:");
    for (const e of errors.slice(0, 20)) {
      console.log(`  ✗ ${e.name} (${e.playerId}): ${e.message}`);
    }
    if (errors.length > 20) console.log(`  … and ${errors.length - 20} more`);
    process.exit(1);
  }

  console.log("\n✓ No hard age validation errors");
}

main();
