/**
 * Apply Current rating and/or potential overrides in one pass.
 *
 * Usage:
 *   npx tsx scripts/apply-player-attrs.ts --rating "Caleb Aekins"=87 --potential "Loghan Lewis"=86
 *   npx tsx scripts/apply-player-attrs.ts --batch data/player-attr-batch.json
 *
 * Batch JSON shape:
 * {
 *   "ratings": { "bradford-cur-caleb-aekins": 87, "Caleb Aekins": 87 },
 *   "potentials": { "bradford-cur-loghan-lewis": 86 }
 * }
 *
 * Accepts player IDs or exact Current player names. Updates:
 * - data/player-rating-overrides.ts + .json
 * - data/player-potential-overrides.ts + potentialOverrides in rating-overrides.json
 * - peakRating/value in current chunk JSON + current-squads.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { Position, PlayerCategory } from "../src/lib/types";

const root = join(__dirname, "..");

type PlayerRow = {
  id: string;
  name: string;
  peakRating: number;
  position: Position;
  category: PlayerCategory;
  value: number;
  club?: string;
};

function loadCurrentPlayers(): PlayerRow[] {
  const dir = join(root, "data/players/chunks/current");
  const out: PlayerRow[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as
      | PlayerRow[]
      | { players?: PlayerRow[] };
    const rows = Array.isArray(raw) ? raw : (raw.players ?? []);
    out.push(...rows);
  }
  return out;
}

function resolveId(
  key: string,
  byId: Map<string, PlayerRow>,
  byName: Map<string, PlayerRow[]>
): string {
  if (byId.has(key)) return key;
  const matches = byName.get(key.toLowerCase()) ?? [];
  if (matches.length === 1) return matches[0]!.id;
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous name "${key}": ${matches.map((m) => m.id).join(", ")}`
    );
  }
  throw new Error(`Unknown player "${key}"`);
}

function parseArgs(argv: string[]): {
  ratings: Record<string, number>;
  potentials: Record<string, number>;
} {
  const ratings: Record<string, number> = {};
  const potentials: Record<string, number> = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--batch") {
      const path = argv[++i];
      if (!path) throw new Error("--batch requires a path");
      const abs = path.startsWith("data/") ? join(root, path) : path;
      const batch = JSON.parse(readFileSync(abs, "utf8")) as {
        ratings?: Record<string, number>;
        potentials?: Record<string, number>;
      };
      Object.assign(ratings, batch.ratings ?? {});
      Object.assign(potentials, batch.potentials ?? {});
      continue;
    }
    if (a === "--rating" || a === "--potential") {
      const raw = argv[++i];
      if (!raw || !raw.includes("=")) {
        throw new Error(`${a} expects NameOrId=number`);
      }
      const eq = raw.lastIndexOf("=");
      const key = raw.slice(0, eq).replace(/^"|"$/g, "");
      const value = Number(raw.slice(eq + 1));
      if (!Number.isFinite(value)) throw new Error(`Bad value in ${raw}`);
      if (a === "--rating") ratings[key] = value;
      else potentials[key] = value;
      continue;
    }
    if (a.startsWith("-")) {
      throw new Error(`Unknown flag ${a}`);
    }
  }
  return { ratings, potentials };
}

function upsertTsRecord(
  filePath: string,
  exportName: string,
  entries: Record<string, number>
): void {
  let src = readFileSync(filePath, "utf8");
  for (const [id, value] of Object.entries(entries)) {
    const re = new RegExp(
      `("${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}":\\s*)\\d+`
    );
    if (re.test(src)) {
      src = src.replace(re, `$1${value}`);
    } else {
      const marker = `export const ${exportName}`;
      const idx = src.indexOf(marker);
      if (idx < 0) throw new Error(`Missing ${exportName} in ${filePath}`);
      const brace = src.indexOf("{", idx);
      src =
        src.slice(0, brace + 1) +
        `\n  "${id}": ${value},` +
        src.slice(brace + 1);
    }
  }
  writeFileSync(filePath, src);
}

function patchPlayersFiles(ratings: Record<string, number>): void {
  const files = [
    join(root, "data/current-squads.json"),
    ...readdirSync(join(root, "data/players/chunks/current"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(root, "data/players/chunks/current", f)),
  ];

  for (const file of files) {
    const raw = JSON.parse(readFileSync(file, "utf8")) as
      | PlayerRow[]
      | { players?: PlayerRow[] };
    const data = Array.isArray(raw) ? raw : raw.players;
    if (!data) continue;
    let changed = 0;
    for (const p of data) {
      const next = ratings[p.id];
      if (next == null) continue;
      p.peakRating = next;
      p.value = computePlayerValue(
        p.peakRating,
        p.position,
        p.category ?? "current"
      );
      changed += 1;
    }
    if (changed > 0) {
      writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
      console.log(`  ${changed} ratings → ${file.replace(root + "\\", "")}`);
    }
  }
}

function main(): void {
  const { ratings: rawRatings, potentials: rawPotentials } = parseArgs(
    process.argv.slice(2)
  );
  if (
    Object.keys(rawRatings).length === 0 &&
    Object.keys(rawPotentials).length === 0
  ) {
    console.log(`Usage:
  npx tsx scripts/apply-player-attrs.ts --rating "Name"=87 --potential "Name"=91
  npx tsx scripts/apply-player-attrs.ts --batch data/player-attr-batch.json`);
    process.exit(1);
  }

  const players = loadCurrentPlayers();
  const byId = new Map(players.map((p) => [p.id, p]));
  const byName = new Map<string, PlayerRow[]>();
  for (const p of players) {
    const key = p.name.toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
  }

  const ratings: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawRatings)) {
    ratings[resolveId(key, byId, byName)] = value;
  }
  const potentials: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawPotentials)) {
    potentials[resolveId(key, byId, byName)] = value;
  }

  if (Object.keys(ratings).length > 0) {
    upsertTsRecord(
      join(root, "data/player-rating-overrides.ts"),
      "PLAYER_RATING_OVERRIDES",
      ratings
    );
    const jsonPath = join(root, "data/player-rating-overrides.json");
    const json = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      overrides: Record<string, number>;
      potentialOverrides?: Record<string, number>;
    };
    Object.assign(json.overrides, ratings);
    writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
    patchPlayersFiles(ratings);
    for (const [id, rating] of Object.entries(ratings)) {
      console.log(`rating  ${byId.get(id)?.name ?? id}: ${rating}`);
    }
  }

  if (Object.keys(potentials).length > 0) {
    upsertTsRecord(
      join(root, "data/player-potential-overrides.ts"),
      "PLAYER_POTENTIAL_OVERRIDES",
      potentials
    );
    const jsonPath = join(root, "data/player-rating-overrides.json");
    const json = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      overrides: Record<string, number>;
      potentialOverrides?: Record<string, number>;
    };
    json.potentialOverrides = {
      ...(json.potentialOverrides ?? {}),
      ...potentials,
    };
    writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
    for (const [id, pot] of Object.entries(potentials)) {
      console.log(`potential  ${byId.get(id)?.name ?? id}: ${pot}`);
    }
  }

  // Leave a convenient empty batch template if missing.
  const batchPath = join(root, "data/player-attr-batch.json");
  if (!existsSync(batchPath)) {
    writeFileSync(
      batchPath,
      `${JSON.stringify({ ratings: {}, potentials: {} }, null, 2)}\n`
    );
  }

  console.log("done");
}

main();
