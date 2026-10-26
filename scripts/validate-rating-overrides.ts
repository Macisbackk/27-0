/**
 * Validate manual rating overrides are applied and warn on database drift.
 * Run: npm run validate:rating-overrides
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";
import { PLAYER_RATING_AUDIT } from "../data/player-rating-audit";
import ERA_SEASON_RATINGS from "../data/era-season-ratings.json";
import SEASON_2026_RATINGS from "../data/season-2026-ratings.json";

// Later, documented layers in normalize.ts replace a manual override on purpose: the career-arc
// audit, the era card audit and the 2026 season re-rate. Those count as superseded, not errors.
const LATER_LAYERS: Array<[string, Record<string, unknown>]> = [
  ["career-arc audit", PLAYER_RATING_AUDIT],
  ["era card audit", ERA_SEASON_RATINGS],
  ["2026 season ratings", SEASON_2026_RATINGS],
];
import { normalizePlayer } from "../src/lib/players/normalize";

const ROOT = join(__dirname, "..");
const FILES = [
  "data/current-squads.json",
  "data/historic-players.json",
  "data/legends.json",
] as const;

type RawPlayer = Record<string, unknown> & {
  id: string;
  name?: string;
  peakRating?: number;
  rating?: number;
};

function loadPlayers(): RawPlayer[] {
  const players: RawPlayer[] = [];
  for (const file of FILES) {
    const data = JSON.parse(
      readFileSync(join(ROOT, file), "utf8")
    ) as RawPlayer[];
    players.push(...data);
  }
  return players;
}

function main() {
  const players = loadPlayers();
  const byId = new Map(players.map((p) => [p.id, p]));

  let errors = 0;
  let warnings = 0;
  const missing: string[] = [];
  const drift: string[] = [];
  const superseded: Record<string, number> = {};

  for (const [id, overrideRating] of Object.entries(PLAYER_RATING_OVERRIDES)) {
    const raw = byId.get(id);
    if (!raw) {
      missing.push(id);
      errors++;
      continue;
    }

    const normalized = normalizePlayer(raw);
    const layer = LATER_LAYERS.filter(([, ids]) => id in ids).pop();
    if (layer && normalized.peakRating !== overrideRating) {
      superseded[layer[0]] = (superseded[layer[0]] ?? 0) + 1;
      continue;
    }
    if (normalized.peakRating !== overrideRating) {
      console.error(
        `✗ Override not applied: ${id} (${raw.name}) expected ${overrideRating}, got ${normalized.peakRating}`
      );
      errors++;
      continue;
    }

    const rawRating = (raw.peakRating ?? raw.rating) as number | undefined;
    if (rawRating !== undefined && rawRating !== overrideRating) {
      drift.push(`${id} (${raw.name}): JSON=${rawRating}, override=${overrideRating}`);
      warnings++;
    }
  }

  console.log(`\nManual rating overrides: ${Object.keys(PLAYER_RATING_OVERRIDES).length}`);
  console.log(`Missing player records: ${missing.length}`);
  for (const [layer, n] of Object.entries(superseded)) {
    console.log(`Superseded by the ${layer}: ${n}`);
  }
  console.log(`Database drift (JSON ≠ override): ${warnings}`);

  if (missing.length > 0) {
    console.log("\nMissing IDs:");
    for (const id of missing) console.log(`  - ${id}`);
  }

  if (drift.length > 0) {
    console.log(
      "\n⚠ JSON database values differ from overrides (runtime uses overrides):"
    );
    for (const line of drift.slice(0, 20)) console.log(`  - ${line}`);
    if (drift.length > 20) {
      console.log(`  … and ${drift.length - 20} more`);
    }
  }

  if (errors > 0) {
    console.error(`\n✗ ${errors} rating override error(s)`);
    process.exit(1);
  }

  if (warnings > 0) {
    console.log(
      `\n⚠ ${warnings} override(s) differ from JSON — safe if overrides file is authoritative`
    );
  } else {
    console.log("\n✓ All manual rating overrides validated");
  }
}

main();
