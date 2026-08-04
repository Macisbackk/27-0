/**
 * Apply Current 90+ audit ratings into overrides + player JSON sources.
 * Run: npx tsx scripts/apply-current-ninety-plus-audit.ts
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { CURRENT_NINETY_PLUS_AUDIT } from "../data/current-ninety-plus-audit";

const root = join(__dirname, "..");

function ratingToValue(rating: number): number {
  const band = (
    r: number,
    lo: number,
    hi: number,
    vmin: number,
    vmax: number
  ) => {
    const t = Math.max(0, Math.min(1, (r - lo) / (hi - lo)));
    return Math.round((vmin + t * (vmax - vmin)) / 1000) * 1000;
  };
  if (rating >= 95) return band(rating, 95, 99, 500_000, 750_000);
  if (rating >= 90) return band(rating, 90, 94, 250_000, 500_000);
  if (rating >= 85) return band(rating, 85, 89, 150_000, 280_000);
  if (rating >= 80) return band(rating, 80, 84, 90_000, 180_000);
  return band(rating, 70, 79, 12_000, 90_000);
}

const byId = new Map(
  CURRENT_NINETY_PLUS_AUDIT.entries.map((e) => [e.playerId, e.newRating])
);

// ── Overrides JSON ──────────────────────────────────────────────────────────
const overridesPath = join(root, "data/player-rating-overrides.json");
const overridesJson = JSON.parse(readFileSync(overridesPath, "utf8")) as {
  overrides: Record<string, number>;
};
for (const [id, rating] of byId) {
  overridesJson.overrides[id] = rating;
}
writeFileSync(overridesPath, JSON.stringify(overridesJson, null, 2) + "\n");

// ── Overrides TS — rewrite Current Super League block values via regex ──────
const overridesTsPath = join(root, "data/player-rating-overrides.ts");
let overridesTs = readFileSync(overridesTsPath, "utf8");
for (const [id, rating] of byId) {
  const re = new RegExp(`("${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}": )\\d+`);
  if (re.test(overridesTs)) {
    overridesTs = overridesTs.replace(re, `$1${rating}`);
  }
}
writeFileSync(overridesTsPath, overridesTs);

function patchPlayersArray(filePath: string): number {
  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as
    | Array<Record<string, unknown>>
    | { players?: Array<Record<string, unknown>> };
  const players = Array.isArray(data) ? data : data.players;
  if (!players) return 0;
  let changed = 0;
  for (const p of players) {
    const id = String(p.id ?? "");
    const next = byId.get(id);
    if (next == null) continue;
    if (p.peakRating !== next) {
      p.peakRating = next;
      p.value = ratingToValue(next);
      changed++;
    }
  }
  if (changed > 0) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
  return changed;
}

const chunkDir = join(root, "data/players/chunks/current");
let chunkChanges = 0;
for (const file of readdirSync(chunkDir).filter((f) => f.endsWith(".json"))) {
  if (file === "manifest.json") continue;
  chunkChanges += patchPlayersArray(join(chunkDir, file));
}

const squadChanges = patchPlayersArray(join(root, "data/current-squads.json"));

console.log(
  JSON.stringify(
    {
      auditVersion: CURRENT_NINETY_PLUS_AUDIT.version,
      entries: CURRENT_NINETY_PLUS_AUDIT.entries.length,
      chunkPlayerUpdates: chunkChanges,
      currentSquadsUpdates: squadChanges,
      downgrades: CURRENT_NINETY_PLUS_AUDIT.entries.filter(
        (e) => e.decision === "downgrade"
      ).length,
      remains: CURRENT_NINETY_PLUS_AUDIT.entries.filter(
        (e) => e.decision === "remain"
      ).length,
    },
    null,
    2
  )
);
