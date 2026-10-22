/**
 * Build the slim player JSON the app actually ships.
 *
 * data/current-squads.json, historic-players.json and legends.json carry research
 * metadata (sources, migration notes, representative teams…) and fields the loader
 * derives anyway (value, teamYearId, status…). The browser only needs what
 * normalizePlayer() reads, so for every row we drop each field whose removal leaves
 * the normalized player byte-for-byte identical. Nothing the game shows can change.
 *
 * Run: npm run build:runtime-player-data          (writes src/lib/players/generated/*.runtime.json)
 *      npm run build:runtime-player-data -- --check (fails if the committed files are stale)
 * It also runs automatically before `next build` (prebuild).
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizePlayer } from "../src/lib/players/normalize";

type Raw = Record<string, unknown>;

const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "src", "lib", "players", "generated");
const SOURCES = [
  { name: "current", file: "current-squads.json" },
  { name: "historic", file: "historic-players.json" },
  { name: "legends", file: "legends.json" },
] as const;

const fingerprint = (row: Raw): string => {
  try {
    return JSON.stringify(normalizePlayer(row));
  } catch {
    return "<throws>"; // the field is required
  }
};

export function slimRow(row: Raw): Raw {
  const target = fingerprint(row);
  const slim: Raw = { ...row };
  for (const key of Object.keys(row)) {
    if (key === "id" || key === "name") continue;
    const value = slim[key];
    delete slim[key];
    if (fingerprint(slim) !== target) slim[key] = value;
  }
  // Keep the original key order so diffs of the generated file stay readable.
  const ordered: Raw = {};
  for (const key of Object.keys(row)) if (key in slim) ordered[key] = slim[key];
  return ordered;
}

function build(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, file } of SOURCES) {
    const rows = JSON.parse(readFileSync(join(ROOT, "data", file), "utf8")) as Raw[];
    const slim = rows.map(slimRow);
    for (let i = 0; i < rows.length; i++) {
      if (fingerprint(slim[i]!) !== fingerprint(rows[i]!)) {
        throw new Error(`${file}: slim row ${String(rows[i]!.id)} does not normalize identically`);
      }
    }
    // One row per line: small, and git diffs stay per-player.
    out[`${name}.runtime.json`] = `[\n${slim.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;
    const before = JSON.stringify(rows).length;
    const after = out[`${name}.runtime.json`]!.length;
    console.log(`${file}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
  }
  // Manager Mode only reads these fields from the raw 2026 squads (src/lib/career/world.ts SquadRow).
  const CAREER_FIELDS = ["id", "name", "club", "position", "peakRating", "birthYear", "nationality", "availableInGame"];
  const current = JSON.parse(readFileSync(join(ROOT, "data", "current-squads.json"), "utf8")) as Raw[];
  const career = current.map((row) => {
    const pick: Raw = {};
    for (const key of CAREER_FIELDS) if (row[key] !== undefined) pick[key] = row[key];
    return pick;
  });
  out["career-squads.runtime.json"] = `[\n${career.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;
  return out;
}

const check = process.argv.includes("--check");
const files = build();
let stale = 0;
for (const [name, content] of Object.entries(files)) {
  const path = join(OUT_DIR, name);
  if (check) {
    let existing = "";
    try {
      existing = readFileSync(path, "utf8");
    } catch {
      /* missing */
    }
    if (existing !== content) {
      console.error(`Stale: src/lib/players/generated/${name} — run npm run build:runtime-player-data`);
      stale++;
    }
  } else {
    writeFileSync(path, content);
  }
}
if (check && stale > 0) process.exit(1);
console.log(check ? "Runtime player data is up to date." : "Wrote src/lib/players/generated/*.runtime.json");
