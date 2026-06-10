/**
 * Consolidate Mick/Mickey Higham into one historic Warrington record.
 * Run: npm run fix:mickey-higham
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  category?: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  club?: string;
};

const OLD_IDS = new Set([
  "wakefield-leg-mick-higham",
  "leigh-hist-mickey-higham",
]);
const NEW_ID = "warrington-hist-mickey-higham";

const legends = JSON.parse(
  readFileSync(join(DATA_DIR, "legends.json"), "utf-8")
) as RawPlayer[];
let historic = JSON.parse(
  readFileSync(join(DATA_DIR, "historic-players.json"), "utf-8")
) as RawPlayer[];
const overrides = JSON.parse(
  readFileSync(join(DATA_DIR, "rating-overrides.json"), "utf-8")
) as Record<string, number>;

const mickLegend = legends.find((p) => p.id === "wakefield-leg-mick-higham");
const mickeyHistoric = historic.find((p) => p.id === "leigh-hist-mickey-higham");

const source = mickeyHistoric ?? mickLegend;
if (!source) {
  console.error("No Mickey/Mick Higham record found.");
  process.exit(1);
}

const rating = (source.peakRating ?? source.rating ?? 90) as number;

const consolidated: RawPlayer = {
  ...source,
  id: NEW_ID,
  name: "Mickey Higham",
  club: "Warrington Wolves",
  position: "Hooker",
  category: "historic",
  nationality: "England",
  peakRating: rating,
  rating,
  value: source.value ?? 250000,
};

const newLegends = legends.filter((p) => !OLD_IDS.has(p.id));
historic = historic.filter((p) => !OLD_IDS.has(p.id));
historic.push(consolidated);

delete overrides["leigh-hist-mickey-higham"];
delete overrides["wakefield-leg-mick-higham"];
overrides[NEW_ID] = rating;

writeFileSync(join(DATA_DIR, "legends.json"), JSON.stringify(newLegends, null, 2) + "\n");
writeFileSync(
  join(DATA_DIR, "historic-players.json"),
  JSON.stringify(historic, null, 2) + "\n"
);
writeFileSync(
  join(DATA_DIR, "rating-overrides.json"),
  JSON.stringify(overrides, null, 2) + "\n"
);

console.log("Mickey Higham consolidated:");
console.log(`  id: ${NEW_ID}`);
console.log(`  club: Warrington Wolves`);
console.log(`  category: historic`);
console.log(`  rating: ${rating}`);
console.log(`  removed legend Mick Higham: ${!!mickLegend}`);
