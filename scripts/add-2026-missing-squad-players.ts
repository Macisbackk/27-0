/**
 * Add real 2026 Super League squad players that are still missing from
 * data/current-squads.json, and move players whose Current card sits at the
 * wrong club for 2026.
 *
 * Source of the squad lists: Love Rugby League "Super League 2026 squad
 * numbers: Club-by-club guide" (28 Jan 2026), cross-checked per club against a
 * second source (club website, Rugby League Zone or Wikipedia). Every added row
 * carries at least one source URL in the report. Nothing is invented: players
 * whose position or 2026 club could not be confirmed stay out and are listed
 * under `unverified` in the report.
 *
 * Idempotent — re-running skips players already present (normalised name) and
 * moves already applied.
 *
 * Run:
 *   bun scripts/add-2026-missing-squad-players.ts
 * (rewrites current-squads.json, the per-club chunks and the report)
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildTeamYearId } from "../src/lib/game/team-year-pools";
import { computePlayerValue } from "../src/lib/players/ratings";
import { clampCurrentSuperLeagueRating } from "../src/lib/players/rating-floors";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";
import type { Position } from "../src/lib/types";
import {
  ADDITIONS,
  MOVES,
  UNVERIFIED,
  NOT_APPLIED_MOVES,
  SQUAD_LIST_SOURCES,
  type Addition,
} from "../data/sl-2026-missing-squad-players";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const CURRENT_PATH = join(DATA, "current-squads.json");
const HISTORIC_PATH = join(DATA, "historic-players.json");
const CHUNK_DIR = join(DATA, "players", "chunks", "current");
const TEAM_YEAR_SQUADS_PATH = join(DATA, "current-team-year-squads-2026.json");
const TEAM_YEAR_ROSTERS_PATH = join(DATA, "team-year-rosters.json");
const TEAM_YEAR_META_PATH = join(DATA, "team-year-rosters-meta.json");
const SL_SQUADS_PATH = join(DATA, "sl-2026-squads.json");
const REPORT_PATH = join(DATA, "add-2026-missing-squad-players-report.json");

const CURRENT_YEAR = 2026;

export const CLUB_SLUGS: Record<string, string> = {
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

/**
 * Data files that key or reference Current player ids. A move retargets the
 * old id to the new one in each (object keys and quoted string values).
 */
const ID_REFERENCE_FILES = [
  "historic-players.json",
  "birth-years.json",
  "career-tries-verified.json",
  "career-tries-corrections.json",
  "challenge-cup-years.json",
  "dream-team-years.json",
  "golden-boot-years.json",
  "league-leaders-years.json",
  "super-league-champion-years.json",
  "intl-caps-corrections.json",
  "prime-years.json",
  "years-active-corrections.json",
  "player-super-league-club-overrides.json",
  "player-rating-overrides.json",
  "player-rating-overrides.ts",
  "player-potential-overrides.ts",
  "player-goal-kicking-overrides.ts",
  "team-year-rosters.json",
  "current-team-year-squads-2026.json",
];

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  position: string;
  peakRating: number;
  nationality?: string;
  birthYear?: number;
  dateOfBirth?: string;
  yearsActive?: string;
};

function slugifyName(name: string): string {
  return normalizePlayerNameKey(name).replace(/\s+/g, "-");
}

function buildId(club: string, name: string): string {
  const slug = CLUB_SLUGS[club];
  if (!slug) throw new Error(`No id slug for ${club}`);
  return `${slug}-cur-${slugifyName(name)}`;
}

function nameKeys(name: string, aliases: string[] = []): Set<string> {
  return new Set([name, ...aliases].map((n) => normalizePlayerNameKey(n)));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace `"oldId"` with `"newId"`; JSON object key collisions keep the existing new key. */
function retargetFile(file: string, oldId: string, newId: string): number {
  const path = join(DATA, file);
  if (!existsSync(path)) return 0;
  const text = readFileSync(path, "utf8");
  if (!text.includes(`"${oldId}"`)) return 0;
  if (file.endsWith(".json")) {
    const data = JSON.parse(text) as unknown;
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Object.prototype.hasOwnProperty.call(data, oldId) &&
      Object.prototype.hasOwnProperty.call(data, newId)
    ) {
      // Both keys exist (e.g. birth-years.json): keep the destination key.
      delete (data as Record<string, unknown>)[oldId];
      const out = JSON.stringify(data, null, 2) + (text.endsWith("\n") ? "\n" : "");
      writeFileSync(path, out.split(`"${oldId}"`).join(`"${newId}"`));
      return 1;
    }
  }
  const next = text.replace(new RegExp(`"${escapeRe(oldId)}"`, "g"), `"${newId}"`);
  writeFileSync(path, next);
  return 1;
}

function removeFromCurrentPools(oldId: string, newId: string, fromClub: string): string[] {
  const touched: string[] = [];
  const squads = JSON.parse(readFileSync(TEAM_YEAR_SQUADS_PATH, "utf8")) as Record<
    string,
    Record<string, { playerIds: string[]; positions: string[] }>
  >;
  const entry = squads[fromClub]?.[String(CURRENT_YEAR)];
  if (entry) {
    const idx = entry.playerIds.findIndex((id) => id === oldId || id === newId);
    if (idx >= 0) {
      entry.playerIds.splice(idx, 1);
      entry.positions.splice(idx, 1);
      if (entry.playerIds.length < 16) {
        throw new Error(`${fromClub} 2026 pool would drop below 16 players`);
      }
      writeFileSync(TEAM_YEAR_SQUADS_PATH, JSON.stringify(squads, null, 2) + "\n");
      touched.push("current-team-year-squads-2026.json");
    }
  }
  const rosters = JSON.parse(readFileSync(TEAM_YEAR_ROSTERS_PATH, "utf8")) as Record<
    string,
    Record<string, string[]>
  >;
  const roster = rosters[fromClub]?.[String(CURRENT_YEAR)];
  if (roster) {
    const before = roster.length;
    rosters[fromClub]![String(CURRENT_YEAR)] = roster.filter((id) => id !== oldId && id !== newId);
    if (rosters[fromClub]![String(CURRENT_YEAR)]!.length !== before) {
      writeFileSync(TEAM_YEAR_ROSTERS_PATH, JSON.stringify(rosters, null, 2) + "\n");
      touched.push("team-year-rosters.json");
      const meta = JSON.parse(readFileSync(TEAM_YEAR_META_PATH, "utf8")) as Record<
        string,
        Record<string, { playerCount?: number }>
      >;
      const m = meta[fromClub]?.[String(CURRENT_YEAR)];
      if (m) {
        m.playerCount = rosters[fromClub]![String(CURRENT_YEAR)]!.length;
        writeFileSync(TEAM_YEAR_META_PATH, JSON.stringify(meta, null, 2) + "\n");
        touched.push("team-year-rosters-meta.json");
      }
    }
  }
  return touched;
}

function removeFromSlSquads(name: string, fromClub: string): boolean {
  if (!existsSync(SL_SQUADS_PATH)) return false;
  const sl = JSON.parse(readFileSync(SL_SQUADS_PATH, "utf8")) as Record<
    string,
    { name: string }[]
  >;
  const rows = sl[fromClub];
  if (!rows) return false;
  const key = normalizePlayerNameKey(name);
  const next = rows.filter((r) => normalizePlayerNameKey(r.name) !== key);
  if (next.length === rows.length) return false;
  sl[fromClub] = next;
  writeFileSync(SL_SQUADS_PATH, JSON.stringify(sl, null, 2) + "\n");
  return true;
}

function findHistoric(historic: Raw[], keys: Set<string>): Raw | undefined {
  const hits = historic.filter((p) => keys.has(normalizePlayerNameKey(p.name)));
  return (
    hits.find((p) => typeof p.birthYear === "number" && p.nationality && p.nationality !== "Unknown") ??
    hits.find((p) => p.nationality && p.nationality !== "Unknown") ??
    hits[0]
  );
}

function slugifyClubFile(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function writeChunks(players: Raw[]): void {
  const byClub = new Map<string, Raw[]>();
  for (const row of players) {
    const list = byClub.get(row.club) ?? [];
    list.push(row);
    byClub.set(row.club, list);
  }
  const manifestPath = join(CHUNK_DIR, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    clubs: { club: string; slug: string; file: string; count: number }[];
  };
  for (const [club, rows] of byClub) {
    const slug = slugifyClubFile(club);
    const file = `${slug}.json`;
    const path = join(CHUNK_DIR, file);
    if (!existsSync(path)) {
      throw new Error(`No chunk file for ${club}; run build:player-chunks`);
    }
    // Keep each committed chunk's format (2-space JSON; trailing newline only if it had one).
    const hadNewline = readFileSync(path, "utf8").endsWith("\n");
    writeFileSync(path, JSON.stringify(rows, null, 2) + (hadNewline ? "\n" : ""));
    const entry = manifest.clubs.find((c) => c.club === club);
    if (entry) entry.count = rows.length;
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function buildRow(add: Addition, historic: Raw[]): Raw {
  const keys = nameKeys(add.name, add.aliases);
  const hist = findHistoric(historic, keys);
  const position = add.position as Position;
  const rating = clampCurrentSuperLeagueRating(add.rating);
  const id = buildId(add.club, add.name);
  const nationality =
    add.nationality ??
    (hist?.nationality && hist.nationality !== "Unknown" ? hist.nationality : undefined);
  if (!nationality) throw new Error(`${add.name}: no nationality`);
  const dateOfBirth = add.dateOfBirth ?? (typeof hist?.dateOfBirth === "string" ? hist.dateOfBirth : undefined);
  const birthYear =
    add.birthYear ??
    (dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : undefined) ??
    (typeof hist?.birthYear === "number" ? hist.birthYear : undefined);

  const row: Raw = {
    id,
    name: add.name,
    club: add.club,
    currentClub: add.club,
    team: add.club,
    displayClub: add.club,
    position,
    positions: [position],
    primaryPosition: position,
    nationality,
    era: "CONTEMPORARY_ERA",
    yearsActive: add.yearsActive ?? "2026–Present",
    category: "current",
    peakRating: rating,
    value: computePlayerValue(rating, position, "current"),
    appearances: 0,
    tries: 0,
    teamYearId: buildTeamYearId(add.club, String(CURRENT_YEAR)),
    year: CURRENT_YEAR,
    cardYear: CURRENT_YEAR,
    status: "Current",
    basePlayerId: id,
    availableInGame: true,
    superLeagueEligible: true,
  };
  if (dateOfBirth) row.dateOfBirth = dateOfBirth;
  if (birthYear) row.birthYear = birthYear;
  if (add.previousClubs?.length) row.clubsPlayedFor = [...add.previousClubs, add.club];
  return row;
}

function main(): void {
  const players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as Raw[];
  const historic = JSON.parse(readFileSync(HISTORIC_PATH, "utf8")) as Raw[];

  const movedReport: Record<string, unknown>[] = [];

  // ── Moves first, so an added name never duplicates a moved card. ──────────
  for (const move of MOVES) {
    const newId = buildId(move.toClub, move.name);
    const already = players.find((p) => p.id === newId);
    const player = players.find((p) => p.id === move.fromId);
    if (!player) {
      if (already) {
        movedReport.push({ ...move, toId: newId, status: "already applied" });
        continue;
      }
      throw new Error(`Move source ${move.fromId} not found`);
    }
    const fromClub = player.club;
    const poolFiles = removeFromCurrentPools(move.fromId, newId, fromClub);
    const slRemoved = removeFromSlSquads(player.name, fromClub);

    player.id = newId;
    player.basePlayerId = newId;
    player.club = move.toClub;
    player.currentClub = move.toClub;
    player.team = move.toClub;
    player.displayClub = move.toClub;
    player.teamYearId = buildTeamYearId(move.toClub, String(CURRENT_YEAR));
    const played = Array.isArray(player.clubsPlayedFor) ? (player.clubsPlayedFor as string[]) : [];
    for (const c of [fromClub, move.toClub]) if (!played.includes(c)) played.push(c);
    player.clubsPlayedFor = played;

    // Keep the row grouped with its new club.
    players.splice(players.indexOf(player), 1);
    const lastIdx = players.map((p) => p.club).lastIndexOf(move.toClub);
    players.splice(lastIdx + 1, 0, player);

    const retargeted = ID_REFERENCE_FILES.filter((f) => retargetFile(f, move.fromId, newId) > 0);
    movedReport.push({
      name: player.name,
      fromClub,
      toClub: move.toClub,
      fromId: move.fromId,
      toId: newId,
      reason: move.reason,
      sources: move.sources,
      removedFromFromClub2026Pool: poolFiles.length > 0,
      removedFromSl2026Squads: slRemoved,
      idRetargetedIn: retargeted,
      status: "applied",
    });
  }

  // ── Additions ─────────────────────────────────────────────────────────────
  const existingKeys = new Map<string, Raw>();
  for (const p of players) existingKeys.set(normalizePlayerNameKey(p.name), p);

  const addedByClub: Record<string, Record<string, unknown>[]> = {};
  const skipped: Record<string, unknown>[] = [];
  for (const add of ADDITIONS) {
    const keys = nameKeys(add.name, add.aliases);
    const hit = [...keys].map((k) => existingKeys.get(k)).find(Boolean);
    const id = buildId(add.club, add.name);
    if (hit && hit.id !== id) {
      skipped.push({ name: add.name, club: add.club, reason: `already in current-squads as ${hit.id}` });
      continue;
    }
    const row = buildRow(add, historic);
    const reportEntry = {
      name: add.name,
      id: row.id,
      squadNumber: add.squadNumber ?? null,
      position: row.position,
      rating: row.peakRating,
      nationality: row.nationality,
      nationalityBasis: add.nationalityBasis,
      birthYear: row.birthYear ?? null,
      status: add.status,
      sources: add.sources,
      notes: add.notes ?? null,
    };
    (addedByClub[add.club] ??= []).push(reportEntry);
    if (hit) continue; // already added on a previous run — keep the stored row
    const lastIdx = players.map((p) => p.club).lastIndexOf(add.club);
    players.splice(lastIdx + 1, 0, row);
    existingKeys.set(normalizePlayerNameKey(add.name), row);
  }

  const ids = new Set<string>();
  for (const p of players) {
    if (ids.has(p.id)) throw new Error(`Duplicate id ${p.id}`);
    ids.add(p.id);
  }

  writeFileSync(CURRENT_PATH, JSON.stringify(players, null, 2) + "\n");
  writeChunks(players);

  const counts: Record<string, number> = {};
  for (const club of Object.keys(CLUB_SLUGS)) {
    counts[club] = players.filter((p) => p.club === club && p.availableInGame !== false).length;
  }

  const clubs: Record<string, unknown> = {};
  for (const club of Object.keys(CLUB_SLUGS)) {
    clubs[club] = {
      squadListSources: SQUAD_LIST_SOURCES[club] ?? [],
      added: addedByClub[club] ?? [],
      moved: movedReport.filter((m) => m.toClub === club || m.fromClub === club),
      movesNotApplied: NOT_APPLIED_MOVES.filter((m) => m.club === club),
      unverified: UNVERIFIED.filter((u) => u.club === club),
      playableCurrentPlayers: counts[club],
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    script: "scripts/add-2026-missing-squad-players.ts",
    method: [
      "Squad lists: Love Rugby League club-by-club 2026 squad numbers (28 Jan 2026), cross-checked per club.",
      "Missing = on a 2026 squad list but no Current card with the same normalised name (normalizePlayerNameKey).",
      "Position, nationality and date of birth from the cited source; nationalityBasis says when nationality is inferred from an English junior/academy pathway.",
      "Ratings on the 2026 Current scale (80 floor): academy/fringe 80, experienced depth 81, never above an established starter at the same club. Existing ratings untouched.",
      "Classic Current spins draw from the fixed 17-man 2026 pools (current-team-year-squads-2026.json), so depth rows appear in Manager Mode, Wordle/Grid and the global recruitment pools, not in the 17-man Classic spin pools.",
    ],
    totals: {
      added: Object.values(addedByClub).reduce((n, l) => n + l.length, 0),
      moved: movedReport.length,
      unverified: UNVERIFIED.length,
      movesNotApplied: NOT_APPLIED_MOVES.length,
    },
    clubs,
    skippedAlreadyPresent: skipped,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log(
    `Added ${report.totals.added}, moved ${report.totals.moved}, unverified ${report.totals.unverified}.`
  );
  for (const [club, n] of Object.entries(counts)) console.log(`  ${club}: ${n}`);
}

main();
