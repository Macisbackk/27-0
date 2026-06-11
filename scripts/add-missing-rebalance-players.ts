/**
 * Add/map missing rating-rebalance players.
 * Run: npx tsx scripts/add-missing-rebalance-players.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ratingToValue } from "../src/lib/players/ratings";
import slIndex from "../data/superleague-player-index.json";

const ROOT = join(__dirname, "..");
const RECORDS_PATH = join(ROOT, "data", "missing-player-records.json");

type Position =
  | "FULLBACK"
  | "WING"
  | "CENTRE"
  | "STAND_OFF"
  | "SCRUM_HALF"
  | "PROP"
  | "HOOKER"
  | "SECOND_ROW"
  | "LOOSE_FORWARD";

interface PlayerRecord {
  id: string;
  name: string;
  position: Position;
  club: string;
  nationality: string;
  era: "CONTEMPORARY_ERA";
  yearsActive: string;
  category: "current" | "historic";
  peakRating: number;
  rating: number;
  value: number;
  intlCaps: number;
  appearances?: number;
  tries?: number;
}

interface MapEntry {
  action: "map";
  batchName: string;
  existingId: string;
  displayName: string;
  rating: number;
}

interface AddEntry {
  name: string;
  rating: number;
  club: string;
  position: Position;
  nationality: string;
  yearsActive: string;
  category: "current" | "historic";
  intlCaps?: number;
  appearances?: number;
  tries?: number;
}

type RecordEntry = MapEntry | AddEntry;

function isMapEntry(e: RecordEntry): e is MapEntry {
  return "action" in e && e.action === "map";
}

const CLUB_ID: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Wakefield Trinity": "wakefield",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Toulouse Olympique": "toulouse",
  "London Broncos": "london",
  "St Helens": "st-helens",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Wigan Warriors": "wigan",
  "Leigh Leopards": "leigh",
  "Sheffield Eagles": "sheffield",
  "York Knights": "york",
  "Oldham RLFC": "oldham",
};

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''.]/g, "")
    .replace(/\s+jr\.?$/i, "-jr")
    .replace(/\s+sr\.?$/i, "-sr")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slPositionToEnum(raw: string | null): Position | null {
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (p.includes("full")) return "FULLBACK";
  if (p.includes("wing")) return "WING";
  if (p.includes("centre") || p.includes("center")) return "CENTRE";
  if (p.includes("stand")) return "STAND_OFF";
  if (p.includes("scrum")) return "SCRUM_HALF";
  if (p.includes("hooker")) return "HOOKER";
  if (p.includes("second")) return "SECOND_ROW";
  if (p.includes("loose")) return "LOOSE_FORWARD";
  if (p.includes("prop")) return "PROP";
  return null;
}

function enrichFromSlIndex(entry: AddEntry): AddEntry {
  const rec = slIndex.players[normalizeKey(entry.name) as keyof typeof slIndex.players];
  if (!rec) return entry;
  const pos = slPositionToEnum(rec.position);
  return {
    ...entry,
    position: pos ?? entry.position,
    appearances: entry.appearances ?? rec.careerAppearances ?? undefined,
    tries: entry.tries ?? rec.careerTries ?? undefined,
  };
}

function makeId(entry: AddEntry): string {
  const clubPrefix = CLUB_ID[entry.club] ?? slugify(entry.club);
  const cat = entry.category === "historic" ? "hist" : "cur";
  return `${clubPrefix}-${cat}-${slugify(entry.name)}`;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function saveJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function buildPlayer(entry: AddEntry): PlayerRecord {
  const enriched = enrichFromSlIndex(entry);
  const rating = enriched.rating;
  const player: PlayerRecord = {
    id: makeId(enriched),
    name: enriched.name,
    position: enriched.position,
    club: enriched.club,
    nationality: enriched.nationality,
    era: "CONTEMPORARY_ERA",
    yearsActive: enriched.yearsActive,
    category: enriched.category,
    peakRating: rating,
    rating,
    value: ratingToValue(rating),
    intlCaps: enriched.intlCaps ?? 0,
  };
  if (enriched.appearances != null) player.appearances = enriched.appearances;
  if (enriched.tries != null) player.tries = enriched.tries;
  return player;
}

function main() {
  const records = loadJson<RecordEntry[]>(RECORDS_PATH);
  const currentPath = join(ROOT, "data", "current-squads.json");
  const historicPath = join(ROOT, "data", "historic-players.json");
  const additionsPath = join(ROOT, "data", "player-additions.json");

  const current = loadJson<PlayerRecord[]>(currentPath);
  const historic = loadJson<PlayerRecord[]>(historicPath);
  const additions = loadJson<{ current?: PlayerRecord[]; historic?: PlayerRecord[] }>(
    additionsPath
  );

  const allIds = new Set([
    ...current.map((p) => p.id),
    ...historic.map((p) => p.id),
  ]);
  const allNames = new Set([
    ...current.map((p) => normalizeKey(p.name)),
    ...historic.map((p) => normalizeKey(p.name)),
  ]);

  const added: PlayerRecord[] = [];
  const mapped: string[] = [];

  for (const entry of records) {
    if (isMapEntry(entry)) {
      const idx = current.findIndex((p) => p.id === entry.existingId);
      if (idx === -1) {
        console.error(`Map target not found: ${entry.existingId}`);
        continue;
      }
      current[idx].name = entry.displayName;
      current[idx].peakRating = entry.rating;
      current[idx].rating = entry.rating;
      current[idx].value = ratingToValue(entry.rating);
      allNames.add(normalizeKey(entry.displayName));
      mapped.push(`${entry.batchName} → ${entry.existingId} (${entry.rating})`);
      continue;
    }

    const key = normalizeKey(entry.name);
    if (allNames.has(key)) {
      console.warn(`Skip duplicate name: ${entry.name}`);
      continue;
    }

    const player = buildPlayer(entry);
    if (allIds.has(player.id)) {
      console.warn(`Skip duplicate id: ${player.id}`);
      continue;
    }

    if (player.category === "historic") {
      historic.push(player);
      additions.historic = additions.historic ?? [];
      additions.historic.push(player);
    } else {
      current.push(player);
      additions.current = additions.current ?? [];
      additions.current.push(player);
    }

    allIds.add(player.id);
    allNames.add(key);
    added.push(player);
  }

  saveJson(currentPath, current);
  saveJson(historicPath, historic);
  saveJson(additionsPath, additions);

  console.log(`\n✅ Missing players processed`);
  console.log(`   Mapped: ${mapped.length}`);
  mapped.forEach((m) => console.log(`     - ${m}`));
  console.log(`   Added: ${added.length}`);
  added.forEach((p) =>
    console.log(
      `     - ${p.name} (${p.id}) ${p.rating} ${p.club} ${p.position} ${p.yearsActive}`
    )
  );
}

main();
