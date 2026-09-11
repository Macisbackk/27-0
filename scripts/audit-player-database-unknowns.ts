/**
 * Full unknown-field + 2026 completeness audit for player databases.
 * Run: npx tsx scripts/audit-player-database-unknowns.ts
 * Writes: data/player-database-unknown-audit.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(__dirname, "..", "data");
const POSITIONS = new Set([
  "FULLBACK",
  "WING",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
  "Utility",
  "UTILITY",
  "utility",
]);

const SL_2026_CLUBS = [
  "Bradford Bulls",
  "Castleford Tigers",
  "Catalans Dragons",
  "Huddersfield Giants",
  "Hull FC",
  "Hull KR",
  "Leeds Rhinos",
  "Leigh Leopards",
  "St Helens",
  "Toulouse Olympique",
  "Warrington Wolves",
  "Wakefield Trinity",
  "Wigan Warriors",
  "York Knights",
] as const;

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  team?: string;
  displayClub?: string;
  position?: string;
  nationality?: string;
  dateOfBirth?: string;
  birthYear?: number;
  peakRating?: number;
  value?: number;
  category?: string;
  year?: number;
  cardYear?: number;
  teamYearId?: string;
  availableInGame?: boolean;
  superLeagueEligible?: boolean;
};

function load(name: string): Raw[] {
  const raw = JSON.parse(readFileSync(join(DATA, name), "utf8"));
  return Array.isArray(raw) ? raw : Object.values(raw).flat();
}

function isUnknownNation(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return (
    !s ||
    /^unknown$/i.test(s) ||
    /^n\/?a$/i.test(s) ||
    /^tbd$/i.test(s) ||
    s === "?"
  );
}

function isUnknownPos(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s || /^unknown$/i.test(s) || s === "?") return true;
  // Title-case / alias forms are normalised at load time — not unknowns.
  const key = s.toLowerCase().replace(/_/g, " ").replace(/-/g, " ");
  const aliases = new Set(
    [...POSITIONS].map((p) => p.toLowerCase().replace(/_/g, " "))
  );
  aliases.add("stand off");
  aliases.add("stand-off");
  aliases.add("scrum half");
  aliases.add("scrum-half");
  aliases.add("second row");
  aliases.add("second-row");
  aliases.add("loose forward");
  aliases.add("fullback");
  aliases.add("full back");
  if (POSITIONS.has(s) || aliases.has(key)) return false;
  return true;
}

function isBadDob(v: unknown): boolean {
  if (v == null || v === "") return true;
  const s = String(v).trim();
  if (/unknown|tbd|n\/a|\?/i.test(s)) return true;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  let y = 0,
    m = 0,
    d = 0;
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  } else return true;
  if (y < 1940 || y > 2015) return true;
  if (m < 1 || m > 12 || d < 1 || d > 31) return true;
  return false;
}

function clubOf(p: Raw): string {
  return String(p.displayClub ?? p.team ?? p.club ?? "");
}

function main() {
  const files = [
    { file: "current-squads.json", rows: load("current-squads.json") },
    { file: "historic-players.json", rows: load("historic-players.json") },
    { file: "legends.json", rows: load("legends.json") },
  ] as const;

  const issues: Array<{
    file: string;
    id: string;
    name: string;
    field: string;
    value: unknown;
  }> = [];

  const ids = new Map<string, string[]>();
  let total = 0;

  for (const { file, rows } of files) {
    total += rows.length;
    for (const p of rows) {
      const list = ids.get(p.id) ?? [];
      list.push(file);
      ids.set(p.id, list);

      if (!p.name?.trim()) {
        issues.push({ file, id: p.id, name: p.name, field: "name", value: p.name });
      }
      if (isUnknownPos(p.position)) {
        issues.push({
          file,
          id: p.id,
          name: p.name,
          field: "position",
          value: p.position ?? null,
        });
      }
      if (isUnknownNation(p.nationality)) {
        // Unavailable leftovers are out of the playable pool — still note them.
        if (p.availableInGame === false) continue;
        issues.push({
          file,
          id: p.id,
          name: p.name,
          field: "nationality",
          value: p.nationality ?? null,
        });
      }
      if (!clubOf(p)) {
        issues.push({ file, id: p.id, name: p.name, field: "club", value: null });
      }
      if (p.peakRating == null || !Number.isFinite(Number(p.peakRating))) {
        issues.push({
          file,
          id: p.id,
          name: p.name,
          field: "peakRating",
          value: p.peakRating ?? null,
        });
      }
      if (p.value == null || !Number.isFinite(Number(p.value))) {
        issues.push({
          file,
          id: p.id,
          name: p.name,
          field: "value",
          value: p.value ?? null,
        });
      }

      // DOB: flag missing for current players only (historic often birthYear-only)
      if (p.category === "current" || file === "current-squads.json") {
        const hasBirthYear =
          typeof p.birthYear === "number" && Number.isFinite(p.birthYear);
        if (isBadDob(p.dateOfBirth) && !hasBirthYear) {
          issues.push({
            file,
            id: p.id,
            name: p.name,
            field: "dateOfBirth/birthYear",
            value: { dateOfBirth: p.dateOfBirth ?? null, birthYear: p.birthYear ?? null },
          });
        }
        if (!p.year && !p.cardYear) {
          issues.push({
            file,
            id: p.id,
            name: p.name,
            field: "year/cardYear",
            value: null,
          });
        }
        if (!p.teamYearId) {
          issues.push({
            file,
            id: p.id,
            name: p.name,
            field: "teamYearId",
            value: null,
          });
        }
      }
    }
  }

  const duplicateIds = [...ids.entries()].filter(([, f]) => f.length > 1);

  const current = files[0].rows.filter(
    (p) => p.availableInGame !== false
  );
  const byClub: Record<string, number> = {};
  for (const club of SL_2026_CLUBS) byClub[club] = 0;
  const unexpectedClubs: Record<string, number> = {};
  for (const p of current) {
    const club = clubOf(p);
    if ((SL_2026_CLUBS as readonly string[]).includes(club)) {
      byClub[club] = (byClub[club] ?? 0) + 1;
    } else {
      unexpectedClubs[club] = (unexpectedClubs[club] ?? 0) + 1;
    }
  }

  const byField: Record<string, number> = {};
  for (const i of issues) {
    byField[i.field] = (byField[i.field] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      players: total,
      current: current.length,
      historic: files[1].rows.length,
      legends: files[2].rows.length,
      unknownFieldHits: issues.length,
      duplicateIds: duplicateIds.length,
    },
    unknownByField: byField,
    currentByClub: byClub,
    unexpectedCurrentClubs: unexpectedClubs,
    duplicateIds: duplicateIds.slice(0, 50).map(([id, f]) => ({ id, files: f })),
    issues: issues.slice(0, 2000),
  };

  writeFileSync(
    join(DATA, "player-database-unknown-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log("=== UNKNOWN DATA AUDIT ===");
  console.log(`Players audited: ${total}`);
  console.log(`Unknown field hits: ${issues.length}`);
  console.log("By field:", byField);
  console.log("Duplicate IDs:", duplicateIds.length);
  console.log("\n2026 Current by club:");
  for (const club of SL_2026_CLUBS) {
    console.log(`  ${club}: ${byClub[club] ?? 0}`);
  }
  console.log("\nUnexpected current clubs:", unexpectedClubs);
  console.log("\nSample unknowns (first 40):");
  for (const i of issues.slice(0, 40)) {
    console.log(
      `  ${i.name.padEnd(28)} ${i.field.padEnd(22)} ${JSON.stringify(i.value)}`
    );
  }
  console.log("\nWrote data/player-database-unknown-audit.json");
}

main();
