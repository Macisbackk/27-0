/**
 * Audit Quick Mode Current positions after registry load (incl. dual inheritance).
 * Run: npx tsx scripts/audit-quickmode-registry-positions.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import sl2026Squads from "../data/sl-2026-squads.json";
import currentTeamYear from "../data/current-team-year-squads-2026.json";
import { getPlayerById } from "../src/lib/players";
import {
  getEligiblePositions,
  parsePositionAbbreviations,
} from "../src/lib/players/player-positions";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data/quickmode-registry-position-audit.json");

type SquadRow = { name: string; positions: string; rating: number };

const CLUB_SLUGS: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Castleford Tigers": "castleford",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds",
  "Leigh Leopards": "leigh",
  "St Helens": "st-helens",
  "Toulouse Olympique": "toulouse",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Wigan Warriors": "wigan",
  "York Knights": "york",
};

function slugName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function setEq(a: Position[], b: Position[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((p) => s.has(p));
}

const primaryMismatches: unknown[] = [];
const eligibilityInflation: unknown[] = [];
const missing: unknown[] = [];
const unavailable: unknown[] = [];
const deadPoolIds: unknown[] = [];

const source = sl2026Squads as Record<string, SquadRow[]>;
const ty = currentTeamYear as Record<
  string,
  Record<string, { playerIds: string[] }>
>;

for (const [club, rows] of Object.entries(source)) {
  const slug = CLUB_SLUGS[club];
  for (const row of rows) {
    const id = `${slug}-cur-${slugName(row.name)}`;
    const expectedAll = parsePositionAbbreviations(row.positions);
    const expectedPrimary = expectedAll[0]!;
    const player = getPlayerById(id);
    if (!player) {
      missing.push({ club, name: row.name, id });
      continue;
    }
    if (player.availableInGame === false) {
      unavailable.push({ club, name: row.name, id });
      continue;
    }
    if (player.position !== expectedPrimary) {
      primaryMismatches.push({
        id,
        name: player.name,
        club,
        expected: expectedPrimary,
        got: player.position,
        sourceAbbrev: row.positions,
        cardAbbrev: player.positionAbbrev,
      });
    }
    const eligible = getEligiblePositions(player);
    if (!setEq(eligible, expectedAll) && !expectedAll.every((p) => eligible.includes(p))) {
      eligibilityInflation.push({
        id,
        name: player.name,
        club,
        expected: expectedAll,
        eligible,
        note: "eligible does not cover source abbrev set",
      });
    } else if (eligible.length > expectedAll.length + (expectedAll.includes("SCRUM_HALF") || expectedAll.includes("STAND_OFF") ? 1 : 0)) {
      // SH/SO auto-pair can add one; flag larger inflation
      const extra = eligible.filter((p) => !expectedAll.includes(p));
      const halfPair =
        (expectedAll.includes("SCRUM_HALF") && extra.length === 1 && extra[0] === "STAND_OFF") ||
        (expectedAll.includes("STAND_OFF") && extra.length === 1 && extra[0] === "SCRUM_HALF");
      if (!halfPair && extra.length > 0) {
        eligibilityInflation.push({
          id,
          name: player.name,
          club,
          expected: expectedAll,
          eligible,
          extra,
        });
      }
    }
  }

  for (const id of ty[club]?.["2026"]?.playerIds ?? []) {
    if (!getPlayerById(id)) deadPoolIds.push({ club, id });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    primaryMismatches: primaryMismatches.length,
    eligibilityInflation: eligibilityInflation.length,
    missing: missing.length,
    unavailable: unavailable.length,
    deadPoolIds: deadPoolIds.length,
  },
  primaryMismatches,
  eligibilityInflation,
  missing,
  unavailable,
  deadPoolIds,
};

writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out: OUT, ...report.summary }, null, 2));
if (eligibilityInflation.length) {
  console.log("sample inflation", JSON.stringify(eligibilityInflation.slice(0, 15), null, 2));
}
if (primaryMismatches.length) {
  console.log("sample primary", JSON.stringify(primaryMismatches.slice(0, 15), null, 2));
}
