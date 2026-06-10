/**
 * Player rating/type corrections — batch 2.
 * Run: npm run fix:players-batch2
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
  const band = (
    r: number,
    rMin: number,
    rMax: number,
    vMin: number,
    vMax: number
  ) => {
    const t = Math.max(0, Math.min(1, (r - rMin) / (rMax - rMin)));
    return Math.round((vMin + t * (vMax - vMin)) / 1_000) * 1_000;
  };
  if (rating >= 95) return band(rating, 95, 99, 500_000, 750_000);
  if (rating >= 90) return band(rating, 90, 94, 250_000, 500_000);
  if (rating >= 85) return band(rating, 85, 89, 150_000, 280_000);
  if (rating >= 80) return band(rating, 80, 84, 90_000, 180_000);
  return band(rating, 75, 79, 45_000, 100_000);
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

const DEMOTE: Array<{
  legendId: string;
  historicId: string;
  name: string;
  rating: number;
  nationality?: string;
}> = [
  {
    legendId: "wigan-leg-terry-newton",
    historicId: "wigan-hist-terry-newton",
    name: "Terry Newton",
    rating: 94,
    nationality: "England",
  },
  {
    legendId: "leeds-leg-richard-mathers",
    historicId: "leeds-hist-richard-mathers",
    name: "Richard Mathers",
    rating: 89,
  },
  {
    legendId: "leeds-leg-mark-calderwood",
    historicId: "leeds-hist-mark-calderwood",
    name: "Mark Calderwood",
    rating: 87,
  },
  {
    legendId: "hull-fc-leg-danny-tickle",
    historicId: "hull-fc-hist-danny-tickle",
    name: "Danny Tickle",
    rating: 89,
  },
  {
    legendId: "castleford-leg-jon-wells",
    historicId: "castleford-hist-jon-wells",
    name: "Jon Wells",
    rating: 85,
  },
];

const LEGEND_UPDATES: Array<{
  id: string;
  rating: number;
  name?: string;
}> = [
  { id: "wakefield-leg-stefan-ratchford", rating: 88 },
  { id: "andrew-johns", rating: 96 },
  { id: "jason-robinson", rating: 95 },
  { id: "garry-schofield", rating: 96, name: "Garry Schofield" },
];

function applyRating(p: RawPlayer, rating: number, nationality?: string, name?: string) {
  p.peakRating = rating;
  p.rating = rating;
  p.value = ratingToValue(rating);
  if (nationality) p.nationality = nationality;
  if (name) p.name = name;
}

function toHistoric(source: RawPlayer, target: (typeof DEMOTE)[number]): RawPlayer {
  const pos = source.position as string;
  return {
    id: target.historicId,
    name: target.name,
    position: POSITION_MAP[pos] ?? pos,
    club: source.club,
    nationality: target.nationality ?? (source.nationality as string),
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

const legendsPath = join(DATA_DIR, "legends.json");
const historicPath = join(DATA_DIR, "historic-players.json");
const overridesPath = join(DATA_DIR, "rating-overrides.json");

let legends = JSON.parse(readFileSync(legendsPath, "utf-8")) as RawPlayer[];
let historic = JSON.parse(readFileSync(historicPath, "utf-8")) as RawPlayer[];
const overrides = JSON.parse(readFileSync(overridesPath, "utf-8")) as Record<
  string,
  number
>;

const demoteIds = new Set(DEMOTE.map((d) => d.legendId));
const legendById = new Map(legends.map((p) => [p.id, p]));
const removed: string[] = [];
const added: string[] = [];
const updated: string[] = [];

legends = legends.filter((p) => {
  if (!demoteIds.has(p.id)) return true;
  removed.push(p.name);
  return false;
});

const historicById = new Map(historic.map((p) => [p.id, p]));

for (const target of DEMOTE) {
  const source = legendById.get(target.legendId);
  if (!source) continue;
  historicById.set(target.historicId, toHistoric(source, target));
  overrides[target.historicId] = target.rating;
  added.push(`${target.name} → ${target.rating} historic`);
}

for (const fix of LEGEND_UPDATES) {
  const p = legends.find((x) => x.id === fix.id);
  if (!p) {
    console.warn(`Legend not found: ${fix.id}`);
    continue;
  }
  applyRating(p, fix.rating, undefined, fix.name);
  overrides[fix.id] = fix.rating;
  updated.push(`${p.name} → ${fix.rating} legend`);
}

historic = Array.from(historicById.values());

writeFileSync(legendsPath, JSON.stringify(legends, null, 2) + "\n");
writeFileSync(historicPath, JSON.stringify(historic, null, 2) + "\n");
writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + "\n");

console.log("Removed from legends:", removed.join(", "));
console.log("Added historic:", added.join("\n  "));
console.log("Updated legends:", updated.join("\n  "));
