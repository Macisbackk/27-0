/**
 * Re-apply nationality/DOB from RLP cache with fixed title parsing
 * (supports both "- RLP" and "- Playing Career" titles).
 */
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  nameKey,
  parsePlaceOfBirth,
  nationalityFromPlaceOfBirth,
  parseBornField,
  isoDateFromDob,
  birthYearFromDob,
} from "./lib/rlp-parse";

const DATA = join(__dirname, "..", "data");
const CACHE = join(__dirname, "rlp-cache");

function parseTitle(html: string): string | null {
  const m =
    html.match(/<title>([^<]+?)\s*-\s*RLP<\/title>/i) ||
    html.match(/<title>([^<]+?)\s*-\s*Playing Career<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

type Raw = {
  id: string;
  name: string;
  nationality?: string;
  dateOfBirth?: string;
  birthYear?: number;
  availableInGame?: boolean;
};

function applyFile(file: string) {
  const path = join(DATA, file);
  const rows = JSON.parse(readFileSync(path, "utf8")) as Raw[];
  const byName = new Map<
    string,
    { nat: string | null; dob: string | null; year: number | null }
  >();

  for (const f of readdirSync(CACHE)) {
    if (!f.endsWith(".html")) continue;
    const html = readFileSync(join(CACHE, f), "utf8");
    if (html.length < 200) continue;
    const title = parseTitle(html);
    if (!title) continue;
    const place = parsePlaceOfBirth(html);
    const born = parseBornField(html);
    byName.set(nameKey(title), {
      nat: place ? nationalityFromPlaceOfBirth(place) : null,
      dob: born ? isoDateFromDob(born) : null,
      year: born ? birthYearFromDob(born) : null,
    });
  }

  let nat = 0;
  let dob = 0;
  for (const p of rows) {
    if (p.availableInGame === false) continue;
    const hit = byName.get(nameKey(p.name));
    if (!hit) continue;
    if ((!p.nationality || /^unknown$/i.test(p.nationality)) && hit.nat) {
      p.nationality = hit.nat;
      nat++;
    }
    if (!p.dateOfBirth && p.birthYear == null && (hit.dob || hit.year != null)) {
      if (hit.dob) p.dateOfBirth = hit.dob;
      if (hit.year != null) p.birthYear = hit.year;
      dob++;
    }
  }
  writeFileSync(path, JSON.stringify(rows, null, 2) + "\n");
  console.log(`${file}: nationality +${nat}, dob +${dob}`);
}

applyFile("historic-players.json");
applyFile("current-squads.json");
applyFile("legends.json");

const hist = JSON.parse(
  readFileSync(join(DATA, "historic-players.json"), "utf8")
) as Raw[];
const still = hist.filter(
  (p) =>
    p.availableInGame !== false &&
    (!p.nationality || /^unknown$/i.test(p.nationality))
);
console.log(`Historic still Unknown nationality: ${still.length}`);
