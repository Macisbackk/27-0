/**
 * Sync stored `value` fields in player JSON to match peak ratings.
 * Run: npm run sync:player-values
 * Apply: npm run sync:player-values -- --apply
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizePlayer } from "../src/lib/players/normalize";
import { computePlayerValue } from "../src/lib/players/ratings";

const ROOT = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

const FILES = [
  join(ROOT, "data", "current-squads.json"),
  join(ROOT, "data", "historic-players.json"),
  join(ROOT, "data", "legends.json"),
];

function main(): void {
  let updated = 0;
  let checked = 0;

  for (const path of FILES) {
    const players = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >[];
    let fileUpdated = 0;

    for (const raw of players) {
      if (raw.availableInGame === false) continue;
      checked++;

      const normalized = normalizePlayer(raw);
      const expected = computePlayerValue(
        normalized.peakRating,
        normalized.position,
        normalized.category
      );

      if (raw.value === expected) continue;
      fileUpdated++;
      updated++;

      if (APPLY) {
        raw.value = expected;
      } else {
        console.log(
          `${String(raw.name)} (${String(raw.id)}): ${String(raw.value)} → ${expected} (rating ${normalized.peakRating})`
        );
      }
    }

    if (APPLY && fileUpdated > 0) {
      writeFileSync(path, `${JSON.stringify(players, null, 2)}\n`);
      console.log(`Updated ${fileUpdated} value(s) in ${path}`);
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Found"} ${updated} value change(s) across ${checked} players`
  );

  if (!APPLY && updated > 0) {
    console.log("Re-run with --apply to write changes.");
    process.exit(1);
  }
}

main();
