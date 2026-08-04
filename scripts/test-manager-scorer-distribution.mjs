/**
 * Monte Carlo: 1000 simulated try allocations with the shared weighting rules.
 * Run: node scripts/test-manager-scorer-distribution.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Lightweight mirror of production weighting (keeps the script dependency-free).
const STARTER_TRY_WEIGHT = {
  WING: 1.5,
  CENTRE: 1.15,
  FULLBACK: 1.05,
  STAND_OFF: 0.72,
  SCRUM_HALF: 0.68,
  HOOKER: 0.32,
  LOOSE_FORWARD: 0.22,
  SECOND_ROW: 0.14,
  PROP: 0.1,
};

const BACK_MULTI = [1, 0.44, 0.19, 0.075, 0.028, 0.01];
const HALF_MULTI = [1, 0.3, 0.12, 0.045, 0.016, 0.006];
const FORWARD_MULTI = [1, 0.16, 0.055, 0.018, 0.006, 0.002];

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeWeight(w) {
  if (!Number.isFinite(w) || w < 0) return 0;
  return w;
}

function pickWeightedIndexSafe(weights, rng) {
  const clean = weights.map(sanitizeWeight);
  const sum = clean.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) {
    return Math.floor(rng() * clean.length);
  }
  let roll = rng() * sum;
  for (let i = 0; i < clean.length; i++) {
    roll -= clean[i];
    if (roll <= 0) return i;
  }
  return clean.length - 1;
}

function abilityFactor(rating, form, fitness) {
  const formMul = 0.72 + (form / 100) * 0.56;
  const fitMul = 0.55 + (fitness / 100) * 0.45;
  return Math.pow(Math.max(80, rating) / 83, 2.35) * formMul * fitMul;
}

function multiTry(already, position, rating, teamTries) {
  if (already <= 0) return 1;
  const isBack = ["WING", "CENTRE", "FULLBACK"].includes(position);
  const isHalf = ["STAND_OFF", "SCRUM_HALF", "HOOKER"].includes(position);
  const table = isBack ? BACK_MULTI : isHalf ? HALF_MULTI : FORWARD_MULTI;
  let mult = table[Math.min(already, table.length - 1)];
  if (rating >= 92 && already === 1) mult *= 1.12;
  if (already >= 3 && teamTries <= 5) mult *= 0.82;
  return mult;
}

function buildSquad() {
  const lineup = [
    { id: "fb", name: "Fullback A", position: "FULLBACK", rating: 86, form: 60, fitness: 95, reserve: false },
    { id: "w1", name: "Wing Elite", position: "WING", rating: 92, form: 65, fitness: 92, reserve: false },
    { id: "c1", name: "Centre A", position: "CENTRE", rating: 86, form: 55, fitness: 90, reserve: false },
    { id: "c2", name: "Centre B", position: "CENTRE", rating: 84, form: 50, fitness: 88, reserve: false },
    { id: "w2", name: "Wing Reserve", position: "WING", rating: 81, form: 52, fitness: 90, reserve: true },
    { id: "so", name: "Stand-off", position: "STAND_OFF", rating: 88, form: 58, fitness: 93, reserve: false },
    { id: "sh", name: "Scrum-half", position: "SCRUM_HALF", rating: 87, form: 57, fitness: 94, reserve: false },
    { id: "p1", name: "Prop A", position: "PROP", rating: 85, form: 50, fitness: 85, reserve: false },
    { id: "hk", name: "Hooker", position: "HOOKER", rating: 85, form: 54, fitness: 88, reserve: false },
    { id: "p2", name: "Prop B", position: "PROP", rating: 83, form: 48, fitness: 84, reserve: false },
    { id: "sr1", name: "Second-row A", position: "SECOND_ROW", rating: 85, form: 52, fitness: 87, reserve: false },
    { id: "sr2", name: "Second-row Low", position: "SECOND_ROW", rating: 80, form: 50, fitness: 90, reserve: true },
    { id: "lf", name: "Loose forward", position: "LOOSE_FORWARD", rating: 86, form: 56, fitness: 89, reserve: false },
  ];
  return lineup.map((p) => ({
    ...p,
    baseWeight:
      (STARTER_TRY_WEIGHT[p.position] ?? 0.5) *
      abilityFactor(p.rating, p.form, p.fitness),
  }));
}

function allocate(squad, tries, rng) {
  const alloc = new Array(squad.length).fill(0);
  for (let t = 0; t < tries; t++) {
    const weights = squad.map((p, i) =>
      sanitizeWeight(
        p.baseWeight * multiTry(alloc[i], p.position, p.rating, tries)
      )
    );
    const idx = pickWeightedIndexSafe(weights, rng);
    alloc[idx]++;
  }
  return alloc;
}

const MATCHES = 1000;
const squad = buildSquad();
const byPos = Object.fromEntries(
  Object.keys(STARTER_TRY_WEIGHT).map((p) => [p, 0])
);
const byBand = { low: 0, mid: 0, high: 0, elite: 0 };
let totalTries = 0;
let monopolyMatches = 0;
let hatTricks = 0;
let reserveTries = 0;
let unresolved = 0;
const topTotals = new Map();

for (let m = 0; m < MATCHES; m++) {
  const rng = mulberry32(1000 + m * 97);
  const tries = 2 + Math.floor(rng() * 5); // 2–6
  const alloc = allocate(squad, tries, rng);
  totalTries += tries;

  const scorersWithTries = alloc
    .map((n, i) => ({ n, p: squad[i] }))
    .filter((x) => x.n > 0);

  if (scorersWithTries.length === 1 && tries >= 2) monopolyMatches++;

  for (let i = 0; i < squad.length; i++) {
    const n = alloc[i];
    if (n <= 0) continue;
    const p = squad[i];
    if (!p || !Number.isFinite(p.baseWeight)) unresolved++;
    byPos[p.position] = (byPos[p.position] ?? 0) + n;
    if (p.rating < 65) byBand.low += n;
    else if (p.rating < 78) byBand.mid += n;
    else if (p.rating < 86) byBand.high += n;
    else byBand.elite += n;
    if (p.reserve) reserveTries += n;
    if (n >= 3) hatTricks++;
    topTotals.set(p.id, (topTotals.get(p.id) ?? 0) + n);
  }
}

const pct = (n) => ((100 * n) / Math.max(1, totalTries)).toFixed(1);

console.log("=== Manager scorer distribution (1000 matches) ===");
console.log(`Total tries: ${totalTries}`);
console.log(
  `Matches where one player scored every team try (≥2 tries): ${monopolyMatches} (${(
    (100 * monopolyMatches) /
    MATCHES
  ).toFixed(1)}%)`
);
console.log(`Hat-trick occurrences (player ≥3 in a match): ${hatTricks}`);
console.log(`Reserve-player try share: ${pct(reserveTries)}%`);
console.log(`Unresolved / invalid scorers: ${unresolved}`);
console.log("\nTries by position:");
for (const [pos, n] of Object.entries(byPos)) {
  console.log(`  ${pos.padEnd(14)} ${pct(n)}%`);
}
console.log("\nTries by rating band:");
console.log(`  low (<65):   ${pct(byBand.low)}%`);
console.log(`  mid (65-77): ${pct(byBand.mid)}%`);
console.log(`  high (78-85):${pct(byBand.high)}%`);
console.log(`  elite (86+): ${pct(byBand.elite)}%`);
console.log("\nTop individual try totals:");
[...topTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .forEach(([id, n]) => {
    const p = squad.find((s) => s.id === id);
    console.log(`  ${p.name.padEnd(16)} ${n} (${pct(n)}%) rating ${p.rating}`);
  });

if (unresolved > 0) process.exitCode = 1;
if (monopolyMatches / MATCHES > 0.12) {
  console.error("FAIL: monopoly rate too high");
  process.exitCode = 1;
}
if (byBand.low / totalTries > 0.25) {
  console.error("FAIL: low-rated players scoring too often");
  process.exitCode = 1;
}
if ((byPos.WING + byPos.CENTRE + byPos.FULLBACK) / totalTries < 0.45) {
  console.error("FAIL: backs not scoring enough");
  process.exitCode = 1;
}
