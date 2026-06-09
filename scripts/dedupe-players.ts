/**
 * Remove duplicate real players across player JSON files.
 * Keeps one record per normalized name; priority: legend > historic > current.
 * Run: npx tsx scripts/dedupe-players.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const GOAT_ID = "jm-goat-joe-mellor";

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  category: string;
  peakRating?: number;
  appearances?: number;
};

function norm(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryRank(c: string): number {
  if (c === "legend") return 3;
  if (c === "historic") return 2;
  return 1;
}

function pickBest(players: Raw[]): Raw {
  return [...players].sort((a, b) => {
    const cr = categoryRank(b.category) - categoryRank(a.category);
    if (cr !== 0) return cr;
    const apps =
      (b.appearances ?? 0) - (a.appearances ?? 0);
    if (apps !== 0) return apps;
    return (b.peakRating ?? 0) - (a.peakRating ?? 0);
  })[0];
}

function dedupeFile(file: string, globalKeepIds: Set<string>): number {
  const path = join(DATA_DIR, file);
  const players = JSON.parse(readFileSync(path, "utf-8")) as Raw[];
  const before = players.length;
  const kept = players.filter(
    (p) => p.id === GOAT_ID || globalKeepIds.has(p.id)
  );
  writeFileSync(path, JSON.stringify(kept, null, 2) + "\n");
  return before - kept.length;
}

function main() {
  const current = JSON.parse(
    readFileSync(join(DATA_DIR, "current-squads.json"), "utf-8")
  ) as Raw[];
  const historic = JSON.parse(
    readFileSync(join(DATA_DIR, "historic-players.json"), "utf-8")
  ) as Raw[];
  const legends = JSON.parse(
    readFileSync(join(DATA_DIR, "legends.json"), "utf-8")
  ) as Raw[];

  const all = [
    ...legends.map((p) => ({ ...p, _file: "legends" as const })),
    ...historic.map((p) => ({ ...p, _file: "historic" as const })),
    ...current.map((p) => ({ ...p, _file: "current" as const })),
  ].filter((p) => p.id !== GOAT_ID);

  const byName = new Map<string, (Raw & { _file: string })[]>();
  for (const p of all) {
    const key = norm(p.name);
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
  }

  const keepIds = new Set<string>([GOAT_ID]);
  let dupGroups = 0;

  for (const [, group] of byName) {
    if (group.length === 1) {
      keepIds.add(group[0].id);
      continue;
    }
    dupGroups++;
    const best = pickBest(group);
    keepIds.add(best.id);
    console.log(
      `  keep ${best.name} → ${best.id} (${best.category}), drop ${group.length - 1}`
    );
  }

  const r1 = dedupeFile("legends.json", keepIds);
  const r2 = dedupeFile("historic-players.json", keepIds);
  const r3 = dedupeFile("current-squads.json", keepIds);

  console.log(`\nDuplicate name groups: ${dupGroups}`);
  console.log(`Removed: ${r1} legend, ${r2} historic, ${r3} current`);
  console.log(`Unique players kept: ${keepIds.size}`);
}

main();
