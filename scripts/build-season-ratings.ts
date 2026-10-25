/**
 * Builds data/season-2026-ratings.json from researched 2026 season evidence (one JSON per group of
 * clubs: id → { to, why }). Only current-season cards change; unknown ids are reported and skipped.
 * Run: bun scripts/build-season-ratings.ts <result.json>...
 */
import fs from "node:fs";
import { getShowcasePlayers } from "../src/lib/players";

const current = new Map(getShowcasePlayers().filter((p) => p.category === "current").map((p) => [p.id, p]));
const out: Record<string, { to: number; from: number; name: string; club: string; why: string }> = {};
const prevPath = "data/season-2026-ratings.json";
const prev = fs.existsSync(prevPath) ? (JSON.parse(fs.readFileSync(prevPath, "utf8")) as typeof out) : {};
const unknown: string[] = [];
for (const file of process.argv.slice(2)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, { to: number; why: string }>;
  for (const [id, v] of Object.entries(data)) {
    const p = current.get(id);
    if (!p) {
      unknown.push(id);
      continue;
    }
    const to = Math.max(80, Math.min(99, Math.round(v.to)));
    // "from" is the rating before this re-rate (stable across re-runs).
    out[id] = { to, from: prev[id]?.from ?? p.peakRating, name: p.name, club: p.club, why: v.why };
  }
}
const merged = { ...prev, ...out };
fs.writeFileSync(prevPath, JSON.stringify(merged, null, 2) + "\n");
const rows = Object.values(merged);
console.log(`${rows.length} players re-rated (${rows.filter((r) => r.to > r.from).length} up, ${rows.filter((r) => r.to < r.from).length} down)`);
if (unknown.length) console.log(`skipped unknown ids: ${unknown.join(", ")}`);
