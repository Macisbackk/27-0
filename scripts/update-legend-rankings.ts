/**
 * Apply top-player rating rankings.
 * Run: npx tsx scripts/update-legend-rankings.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

type Raw = Record<string, unknown>;

const LEGEND_RATINGS: Record<string, number> = {
  "andrew-johns": 99,
  "jason-robinson": 98,
  "garry-schofield": 97,
  "ellery-hanley": 97,
  "paul-sculthorpe": 96,
  "bradford-leg-robbie-hunter-paul": 95,
  "andy-farrell": 95,
  "kevin-sinfield": 95,
  "martin-offiah": 94,
  "sam-burgess": 93,
  "jamie-peacock": 93,
  "paul-newlove": 92,
};

const HISTORIC_RATINGS: Record<string, number> = {
  "st-helens-hist-anthony-sullivan": 94,
  "st-helens-hist-ben-barba": 91,
};

const CURRENT_RATINGS: Record<string, number> = {
  "wigan-cur-bevan-french": 93,
};

function load<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
}

function save(path: string, data: unknown): void {
  writeFileSync(join(ROOT, path), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function applyRatings(players: Raw[], map: Record<string, number>): number {
  let n = 0;
  for (const p of players) {
    const id = p.id as string;
    const rating = map[id];
    if (rating === undefined) continue;
    p.peakRating = rating;
    p.rating = rating;
    n++;
  }
  return n;
}

function main() {
  const legends = load<Raw[]>("data/legends.json");
  const historic = load<Raw[]>("data/historic-players.json");
  const current = load<Raw[]>("data/current-squads.json");
  const overrides = load<Record<string, number>>("data/rating-overrides.json");

  const legendCount = applyRatings(legends, LEGEND_RATINGS);
  const historicCount = applyRatings(historic, HISTORIC_RATINGS);
  const currentCount = applyRatings(current, CURRENT_RATINGS);

  for (const [id, rating] of Object.entries({
    ...LEGEND_RATINGS,
    ...HISTORIC_RATINGS,
    ...CURRENT_RATINGS,
  })) {
    overrides[id] = rating;
  }

  save("data/legends.json", legends);
  save("data/historic-players.json", historic);
  save("data/current-squads.json", current);
  save("data/rating-overrides.json", overrides);

  console.log(`Updated legends: ${legendCount}`);
  console.log(`Updated historic: ${historicCount}`);
  console.log(`Updated current: ${currentCount}`);
  console.log(`Override keys: ${Object.keys({ ...LEGEND_RATINGS, ...HISTORIC_RATINGS, ...CURRENT_RATINGS }).length}`);
}

main();
