/**
 * Merge data/player-additions.json into main player databases.
 * Run: npm run merge:players
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type RawPlayer = Record<string, unknown> & { id: string; category: string };

const DATA_DIR = join(__dirname, "..", "data");
const additions = JSON.parse(
  readFileSync(join(DATA_DIR, "player-additions.json"), "utf-8")
) as {
  current: RawPlayer[];
  historic: RawPlayer[];
  legend: RawPlayer[];
};

function mergeInto(file: string, incoming: RawPlayer[]): number {
  const path = join(DATA_DIR, file);
  const existing = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];
  const ids = new Set(existing.map((p) => p.id));
  let added = 0;

  for (const player of incoming) {
    if (ids.has(player.id)) {
      console.log(`  skip duplicate: ${player.id}`);
      continue;
    }
    existing.push(player);
    ids.add(player.id);
    added++;
  }

  writeFileSync(path, JSON.stringify(existing, null, 2) + "\n");
  return added;
}

console.log("Merging player additions…\n");
const a = mergeInto("current-squads.json", additions.current);
const b = mergeInto("historic-players.json", additions.historic);
const c = mergeInto("legends.json", additions.legend ?? []);
console.log(`Added ${a} current, ${b} historic, ${c} legend players.`);
