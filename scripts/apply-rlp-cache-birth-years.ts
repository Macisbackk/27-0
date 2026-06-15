/**
 * Extract birth years from RLP cache HTML and merge into data/birth-years.json.
 * Run: npx tsx scripts/apply-rlp-cache-birth-years.ts
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const CACHE_DIR = join(__dirname, "rlp-cache");
const BIRTH_YEARS_PATH = join(DATA_DIR, "birth-years.json");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;

type RawPlayer = { id: string; name: string };

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateOfBirth(html: string): string | null {
  const m = html.match(/<dt>Date Of Birth<\/dt>\s*<dd>([^<]+)<\/dd>/i);
  return m?.[1]?.trim() ?? null;
}

function parsePlayerName(html: string): string | null {
  const m = html.match(/<title>([^<]+?)\s*-\s*RLP<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function birthYearFromDob(dob: string): number | null {
  const dmy = dob.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return Number.parseInt(dmy[3], 10);
  const iso = dob.match(/^(\d{4})-/);
  if (iso) return Number.parseInt(iso[1], 10);
  const yearOnly = dob.match(/^(\d{4})$/);
  if (yearOnly) return Number.parseInt(yearOnly[1], 10);
  return null;
}

function buildNameToBirthYear(): Map<string, number> {
  const map = new Map<string, number>();
  if (!existsSync(CACHE_DIR)) return map;

  for (const file of readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(join(CACHE_DIR, file), "utf-8");
    const name = parsePlayerName(html);
    const dob = parseDateOfBirth(html);
    if (!name || !dob) continue;
    const birthYear = birthYearFromDob(dob);
    if (birthYear === null) continue;
    map.set(normalizeName(name), birthYear);
  }
  return map;
}

function loadPlayers(): RawPlayer[] {
  const players: RawPlayer[] = [];
  for (const file of FILES) {
    const raw = JSON.parse(
      readFileSync(join(DATA_DIR, file), "utf-8")
    ) as RawPlayer[];
    players.push(...raw);
  }
  return players;
}

function main() {
  const nameToBirthYear = buildNameToBirthYear();
  const existing = existsSync(BIRTH_YEARS_PATH)
    ? (JSON.parse(readFileSync(BIRTH_YEARS_PATH, "utf-8")) as Record<
        string,
        number
      >)
    : {};

  let added = 0;
  for (const player of loadPlayers()) {
    const birthYear = nameToBirthYear.get(normalizeName(player.name));
    if (birthYear === undefined || existing[player.id] !== undefined) continue;
    existing[player.id] = birthYear;
    added++;
  }

  const sorted = Object.fromEntries(
    Object.entries(existing).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(BIRTH_YEARS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `Updated ${BIRTH_YEARS_PATH}: ${added} new entries (${Object.keys(sorted).length} total).`
  );
}

main();
