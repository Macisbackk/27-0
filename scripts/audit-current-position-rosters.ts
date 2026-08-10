/**
 * Scan team-year rosters vs sl-2026-squads for missing cards / length / order issues.
 * Run: npx tsx scripts/audit-current-position-rosters.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sl2026Squads from "../data/sl-2026-squads.json";
import { parsePositionAbbreviations } from "../src/lib/players/player-positions";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const TEAM_YEAR_PATH = join(ROOT, "data", "current-team-year-squads-2026.json");
const OUT_PATH = join(ROOT, "data", "current-position-roster-audit.json");

type SquadRow = { name: string; positions: string; rating: number };
type RawPlayer = { id: string; name: string; club: string; position: string };

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const DISPLAY_NAME_FIXES: Record<string, string> = {
  "Nick Cotric": "Nick Čotrić",
  "Jarrod O Connor": "Jarrod O'Connor",
  "Gareth O Brien": "Gareth O'Brien",
  "Ethan O Neill": "Ethan O'Neill",
  "Kai O Donnell": "Kai O'Donnell",
  "Brad O Neill": "Brad O'Neill",
  "Herman Eseese": "Herman Ese'ese",
  "Paul Seguier": "Paul Séguier",
  "Cesar Rouge": "César Rougé",
  "Justin Sangare": "Justin Sangaré",
  "Xavier Vaa": "Xavier Va'a",
  "Toa Mataafa": "Toa Mata'afa",
};

const current = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as RawPlayer[];
const teamYear = JSON.parse(readFileSync(TEAM_YEAR_PATH, "utf8")) as Record<
  string,
  Record<string, { playerIds: string[]; positions: string[] }>
>;
const byId = new Map(current.map((p) => [p.id, p]));

const clubIssues: unknown[] = [];

for (const [club, rows] of Object.entries(sl2026Squads as Record<string, SquadRow[]>)) {
  const y = teamYear[club]?.["2026"];
  const issues: string[] = [];
  const slotDrifts: unknown[] = [];

  if (!y) {
    clubIssues.push({ club, issues: ["missing team-year 2026"] });
    continue;
  }
  if (rows.length !== 17) issues.push(`source rows=${rows.length}`);
  if (y.playerIds.length !== 17) issues.push(`teamYear ids=${y.playerIds.length}`);
  if (y.positions.length !== 17) issues.push(`teamYear positions=${y.positions.length}`);
  if (y.playerIds.length !== y.positions.length) {
    issues.push("playerIds/positions length mismatch");
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const display = DISPLAY_NAME_FIXES[row.name] ?? row.name;
    const expectedPos = parsePositionAbbreviations(row.positions)[0] as Position;
    const id = y.playerIds[i];
    const slotPos = y.positions[i] as Position | undefined;
    const player = id ? byId.get(id) : undefined;

    if (!id) {
      issues.push(`slot ${i}: missing id for ${row.name}`);
      continue;
    }
    if (!player) {
      issues.push(`slot ${i}: id ${id} not in current-squads (${row.name})`);
      continue;
    }
    if (player.club !== club) {
      issues.push(
        `slot ${i}: ${player.name} club is "${player.club}" expected "${club}"`
      );
    }
    if (normName(player.name) !== normName(display) && normName(player.name) !== normName(row.name)) {
      issues.push(
        `slot ${i}: name "${player.name}" does not match source "${row.name}"`
      );
    }
    if (player.position !== expectedPos) {
      issues.push(
        `slot ${i}: ${player.name} position ${player.position} ≠ source ${expectedPos} (${row.positions})`
      );
    }
    if (slotPos && slotPos !== expectedPos) {
      slotDrifts.push({
        index: i,
        name: player.name,
        teamYearSlot: slotPos,
        sourcePrimary: expectedPos,
        playerPosition: player.position,
      });
    }
  }

  if (issues.length || slotDrifts.length) {
    clubIssues.push({ club, issues, slotDrifts });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  clubsWithIssues: clubIssues.length,
  clubIssues,
};
writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
console.log(`clubsWithIssues=${clubIssues.length}`);
for (const c of clubIssues as Array<{ club: string; issues: string[] }>) {
  console.log(`\n${c.club}`);
  for (const i of c.issues.slice(0, 20)) console.log(`  - ${i}`);
  if (c.issues.length > 20) console.log(`  ... +${c.issues.length - 20} more`);
}
console.log(`\nWrote ${OUT_PATH}`);
