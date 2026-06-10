/**
 * Remove cross-file duplicate players (normalized name).
 * Run: npm run audit:duplicates
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  category?: string;
  peakRating?: number;
  rating?: number;
};

const DATA_DIR = join(__dirname, "..", "data");
const FILES = [
  { file: "current-squads.json", priority: 1 },
  { file: "historic-players.json", priority: 2 },
  { file: "legends.json", priority: 3 },
] as const;

const HIDDEN_IDS = new Set(["jm-goat-joe-mellor"]);

function normalizeName(name: string): string {
  let key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (key.startsWith("gary ")) key = `garry ${key.slice(5)}`;
  return key;
}

function scorePlayer(p: RawPlayer, filePriority: number): number {
  const category = (p.category as string) ?? "current";
  const catScore =
    category === "legend" ? 30 : category === "historic" ? 20 : 10;
  const rating = (p.peakRating ?? p.rating ?? 0) as number;
  return catScore + rating + filePriority * 0.1;
}

const allEntries: Array<{
  file: string;
  priority: number;
  player: RawPlayer;
  index: number;
}> = [];

for (const { file, priority } of FILES) {
  const players = JSON.parse(
    readFileSync(join(DATA_DIR, file), "utf-8")
  ) as RawPlayer[];
  players.forEach((player, index) => {
    if (HIDDEN_IDS.has(player.id)) return;
    allEntries.push({ file, priority, player, index });
  });
}

const byName = new Map<string, typeof allEntries>();
for (const entry of allEntries) {
  const key = normalizeName(entry.player.name);
  const list = byName.get(key) ?? [];
  list.push(entry);
  byName.set(key, list);
}

const toRemove = new Map<string, Set<number>>();

for (const [nameKey, entries] of byName) {
  if (entries.length <= 1) continue;
  const sorted = [...entries].sort(
    (a, b) => scorePlayer(b.player, b.priority) - scorePlayer(a.player, a.priority)
  );
  const keeper = sorted[0];
  const removed = sorted.slice(1);
  console.log(
    `Duplicate "${keeper.player.name}" — keeping ${keeper.file}#${keeper.player.id}, removing ${removed.length}`
  );
  for (const r of removed) {
    const set = toRemove.get(r.file) ?? new Set<number>();
    set.add(r.index);
    toRemove.set(r.file, set);
  }
}

for (const { file } of FILES) {
  const path = join(DATA_DIR, file);
  const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];
  const removeIdx = toRemove.get(file);
  if (!removeIdx || removeIdx.size === 0) continue;
  const filtered = players.filter((_, i) => !removeIdx.has(i));
  writeFileSync(path, JSON.stringify(filtered, null, 2) + "\n");
  console.log(`Wrote ${file}: removed ${removeIdx.size}, ${filtered.length} remain`);
}

console.log("\nDuplicate audit complete.");
