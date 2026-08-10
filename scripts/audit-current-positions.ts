/**
 * Audit Current/Quick Mode player positions vs sl-2026-squads.json
 * and internal field consistency.
 *
 * Run: npx tsx scripts/audit-current-positions.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sl2026Squads from "../data/sl-2026-squads.json";
import {
  getEligiblePositions,
  parsePositionAbbreviations,
} from "../src/lib/players/player-positions";
import { normalizePosition } from "../src/lib/players/position-utils";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const TEAM_YEAR_PATH = join(ROOT, "data", "current-team-year-squads-2026.json");
const OUT_PATH = join(ROOT, "data", "current-position-audit.json");

type SquadRow = { name: string; positions: string; rating: number };
type RawPlayer = {
  id: string;
  name: string;
  club: string;
  position: string;
  positions?: string[];
  primaryPosition?: string;
  positionAbbrev?: string;
  availableInGame?: boolean;
};

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function setEq(a: Position[], b: Position[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((p) => sa.has(p));
}

function parseMaybeAbbrev(raw?: string): Position[] {
  if (!raw?.trim()) return [];
  try {
    if (/[\/]|(?:^(?:HB|HK|FB|WG|CE|SO|SH|PF|SR|LF)$)/i.test(raw.trim())) {
      return parsePositionAbbreviations(
        raw.includes("/") || raw.length <= 3
          ? raw.toUpperCase()
          : raw
      );
    }
    return [normalizePosition(raw)];
  } catch {
    try {
      return [normalizePosition(raw)];
    } catch {
      return [];
    }
  }
}

const current = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as RawPlayer[];
const teamYear = JSON.parse(readFileSync(TEAM_YEAR_PATH, "utf8")) as Record<
  string,
  Record<string, { playerIds: string[]; positions: string[] }>
>;

const byClubName = new Map<string, Map<string, RawPlayer>>();
for (const p of current) {
  if (p.availableInGame === false) continue;
  const clubKey = p.club;
  if (!byClubName.has(clubKey)) byClubName.set(clubKey, new Map());
  byClubName.get(clubKey)!.set(normName(p.name), p);
}

const primaryMismatches: unknown[] = [];
const eligibilityDrifts: unknown[] = [];
const internalInconsistencies: unknown[] = [];
const teamYearSlotDrifts: unknown[] = [];
const missingFromCurrent: unknown[] = [];
const unmatchedSource: unknown[] = [];

const source = sl2026Squads as Record<string, SquadRow[]>;

for (const [club, rows] of Object.entries(source)) {
  const clubPlayers = byClubName.get(club) ?? new Map();
  for (const row of rows) {
    let expectedPrimary: Position;
    let expectedAll: Position[];
    try {
      expectedAll = parsePositionAbbreviations(row.positions);
      expectedPrimary = expectedAll[0]!;
    } catch (e) {
      unmatchedSource.push({ club, name: row.name, positions: row.positions, error: String(e) });
      continue;
    }

    const player = clubPlayers.get(normName(row.name));
    if (!player) {
      missingFromCurrent.push({ club, name: row.name, expected: row.positions });
      continue;
    }

    const storedPrimary = player.position as Position;
    const storedEligible = getEligiblePositions({
      position: storedPrimary,
      positions: (player.positions ?? []) as Position[],
      primaryPosition: player.primaryPosition,
    });

    if (storedPrimary !== expectedPrimary) {
      primaryMismatches.push({
        id: player.id,
        name: player.name,
        club,
        storedPrimary,
        expectedPrimary,
        sourceAbbrev: row.positions,
        storedPositions: player.positions ?? [],
        primaryPosition: player.primaryPosition ?? null,
        positionAbbrev: player.positionAbbrev ?? null,
      });
    }

    if (!setEq(storedEligible, expectedAll)) {
      // Only flag if not merely HB→SO/SH expansion differences that still cover expected
      const storedSet = new Set(storedEligible);
      const missingExpected = expectedAll.filter((p) => !storedSet.has(p));
      const extra = storedEligible.filter((p) => !expectedAll.includes(p));
      // Extra halfback twin is OK; missing expected primary roles is not
      if (missingExpected.length > 0 || extra.some((p) => !["STAND_OFF", "SCRUM_HALF"].includes(p) || !expectedAll.some((e) => e === "STAND_OFF" || e === "SCRUM_HALF"))) {
        if (missingExpected.length > 0) {
          eligibilityDrifts.push({
            id: player.id,
            name: player.name,
            club,
            storedEligible,
            expectedAll,
            missingExpected,
            extra,
            sourceAbbrev: row.positions,
          });
        }
      }
    }

    const listed = (player.positions ?? []) as string[];
    if (listed.length > 0 && !listed.includes(storedPrimary)) {
      internalInconsistencies.push({
        id: player.id,
        name: player.name,
        club,
        issue: "primary_not_in_positions",
        position: storedPrimary,
        positions: listed,
      });
    }

    const fromAbbrev = parseMaybeAbbrev(player.positionAbbrev);
    const fromPrimary = parseMaybeAbbrev(player.primaryPosition);
    if (fromAbbrev.length > 0 && fromAbbrev[0] !== storedPrimary) {
      internalInconsistencies.push({
        id: player.id,
        name: player.name,
        club,
        issue: "positionAbbrev_primary_mismatch",
        position: storedPrimary,
        positionAbbrev: player.positionAbbrev,
        abbrevPrimary: fromAbbrev[0],
      });
    }
    if (
      fromPrimary.length > 0 &&
      player.primaryPosition &&
      !/[\/]/.test(player.primaryPosition) &&
      fromPrimary[0] !== storedPrimary &&
      // HB expands to both — skip if stored is one of them
      !(
        player.primaryPosition.toUpperCase() === "HB" &&
        (storedPrimary === "STAND_OFF" || storedPrimary === "SCRUM_HALF")
      )
    ) {
      internalInconsistencies.push({
        id: player.id,
        name: player.name,
        club,
        issue: "primaryPosition_field_mismatch",
        position: storedPrimary,
        primaryPosition: player.primaryPosition,
        parsed: fromPrimary[0],
      });
    }
  }
}

// Team-year slot order vs player.position
for (const [club, years] of Object.entries(teamYear)) {
  const y2026 = years["2026"];
  if (!y2026) continue;
  for (let i = 0; i < y2026.playerIds.length; i++) {
    const id = y2026.playerIds[i]!;
    const slotPos = y2026.positions[i] as Position | undefined;
    const player = current.find((p) => p.id === id);
    if (!player || !slotPos) continue;
    const eligible = getEligiblePositions({
      position: player.position as Position,
      positions: (player.positions ?? []) as Position[],
      primaryPosition: player.primaryPosition,
    });
    // Flag if player cannot fill their listed starting slot without relying only on compatible pairs
    if (!eligible.includes(slotPos) && player.position !== slotPos) {
      teamYearSlotDrifts.push({
        id,
        name: player.name,
        club,
        slotIndex: i,
        slotPosition: slotPos,
        playerPosition: player.position,
        eligible,
      });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    primaryMismatches: primaryMismatches.length,
    eligibilityDrifts: eligibilityDrifts.length,
    internalInconsistencies: internalInconsistencies.length,
    teamYearSlotDrifts: teamYearSlotDrifts.length,
    missingFromCurrent: missingFromCurrent.length,
  },
  primaryMismatches,
  eligibilityDrifts,
  internalInconsistencies,
  teamYearSlotDrifts,
  missingFromCurrent,
};

writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Wrote ${OUT_PATH}`);
if (primaryMismatches.length) {
  console.log("\nPrimary mismatches:");
  for (const m of primaryMismatches as Array<Record<string, unknown>>) {
    console.log(
      `  ${m.club} | ${m.name}: ${m.storedPrimary} → expected ${m.expectedPrimary} (${m.sourceAbbrev})`
    );
  }
}
