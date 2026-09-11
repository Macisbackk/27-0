/**
 * Apply verified birth years / DOBs onto Current SL players from:
 * - data/birth-years.json (plausible ages only)
 * - data/wikipedia-birth-audit-report.json found entries
 * - RLP cache by name
 *
 * Then fill historic Unknown nationality from RLP cache (already attempted)
 * and Wikipedia nationality enrich for remaining.
 *
 * Run: npx tsx scripts/apply-current-birth-years.ts
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

/** Reject impossible current-player ages in season 2026. */
function plausibleCurrentBirthYear(y: number): boolean {
  return y >= 1981 && y <= 2010;
}

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  nationality?: string;
  dateOfBirth?: string;
  birthYear?: number;
  availableInGame?: boolean;
  basePlayerId?: string;
};

function parseTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+?)\s*-\s*RLP<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function main() {
  const current = JSON.parse(
    readFileSync(join(DATA, "current-squads.json"), "utf8")
  ) as Raw[];
  const birthYears = JSON.parse(
    readFileSync(join(DATA, "birth-years.json"), "utf8")
  ) as Record<string, number>;

  let wikiFound: Array<{
    playerId: string;
    status: string;
    birthYear?: number;
    dateOfBirth?: string;
  }> = [];
  try {
    const audit = JSON.parse(
      readFileSync(join(DATA, "wikipedia-birth-audit-report.json"), "utf8")
    ) as { entries: typeof wikiFound };
    wikiFound = audit.entries ?? [];
  } catch {
    /* optional */
  }

  const rlp = new Map<
    string,
    { dateOfBirth: string | null; birthYear: number | null; nationality: string | null }
  >();
  if (existsSync(CACHE)) {
    for (const file of readdirSync(CACHE)) {
      if (!file.endsWith(".html")) continue;
      const html = readFileSync(join(CACHE, file), "utf8");
      const name = parseTitle(html);
      if (!name) continue;
      const place = parsePlaceOfBirth(html);
      const born = parseBornField(html);
      rlp.set(nameKey(name), {
        nationality: place ? nationalityFromPlaceOfBirth(place) : null,
        dateOfBirth: born ? isoDateFromDob(born) : null,
        birthYear: born ? birthYearFromDob(born) : null,
      });
    }
  }

  const report = {
    fromWiki: [] as string[],
    fromBirthYears: [] as string[],
    fromRlp: [] as string[],
    skippedImplausibleBirthYear: [] as string[],
    stillMissing: [] as string[],
  };

  const wikiById = new Map(wikiFound.map((e) => [e.playerId, e]));

  /** Hard-verified DOBs that beat colliding birth-years.json entries. */
  const VERIFIED_DOB: Record<string, { dateOfBirth: string; birthYear: number }> = {
    "leigh-cur-adam-cook": { dateOfBirth: "2000-11-14", birthYear: 2000 },
    "leigh-cur-matt-davis": { dateOfBirth: "1996-07-05", birthYear: 1996 },
  };

  for (const p of current) {
    if (p.availableInGame === false) continue;
    if (!SL.has(String(p.club))) continue;

    const verified = VERIFIED_DOB[p.id];
    if (verified) {
      p.dateOfBirth = verified.dateOfBirth;
      p.birthYear = verified.birthYear;
      birthYears[p.id] = verified.birthYear;
      report.fromWiki.push(`${p.id}=${verified.dateOfBirth} (verified override)`);
      continue;
    }

    if (p.dateOfBirth || p.birthYear != null) continue;

    // 1) Wikipedia audit
    const w = wikiById.get(p.id);
    if (w?.status === "found" && w.birthYear && plausibleCurrentBirthYear(w.birthYear)) {
      p.birthYear = w.birthYear;
      if (w.dateOfBirth) p.dateOfBirth = w.dateOfBirth;
      report.fromWiki.push(`${p.id}=${w.dateOfBirth ?? w.birthYear}`);
      continue;
    }

    // 2) RLP cache
    const r = rlp.get(nameKey(p.name));
    if (r && (r.dateOfBirth || r.birthYear != null)) {
      const y = r.birthYear ?? (r.dateOfBirth ? Number(r.dateOfBirth.slice(0, 4)) : null);
      if (y && plausibleCurrentBirthYear(y)) {
        if (r.dateOfBirth) p.dateOfBirth = r.dateOfBirth;
        p.birthYear = y;
        report.fromRlp.push(`${p.id}=${r.dateOfBirth ?? y}`);
        continue;
      }
    }

    // 3) birth-years.json by id / name slug
    const tail = p.id.includes("-cur-") ? p.id.split("-cur-")[1] : undefined;
    const candidates = [p.id, p.basePlayerId, tail].filter(Boolean) as string[];
    let applied = false;
    for (const c of candidates) {
      const y = birthYears[c];
      if (y == null) continue;
      if (!plausibleCurrentBirthYear(y)) {
        report.skippedImplausibleBirthYear.push(`${p.id} birth-years[${c}]=${y}`);
        continue;
      }
      p.birthYear = y;
      report.fromBirthYears.push(`${p.id}=${y} (via ${c})`);
      applied = true;
      break;
    }
    if (applied) continue;

    report.stillMissing.push(`${p.name} (${p.id})`);
  }

  writeFileSync(
    join(DATA, "current-squads.json"),
    JSON.stringify(current, null, 2) + "\n"
  );
  writeFileSync(
    join(DATA, "birth-years.json"),
    JSON.stringify(birthYears, null, 2) + "\n"
  );
  writeFileSync(
    join(DATA, "apply-current-birth-years-report.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify({
    fromWiki: report.fromWiki.length,
    fromBirthYears: report.fromBirthYears.length,
    fromRlp: report.fromRlp.length,
    skippedImplausible: report.skippedImplausibleBirthYear.length,
    stillMissing: report.stillMissing.length,
    stillMissingNames: report.stillMissing,
    skipped: report.skippedImplausibleBirthYear,
  }, null, 2));
}

main();
