/**
 * Remove deprecated `rating` from player database JSON — peakRating is canonical.
 * Run: npx tsx scripts/strip-legacy-player-rating-field.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLAYER_FILES = [
  "data/current-squads.json",
  "data/historic-players.json",
  "data/legends.json",
  "data/player-additions.json",
];

type RawPlayer = Record<string, unknown>;

function stripFile(relativePath: string): { stripped: number; migrated: number } {
  const fullPath = join(ROOT, relativePath);
  const raw = readFileSync(fullPath, "utf8");
  const players = JSON.parse(raw) as RawPlayer[];

  let stripped = 0;
  let migrated = 0;

  for (const player of players) {
    const hasRating = player.rating !== undefined && player.rating !== null;
    const hasPeak = player.peakRating !== undefined && player.peakRating !== null;

    if (hasRating && !hasPeak) {
      player.peakRating = player.rating;
      migrated++;
    }

    if (hasRating) {
      delete player.rating;
      stripped++;
    }
  }

  writeFileSync(fullPath, `${JSON.stringify(players, null, 2)}\n`, "utf8");
  return { stripped, migrated };
}

function main(): void {
  let totalStripped = 0;
  let totalMigrated = 0;

  for (const file of PLAYER_FILES) {
    try {
      const { stripped, migrated } = stripFile(file);
      totalStripped += stripped;
      totalMigrated += migrated;
      console.log(`${file}: removed rating from ${stripped} players (${migrated} copied to peakRating)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${file}: skipped (${message})`);
    }
  }

  console.log(`Done — stripped ${totalStripped}, migrated ${totalMigrated}`);
}

main();
