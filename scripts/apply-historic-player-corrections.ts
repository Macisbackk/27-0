/**
 * Move misclassified legend entries to historic with requested ratings.
 * Run: npm run fix:historic-players
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  category?: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  nationality?: string;
};

const DATA_DIR = join(__dirname, "..", "data");

function ratingToValue(rating: number): number {
  const valueInBand = (
    r: number,
    rMin: number,
    rMax: number,
    vMin: number,
    vMax: number
  ) => {
    const t = Math.max(0, Math.min(1, (r - rMin) / (rMax - rMin)));
    return Math.round((vMin + t * (vMax - vMin)) / 1_000) * 1_000;
  };
  if (rating >= 95) return valueInBand(rating, 95, 99, 500_000, 750_000);
  if (rating >= 90) return valueInBand(rating, 90, 94, 250_000, 500_000);
  if (rating >= 85) return valueInBand(rating, 85, 89, 150_000, 280_000);
  if (rating >= 80) return valueInBand(rating, 80, 84, 90_000, 180_000);
  return valueInBand(rating, 75, 79, 45_000, 100_000);
}

const POSITION_MAP: Record<string, string> = {
  CENTRE: "Centre",
  WING: "Wing",
  HOOKER: "Hooker",
  SECOND_ROW: "Second row",
  SCRUM_HALF: "Scrum-half",
  FULLBACK: "Fullback",
  PROP: "Prop",
  LOOSE_FORWARD: "Loose forward",
};

/** Legend IDs to demote → historic with exact ratings. */
const DEMOTE_FROM_LEGENDS: Array<{
  legendId: string;
  historicId: string;
  name: string;
  rating: number;
  nationality?: string;
}> = [
  { legendId: "huddersfield-leg-aaron-murphy", historicId: "huddersfield-hist-aaron-murphy", name: "Aaron Murphy", rating: 84 },
  { legendId: "wakefield-leg-ben-jeffries", historicId: "wakefield-hist-ben-jeffries", name: "Ben Jeffries", rating: 84 },
  { legendId: "castleford-leg-brett-ferres", historicId: "castleford-hist-brett-ferres", name: "Brett Ferres", rating: 88 },
  { legendId: "leeds-leg-chev-walker", historicId: "leeds-hist-chev-walker", name: "Chev Walker", rating: 87, nationality: "England" },
  { legendId: "leeds-leg-francis-cummins", historicId: "leeds-hist-francis-cummins", name: "Francis Cummins", rating: 89 },
  { legendId: "wigan-leg-gary-connolly", historicId: "wigan-hist-garry-connolly", name: "Garry Connolly", rating: 89, nationality: "England" },
  { legendId: "huddersfield-leg-jermaine-mcgillvary", historicId: "huddersfield-hist-jermaine-mcgillvary", name: "Jermaine McGillvary", rating: 90 },
  { legendId: "wigan-leg-joel-tomkins", historicId: "wigan-hist-joel-tomkins", name: "Joel Tomkins", rating: 88, nationality: "England" },
  { legendId: "hull-fc-leg-lee-radford", historicId: "hull-fc-hist-lee-radford", name: "Lee Radford", rating: 90, nationality: "England" },
  { legendId: "huddersfield-leg-leroy-cudjoe", historicId: "huddersfield-hist-leroy-cudjoe", name: "Leroy Cudjoe", rating: 87, nationality: "England" },
  { legendId: "leeds-leg-matt-diskin", historicId: "leeds-hist-matt-diskin", name: "Matt Diskin", rating: 88 },
  { legendId: "london-leg-paul-sykes", historicId: "wakefield-hist-paul-sykes", name: "Paul Sykes", rating: 87, nationality: "England" },
  { legendId: "wigan-leg-paul-johnson", historicId: "wigan-hist-paul-johnson", name: "Paul Johnson", rating: 86 },
];

const IN_PLACE_HISTORIC: Array<{
  id: string;
  rating: number;
  nationality?: string;
  name?: string;
}> = [
  { id: "leigh-hist-mickey-higham", rating: 90, nationality: "England" },
];

function toHistoricRecord(
  source: RawPlayer,
  target: (typeof DEMOTE_FROM_LEGENDS)[number]
): RawPlayer {
  const pos = source.position as string;
  const displayPos = POSITION_MAP[pos] ?? pos;
  const nationality =
    target.nationality ?? (source.nationality as string) ?? "Unknown";

  return {
    id: target.historicId,
    name: target.name,
    position: displayPos,
    club: source.club,
    nationality,
    era: source.era,
    yearsActive: source.yearsActive,
    category: "historic",
    peakRating: target.rating,
    rating: target.rating,
    value: ratingToValue(target.rating),
    appearances: source.appearances,
    tries: source.tries,
    intlCaps: source.intlCaps ?? 0,
    clubLegend: source.clubLegend ?? false,
  };
}

function applyRating(player: RawPlayer, rating: number, nationality?: string, name?: string) {
  player.peakRating = rating;
  player.rating = rating;
  player.value = ratingToValue(rating);
  player.category = "historic";
  if (nationality) player.nationality = nationality;
  if (name) player.name = name;
}

// --- Load data ---
const legendsPath = join(DATA_DIR, "legends.json");
const historicPath = join(DATA_DIR, "historic-players.json");
const overridesPath = join(DATA_DIR, "rating-overrides.json");

const legends = JSON.parse(readFileSync(legendsPath, "utf-8")) as RawPlayer[];
const historic = JSON.parse(readFileSync(historicPath, "utf-8")) as RawPlayer[];
const overrides = JSON.parse(readFileSync(overridesPath, "utf-8")) as Record<
  string,
  number
>;

const demoteIds = new Set(DEMOTE_FROM_LEGENDS.map((d) => d.legendId));
const legendById = new Map(legends.map((p) => [p.id, p]));

const removed: string[] = [];
const added: string[] = [];
const updated: string[] = [];

// Remove from legends and add to historic
const newLegends = legends.filter((p) => {
  if (!demoteIds.has(p.id)) return true;
  removed.push(p.name);
  return false;
});

const historicById = new Map(historic.map((p) => [p.id, p]));
const historicNames = new Set(historic.map((p) => p.name.toLowerCase()));

for (const target of DEMOTE_FROM_LEGENDS) {
  const source = legendById.get(target.legendId);
  if (!source) {
    console.warn(`Legend not found: ${target.legendId}`);
    continue;
  }

  // Drop stale historic duplicate by name if present
  for (const [id, p] of historicById) {
    if (p.name.toLowerCase() === target.name.toLowerCase() && id !== target.historicId) {
      historicById.delete(id);
      console.warn(`Removed duplicate historic: ${p.name} (${id})`);
    }
  }

  const record = toHistoricRecord(source, target);
  historicById.set(target.historicId, record);
  overrides[target.historicId] = target.rating;
  added.push(`${target.name} → ${target.rating} (historic)`);
  historicNames.add(target.name.toLowerCase());
}

for (const fix of IN_PLACE_HISTORIC) {
  const player = historicById.get(fix.id);
  if (!player) {
    console.warn(`Historic player not found: ${fix.id}`);
    continue;
  }
  applyRating(player, fix.rating, fix.nationality, fix.name);
  overrides[fix.id] = fix.rating;
  updated.push(`${player.name} → ${fix.rating}`);
}

writeFileSync(legendsPath, JSON.stringify(newLegends, null, 2) + "\n");
writeFileSync(
  historicPath,
  JSON.stringify(Array.from(historicById.values()), null, 2) + "\n"
);
writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + "\n");

console.log("\n=== Historic player corrections ===");
console.log(`Removed from legends (${removed.length}):`, removed.join(", "));
console.log(`Added/updated historic (${added.length}):`);
added.forEach((l) => console.log(`  ${l}`));
console.log(`In-place updates (${updated.length}):`);
updated.forEach((l) => console.log(`  ${l}`));
console.log(`Legends remaining: ${newLegends.length}`);
console.log(`Historic total: ${historicById.size}`);
