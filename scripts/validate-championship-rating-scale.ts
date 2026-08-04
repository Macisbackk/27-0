/**
 * Validate Championship rating scale correction (floor 70, SL/Historic floor 80).
 * Run: npx tsx scripts/validate-championship-rating-scale.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import {
  CURRENT_SUPER_LEAGUE_MIN_RATING,
  HISTORIC_PLAYER_MIN_RATING,
  CHAMPIONSHIP_PLAYER_MIN_RATING,
} from "../src/lib/players/rating-floors";
import { CURRENT_PLAYERS, HISTORIC_PLAYERS } from "../src/lib/players";
import { CHAMPIONSHIP_CLUBS } from "../src/lib/clubs/championship-clubs";
import {
  generateChampionshipSquads,
  GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
} from "../src/lib/manager/championship/championshipSquads";
import {
  correctMistakenChampionshipFloor80Rating,
  remapChampionshipSquadRatings,
} from "../src/lib/manager/championship/championshipRatingScale";
import {
  CHAMPIONSHIP_RATING_SCALE_VERSION,
  PLAYER_RATING_SCHEMA_VERSION,
  migratePlayerRatingsV4,
} from "../src/lib/manager/migratePlayerRatingsV4";
import { createNewCareer } from "../src/lib/manager/managerState";
import type { ChampionshipGeneratedPlayer } from "../src/lib/manager/championship/championshipSquads";
import type { Position } from "../src/lib/types";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log("Floors\n");
assert(CURRENT_SUPER_LEAGUE_MIN_RATING === 80, "Current SL floor = 80");
assert(HISTORIC_PLAYER_MIN_RATING === 80, "Historic floor = 80");
assert(CHAMPIONSHIP_PLAYER_MIN_RATING === 70, "Championship floor = 70");
assert(GENERATED_CHAMPIONSHIP_SQUADS_VERSION === 3, "Champ squads version = 3");
assert(PLAYER_RATING_SCHEMA_VERSION === 4, "playerRatingSchemaVersion = 4");
assert(
  CHAMPIONSHIP_RATING_SCALE_VERSION === 2,
  "championshipRatingScaleVersion = 2"
);

console.log("\nCurrent / Historic floors intact\n");
const currentBelow = CURRENT_PLAYERS.filter((p) => p.peakRating < 80);
const historicBelow = HISTORIC_PLAYERS.filter((p) => p.peakRating < 80);
assert(
  currentBelow.length === 0,
  `No Current player below 80 (${currentBelow.length})`
);
assert(
  historicBelow.length === 0,
  `No Historic player below 80 (${historicBelow.length})`
);
const currentAvg =
  CURRENT_PLAYERS.reduce((s, p) => s + p.peakRating, 0) /
  CURRENT_PLAYERS.length;

console.log("\nGenerated Championship scale\n");
const squads = generateChampionshipSquads("validate-champ-scale", 2026);
const players = Object.values(squads.players);
const minC = Math.min(...players.map((p) => p.peakRating));
const maxC = Math.max(...players.map((p) => p.peakRating));
const avgC =
  players.reduce((s, p) => s + p.peakRating, 0) / Math.max(1, players.length);
assert(players.length === 500, "500 Championship players");
assert(minC >= 70, `Champ min >= 70 (got ${minC})`);
assert(minC < 80, `Champ min not clamped to 80 (got ${minC})`);
assert(maxC <= 89, `Champ max <= 89 (got ${maxC})`);
assert(avgC >= 74 && avgC <= 80, `Champ overall avg ~75–78 (got ${avgC.toFixed(2)})`);
assert(avgC < currentAvg - 4, `Champ avg below SL avg (${avgC.toFixed(2)} vs ${currentAvg.toFixed(2)})`);

const byClub: Record<string, number[]> = {};
for (const p of players) {
  (byClub[p.clubId] ??= []).push(p.peakRating);
}
const clubAvgs = CHAMPIONSHIP_CLUBS.map((c) => {
  const rs = byClub[c.id] ?? [];
  const avg = rs.reduce((s, r) => s + r, 0) / Math.max(1, rs.length);
  return { club: c.name, id: c.id, strength: c.baseStrength, avg };
});
clubAvgs.sort((a, b) => a.avg - b.avg);
const weakest = clubAvgs[0]!;
const strongest = clubAvgs[clubAvgs.length - 1]!;
assert(
  strongest.avg > weakest.avg + 1.5,
  `Strong clubs beat weak clubs (${strongest.club} ${strongest.avg.toFixed(2)} > ${weakest.club} ${weakest.avg.toFixed(2)})`
);

const byPos: Record<string, number[]> = {};
for (const p of players) {
  (byPos[p.position] ??= []).push(p.peakRating);
}
const posAvgs = Object.entries(byPos).map(([pos, rs]) => ({
  pos,
  avg: rs.reduce((s, r) => s + r, 0) / rs.length,
}));

const elite = players
  .filter((p) => p.peakRating >= 85)
  .sort((a, b) => b.peakRating - a.peakRating);

assert(elite.length > 0, `Has elite 85+ players (${elite.length})`);
assert(elite.length < 80, `Elite 85+ remain rare (${elite.length}/500)`);

console.log("\nMistaken floor-80 remap (not flat −10)\n");
const fakePeers = [80, 81, 82, 83, 84, 85, 86];
const mapped80 = correctMistakenChampionshipFloor80Rating(80, {
  clubId: weakest.id,
  peerRatings: fakePeers,
  position: "PROP" as Position,
  slotHint: 20,
});
const mapped89 = correctMistakenChampionshipFloor80Rating(89, {
  clubId: strongest.id,
  peerRatings: fakePeers,
  position: "STAND_OFF" as Position,
  slotHint: 0,
});
assert(mapped80 >= 70 && mapped80 <= 76, `Depth 80 remaps near 70–76 (got ${mapped80})`);
assert(mapped89 >= 85, `Elite 89 stays elite (got ${mapped89})`);
assert(mapped89 - mapped80 >= 8, "Remap preserves spread (not flat −10)");

// Build a fake mistaken squad (all 80+) and remap
const mistaken: Record<string, ChampionshipGeneratedPlayer> = {};
for (const p of players.slice(0, 25)) {
  mistaken[p.id] = { ...p, peakRating: 80 + (p.peakRating % 10) };
}
const remapped = remapChampionshipSquadRatings(mistaken);
const remapMin = Math.min(...Object.values(remapped).map((p) => p.peakRating));
assert(remapMin < 80, `Remap produces sub-80 depth (min ${remapMin})`);

console.log("\nSave migration\n");
const career = createNewCareer("Leeds Rhinos");
const migrated = migratePlayerRatingsV4(career);
assert(
  migrated.playerRatingSchemaVersion === 4,
  "career schema version 4"
);
assert(
  migrated.championshipRatingScaleVersion === 2,
  "career champ scale version 2"
);
const mPlayers = Object.values(migrated.championshipSquads?.players ?? {});
assert(mPlayers.length === 500, "migration keeps 500 players");
assert(
  Math.min(...mPlayers.map((p) => p.peakRating)) >= 70,
  "migrated champ min >= 70"
);
assert(
  Math.min(...mPlayers.map((p) => p.peakRating)) < 80,
  "migrated champ not all floored to 80"
);

// Idempotent
const again = migratePlayerRatingsV4(migrated);
assert(
  JSON.stringify(
    Object.values(again.championshipSquads!.players).map((p) => [
      p.id,
      p.peakRating,
    ])
  ) ===
    JSON.stringify(
      Object.values(migrated.championshipSquads!.players).map((p) => [
        p.id,
        p.peakRating,
      ])
    ),
  "migration is idempotent"
);

const report = {
  floors: {
    current: CURRENT_SUPER_LEAGUE_MIN_RATING,
    historic: HISTORIC_PLAYER_MIN_RATING,
    championship: CHAMPIONSHIP_PLAYER_MIN_RATING,
  },
  generatedVersion: GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
  schemaVersion: PLAYER_RATING_SCHEMA_VERSION,
  championshipRatingScaleVersion: CHAMPIONSHIP_RATING_SCALE_VERSION,
  championshipOverall: { min: minC, max: maxC, avg: Number(avgC.toFixed(2)) },
  superLeagueCurrentAvg: Number(currentAvg.toFixed(2)),
  averageByClub: clubAvgs.map((c) => ({
    ...c,
    avg: Number(c.avg.toFixed(2)),
  })),
  averageByPosition: posAvgs.map((p) => ({
    pos: p.pos,
    avg: Number(p.avg.toFixed(2)),
  })),
  elite85Plus: elite.map((p) => ({
    id: p.id,
    name: p.name,
    club: p.clubName,
    position: p.position,
    peakRating: p.peakRating,
    age: p.age,
  })),
  passed,
  failed,
};

writeFileSync(
  join(__dirname, "..", "data", "championship-rating-scale-report.json"),
  JSON.stringify(report, null, 2)
);

console.log(`\n${passed} passed, ${failed} failed`);
console.log("Wrote data/championship-rating-scale-report.json");
if (failed > 0) process.exit(1);
