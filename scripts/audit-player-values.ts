/**
 * Audit player rating vs value alignment.
 * Run: npm run validate:values
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_POOL } from "../src/lib/players";
import {
  computePlayerValue,
  ratingToValue,
} from "../src/lib/players/ratings";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";

const ROOT = join(__dirname, "..");
const REPORT_PATH = join(ROOT, "data", "player-values-audit-report.json");

interface ValueAnomaly {
  playerId: string;
  name: string;
  peakRating: number;
  expectedValue: number;
  actualValue: number;
  hasOverride: boolean;
  kind: "mismatch" | "inverted_peer" | "out_of_band";
  message: string;
}

function main(): void {
  const anomalies: ValueAnomaly[] = [];
  const players = PLAYER_POOL.filter((p) => p.availableInGame !== false);

  for (const player of players) {
    const expected = computePlayerValue(
      player.peakRating,
      player.position,
      player.category
    );
    const hasOverride = PLAYER_RATING_OVERRIDES[player.id] !== undefined;

    if (player.value !== expected) {
      anomalies.push({
        playerId: player.id,
        name: player.name,
        peakRating: player.peakRating,
        expectedValue: expected,
        actualValue: player.value,
        hasOverride,
        kind: "mismatch",
        message: `Value ${player.value} ≠ expected ${expected} for rating ${player.peakRating}`,
      });
      continue;
    }
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (a.peakRating >= b.peakRating + 3 && a.value < b.value) {
        anomalies.push({
          playerId: a.id,
          name: a.name,
          peakRating: a.peakRating,
          expectedValue: a.value,
          actualValue: b.value,
          hasOverride:
            PLAYER_RATING_OVERRIDES[a.id] !== undefined ||
            PLAYER_RATING_OVERRIDES[b.id] !== undefined,
          kind: "inverted_peer",
          message: `${a.name} (${a.peakRating}/${a.value}) rated ≥3 above ${b.name} (${b.peakRating}/${b.value}) but lower value`,
        });
      }
    }
  }

  const mismatches = anomalies.filter((a) => a.kind === "mismatch");
  const inverted = anomalies.filter((a) => a.kind === "inverted_peer");
  const outOfBand = anomalies.filter((a) => a.kind === "out_of_band");

  const sortedByValue = [...players].sort((a, b) => b.value - a.value);
  const topValue = sortedByValue.slice(0, 15).map((p) => ({
    id: p.id,
    name: p.name,
    rating: p.peakRating,
    value: p.value,
  }));
  const lowValue = sortedByValue
    .slice(-15)
    .reverse()
    .map((p) => ({
      id: p.id,
      name: p.name,
      rating: p.peakRating,
      value: p.value,
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      playersAudited: players.length,
      mismatches: mismatches.length,
      invertedPeers: inverted.length,
      outOfBand: outOfBand.length,
    },
    topValue,
    lowValue,
    anomalies,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("🏉 Player Value Audit\n");
  console.log(`Players audited: ${players.length}`);
  console.log(`Rating/value mismatches: ${mismatches.length}`);
  console.log(`Inverted peer pairs: ${inverted.length}`);
  console.log(`Out-of-band values: ${outOfBand.length}`);
  console.log(`Report: ${REPORT_PATH}`);

  console.log("\nTop values:");
  for (const p of topValue.slice(0, 5)) {
    console.log(`  ${p.name}: £${p.value.toLocaleString()} (rating ${p.rating})`);
  }

  if (mismatches.length > 0) {
    console.log("\nMismatches (sample):");
    for (const a of mismatches.slice(0, 10)) {
      console.log(
        `  ✗ ${a.name}: expected ${a.expectedValue}, got ${a.actualValue}${a.hasOverride ? " [override]" : ""}`
      );
    }
  }

  if (mismatches.length > 0 || inverted.length > 0) {
    console.error(
      `\n✗ ${mismatches.length} mismatch(es), ${inverted.length} inverted peer(s)`
    );
    process.exit(1);
  }

  console.log("\n✓ Player values aligned with ratings");
}

main();
