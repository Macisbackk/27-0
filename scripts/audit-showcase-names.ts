/**
 * Audit every Showcase player name through the canonical resolver.
 * Usage: npx tsx scripts/audit-showcase-names.ts
 */
import { getShowcasePlayers } from "../src/lib/players";
import {
  resolvePlayerDisplayName,
  type PlayerNameResolveResult,
} from "../src/lib/players/display-name-resolver";

export type PlayerNameAuditResult = {
  playerId: string;
  playerType: string;
  rawNameFields: PlayerNameResolveResult["rawNameFields"];
  resolvedDisplayName: string;
  valid: boolean;
  problems: string[];
};

const players = getShowcasePlayers();
const byId = new Map<string, number>();
const results: PlayerNameAuditResult[] = [];

for (const player of players) {
  byId.set(player.id, (byId.get(player.id) ?? 0) + 1);
  const resolved = resolvePlayerDisplayName(player);
  results.push({
    playerId: player.id,
    playerType: player.category,
    rawNameFields: resolved.rawNameFields,
    resolvedDisplayName: resolved.displayName,
    valid: resolved.valid,
    problems: resolved.problems,
  });
}

const invalid = results.filter((r) => !r.valid);
const fallback = results.filter((r) =>
  r.problems.includes("used_fallback_fields")
);
const whitespace = results.filter((r) =>
  r.problems.includes("duplicate_whitespace")
);
const duplicateIds = [...byId.entries()].filter(([, count]) => count > 1);

const nameGroups = new Map<string, string[]>();
for (const r of results) {
  if (!r.valid) continue;
  const key = r.resolvedDisplayName.toLowerCase();
  const list = nameGroups.get(key) ?? [];
  list.push(r.playerId);
  nameGroups.set(key, list);
}
const duplicateNames = [...nameGroups.entries()].filter(
  ([, ids]) => ids.length > 1
);

console.log("=== Player Showcase name audit ===");
console.log(`Total Showcase records: ${results.length}`);
console.log(`Invalid / missing names: ${invalid.length}`);
console.log(`Used fallback name fields: ${fallback.length}`);
console.log(`Duplicate whitespace (pre-normalize): ${whitespace.length}`);
console.log(`Duplicate stable IDs: ${duplicateIds.length}`);
console.log(
  `Duplicate display names with different IDs: ${duplicateNames.length}`
);

if (invalid.length > 0) {
  console.log("\nInvalid records (first 50):");
  for (const row of invalid.slice(0, 50)) {
    console.log(
      `  ${row.playerId} [${row.playerType}] problems=${row.problems.join(",")}`
    );
  }
}

if (duplicateIds.length > 0) {
  console.log("\nDuplicate IDs:");
  for (const [id, count] of duplicateIds.slice(0, 20)) {
    console.log(`  ${id} × ${count}`);
  }
}

if (invalid.length > 0 || duplicateIds.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nAll Showcase records resolve a valid display name.");
}
