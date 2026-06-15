/**
 * Player rating patch + Kieran Gill — Jun 2026
 * Run: npx tsx scripts/apply-rating-patch-jun2026b.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { PlayerCategory, Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");

interface RawPlayer {
  id: string;
  name: string;
  position: Position;
  category: PlayerCategory;
  peakRating?: number;
  rating?: number;
  value?: number;
  club?: string;
  nationality?: string;
  era?: string;
  yearsActive?: string;
  intlCaps?: number;
  appearances?: number;
  tries?: number;
  clubLegend?: boolean;
}

const RATING_PATCH: Record<string, number> = {
  "wakefield-hist-joe-arundel": 83,
  "bradford-cur-eribe-doro": 83,
  "huddersfield-hist-tom-holmes": 83,
  "hull-kr-cur-will-oakes": 80,
};

const KIERAN_GILL: RawPlayer = {
  id: "bradford-hist-kieran-gill",
  name: "Kieran Gill",
  position: "CENTRE",
  club: "Bradford Bulls",
  nationality: "England",
  era: "MODERN_ERA",
  yearsActive: "2016–2026",
  category: "historic",
  peakRating: 79,
  rating: 79,
  value: computePlayerValue(79, "CENTRE", "historic"),
  intlCaps: 0,
  appearances: 188,
  tries: 145,
  clubLegend: false,
};

function updatePlayer(players: RawPlayer[], id: string, target: number) {
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error(`Player not found: ${id}`);
  const from = player.rating ?? player.peakRating ?? 0;
  const valueFrom = player.value ?? 0;
  const valueTo = computePlayerValue(target, player.position, player.category);
  player.peakRating = target;
  player.rating = target;
  player.value = valueTo;
  console.log(
    `  ${player.name}: ${from} → ${target} | value ${valueFrom.toLocaleString()} → ${valueTo.toLocaleString()}`
  );
}

function main() {
  const currentPath = join(ROOT, "data", "current-squads.json");
  const historicPath = join(ROOT, "data", "historic-players.json");

  const current = JSON.parse(readFileSync(currentPath, "utf8")) as RawPlayer[];
  const historic = JSON.parse(readFileSync(historicPath, "utf8")) as RawPlayer[];

  console.log("Current players:");
  updatePlayer(current, "bradford-cur-eribe-doro", RATING_PATCH["bradford-cur-eribe-doro"]);
  updatePlayer(current, "hull-kr-cur-will-oakes", RATING_PATCH["hull-kr-cur-will-oakes"]);

  console.log("\nHistoric players:");
  updatePlayer(historic, "wakefield-hist-joe-arundel", RATING_PATCH["wakefield-hist-joe-arundel"]);
  updatePlayer(historic, "huddersfield-hist-tom-holmes", RATING_PATCH["huddersfield-hist-tom-holmes"]);

  const existingGill = historic.find((p) => p.id === KIERAN_GILL.id);
  if (existingGill) {
    Object.assign(existingGill, KIERAN_GILL);
    console.log(`\nUpdated existing Kieran Gill (${KIERAN_GILL.rating})`);
  } else {
    const sammutIdx = historic.findIndex((p) => p.id === "bradford-hist-jarrod-sammut");
    if (sammutIdx === -1) throw new Error("jarrod-sammut anchor not found");
    historic.splice(sammutIdx + 1, 0, KIERAN_GILL);
    console.log(`\nAdded Kieran Gill (${KIERAN_GILL.rating})`);
  }

  writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  writeFileSync(historicPath, `${JSON.stringify(historic, null, 2)}\n`, "utf8");
  console.log("\nDone.");
}

main();
