/**
 * Audit unresolved player names in era-starting-17s.json.
 * Run: npx tsx scripts/audit-era-starting-17-missing.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import eraStarting17s from "../data/era-starting-17s.json";
import { findPlayerByName } from "../src/lib/players/player-name-resolve";
import type { EraStarting17Entry } from "../src/lib/players/era-starting-17s";

const OUT = join(process.cwd(), "data", "era-starting-17-missing-players.json");

type MissingRef = {
  name: string;
  occurrences: number;
  clubYears: string[];
  positions: string[];
};

function main(): void {
  const entries = eraStarting17s as EraStarting17Entry[];
  const byName = new Map<string, MissingRef>();

  for (const entry of entries) {
    for (const member of entry.squad) {
      if (findPlayerByName(member.name)) continue;
      const ref = byName.get(member.name) ?? {
        name: member.name,
        occurrences: 0,
        clubYears: [],
        positions: [],
      };
      ref.occurrences++;
      const label = `${entry.club} ${entry.year}`;
      if (!ref.clubYears.includes(label)) ref.clubYears.push(label);
      if (!ref.positions.includes(member.position)) {
        ref.positions.push(member.position);
      }
      byName.set(member.name, ref);
    }
  }

  const missing = [...byName.values()].sort(
    (a, b) => b.occurrences - a.occurrences
  );

  writeFileSync(
    OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), total: missing.length, missing }, null, 2)}\n`
  );

  console.log(`Missing unique players: ${missing.length}`);
  console.log(`Report: ${OUT}`);
  for (const row of missing.slice(0, 40)) {
    console.log(`  ${row.name} (${row.occurrences}x) [${row.positions.join(",")}]`);
  }
  if (missing.length > 40) {
    console.log(`  … and ${missing.length - 40} more`);
  }
}

main();
