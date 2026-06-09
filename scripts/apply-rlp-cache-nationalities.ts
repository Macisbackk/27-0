/**
 * Apply nationality from RLP cache files by player name (no network, no list HTML).
 * Run: npx tsx scripts/apply-rlp-cache-nationalities.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["historic-players.json", "legends.json"] as const;

const KNOWN_NATIONALITIES = new Set([
  "Australia",
  "Cook Islands",
  "England",
  "Fiji",
  "France",
  "Ireland",
  "Italy",
  "Jamaica",
  "Lebanon",
  "New Zealand",
  "Papua New Guinea",
  "Samoa",
  "Scotland",
  "Serbia",
  "Tonga",
  "Wales",
]);

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nationalityFromPlaceOfBirth(place: string): string | null {
  const lower = place.toLowerCase();
  if (lower.includes("scotland")) return "Scotland";
  if (lower.includes("wales")) return "Wales";
  if (lower.includes("northern ireland")) return "Ireland";
  if (lower.includes("england")) return "England";
  if (lower.includes("ireland")) return "Ireland";
  if (lower.includes("australia")) return "Australia";
  if (lower.includes("new zealand")) return "New Zealand";
  if (lower.includes("france")) return "France";
  if (lower.includes("samoa")) return "Samoa";
  if (lower.includes("tonga")) return "Tonga";
  if (lower.includes("fiji")) return "Fiji";
  if (lower.includes("papua")) return "Papua New Guinea";
  if (lower.includes("cook islands")) return "Cook Islands";
  if (lower.includes("lebanon")) return "Lebanon";
  if (lower.includes("jamaica")) return "Jamaica";
  if (lower.includes("italy")) return "Italy";
  if (lower.includes("serbia")) return "Serbia";
  const last = place.split(",").pop()?.trim();
  if (last && KNOWN_NATIONALITIES.has(last)) return last;
  return null;
}

function parsePlaceOfBirth(html: string): string | null {
  const m = html.match(/<dt>Place Of Birth<\/dt>\s*<dd>([^<]+)<\/dd>/i);
  return m?.[1]?.trim() ?? null;
}

function parsePlayerName(html: string): string | null {
  const m = html.match(/<title>([^<]+?)\s*-\s*RLP<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function buildNameToNat(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(CACHE_DIR)) return map;

  for (const file of readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(join(CACHE_DIR, file), "utf-8");
    const name = parsePlayerName(html);
    const place = parsePlaceOfBirth(html);
    if (!name || !place) continue;
    const nat = nationalityFromPlaceOfBirth(place);
    if (nat) map.set(normalizeName(name), nat);
  }
  return map;
}

function main() {
  const nameToNat = buildNameToNat();
  console.log(`Cache entries with nationality: ${nameToNat.size}`);
  if (nameToNat.size === 0) {
    console.log("No cache data.");
    return;
  }

  let updated = 0;

  for (const file of FILES) {
    const path = join(DATA_DIR, file);
    const players = JSON.parse(readFileSync(path, "utf-8")) as {
      name: string;
      nationality: string;
    }[];
    let changed = false;

    for (const player of players) {
      if (player.nationality !== "Unknown") continue;
      const nat = nameToNat.get(normalizeName(player.name));
      if (!nat) continue;
      player.nationality = nat;
      updated++;
      changed = true;
    }

    if (changed) writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
    console.log(`${file}: ${changed ? "updated" : "unchanged"}`);
  }

  console.log(`Nationality updated from cache: ${updated}`);
}

main();
