/**
 * Validate player ratings after the v3 floor-80 rebalance.
 * Run: npx tsx scripts/validate-player-ratings.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(__dirname, "..", "data");
const CURRENT_MIN = 80;
const HISTORIC_MIN = 80;

interface RawPlayer {
  id: string;
  name: string;
  position: string;
  club: string;
  category: string;
  peakRating: number;
  value?: number;
}

interface LedgerEntry {
  playerId: string;
  playerType: string;
  previousRating: number;
  newRating: number;
  confidence: string;
  manualOverride?: boolean;
  evidenceSummary?: string;
  sourceNames?: string[];
}

const MANUAL = {
  "hull-kr-cur-arthur-mourgue": 87,
  "huddersfield-cur-george-flanagan-jr": 83,
  "bradford-cur-joe-mellor": 83,
  "wigan-hist-matt-bowen": 87,
} as const;

const FLANAGAN_POTENTIAL = 89;

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

function band(r: number): string {
  if (r < 80) return "below80";
  if (r <= 82) return "80-82";
  if (r <= 85) return "83-85";
  if (r <= 88) return "86-88";
  if (r <= 91) return "89-91";
  if (r <= 94) return "92-94";
  if (r <= 96) return "95-96";
  return "97-99";
}

function countExact(players: RawPlayer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of players) {
    const k = String(p.peakRating);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function avgBy(
  players: RawPlayer[],
  keyFn: (p: RawPlayer) => string
): Record<string, { avg: number; n: number }> {
  const buckets: Record<string, number[]> = {};
  for (const p of players) {
    const k = keyFn(p);
    (buckets[k] ??= []).push(p.peakRating);
  }
  const out: Record<string, { avg: number; n: number }> = {};
  for (const [k, vals] of Object.entries(buckets)) {
    out[k] = {
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      n: vals.length,
    };
  }
  return out;
}

const errors: string[] = [];
const warnings: string[] = [];

const current = load<RawPlayer[]>("current-squads.json");
const historic = load<RawPlayer[]>("historic-players.json");
const legends = load<RawPlayer[]>("legends.json");
const ledger = load<{ entries?: LedgerEntry[] } | LedgerEntry[]>(
  "player-rating-research.json"
);
const ledgerEntries = Array.isArray(ledger)
  ? ledger
  : (ledger.entries ?? []);
const potentialOverrides = load<Record<string, number> | { overrides?: Record<string, number> }>(
  // potential lives in TS — check JSON mirror if present, else hardcode check
  "player-rating-overrides.json"
);

const potentialTs = readFileSync(
  join(DATA, "player-potential-overrides.ts"),
  "utf8"
);
if (!potentialTs.includes(`"huddersfield-cur-george-flanagan-jr": 89`)) {
  errors.push("George Flanagan Jr potential override missing/ wrong (need 89)");
}

for (const p of current) {
  if (p.peakRating < CURRENT_MIN || p.peakRating > 99) {
    errors.push(`Current ${p.id} rating ${p.peakRating} out of range`);
  }
  if (!Number.isFinite(p.peakRating) || Number.isNaN(p.peakRating)) {
    errors.push(`Current ${p.id} NaN/invalid rating`);
  }
}
for (const p of historic) {
  if (p.peakRating < HISTORIC_MIN || p.peakRating > 99) {
    errors.push(`Historic ${p.id} rating ${p.peakRating} out of range`);
  }
}

for (const [id, expected] of Object.entries(MANUAL)) {
  const pool = [...current, ...historic, ...legends];
  const p = pool.find((x) => x.id === id);
  if (!p) {
    errors.push(`Manual override player missing: ${id}`);
    continue;
  }
  if (p.peakRating !== expected) {
    errors.push(
      `Override ${id}: expected ${expected}, got ${p.peakRating}`
    );
  }
}

const mourgueDup = current.filter((p) =>
  /mourgu?e/i.test(p.name)
);
if (mourgueDup.length !== 1) {
  errors.push(`Arthur Mourgue duplicates/missing: ${mourgueDup.length}`);
}

const mellorGoat = [...current, ...historic, ...legends].filter((p) =>
  /mellor/i.test(p.name)
);
const normalMellor = mellorGoat.find((p) => p.id === "bradford-cur-joe-mellor");
if (!normalMellor || normalMellor.peakRating !== 83) {
  errors.push("Joe Mellor normal rating must be 83");
}

const currentAbove96 = current.filter((p) => p.peakRating > 96);
if (currentAbove96.length > 0) {
  warnings.push(
    `Current players above 96: ${currentAbove96.map((p) => p.name).join(", ")}`
  );
}

const ledgerById = new Map(ledgerEntries.map((e) => [e.playerId, e]));
let missingLedger = 0;
for (const p of [...current, ...historic]) {
  if (!ledgerById.has(p.id)) missingLedger++;
}
if (missingLedger > 0) {
  errors.push(`Missing research ledger entries: ${missingLedger}`);
}

const lowConfidence = ledgerEntries.filter((e) => e.confidence === "low");
const noSources = ledgerEntries.filter(
  (e) => !e.sourceNames || e.sourceNames.length === 0
);
if (noSources.length > 0) {
  warnings.push(`Ledger entries without sources: ${noSources.length}`);
}

// Clamp detection: if previous==new for almost all who were below 80, fail
const wasBelow = ledgerEntries.filter((e) => e.previousRating < 80);
const clampedOnly = wasBelow.filter(
  (e) => e.newRating === 80 && e.previousRating >= 75 && !e.manualOverride
);
const clampRatio =
  wasBelow.length > 0 ? clampedOnly.length / wasBelow.length : 0;
if (clampRatio > 0.85) {
  errors.push(
    `Likely blanket clamp: ${(clampRatio * 100).toFixed(1)}% of below-80 players became exactly 80`
  );
}

const curAvg =
  current.reduce((s, p) => s + p.peakRating, 0) / Math.max(1, current.length);
const histAvg =
  historic.reduce((s, p) => s + p.peakRating, 0) / Math.max(1, historic.length);

const champNote =
  "Championship generated ratings use a separate 70–89 scale (see validate:championship-ratings).";

const report = {
  schemaVersion: 3,
  ok: errors.length === 0,
  errors,
  warnings,
  counts: {
    current: current.length,
    historic: historic.length,
    legends: legends.length,
    ledger: ledgerEntries.length,
    lowConfidence: lowConfidence.length,
  },
  floors: { currentMin: CURRENT_MIN, historicMin: HISTORIC_MIN },
  averages: { current: curAvg, historic: histAvg },
  exactCounts: {
    current: countExact(current),
    historic: countExact(historic),
    combined: countExact([...current, ...historic]),
  },
  bands: {
    current: Object.fromEntries(
      ["80-82", "83-85", "86-88", "89-91", "92-94", "95-96", "97-99"].map(
        (b) => [b, current.filter((p) => band(p.peakRating) === b).length]
      )
    ),
    historic: Object.fromEntries(
      ["80-82", "83-85", "86-88", "89-91", "92-94", "95-96", "97-99"].map(
        (b) => [b, historic.filter((p) => band(p.peakRating) === b).length]
      )
    ),
  },
  byClub: avgBy(current, (p) => p.club),
  byPosition: {
    current: avgBy(current, (p) => p.position),
    historic: avgBy(historic, (p) => p.position),
  },
  manualOverrides: MANUAL,
  flanaganPotential: FLANAGAN_POTENTIAL,
  clampRatio,
  championship: champNote,
  potentialOverridesPresent: Boolean(potentialOverrides),
};

writeFileSync(
  join(DATA, "player-rating-validation-report.json"),
  JSON.stringify(report, null, 2) + "\n"
);

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) {
  console.error(`\nFAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log("\nValidation passed.");
