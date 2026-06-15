/**
 * Apply batch player rating updates from data/rating-rebalance-batch.json
 * Run: npx tsx scripts/apply-rating-rebalance.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";

const ROOT = join(__dirname, "..");
const BATCH_PATH = join(ROOT, "data", "rating-rebalance-batch.json");

const EXCLUDED_IDS = new Set([
  "jm-goat-joe-mellor",
]);

const EXCLUDED_PREFIXES = ["ssh-sam-hallas-"];

/** Alternate spellings in batch file → normalized DB name key */
const NAME_ALIASES: Record<string, string> = {
  "justin sangaré": "justin sangare",
};

interface RawPlayer {
  id: string;
  name: string;
  peakRating?: number;
  rating?: number;
  category?: string;
  [key: string]: unknown;
}

function normalizeName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return NAME_ALIASES[base] ?? base;
}

function isExcluded(id: string): boolean {
  if (EXCLUDED_IDS.has(id)) return true;
  if (PLAYER_RATING_OVERRIDES[id] !== undefined) return true;
  return EXCLUDED_PREFIXES.some((p) => id.startsWith(p));
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function saveJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function applyToPlayers(
  players: RawPlayer[],
  ratingMap: Map<string, number>,
  source: string,
  updates: { id: string; name: string; from: number; to: number; file: string }[],
  notFound: Set<string>,
  duplicateNames: Map<string, RawPlayer[]>
): void {
  const byName = new Map<string, RawPlayer[]>();
  for (const p of players) {
    if (isExcluded(p.id)) continue;
    const key = normalizeName(p.name);
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
  }

  for (const [name, list] of byName) {
    if (list.length > 1 && list.every((p) => p.category === "current")) {
      duplicateNames.set(name, list);
    }
  }

  for (const [name, targetRating] of ratingMap) {
    const matches = byName.get(name);
    if (!matches || matches.length === 0) {
      notFound.add(name);
      continue;
    }

    if (matches.length > 1) {
      const currentMatches = matches.filter((p) => p.category === "current");
      const toUpdate =
        currentMatches.length === 1
          ? currentMatches
          : currentMatches.length > 1
            ? currentMatches
            : matches.length === 1
              ? matches
              : [matches[0]];

      if (currentMatches.length > 1) {
        console.warn(
          `  ⚠ Multiple current records for "${matches[0].name}" — updating all ${currentMatches.length}`
        );
      }

      for (const p of toUpdate) {
        const from = p.peakRating ?? p.rating ?? 0;
        if (from === targetRating && (p.rating ?? from) === targetRating) continue;
        p.peakRating = targetRating;
        p.rating = targetRating;
        updates.push({
          id: p.id,
          name: p.name,
          from,
          to: targetRating,
          file: source,
        });
      }
      continue;
    }

    const p = matches[0];
    const from = p.peakRating ?? p.rating ?? 0;
    if (from === targetRating && (p.rating ?? from) === targetRating) continue;
    p.peakRating = targetRating;
    p.rating = targetRating;
    updates.push({
      id: p.id,
      name: p.name,
      from,
      to: targetRating,
      file: source,
    });
  }
}

function main() {
  const batch = loadJson<{ name: string; rating: number }[]>(BATCH_PATH);
  const ratingMap = new Map<string, number>();
  for (const entry of batch) {
    ratingMap.set(normalizeName(entry.name), entry.rating);
  }

  const updates: {
    id: string;
    name: string;
    from: number;
    to: number;
    file: string;
  }[] = [];
  const notFound = new Set<string>();
  const duplicateNames = new Map<string, RawPlayer[]>();

  const currentPath = join(ROOT, "data", "current-squads.json");
  const historicPath = join(ROOT, "data", "historic-players.json");
  const additionsPath = join(ROOT, "data", "player-additions.json");
  const overridesPath = join(ROOT, "data", "rating-overrides.json");

  const current = loadJson<RawPlayer[]>(currentPath);
  const additionsNotFound = new Set<string>();
  const historicNotFound = new Set<string>();

  applyToPlayers(current, ratingMap, "current-squads.json", updates, notFound, duplicateNames);
  saveJson(currentPath, current);

  const historic = loadJson<RawPlayer[]>(historicPath);
  applyToPlayers(historic, ratingMap, "historic-players.json", updates, historicNotFound, duplicateNames);
  saveJson(historicPath, historic);

  const additions = loadJson<{ current?: RawPlayer[]; historic?: RawPlayer[] }>(additionsPath);
  if (additions.current) {
    applyToPlayers(
      additions.current,
      ratingMap,
      "player-additions.json (current)",
      updates,
      additionsNotFound,
      duplicateNames
    );
  }
  if (additions.historic) {
    applyToPlayers(
      additions.historic,
      ratingMap,
      "player-additions.json (historic)",
      updates,
      additionsNotFound,
      duplicateNames
    );
  }
  saveJson(additionsPath, additions);

  for (const name of [...notFound]) {
    if (!historicNotFound.has(name)) notFound.delete(name);
  }

  const overrides = loadJson<Record<string, number>>(overridesPath);
  let overrideUpdates = 0;
  for (const u of updates) {
    if (u.file !== "current-squads.json") continue;
    if (overrides[u.id] !== undefined) {
      overrides[u.id] = u.to;
      overrideUpdates++;
    }
  }
  const joeMellor = current.find((p) => p.id === "bradford-cur-joe-mellor");
  if (joeMellor && ratingMap.has(normalizeName("Joe Mellor"))) {
    overrides["bradford-cur-joe-mellor"] = ratingMap.get(normalizeName("Joe Mellor"))!;
    overrideUpdates++;
  }
  saveJson(overridesPath, overrides);

  const uniqueUpdates = new Map<string, (typeof updates)[0]>();
  for (const u of updates.filter((x) => x.file === "current-squads.json")) {
    uniqueUpdates.set(u.id, u);
  }

  console.log(`\n✅ Rating rebalance applied`);
  console.log(`   Players in batch: ${ratingMap.size}`);
  console.log(`   Updated (current-squads): ${uniqueUpdates.size}`);
  console.log(`   Override entries synced: ${overrideUpdates}`);

  if (notFound.size > 0) {
    console.log(`\n⚠ Not found (${notFound.size}):`);
    for (const n of [...notFound].sort()) {
      const orig = batch.find((b) => normalizeName(b.name) === n)?.name ?? n;
      console.log(`   - ${orig}`);
    }
  }

  if (duplicateNames.size > 0) {
    console.log(`\n⚠ Duplicate active names (${duplicateNames.size}):`);
    for (const [name, list] of [...duplicateNames].sort(([a], [b]) => a.localeCompare(b))) {
      console.log(
        `   - ${list[0].name}: ${list.map((p) => `${p.id}@${p.peakRating}`).join(", ")}`
      );
    }
  }
}

main();
