/**
 * One-off player rating patch — updates ratings and recalculates fantasy values.
 * Run: npx tsx scripts/apply-rating-patch-jun2026.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { PlayerCategory, Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");

const RATING_PATCH: Record<string, number> = {
  "st-helens-cur-jack-welsby": 88,
  "leeds-cur-harry-newman": 87,
  "wigan-cur-harry-smith": 88,
  "hull-fc-cur-herman-eseese": 88,
  "hull-fc-cur-jordan-rapana": 86,
  "wigan-cur-kaide-ellis": 85,
  "hull-fc-cur-jake-clifford": 84,
  "leeds-cur-kallum-watkins": 87,
  "catalans-cur-tevita-pangai-jr": 86,
  "hull-kr-cur-peta-hiku": 88,
  "leeds-cur-cameron-smith": 88,
  "catalans-cur-benjamin-garcia": 88,
  "warrington-cur-danny-walker": 86,
  "wakefield-cur-jake-trueman": 87,
  "york-cur-paul-vaughan": 88,
  "bradford-cur-waqa-blake": 87,
};

interface RawPlayer {
  id: string;
  name: string;
  position: Position;
  category: PlayerCategory;
  peakRating?: number;
  rating?: number;
  value?: number;
}

function main() {
  const players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as RawPlayer[];
  const updates: {
    name: string;
    from: number;
    to: number;
    valueFrom: number;
    valueTo: number;
  }[] = [];
  const notFound: string[] = [];

  for (const [id, targetRating] of Object.entries(RATING_PATCH)) {
    const player = players.find((p) => p.id === id);
    if (!player) {
      notFound.push(id);
      continue;
    }

    const from = player.rating ?? player.peakRating ?? 0;
    const valueFrom = player.value ?? 0;
    const valueTo = computePlayerValue(
      targetRating,
      player.position,
      player.category
    );

    player.peakRating = targetRating;
    player.rating = targetRating;
    player.value = valueTo;

    updates.push({
      name: player.name,
      from,
      to: targetRating,
      valueFrom,
      valueTo,
    });
  }

  writeFileSync(CURRENT_PATH, `${JSON.stringify(players, null, 2)}\n`, "utf8");

  console.log(`Updated ${updates.length} players:\n`);
  for (const u of updates) {
    console.log(
      `  ${u.name}: ${u.from} → ${u.to} | value ${u.valueFrom.toLocaleString()} → ${u.valueTo.toLocaleString()}`
    );
  }

  if (notFound.length > 0) {
    console.log(`\nNot found: ${notFound.join(", ")}`);
    process.exit(1);
  }
}

main();
