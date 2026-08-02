/**
 * Quick Mode try-allocation safety test.
 * Run: node scripts/test-quick-mode-try-allocation.mjs
 */

function sanitizeTryWeight(weight) {
  if (!Number.isFinite(weight) || weight < 0) return 0;
  return weight;
}

function pickWeightedIndexSafe(weights, rng) {
  if (weights.length === 0) return -1;
  const clean = weights.map(sanitizeTryWeight);
  const sum = clean.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Math.floor(rng() * clean.length);
  let pick = rng() * sum;
  for (let i = 0; i < clean.length; i++) {
    pick -= clean[i];
    if (pick <= 0) return i;
  }
  return clean.length - 1;
}

function allocateMatchTries(matchTries, baseWeights, rng) {
  const allocated = new Array(baseWeights.length).fill(0);
  const cleanBase = baseWeights.map(sanitizeTryWeight);
  const weightSum = cleanBase.reduce((s, w) => s + w, 0);
  if (!(weightSum > 0)) {
    for (let t = 0; t < matchTries; t++) {
      allocated[Math.floor(rng() * cleanBase.length)]++;
    }
    return allocated;
  }
  for (let t = 0; t < matchTries; t++) {
    const already = allocated.slice();
    const effective = cleanBase.map((w, i) => {
      const mult =
        already[i] <= 0 ? 1 : already[i] === 1 ? 0.42 : already[i] === 2 ? 0.18 : 0.06;
      return sanitizeTryWeight(w * mult);
    });
    const floored = effective.map((w) => (w > 0 ? Math.max(0.0001, w) : 0));
    const pick = pickWeightedIndexSafe(floored, rng);
    allocated[pick]++;
  }
  return allocated;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAYERS = 13;
let monopoly = 0;
let totalMatches = 1000;
let nanPoisonMonopoly = 0;

for (let m = 0; m < totalMatches; m++) {
  const rng = mulberry32(2000 + m * 17);
  const weights = Array.from({ length: PLAYERS }, (_, i) =>
    0.2 + (i === 1 ? 1.4 : 0.4) + rng() * 0.3
  );
  const tries = 2 + Math.floor(rng() * 5);
  const alloc = allocateMatchTries(tries, weights, rng);
  const scorers = alloc.filter((n) => n > 0).length;
  if (scorers === 1 && tries >= 2) monopoly++;
}

// NaN poison case — old code collapsed to last index every try
{
  const rng = mulberry32(999);
  const poisoned = Array.from({ length: PLAYERS }, (_, i) =>
    i === 3 ? NaN : 1
  );
  let lastOnly = 0;
  for (let m = 0; m < 200; m++) {
    const alloc = allocateMatchTries(5, poisoned, rng);
    const onlyLast = alloc.every((n, i) => (i === PLAYERS - 1 ? n === 5 : n === 0));
    const onlyFirst = alloc.every((n, i) => (i === 0 ? n === 5 : n === 0));
    if (onlyLast || onlyFirst) lastOnly++;
  }
  nanPoisonMonopoly = lastOnly;
}

console.log("=== Quick Mode try-allocation safety ===");
console.log(`Monopoly rate (≥2 tries, one scorer): ${((100 * monopoly) / totalMatches).toFixed(1)}%`);
console.log(`NaN-poison all-to-one-index matches: ${nanPoisonMonopoly}/200`);

if (monopoly / totalMatches > 0.12) {
  console.error("FAIL: monopoly rate too high");
  process.exitCode = 1;
}
if (nanPoisonMonopoly > 5) {
  console.error("FAIL: NaN weights still collapse to one index");
  process.exitCode = 1;
}
if (!process.exitCode) console.log("PASS");
