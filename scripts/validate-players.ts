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
import {
  buildPlayerTeamYearId,
  isGenericCareerRaw,
  resolveRawCardYear,
} from "../src/lib/players/year-card";

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
  year?: number;
  teamYearId?: string;
  status?: string;
  primaryPosition?: string;
  availableInGame?: boolean;
}

function validatePlayers(
  players: RawPlayer[],
  source: string,
  clubNames: Set<string>
): { utilityMapped: number; yearPinFailures: string[] } {
  const ids = new Set<string>();
  let utilityMapped = 0;
  const yearPinFailures: string[] = [];

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

    if (p.peakRating < 75 || p.peakRating > 99) {
      throw new Error(`Invalid rating for ${p.name}: ${p.peakRating}`);
    }

    const legacyRating = (p as unknown as Record<string, unknown>).rating;
    if (legacyRating !== undefined) {
      throw new Error(
        `Legacy rating field on ${p.id} — remove "rating" and use peakRating only`
      );
    }

    if (p.value < 10000) {
      throw new Error(`Invalid value for ${p.name}: ${p.value}`);
    }

    if (isUtilityPosition(p.position) && !resolved.mappedFromUtility) {
      throw new Error(`Utility mapping failed for ${p.name}`);
    }

    if (p.availableInGame === false) continue;

    const year = resolveRawCardYear(p as unknown as Record<string, unknown>);
    if (year === undefined) {
      yearPinFailures.push(`${p.id}: missing year`);
      continue;
    }

    if (p.category === "current" && year !== 2026) {
      yearPinFailures.push(`${p.id}: current player must be year 2026`);
    }

    const expectedTeamYearId = buildPlayerTeamYearId(p.club, year);
    if (!p.teamYearId?.trim()) {
      yearPinFailures.push(`${p.id}: missing teamYearId`);
    } else if (p.teamYearId !== expectedTeamYearId) {
      yearPinFailures.push(
        `${p.id}: teamYearId ${p.teamYearId} !== ${expectedTeamYearId}`
      );
    }

    if (!p.status?.trim()) {
      yearPinFailures.push(`${p.id}: missing status`);
    }

    if (isGenericCareerRaw(p as unknown as Record<string, unknown>)) {
      yearPinFailures.push(`${p.id}: generic multi-year career card`);
    }
  }

  return { utilityMapped, yearPinFailures };
}

async function main() {
  const clubNames = new Set(clubs.map((c: { name: string }) => c.name));

  console.log("🏉 27-0 Player Database Validation\n");
  console.log(`Clubs: ${clubs.length}`);

  let totalUtility = 0;
  const allYearPinFailures: string[] = [];

  const currentResult = validatePlayers(
    currentSquads as RawPlayer[],
    "current-squads.json",
    clubNames
  );
  totalUtility += currentResult.utilityMapped;
  allYearPinFailures.push(...currentResult.yearPinFailures);
  console.log(`✓ Current squads: ${currentSquads.length} players`);

  const historicResult = validatePlayers(
    historicPlayers as RawPlayer[],
    "historic-players.json",
    clubNames
  );
  totalUtility += historicResult.utilityMapped;
  allYearPinFailures.push(...historicResult.yearPinFailures);
  console.log(`✓ Historic players: ${historicPlayers.length} players`);

  const legendsResult = validatePlayers(
    legends as RawPlayer[],
    "legends.json",
    clubNames
  );
  totalUtility += legendsResult.utilityMapped;
  allYearPinFailures.push(...legendsResult.yearPinFailures);
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

  if (allYearPinFailures.length > 0) {
    console.error(`\n❌ Year-pin validation failures: ${allYearPinFailures.length}`);
    for (const msg of allYearPinFailures.slice(0, 40)) {
      console.error(`  - ${msg}`);
    }
    if (allYearPinFailures.length > 40) {
      console.error(`  ... and ${allYearPinFailures.length - 40} more`);
    }
    process.exit(1);
  }

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
