/**
 * Player database validation script.
 * Source of truth: data/*.json
 * Run: npm run validate:players
 */

import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import clubs from "../data/clubs.json";
import {
  isUtilityPosition,
  resolvePosition,
} from "../src/lib/players/position-utils";

interface RawPlayer {
  id: string;
  name: string;
  position: string;
  club: string;
  nationality: string;
  yearsActive: string;
  category: string;
  peakRating: number;
  value: number;
  primaryPosition?: string;
  appearances?: number;
  tries?: number;
}

function validatePlayers(
  players: RawPlayer[],
  source: string,
  clubNames: Set<string>
): { utilityMapped: number } {
  const ids = new Set<string>();
  let utilityMapped = 0;

  for (const p of players) {
    if (ids.has(p.id)) throw new Error(`Duplicate ID in ${source}: ${p.id}`);
    ids.add(p.id);

    if (!p.name?.trim()) throw new Error(`Missing name in ${source}: ${p.id}`);

    const resolved = resolvePosition(p as unknown as Record<string, unknown>);
    if (resolved.mappedFromUtility) {
      utilityMapped++;
      console.log(
        `  ℹ Utility mapped: ${p.name} → ${resolved.position}` +
          (p.primaryPosition ? ` (primaryPosition: ${p.primaryPosition})` : "")
      );
    }

    if (!clubNames.has(p.club)) {
      console.warn(`  ⚠ ${p.name}: club "${p.club}" not in clubs.json`);
    }

    if (!p.yearsActive?.trim()) {
      throw new Error(`Missing yearsActive in ${source}: ${p.id}`);
    }

    if (p.peakRating < 50 || p.peakRating > 99) {
      throw new Error(`Invalid rating for ${p.name}: ${p.peakRating}`);
    }
    if (p.value < 10000) {
      throw new Error(`Invalid value for ${p.name}: ${p.value}`);
    }

    if (isUtilityPosition(p.position) && !resolved.mappedFromUtility) {
      throw new Error(`Utility mapping failed for ${p.name}`);
    }
  }

  return { utilityMapped };
}

async function main() {
  const clubNames = new Set(clubs.map((c: { name: string }) => c.name));

  console.log("🏉 27-0 Player Database Validation\n");
  console.log(`Clubs: ${clubs.length}`);

  let totalUtility = 0;

  const currentResult = validatePlayers(
    currentSquads as RawPlayer[],
    "current-squads.json",
    clubNames
  );
  totalUtility += currentResult.utilityMapped;
  console.log(`✓ Current squads: ${currentSquads.length} players`);

  const historicResult = validatePlayers(
    historicPlayers as RawPlayer[],
    "historic-players.json",
    clubNames
  );
  totalUtility += historicResult.utilityMapped;
  console.log(`✓ Historic players: ${historicPlayers.length} players`);

  const legendsResult = validatePlayers(
    legends as RawPlayer[],
    "legends.json",
    clubNames
  );
  totalUtility += legendsResult.utilityMapped;
  console.log(`✓ Legends: ${legends.length} players`);

  const legendIds = new Set((legends as RawPlayer[]).map((p) => p.id));
  const historicDupes = (historicPlayers as RawPlayer[]).filter((p) =>
    legendIds.has(p.id)
  );
  if (historicDupes.length > 0) {
    console.log(
      `  ℹ ${historicDupes.length} legend duplicates removed from historic pool at runtime`
    );
  }

  const total =
    currentSquads.length +
    historicPlayers.length +
    legends.length -
    historicDupes.length;

  console.log(`\n✅ Database valid — ${total} unique players ready`);
  if (totalUtility > 0) {
    console.log(
      `   ${totalUtility} Utility player(s) mapped to squad positions`
    );
  }
  console.log(
    "\nTo add players: edit data/*.json and re-run npm run validate:players"
  );
}

main().catch((e) => {
  console.error("❌ Validation failed:", e);
  process.exit(1);
});
