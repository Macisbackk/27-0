/**
 * Apply the curated Legend Tier prime-year cards (Showcase + Era Mode).
 *
 * Sets category/status to Legend, peakRating to the listed values, and
 * creates missing club-year cards from the safest existing template.
 *
 * Run: npx tsx scripts/apply-legend-tier-primes.ts [--dry-run]
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { expandNameLookupKeys } from "../src/lib/players/player-name-resolve";
import { computePlayerValue } from "../src/lib/players/ratings";
import { buildPlayerTeamYearId } from "../src/lib/players/year-card";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const HISTORIC_PATH = join(ROOT, "data/historic-players.json");
const LEGENDS_PATH = join(ROOT, "data/legends.json");
const CURRENT_PATH = join(ROOT, "data/current-squads.json");
const OVERRIDES_TS = join(ROOT, "data/player-rating-overrides.ts");
const OVERRIDES_JSON = join(ROOT, "data/player-rating-overrides.json");
const REPORT_PATH = join(ROOT, "data/legend-tier-primes-apply-report.json");

const DRY_RUN = process.argv.includes("--dry-run");

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  category?: string;
  peakRating?: number;
  year?: number;
  cardYear?: number;
  position?: string;
  nationality?: string;
  yearsActive?: string;
  status?: string;
  value?: number;
  teamYearId?: string;
  basePlayerId?: string;
  displayClub?: string;
  team?: string;
};

type LegendPrime = {
  name: string;
  rating: number;
  year: number;
  club: string;
};

const LEGEND_PRIMES: LegendPrime[] = [
  { name: "Kevin Sinfield", rating: 98, year: 2012, club: "Leeds Rhinos" },
  { name: "Sam Tomkins", rating: 98, year: 2012, club: "Wigan Warriors" },
  { name: "Paul Sculthorpe", rating: 99, year: 2002, club: "St Helens" },
  { name: "Jamie Peacock", rating: 99, year: 2003, club: "Bradford Bulls" },
  { name: "Andy Farrell", rating: 99, year: 1996, club: "Wigan Warriors" },
  { name: "James Roby", rating: 98, year: 2007, club: "St Helens" },
  { name: "Sean Long", rating: 98, year: 2000, club: "St Helens" },
  { name: "Keiron Cunningham", rating: 98, year: 2000, club: "St Helens" },
  { name: "James Graham", rating: 97, year: 2008, club: "St Helens" },
  { name: "Paul Wellens", rating: 97, year: 2006, club: "St Helens" },
  { name: "Sean O'Loughlin", rating: 97, year: 2013, club: "Wigan Warriors" },
  { name: "Jamie Lyon", rating: 97, year: 2005, club: "St Helens" },
  { name: "Danny McGuire", rating: 97, year: 2015, club: "Leeds Rhinos" },
  { name: "Rob Burrow", rating: 96, year: 2007, club: "Leeds Rhinos" },
  { name: "Leon Pryce", rating: 96, year: 2006, club: "St Helens" },
  { name: "Adrian Morley", rating: 96, year: 2010, club: "Warrington Wolves" },
  { name: "Gareth Ellis", rating: 96, year: 2007, club: "Leeds Rhinos" },
  { name: "Jason Robinson", rating: 96, year: 1998, club: "Wigan Warriors" },
  { name: "Kris Radlinski", rating: 96, year: 2002, club: "Wigan Warriors" },
  { name: "Iestyn Harris", rating: 96, year: 1998, club: "Leeds Rhinos" },
  { name: "Danny Brough", rating: 96, year: 2013, club: "Huddersfield Giants" },
  { name: "Stuart Fielden", rating: 96, year: 2003, club: "Bradford Bulls" },
  { name: "Pat Richards", rating: 96, year: 2010, club: "Wigan Warriors" },
  { name: "Lee Briers", rating: 95, year: 2011, club: "Warrington Wolves" },
  { name: "Liam Farrell", rating: 95, year: 2020, club: "Wigan Warriors" },
];

const CLUB_ID_PREFIX: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Huddersfield Giants": "huddersfield",
  "Leeds Rhinos": "leeds",
  "St Helens": "st-helens",
  "Warrington Wolves": "warrington",
  "Wigan Warriors": "wigan",
};

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

function normaliseClub(club: string): string {
  return normaliseName(club);
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
  if (typeof p.year === "number") return p.year;
  if (typeof p.cardYear === "number") return p.cardYear;
  const m = p.id.match(/-(\d{4})$/);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

function playerClub(p: RawPlayer): string {
  return String(p.club ?? p.displayClub ?? p.team ?? "");
}

function loadCurrent(): RawPlayer[] {
  const raw = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as
    | RawPlayer[]
    | { players: RawPlayer[] };
  return Array.isArray(raw) ? raw : raw.players;
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

function findExactCard(
  prime: LegendPrime,
  pools: RawPlayer[][]
): { player: RawPlayer; pool: "historic" | "legends" } | null {
  for (const [poolName, pool] of [
    ["historic", pools[0]!],
    ["legends", pools[1]!],
  ] as const) {
    const hits = pool.filter(
      (p) =>
        normaliseName(p.name) === normaliseName(prime.name) &&
        playerYear(p) === prime.year &&
        normaliseClub(playerClub(p)) === normaliseClub(prime.club)
    );
    if (hits.length === 1) {
      return { player: hits[0]!, pool: poolName };
    }
    if (hits.length > 1) {
      // Prefer id with -leg- and year suffix
      const ranked = [...hits].sort((a, b) => {
        const score = (p: RawPlayer) =>
          (p.id.includes("-leg-") ? 4 : 0) +
          (p.id.endsWith(`-${prime.year}`) ? 2 : 0) +
          (p.category === "legend" ? 1 : 0);
        return score(b) - score(a);
      });
      return { player: ranked[0]!, pool: poolName };
    }
  }
  return null;
}

function pickTemplate(
  name: string,
  club: string,
  index: Map<string, RawPlayer[]>
): RawPlayer | null {
  const cands = nameCandidates(name, index);
  const sameClub = cands.filter(
    (p) => normaliseClub(playerClub(p)) === normaliseClub(club)
  );
  const prefer = [...sameClub, ...cands];
  const legend = prefer.find((p) => p.category === "legend");
  const historic = prefer.find((p) => p.category === "historic");
  return legend ?? historic ?? prefer[0] ?? null;
}

function buildLegendId(
  club: string,
  name: string,
  year: number,
  existing: Set<string>
): string {
  const prefix = CLUB_ID_PREFIX[club] ?? slugify(club);
  let base = `${prefix}-leg-${slugify(name)}-${year}`;
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function applyLegendFields(player: RawPlayer, prime: LegendPrime): void {
  const position = String(player.position ?? "LOOSE_FORWARD") as Position;
  player.peakRating = prime.rating;
  player.category = "legend";
  player.status = "Legend";
  player.year = prime.year;
  player.cardYear = prime.year;
  player.club = prime.club;
  player.team = prime.club;
  player.displayClub = prime.club;
  player.teamYearId = buildPlayerTeamYearId(prime.club, prime.year);
  player.yearsActive = `${prime.year}–${prime.year}`;
  player.value = computePlayerValue(prime.rating, position, "legend");
  player.availableInGame = true;
  delete (player as { rating?: number }).rating;
}

function createLegendCard(
  prime: LegendPrime,
  template: RawPlayer,
  existingIds: Set<string>
): RawPlayer {
  const position = String(template.position ?? "LOOSE_FORWARD") as Position;
  const id = buildLegendId(prime.club, prime.name, prime.year, existingIds);
  const basePlayerId =
    typeof template.basePlayerId === "string" && template.basePlayerId
      ? template.basePlayerId
      : template.id.replace(/-\d{4}$/, "");

  const card: RawPlayer = {
    ...template,
    id,
    name: prime.name,
    position,
    primaryPosition: position,
    club: prime.club,
    team: prime.club,
    displayClub: prime.club,
    nationality: String(template.nationality ?? "England"),
    yearsActive: `${prime.year}–${prime.year}`,
    year: prime.year,
    cardYear: prime.year,
    teamYearId: buildPlayerTeamYearId(prime.club, prime.year),
    category: "legend",
    status: "Legend",
    peakRating: prime.rating,
    value: computePlayerValue(prime.rating, position, "legend"),
    intlCaps: typeof template.intlCaps === "number" ? template.intlCaps : 0,
    availableInGame: true,
    basePlayerId,
    source: "legend-tier-primes",
  };
  delete (card as { rating?: number }).rating;
  return card;
}

function upsertTsOverrides(
  filePath: string,
  entries: Record<string, number>
): void {
  let src = readFileSync(filePath, "utf8");
  for (const [id, value] of Object.entries(entries)) {
    const re = new RegExp(
      `(\\s+"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*)\\d+`
    );
    if (re.test(src)) {
      src = src.replace(re, `$1${value}`);
      continue;
    }
    const insertAt = src.lastIndexOf("};");
    if (insertAt < 0) throw new Error(`Cannot find end of overrides in ${filePath}`);
    src = src.slice(0, insertAt) + `  "${id}": ${value},\n` + src.slice(insertAt);
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
  };
  raw.ratingOverrides = { ...(raw.ratingOverrides ?? {}), ...entries };
  writeFileSync(filePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

function main(): void {
  const historic = JSON.parse(
    readFileSync(HISTORIC_PATH, "utf8")
  ) as RawPlayer[];
  const legends = JSON.parse(readFileSync(LEGENDS_PATH, "utf8")) as RawPlayer[];
  const current = loadCurrent();
  const allIndex = buildNameIndex([...historic, ...legends, ...current]);
  const existingIds = new Set([
    ...historic.map((p) => p.id),
    ...legends.map((p) => p.id),
  ]);

  const overrides: Record<string, number> = {};
  const report = {
    dryRun: DRY_RUN,
    updated: [] as Array<{ id: string; pool: string; rating: number }>,
    created: [] as Array<{ id: string; rating: number }>,
    unmatched: [] as Array<LegendPrime & { reason: string }>,
  };

  for (const prime of LEGEND_PRIMES) {
    const exact = findExactCard(prime, [historic, legends]);
    if (exact) {
      applyLegendFields(exact.player, prime);
      overrides[exact.player.id] = prime.rating;
      report.updated.push({
        id: exact.player.id,
        pool: exact.pool,
        rating: prime.rating,
      });
      continue;
    }

    const template = pickTemplate(prime.name, prime.club, allIndex);
    if (!template) {
      report.unmatched.push({ ...prime, reason: "no template player found" });
      continue;
    }

    // Prefer creating year cards in historic-players (existing leg- year-card home)
    const card = createLegendCard(prime, template, existingIds);
    existingIds.add(card.id);
    historic.push(card);
    overrides[card.id] = prime.rating;
    report.created.push({ id: card.id, rating: prime.rating });
  }

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("=== Legend tier primes ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}`);
  console.log(`Updated: ${report.updated.length}`);
  console.log(`Created: ${report.created.length}`);
  console.log(`Unmatched: ${report.unmatched.length}`);
  for (const u of report.updated) {
    console.log(`  update ${u.id} → ${u.rating} (${u.pool})`);
  }
  for (const c of report.created) {
    console.log(`  create ${c.id} → ${c.rating}`);
  }
  for (const u of report.unmatched) {
    console.log(`  unmatched ${u.name} ${u.year} ${u.club}: ${u.reason}`);
  }

  if (DRY_RUN) {
    console.log("Dry run only — report written, data unchanged.");
    return;
  }

  writeFileSync(HISTORIC_PATH, `${JSON.stringify(historic, null, 2)}\n`, "utf8");
  writeFileSync(LEGENDS_PATH, `${JSON.stringify(legends, null, 2)}\n`, "utf8");
  upsertTsOverrides(OVERRIDES_TS, overrides);
  upsertJsonOverrides(OVERRIDES_JSON, overrides);
  console.log(`Wrote historic + legends + ${Object.keys(overrides).length} overrides`);
}

main();
