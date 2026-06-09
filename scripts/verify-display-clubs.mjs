import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clubs = JSON.parse(readFileSync(join(root, "data/clubs.json"), "utf8"));
const active = new Set(clubs.filter((c) => c.active !== false).map((c) => c.name));
const overrides = JSON.parse(
  readFileSync(join(root, "data/player-super-league-club-overrides.json"), "utf8")
);

// Simulate normalize resolution for non-active raw clubs
const sources = ["historic-players.json", "legends.json"];
const nonActive = [];
for (const file of sources) {
  const data = JSON.parse(readFileSync(join(root, "data", file), "utf8"));
  for (const p of data) {
    if (!active.has(p.club)) nonActive.push(p);
  }
}

console.log("Players with non-active raw clubs:", nonActive.length);
console.log("Overrides defined:", Object.keys(overrides).length);

const missing = nonActive.filter((p) => !overrides[p.id]);
if (missing.length) {
  console.log("Missing overrides (using prefix/legend fallback):");
  missing.forEach((p) => console.log(" ", p.id, p.club));
} else {
  console.log("All non-active players have explicit overrides.");
}
