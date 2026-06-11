import batch from "../data/rating-rebalance-batch.json";
import current from "../data/current-squads.json";

const ALIASES: Record<string, string> = {
  "justin sangaré": "justin sangare",
};

import historic from "../data/historic-players.json";

function norm(n: string): string {
  const base = n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[base] ?? base;
}

type P = (typeof current)[0];
const byName = new Map<string, P>();
for (const p of [...current, ...historic]) {
  const k = norm(p.name);
  const existing = byName.get(k);
  if (!existing || p.category === "current") byName.set(k, p);
}

const missing: string[] = [];
const wrong: string[] = [];

for (const { name, rating } of batch) {
  const p = byName.get(norm(name));
  if (!p) {
    missing.push(name);
    continue;
  }
  const actual = p.peakRating ?? p.rating ?? 0;
  if (actual !== rating) wrong.push(`${name}: has ${actual}, want ${rating}`);
}

console.log(`Batch: ${batch.length}`);
console.log(`Missing: ${missing.length}`);
missing.sort().forEach((m) => console.log(`  - ${m}`));
console.log(`Wrong rating: ${wrong.length}`);
wrong.sort().forEach((w) => console.log(`  - ${w}`));
