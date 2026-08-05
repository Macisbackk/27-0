/**
 * Import season-specific historic Super League ratings (2020–2025).
 *
 * Source (only):
 *   data/imports/historic_super_league_ratings_2020_2025_smoothed.json
 *
 * Updates:
 *   - data/historic-players.json (matched year cards + safe new season versions)
 *   - data/player-rating-overrides.ts / .json (so normalize uses imported peakRating)
 *
 * Never touches current-squads, legends values, championship, reserves, or GOAT.
 *
 * Usage:
 *   npm run import:historic-ratings -- --dry-run
 *   npm run import:historic-ratings
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import { expandNameLookupKeys } from "../src/lib/players/player-name-resolve";
import { buildPlayerTeamYearId } from "../src/lib/players/year-card";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const IMPORT_PATH = join(
  ROOT,
  "data/imports/historic_super_league_ratings_2020_2025_smoothed.json"
);
const HISTORIC_PATH = join(ROOT, "data/historic-players.json");
const CURRENT_PATH = join(ROOT, "data/current-squads.json");
const LEGENDS_PATH = join(ROOT, "data/legends.json");
const ERA_17_PATH = join(ROOT, "data/era-starting-17s.json");
const REPORT_PATH = join(
  ROOT,
  "data/imports/historic_super_league_ratings_2020_2025_apply-report.json"
);
const RATING_OVERRIDES_TS = join(ROOT, "data/player-rating-overrides.ts");
const RATING_OVERRIDES_JSON = join(ROOT, "data/player-rating-overrides.json");

const YEAR_MIN = 2020;
const YEAR_MAX = 2025;
const RATING_MIN = 80;
const RATING_MAX = 93;

const CLUB_ID_PREFIX: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Castleford Tigers": "castleford",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds",
  "Leigh Leopards": "leigh",
  "London Broncos": "london",
  "Salford Red Devils": "salford",
  "St Helens": "st-helens",
  "Toulouse Olympique": "toulouse",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Widnes Vikings": "widnes",
  "Wigan Warriors": "wigan",
  "York Knights": "york",
};

/** Canonical display club → normalised key aliases. */
const CLUB_ALIASES: Record<string, string> = {
  leigh: "leigh leopards",
  "leigh centurions": "leigh leopards",
  "leigh leopards": "leigh leopards",
  wakefield: "wakefield trinity",
  "wakefield trinity wildcats": "wakefield trinity",
  "wakefield trinity": "wakefield trinity",
  salford: "salford red devils",
  "salford city reds": "salford red devils",
  "salford red devils": "salford red devils",
  "harlequins rl": "london broncos",
  london: "london broncos",
  "london broncos": "london broncos",
  "st. helens": "st helens",
  "st helens": "st helens",
  "hull fc": "hull fc",
  "hull kr": "hull kr",
  wigan: "wigan warriors",
  "wigan warriors": "wigan warriors",
  warrington: "warrington wolves",
  "warrington wolves": "warrington wolves",
  leeds: "leeds rhinos",
  "leeds rhinos": "leeds rhinos",
  castleford: "castleford tigers",
  "castleford tigers": "castleford tigers",
  catalans: "catalans dragons",
  "catalans dragons": "catalans dragons",
  huddersfield: "huddersfield giants",
  "huddersfield giants": "huddersfield giants",
  bradford: "bradford bulls",
  "bradford bulls": "bradford bulls",
  toulouse: "toulouse olympique",
  "toulouse olympique": "toulouse olympique",
  widnes: "widnes vikings",
  "widnes vikings": "widnes vikings",
  york: "york knights",
  "york knights": "york knights",
};

const CANONICAL_CLUB_BY_NORM: Record<string, string> = {
  "leigh leopards": "Leigh Leopards",
  "wakefield trinity": "Wakefield Trinity",
  "salford red devils": "Salford Red Devils",
  "london broncos": "London Broncos",
  "st helens": "St Helens",
  "hull fc": "Hull FC",
  "hull kr": "Hull KR",
  "wigan warriors": "Wigan Warriors",
  "warrington wolves": "Warrington Wolves",
  "leeds rhinos": "Leeds Rhinos",
  "castleford tigers": "Castleford Tigers",
  "catalans dragons": "Catalans Dragons",
  "huddersfield giants": "Huddersfield Giants",
  "bradford bulls": "Bradford Bulls",
  "toulouse olympique": "Toulouse Olympique",
  "widnes vikings": "Widnes Vikings",
  "york knights": "York Knights",
};

const STARTING_17_POSITION_MAP: Record<string, Position> = {
  FB: "FULLBACK",
  W: "WING",
  C: "CENTRE",
  FE: "STAND_OFF",
  HB: "SCRUM_HALF",
  FR: "PROP",
  HK: "HOOKER",
  "2R": "SECOND_ROW",
  L: "LOOSE_FORWARD",
  B: "LOOSE_FORWARD",
};

type ImportRow = {
  name: string;
  rating: number;
  club: string;
  year: number;
};

type ImportFile = {
  players: ImportRow[];
};

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  category?: string;
  peakRating?: number;
  year?: number;
  cardYear?: number;
  teamYearId?: string;
  nationality?: string;
  position?: string;
  yearsActive?: string;
  value?: number;
  status?: string;
  basePlayerId?: string;
  team?: string;
  displayClub?: string;
  appearances?: number;
  tries?: number;
  intlCaps?: number;
};

type EraMember = { number: number; position: string; name: string };
type EraEntry = {
  club: string;
  year: number;
  source: string;
  squad: EraMember[];
};

type MatchHit =
  | { status: "matched"; player: RawPlayer; via: string }
  | { status: "ambiguous"; candidates: RawPlayer[]; via: string }
  | { status: "legend_only"; candidates: RawPlayer[] }
  | { status: "current_only"; candidates: RawPlayer[] }
  | { status: "unmatched" };

const dryRun =
  process.argv.includes("--dry-run") || process.argv.includes("-n");

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseClubKey(club: string): string {
  const n = normaliseName(club);
  return CLUB_ALIASES[n] ?? n;
}

function canonicalClub(club: string): string {
  const key = normaliseClubKey(club);
  return CANONICAL_CLUB_BY_NORM[key] ?? club.trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function playerYear(p: RawPlayer): number | undefined {
  if (typeof p.year === "number" && Number.isFinite(p.year)) return p.year;
  if (typeof p.cardYear === "number" && Number.isFinite(p.cardYear)) {
    return p.cardYear;
  }
  const m = p.id.match(/-(\d{4})$/);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

function playerClub(p: RawPlayer): string {
  return String(p.club ?? p.displayClub ?? p.team ?? "");
}

function seasonKey(name: string, club: string, year: number): string {
  return `${normaliseName(name)}|${normaliseClubKey(club)}|${year}`;
}

function identitySlug(name: string, club: string, year: number): string {
  return `${slugify(name)}-${slugify(canonicalClub(club))}-${year}`;
}

function loadCurrentPlayers(): RawPlayer[] {
  const raw = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as
    | RawPlayer[]
    | { players: RawPlayer[] };
  return Array.isArray(raw) ? raw : raw.players;
}

function upsertTsRecord(
  filePath: string,
  exportName: string,
  entries: Record<string, number>
): void {
  let src = readFileSync(filePath, "utf8");
  for (const [id, value] of Object.entries(entries)) {
    const re = new RegExp(`(\\s+"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*)\\d+`);
    if (re.test(src)) {
      src = src.replace(re, `$1${value}`);
      continue;
    }
    const insertAt = src.lastIndexOf("};");
    if (insertAt < 0) {
      throw new Error(`Could not find end of ${exportName} in ${filePath}`);
    }
    const line = `  "${id}": ${value},\n`;
    src = src.slice(0, insertAt) + line + src.slice(insertAt);
  }
  writeFileSync(filePath, src, "utf8");
}

function upsertJsonOverrides(
  filePath: string,
  entries: Record<string, number>
): void {
  if (!existsSync(filePath)) return;
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
    ratingOverrides?: Record<string, number>;
    [key: string]: unknown;
  };
  const map = { ...(raw.ratingOverrides ?? {}) };
  for (const [id, value] of Object.entries(entries)) {
    map[id] = value;
  }
  raw.ratingOverrides = map;
  writeFileSync(filePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

function buildNameIndex(players: RawPlayer[]): Map<string, RawPlayer[]> {
  const index = new Map<string, RawPlayer[]>();
  for (const player of players) {
    for (const key of expandNameLookupKeys(player.name)) {
      const list = index.get(key) ?? [];
      list.push(player);
      index.set(key, list);
    }
  }
  return index;
}

function nameCandidates(
  name: string,
  index: Map<string, RawPlayer[]>
): RawPlayer[] {
  const seen = new Set<string>();
  const out: RawPlayer[] = [];
  for (const key of expandNameLookupKeys(name)) {
    for (const p of index.get(key) ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function pickTemplate(
  name: string,
  index: Map<string, RawPlayer[]>
): RawPlayer | null {
  const cands = nameCandidates(name, index);
  const historic = cands.filter((p) => p.category === "historic");
  const legend = cands.filter((p) => p.category === "legend");
  const current = cands.filter((p) => p.category === "current");
  return historic[0] ?? legend[0] ?? current[0] ?? null;
}

function mapEraPosition(code: string, fallback?: string): Position {
  const mapped = STARTING_17_POSITION_MAP[code.trim().toUpperCase()];
  if (mapped) return mapped;
  if (fallback && STARTING_17_POSITION_MAP[fallback]) {
    return STARTING_17_POSITION_MAP[fallback];
  }
  const asPos = fallback as Position | undefined;
  if (
    asPos &&
    [
      "FULLBACK",
      "WING",
      "CENTRE",
      "STAND_OFF",
      "SCRUM_HALF",
      "PROP",
      "HOOKER",
      "SECOND_ROW",
      "LOOSE_FORWARD",
    ].includes(asPos)
  ) {
    return asPos;
  }
  return "LOOSE_FORWARD";
}

function buildYearCardId(
  club: string,
  name: string,
  year: number,
  existingIds: Set<string>
): string {
  const prefix = CLUB_ID_PREFIX[club] ?? slugify(club);
  let base = `${prefix}-hist-${slugify(name)}-${year}`;
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function matchImportRow(
  row: ImportRow,
  historicBySeason: Map<string, RawPlayer[]>,
  historicById: Map<string, RawPlayer>,
  historicNameIndex: Map<string, RawPlayer[]>,
  allNameIndex: Map<string, RawPlayer[]>,
  eraSeasonNames: Map<string, { position: string; club: string }>
): MatchHit {
  const club = canonicalClub(row.club);
  const key = seasonKey(row.name, club, row.year);

  // 1) Normalised name + club + year (historic only)
  const seasonHits = (historicBySeason.get(key) ?? []).filter(
    (p) => p.category === "historic"
  );
  if (seasonHits.length === 1) {
    return { status: "matched", player: seasonHits[0]!, via: "name+club+year" };
  }
  if (seasonHits.length > 1) {
    return {
      status: "ambiguous",
      candidates: seasonHits,
      via: "name+club+year",
    };
  }

  // 2) Stable team-year player ID
  const expectedId = buildYearCardId(club, row.name, row.year, new Set());
  const byId = historicById.get(expectedId);
  if (byId && byId.category === "historic") {
    return { status: "matched", player: byId, via: "stable-id" };
  }

  // Also try any historic name candidates with exact year + club
  const nameHits = nameCandidates(row.name, historicNameIndex).filter((p) => {
    if (p.category !== "historic") return false;
    const y = playerYear(p);
    if (y !== row.year) return false;
    return normaliseClubKey(playerClub(p)) === normaliseClubKey(club);
  });
  if (nameHits.length === 1) {
    return {
      status: "matched",
      player: nameHits[0]!,
      via: "name+year+club-index",
    };
  }
  if (nameHits.length > 1) {
    return {
      status: "ambiguous",
      candidates: nameHits,
      via: "name+year+club-index",
    };
  }

  // Refuse current / legend as update targets
  const allHits = nameCandidates(row.name, allNameIndex).filter((p) => {
    const y = playerYear(p);
    return (
      y === row.year &&
      normaliseClubKey(playerClub(p)) === normaliseClubKey(club)
    );
  });
  const legends = allHits.filter((p) => p.category === "legend");
  const currents = allHits.filter((p) => p.category === "current");
  if (legends.length > 0 && nameHits.length === 0) {
    return { status: "legend_only", candidates: legends };
  }
  if (currents.length > 0 && nameHits.length === 0) {
    return { status: "current_only", candidates: currents };
  }

  // 3) Confirmed in era club-year squad — candidate for create (handled later)
  if (eraSeasonNames.has(key)) {
    return { status: "unmatched" };
  }

  return { status: "unmatched" };
}

function createSeasonCard(
  row: ImportRow,
  template: RawPlayer,
  eraPosition: string | undefined,
  existingIds: Set<string>
): RawPlayer {
  const club = canonicalClub(row.club);
  const year = row.year;
  const rating = row.rating;
  const position = mapEraPosition(
    eraPosition ?? "",
    String(template.position ?? "LOOSE_FORWARD")
  );
  const id = buildYearCardId(club, row.name, year, existingIds);
  const basePlayerId =
    typeof template.basePlayerId === "string" && template.basePlayerId
      ? template.basePlayerId
      : template.id.replace(/-\d{4}$/, "");

  const card: RawPlayer = {
    id,
    name: row.name,
    position,
    primaryPosition: position,
    club,
    team: club,
    displayClub: club,
    nationality: String(template.nationality ?? "Unknown"),
    yearsActive: `${year}–${year}`,
    year,
    cardYear: year,
    teamYearId: buildPlayerTeamYearId(club, year),
    category: "historic",
    status: "Historic",
    peakRating: rating,
    value: computePlayerValue(rating, position, "historic"),
    intlCaps:
      typeof template.intlCaps === "number" ? template.intlCaps : 0,
    availableInGame: true,
    basePlayerId,
    source: "historic_super_league_ratings_2020_2025_smoothed",
    needsReview: false,
  };

  if (typeof template.dateOfBirth === "string") {
    card.dateOfBirth = template.dateOfBirth;
  }
  if (typeof template.birthYear === "number") {
    card.birthYear = template.birthYear;
  }
  if (typeof template.era === "string") {
    card.era = template.era;
  } else {
    card.era = "CONTEMPORARY_ERA";
  }

  // Do not invent career stats — omit appearances/tries unless template is same season
  const tplYear = playerYear(template);
  if (
    tplYear === year &&
    normaliseClubKey(playerClub(template)) === normaliseClubKey(club)
  ) {
    if (typeof template.appearances === "number") {
      card.appearances = template.appearances;
    }
    if (typeof template.tries === "number") {
      card.tries = template.tries;
    }
  }

  return card;
}

function main(): void {
  const importFile = JSON.parse(
    readFileSync(IMPORT_PATH, "utf8")
  ) as ImportFile;
  const rows = importFile.players ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Import file has no players[]");
  }

  const historic = JSON.parse(
    readFileSync(HISTORIC_PATH, "utf8")
  ) as RawPlayer[];
  const current = loadCurrentPlayers();
  const legends = JSON.parse(readFileSync(LEGENDS_PATH, "utf8")) as RawPlayer[];
  const eraEntries = JSON.parse(
    readFileSync(ERA_17_PATH, "utf8")
  ) as EraEntry[];

  const historicBySeason = new Map<string, RawPlayer[]>();
  const historicById = new Map<string, RawPlayer>();
  for (const p of historic) {
    historicById.set(p.id, p);
    const y = playerYear(p);
    if (y === undefined) continue;
    const key = seasonKey(p.name, playerClub(p), y);
    const list = historicBySeason.get(key) ?? [];
    list.push(p);
    historicBySeason.set(key, list);
  }

  const historicNameIndex = buildNameIndex(historic);
  const allNameIndex = buildNameIndex([...historic, ...current, ...legends]);

  const eraSeasonNames = new Map<
    string,
    { position: string; club: string }
  >();
  for (const entry of eraEntries) {
    if (entry.year < YEAR_MIN || entry.year > YEAR_MAX) continue;
    const club = canonicalClub(entry.club);
    for (const member of entry.squad) {
      const key = seasonKey(member.name, club, entry.year);
      eraSeasonNames.set(key, { position: member.position, club });
    }
  }

  const invalid: Array<{ row: ImportRow; reason: string }> = [];
  const unmatched: Array<{
    name: string;
    club: string;
    year: number;
    rating: number;
    reason: string;
  }> = [];
  const ambiguous: Array<{
    name: string;
    club: string;
    year: number;
    rating: number;
    ids: string[];
    via: string;
  }> = [];
  const duplicatesResolved: Array<{
    key: string;
    keptId: string;
    removedIds: string[];
  }> = [];

  // Resolve duplicate historic season keys (2020–2025 only)
  for (const [key, list] of historicBySeason) {
    const yearPart = Number(key.split("|")[2]);
    if (
      !Number.isFinite(yearPart) ||
      yearPart < YEAR_MIN ||
      yearPart > YEAR_MAX
    ) {
      continue;
    }
    if (list.length <= 1) continue;
    const scored = [...list].sort((a, b) => {
      const score = (p: RawPlayer) =>
        (p.nationality && p.nationality !== "Unknown" ? 4 : 0) +
        (typeof p.appearances === "number" ? 2 : 0) +
        (typeof p.tries === "number" ? 1 : 0) +
        (p.teamYearId ? 1 : 0) +
        (p.status ? 1 : 0);
      return score(b) - score(a);
    });
    const keep = scored[0]!;
    const remove = scored.slice(1);
    duplicatesResolved.push({
      key,
      keptId: keep.id,
      removedIds: remove.map((p) => p.id),
    });
    historicBySeason.set(key, [keep]);
  }

  let updated = 0;
  let created = 0;
  let unchanged = 0;
  const overrideEntries: Record<string, number> = {};
  const existingIds = new Set(historic.map((p) => p.id));
  const removeIds = new Set(
    duplicatesResolved.flatMap((d) => d.removedIds)
  );

  const nextHistoric = historic.filter((p) => !removeIds.has(p.id));
  const nextById = new Map(nextHistoric.map((p) => [p.id, p]));

  for (const row of rows) {
    if (
      !row?.name?.trim() ||
      !row?.club?.trim() ||
      row.year == null ||
      row.rating == null
    ) {
      invalid.push({ row, reason: "missing required fields" });
      continue;
    }
    if (row.year < YEAR_MIN || row.year > YEAR_MAX) {
      invalid.push({ row, reason: `year ${row.year} outside 2020–2025` });
      continue;
    }
    if (row.rating < RATING_MIN || row.rating > RATING_MAX) {
      invalid.push({
        row,
        reason: `rating ${row.rating} outside ${RATING_MIN}–${RATING_MAX}`,
      });
      continue;
    }

    const club = canonicalClub(row.club);
    const key = seasonKey(row.name, club, row.year);
    const hit = matchImportRow(
      row,
      historicBySeason,
      nextById,
      historicNameIndex,
      allNameIndex,
      eraSeasonNames
    );

    if (hit.status === "ambiguous") {
      ambiguous.push({
        name: row.name,
        club,
        year: row.year,
        rating: row.rating,
        ids: hit.candidates.map((c) => c.id),
        via: hit.via,
      });
      continue;
    }

    if (hit.status === "legend_only") {
      unmatched.push({
        name: row.name,
        club,
        year: row.year,
        rating: row.rating,
        reason: "legend-only match refused",
      });
      continue;
    }

    if (hit.status === "current_only") {
      // Still allow create when confirmed in era squad
      if (!eraSeasonNames.has(key)) {
        unmatched.push({
          name: row.name,
          club,
          year: row.year,
          rating: row.rating,
          reason: "current-only match refused",
        });
        continue;
      }
    }

    if (hit.status === "matched") {
      const player = nextById.get(hit.player.id);
      if (!player || player.category !== "historic") {
        unmatched.push({
          name: row.name,
          club,
          year: row.year,
          rating: row.rating,
          reason: "matched non-historic refused",
        });
        continue;
      }
      if (player.peakRating === row.rating) {
        unchanged++;
      } else {
        player.peakRating = row.rating;
        const pos = String(player.position ?? "LOOSE_FORWARD") as Position;
        player.value = computePlayerValue(row.rating, pos, "historic");
        delete (player as { rating?: number }).rating;
        updated++;
      }
      overrideEntries[player.id] = row.rating;
      continue;
    }

    // Create only when era club-year confirms the player
    const eraInfo = eraSeasonNames.get(key);
    if (!eraInfo) {
      unmatched.push({
        name: row.name,
        club,
        year: row.year,
        rating: row.rating,
        reason: "no historic match and not in era starting-17",
      });
      continue;
    }

    // Guard against duplicate season versions
    if ((historicBySeason.get(key) ?? []).some((p) => nextById.has(p.id))) {
      unmatched.push({
        name: row.name,
        club,
        year: row.year,
        rating: row.rating,
        reason: "duplicate season key already present",
      });
      continue;
    }

    const template = pickTemplate(row.name, allNameIndex);
    if (!template) {
      unmatched.push({
        name: row.name,
        club,
        year: row.year,
        rating: row.rating,
        reason: "in era squad but no safe template player for metadata",
      });
      continue;
    }

    const card = createSeasonCard(
      row,
      template,
      eraInfo.position,
      existingIds
    );
    existingIds.add(card.id);
    nextHistoric.push(card);
    nextById.set(card.id, card);
    historicBySeason.set(key, [card]);
    overrideEntries[card.id] = row.rating;
    created++;
  }

  const report = {
    dryRun,
    importPath: IMPORT_PATH,
    totalRead: rows.length,
    invalid: invalid.length,
    invalidRows: invalid,
    updated,
    unchanged,
    created,
    unmatched: unmatched.length,
    unmatchedRows: unmatched,
    ambiguous: ambiguous.length,
    ambiguousRows: ambiguous,
    duplicatesResolved: duplicatesResolved.length,
    duplicateResolutions: duplicatesResolved,
    identityExamples: rows
      .filter((r) => /bevan french|liam farrell|jake connor|toby king|daryl clark/i.test(r.name))
      .slice(0, 20)
      .map((r) => ({
        identity: identitySlug(r.name, r.club, r.year),
        ...r,
        clubCanonical: canonicalClub(r.club),
      })),
    protected: {
      currentSquadsUntouched: true,
      legendsUntouched: true,
      reservesUntouched: true,
      generatedChampionshipUntouched: true,
    },
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("=== Historic season ratings import ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "WRITE"}`);
  console.log(`Read: ${rows.length}`);
  console.log(`Updated existing: ${updated}`);
  console.log(`Unchanged (same rating): ${unchanged}`);
  console.log(`Created season versions: ${created}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);
  console.log(`Invalid: ${invalid.length}`);
  console.log(`Duplicates resolved: ${duplicatesResolved.length}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (unmatched.length) {
    console.log("\nUnmatched (first 40):");
    for (const u of unmatched.slice(0, 40)) {
      console.log(
        `  - ${u.name} | ${u.club} | ${u.year} | ${u.rating} — ${u.reason}`
      );
    }
  }
  if (ambiguous.length) {
    console.log("\nAmbiguous:");
    for (const a of ambiguous) {
      console.log(
        `  - ${a.name} | ${a.club} | ${a.year} → ${a.ids.join(", ")} (${a.via})`
      );
    }
  }

  if (dryRun) {
    console.log("\nDry run only — no files written (except report).");
    return;
  }

  writeFileSync(
    HISTORIC_PATH,
    `${JSON.stringify(nextHistoric, null, 2)}\n`,
    "utf8"
  );
  upsertTsRecord(RATING_OVERRIDES_TS, "PLAYER_RATING_OVERRIDES", overrideEntries);
  upsertJsonOverrides(RATING_OVERRIDES_JSON, overrideEntries);

  console.log(`\nWrote ${HISTORIC_PATH}`);
  console.log(`Upserted ${Object.keys(overrideEntries).length} rating overrides`);
}

main();
