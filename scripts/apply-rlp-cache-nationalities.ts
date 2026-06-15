/**
 * Apply nationality from RLP cache files by player name (no network, no list HTML).
 * Run: npx tsx scripts/apply-rlp-cache-nationalities.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import {
  nameKey,
  nationalityFromPlaceOfBirth,
  parsePlaceOfBirth,
} from "./lib/rlp-parse";

const DATA_DIR = join(__dirname, "..", "data");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;

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
    if (nat) map.set(nameKey(name), nat);
  }
  return map;
}

function isSkipped(player: {
  id: string;
  availableInGame?: boolean;
}): boolean {
  if (player.availableInGame === false) return true;
  if (player.id === "jm-goat-joe-mellor") return true;
  if (player.id.startsWith("ssh-sam-hallas-")) return true;
  return false;
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
      id: string;
      name: string;
      nationality: string;
      availableInGame?: boolean;
    }[];
    let changed = false;

    for (const player of players) {
      if (isSkipped(player) || player.nationality !== "Unknown") continue;
      const nat = nameToNat.get(nameKey(player.name));
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
