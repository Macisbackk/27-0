/**
 * Fill remaining Unknown nationalities + missing Current DOBs from RLP cache
 * by matching player name → cached summary HTML (no network required if cache warm).
 *
 * Also applies a small verified batch for 2026 depth players researched externally.
 *
 * Run: npx tsx scripts/fill-remaining-player-unknowns.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  nameKey,
  parseBornField,
  parsePlaceOfBirth,
  nationalityFromPlaceOfBirth,
  isoDateFromDob,
  birthYearFromDob,
} from "./lib/rlp-parse";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const CACHE = join(__dirname, "rlp-cache");
const REPORT = join(DATA, "fill-remaining-unknowns-report.json");

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  nationality?: string;
  dateOfBirth?: string;
  birthYear?: number;
  availableInGame?: boolean;
  category?: string;
};

const SL = new Set([
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
  "Wakefield Trinity",
  "Warrington Wolves",
  "Wigan Warriors",
  "York Knights",
]);

/** Verified facts for the 14 depth players previously skipped (sources in report). */
const VERIFIED_DEPTH: Record<
  string,
  { nationality: string; dateOfBirth?: string; birthYear?: number; source: string }
> = {
  "Jake Davies": {
    nationality: "England",
    source: "Saints RLFC / England Academy / GSA (England)",
  },
  "Baptiste Rodriguez": {
    nationality: "France",
    source: "Toulouse Olympique French academy (TO13 effectif)",
  },
  "AJ Wallace": {
    nationality: "Jamaica",
    dateOfBirth: "2003-03-31",
    birthYear: 2003,
    source: "Wikipedia Ajahni Wallace — Jamaica international; born Huddersfield 31 Mar 2003",
  },
  "Ellis Gillam": {
    nationality: "England",
    dateOfBirth: "1997-10-06",
    birthYear: 1997,
    source: "English forward (Barrow/Toulouse); DOB 6 Oct 1997",
  },
  "Pierre-Jean Lima": {
    nationality: "France",
    source: "Toulouse Olympique French squad (TO13)",
  },
  "Hugo Garrigues": {
    nationality: "France",
    source: "Toulouse Olympique French academy (TO13)",
  },
  "Myles Lawford": {
    nationality: "England",
    dateOfBirth: "2003-09-09",
    birthYear: 2003,
    source: "RLP — born Dewsbury, England 9 Sep 2003",
  },
  "Jordy Crowther": {
    nationality: "England",
    dateOfBirth: "1997-02-19",
    birthYear: 1997,
    source: "Wikipedia Jordan Crowther — born Wakefield, England 19 Feb 1997",
  },
  "Leon Hayes": {
    nationality: "England",
    source: "England Academy / Warrington pathway",
  },
  "Luke Thomas": {
    nationality: "England",
    source: "Warrington academy English forward",
  },
  "Arron Lindop": {
    nationality: "England",
    source: "England Academy squad (RFL) / Warrington",
  },
  "Tom Forber": {
    nationality: "England",
    dateOfBirth: "2003-05-22",
    birthYear: 2003,
    source: "Wikipedia Tom Forber — born Orford, Warrington, England",
  },
  "Taylor Kerr": {
    nationality: "England",
    source: "England Academy squad (RFL) / Wigan St Jude's",
  },
  "Nathan Lowe": {
    nationality: "England",
    source: "England Academy squad (RFL) / Wigan St Jude's",
  },
};

function parsePlayerNameFromHtml(html: string): string | null {
  const m =
    html.match(/<title>([^<]+?)\s*-\s*RLP<\/title>/i) ||
    html.match(/<title>([^<]+?)\s*-\s*Playing Career<\/title>/i) ||
    html.match(/<title>([^<]+?)\s*-\s*Rugby League Project<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

/** Extra alias keys so cache/DB names resolve together. */
const ALIAS_KEYS: Record<string, string> = {
  [nameKey("Jordy Crowther")]: nameKey("Jordan Crowther"),
  [nameKey("Jordan Crowther")]: nameKey("Jordan Crowther"),
  [nameKey("AJ Wallace")]: nameKey("Ajahni Wallace"),
  [nameKey("Ajahni Wallace")]: nameKey("Ajahni Wallace"),
  [nameKey("Ajahni AJ Wallace")]: nameKey("Ajahni Wallace"),
};

function resolveKey(name: string): string {
  const k = nameKey(name);
  return ALIAS_KEYS[k] ?? k;
}

function buildCacheIndex(): Map<
  string,
  { nationality: string | null; dateOfBirth: string | null; birthYear: number | null }
> {
  const map = new Map<
    string,
    { nationality: string | null; dateOfBirth: string | null; birthYear: number | null }
  >();
  if (!existsSync(CACHE)) return map;

  for (const file of readdirSync(CACHE)) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(join(CACHE, file), "utf8");
    const name = parsePlayerNameFromHtml(html);
    if (!name) continue;
    const place = parsePlaceOfBirth(html);
    const born = parseBornField(html);
    const nat = place ? nationalityFromPlaceOfBirth(place) : null;
    const dateOfBirth = born ? isoDateFromDob(born) : null;
    const birthYear = born ? birthYearFromDob(born) : dateOfBirth
      ? Number(dateOfBirth.slice(0, 4))
      : null;
    map.set(resolveKey(name), {
      nationality: nat,
      dateOfBirth,
      birthYear: birthYear && Number.isFinite(birthYear) ? birthYear : null,
    });
    // Also index under raw name key
    map.set(nameKey(name), {
      nationality: nat,
      dateOfBirth,
      birthYear: birthYear && Number.isFinite(birthYear) ? birthYear : null,
    });
  }
  return map;
}

function load(file: string): Raw[] {
  return JSON.parse(readFileSync(join(DATA, file), "utf8")) as Raw[];
}

function save(file: string, rows: Raw[]) {
  writeFileSync(join(DATA, file), JSON.stringify(rows, null, 2) + "\n", "utf8");
}

function isUnknownNat(n: unknown): boolean {
  return !n || /^unknown$/i.test(String(n).trim());
}

function main() {
  const cache = buildCacheIndex();
  console.log(`RLP cache name index: ${cache.size}`);

  const report = {
    generatedAt: new Date().toISOString(),
    cacheEntries: cache.size,
    depthAdded: [] as string[],
    nationalityFilled: [] as { id: string; name: string; file: string; nationality: string; source: string }[],
    dobFilled: [] as { id: string; name: string; file: string; dateOfBirth?: string; birthYear?: number; source: string }[],
    stillUnknownNationality: [] as { id: string; name: string; file: string }[],
    stillMissingDobCurrent: [] as { id: string; name: string; club: string }[],
  };

  // 1) Add / update the 14 depth players
  const current = load("current-squads.json");
  const byName = new Map(current.map((p) => [resolveKey(p.name), p]));
  // also index raw keys
  for (const p of current) byName.set(nameKey(p.name), p);

  const DEPTH_CLUB: Record<string, string> = {
    "Jake Davies": "St Helens",
    "Baptiste Rodriguez": "Toulouse Olympique",
    "AJ Wallace": "Toulouse Olympique",
    "Ellis Gillam": "Toulouse Olympique",
    "Pierre-Jean Lima": "Toulouse Olympique",
    "Hugo Garrigues": "Toulouse Olympique",
    "Myles Lawford": "Wakefield Trinity",
    "Jordy Crowther": "Warrington Wolves",
    "Leon Hayes": "Warrington Wolves",
    "Luke Thomas": "Warrington Wolves",
    "Arron Lindop": "Warrington Wolves",
    "Tom Forber": "Wigan Warriors",
    "Taylor Kerr": "Wigan Warriors",
    "Nathan Lowe": "Wigan Warriors",
  };

  const CLUB_SLUG: Record<string, string> = {
    "St Helens": "st-helens",
    "Toulouse Olympique": "toulouse",
    "Wakefield Trinity": "wakefield",
    "Warrington Wolves": "warrington",
    "Wigan Warriors": "wigan",
  };

  for (const [name, info] of Object.entries(VERIFIED_DEPTH)) {
    const club = DEPTH_CLUB[name]!;
    const slug = CLUB_SLUG[club]!;
    const id = `${slug}-cur-${nameKey(name).replace(/\s+/g, "-")}`;
    const existing = byName.get(resolveKey(name)) ?? byName.get(nameKey(name));
    const cacheHit =
      cache.get(resolveKey(name)) ?? cache.get(nameKey(name));
    const dateOfBirth =
      info.dateOfBirth || cacheHit?.dateOfBirth || undefined;
    const birthYear =
      info.birthYear ||
      cacheHit?.birthYear ||
      (dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : undefined);

    if (existing && SL.has(String(existing.club)) && existing.availableInGame !== false) {
      existing.nationality = info.nationality;
      if (dateOfBirth) existing.dateOfBirth = dateOfBirth;
      if (birthYear) existing.birthYear = birthYear;
      report.depthAdded.push(`updated:${existing.id}`);
      continue;
    }

    const row: Raw = {
      id,
      name,
      club,
      currentClub: club,
      team: club,
      displayClub: club,
      position: "LOOSE_FORWARD",
      positions: ["LOOSE_FORWARD"],
      primaryPosition: "LOOSE_FORWARD",
      nationality: info.nationality,
      era: "CONTEMPORARY_ERA",
      yearsActive: "2020–Present",
      category: "current",
      peakRating: 80,
      value: 92000,
      appearances: 0,
      tries: 0,
      teamYearId: `${slug.replace(/-/g, "-")}-2026`.includes("st-helens")
        ? "st-helens-2026"
        : `${club.toLowerCase().replace(/\s+/g, "-")}-2026`,
      year: 2026,
      cardYear: 2026,
      status: "Current",
      basePlayerId: id,
      availableInGame: true,
      superLeagueEligible: true,
    };
    // Fix teamYearId properly
    const teamYearMap: Record<string, string> = {
      "St Helens": "st-helens-2026",
      "Toulouse Olympique": "toulouse-olympique-2026",
      "Wakefield Trinity": "wakefield-trinity-2026",
      "Warrington Wolves": "warrington-wolves-2026",
      "Wigan Warriors": "wigan-warriors-2026",
    };
    row.teamYearId = teamYearMap[club];

    // Better positions for known roles
    const POS: Record<string, string> = {
      "Jake Davies": "SECOND_ROW",
      "Baptiste Rodriguez": "HOOKER",
      "AJ Wallace": "SECOND_ROW",
      "Ellis Gillam": "SECOND_ROW",
      "Pierre-Jean Lima": "SECOND_ROW",
      "Hugo Garrigues": "HOOKER",
      "Myles Lawford": "SCRUM_HALF",
      "Jordy Crowther": "LOOSE_FORWARD",
      "Leon Hayes": "SCRUM_HALF",
      "Luke Thomas": "PROP",
      "Arron Lindop": "CENTRE",
      "Tom Forber": "HOOKER",
      "Taylor Kerr": "PROP",
      "Nathan Lowe": "FULLBACK",
    };
    const pos = POS[name] ?? "LOOSE_FORWARD";
    row.position = pos;
    row.positions = [pos];
    row.primaryPosition = pos;

    if (dateOfBirth) row.dateOfBirth = dateOfBirth;
    if (birthYear) row.birthYear = birthYear;

    // Remove non-SL duplicate if present
    if (existing && !SL.has(String(existing.club))) {
      const idx = current.indexOf(existing);
      if (idx >= 0) current.splice(idx, 1);
    }
    current.push(row);
    byName.set(nameKey(name), row);
    report.depthAdded.push(`added:${id} (${info.source})`);
  }

  // 2) Fill Unknown nationality + missing DOB from RLP cache across DBs
  for (const file of ["current-squads.json", "historic-players.json", "legends.json"] as const) {
    const rows = file === "current-squads.json" ? current : load(file);
    let changed = false;
    for (const p of rows) {
      const hit =
        cache.get(resolveKey(p.name)) ?? cache.get(nameKey(p.name));
      if (!hit) {
        if (isUnknownNat(p.nationality) && p.availableInGame !== false) {
          report.stillUnknownNationality.push({
            id: p.id,
            name: p.name,
            file,
          });
        }
        continue;
      }

      if (isUnknownNat(p.nationality) && hit.nationality) {
        p.nationality = hit.nationality;
        changed = true;
        report.nationalityFilled.push({
          id: p.id,
          name: p.name,
          file,
          nationality: hit.nationality,
          source: "rlp-cache",
        });
      }

      const needsDob = !p.dateOfBirth && p.birthYear == null;
      if (needsDob && (hit.dateOfBirth || hit.birthYear != null)) {
        if (hit.dateOfBirth) p.dateOfBirth = hit.dateOfBirth;
        if (hit.birthYear != null) p.birthYear = hit.birthYear;
        changed = true;
        report.dobFilled.push({
          id: p.id,
          name: p.name,
          file,
          dateOfBirth: hit.dateOfBirth ?? undefined,
          birthYear: hit.birthYear ?? undefined,
          source: "rlp-cache",
        });
      }
    }
    if (file === "current-squads.json") {
      rows.sort(
        (a, b) =>
          String(a.club).localeCompare(String(b.club)) ||
          a.name.localeCompare(b.name)
      );
      save(file, rows);
    } else if (changed) {
      save(file, rows);
    } else if (file !== "current-squads.json") {
      // unchanged
    }
  }

  // Recompute still-missing Current DOBs among playable SL
  for (const p of current) {
    if (p.availableInGame === false) continue;
    if (!SL.has(String(p.club))) continue;
    if (!p.dateOfBirth && p.birthYear == null) {
      report.stillMissingDobCurrent.push({
        id: p.id,
        name: p.name,
        club: String(p.club),
      });
    }
  }

  // Dedupe stillUnknown list (only those still unknown after fill)
  const stillNat: typeof report.stillUnknownNationality = [];
  for (const file of ["current-squads.json", "historic-players.json", "legends.json"] as const) {
    const rows = file === "current-squads.json" ? current : load(file);
    for (const p of rows) {
      if (p.availableInGame === false) continue;
      if (isUnknownNat(p.nationality)) {
        stillNat.push({ id: p.id, name: p.name, file });
      }
    }
  }
  report.stillUnknownNationality = stillNat;

  writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n");
  console.log(`Depth: ${report.depthAdded.length}`);
  console.log(`Nationality filled: ${report.nationalityFilled.length}`);
  console.log(`DOB filled: ${report.dobFilled.length}`);
  console.log(`Still unknown nationality: ${report.stillUnknownNationality.length}`);
  console.log(`Still missing Current DOB: ${report.stillMissingDobCurrent.length}`);
  console.log(`Wrote ${REPORT}`);
}

main();
