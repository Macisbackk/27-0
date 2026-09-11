/**
 * Bulk-add 2026 Super League registered-squad players who have Fantasy minutes
 * but are absent from current-squads.json.
 *
 * Club mapping: Jan 2026 SARL squad numbers + mid-season corrections.
 * Bios: inherit from historic cards only — never invent nationality/DOB.
 * Ratings: max(80, historic peak) or Fantasy-informed floor.
 *
 * Run after sync-2026-sl-player-pool.ts:
 *   npx tsx scripts/add-2026-registered-squad-players.ts
 *   npm run build:player-chunks
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildTeamYearId } from "../src/lib/game/team-year-pools";
import { computePlayerValue } from "../src/lib/players/ratings";
import { clampCurrentSuperLeagueRating } from "../src/lib/players/rating-floors";
import type { Position } from "../src/lib/types";
import registered from "../data/sl-2026-registered-squads.json";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const HISTORIC_PATH = join(ROOT, "data", "historic-players.json");
const FANTASY_PATH = join(
  ROOT,
  "data/imports/fantasy-super-league-players-2026.md"
);
const REPORT_PATH = join(
  ROOT,
  "data/add-2026-registered-squad-players-report.json"
);

const CURRENT_YEAR = 2026;

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

const POS_FROM_FANTASY: Record<string, Position> = {
  "Full Back": "FULLBACK",
  Winger: "WING",
  Centre: "CENTRE",
  "Stand Off": "STAND_OFF",
  "Scrum Half": "SCRUM_HALF",
  Prop: "PROP",
  Hooker: "HOOKER",
  "Second Row": "SECOND_ROW",
  "Loose Forward": "LOOSE_FORWARD",
};

const POS_SUFFIXES = Object.keys(POS_FROM_FANTASY);

const NAME_ALIASES: Record<string, string> = {
  "lachlan miller": "lachie miller",
  "oliver ashall bott": "olly ashall bott",
  "caleb uele": "caleb hamlin uele",
  "george flanagan": "george flanagan jr",
  "tuimoala lolohea": "tui lolohea",
  "romain navarrete": "romain navarette",
  "nene macdonald": "nene macdonald",
  "jon bennison": "jonathan bennison",
};

/** Verified nationalities (Wikipedia / RLP / international caps / club bios). */
const VERIFIED_NATIONALITY: Record<string, string> = {
  [norm("Mikaele Ravalawa")]: "Fiji",
  [norm("Jacob Alick-Wiencke")]: "Papua New Guinea",
  [norm("Adam Cook")]: "Australia",
  [norm("Shane Wright")]: "Australia",
  [norm("Jacob Host")]: "Australia",
  [norm("Jackson Hastings")]: "Australia",
  [norm("Nene Macdonald")]: "Papua New Guinea",
  [norm("Toafofoa Sipley")]: "New Zealand",
  [norm("Tiaki Chan")]: "France",
  [norm("Caius Faatili")]: "New Zealand",
  [norm("Isaiah Vagana")]: "New Zealand",
  [norm("Liam Byrne")]: "Ireland",
  [norm("Keenan Palasia")]: "Australia",
  [norm("Kallum Watkins")]: "England",
  [norm("Rhyse Martin")]: "Papua New Guinea",
  [norm("Sam Luckley")]: "Scotland",
  [norm("Tom Briscoe")]: "England",
  [norm("Josh Rourke")]: "Australia",
  [norm("Lachlan Walmsley")]: "Scotland",
  [norm("Nikau Williams")]: "New Zealand",
  [norm("Mathieu Cozza")]: "France",
  [norm("Chris Patolo")]: "Tonga",
  [norm("Franck Maria")]: "France",
  [norm("Leo Darrelatour")]: "France",
  [norm("Guillermo Aispuro-Bichet")]: "France",
  [norm("Romeo Tropis")]: "France",
  [norm("Tray Lolesio")]: "Australia",
  [norm("Iszac Fa'asuamaleaui")]: "Australia",
  [norm("Jeremiah Mata'utia")]: "Samoa",
  [norm("Hugo Salabio")]: "France",
  [norm("Lenny Marc")]: "France",
  [norm("Ugo Tison")]: "France",
  [norm("Clement Martin")]: "France",
  [norm("Giovanni Descalzi")]: "France",
  [norm("Alexis Lis")]: "France",
  [norm("Brock Greacen")]: "Australia",
  [norm("Jordan Lipp")]: "Australia",
  [norm("Scott Galeano")]: "Australia",
  [norm("Ata Hingano")]: "Tonga",
  [norm("Jesse Dee")]: "Australia",
  [norm("Paul Vaughan")]: "Italy",
  [norm("Justin Sangare")]: "France",
  [norm("Kieran Buchanan")]: "Scotland",
  [norm("Mitch Clark")]: "Wales",
  [norm("Noah Stephens")]: "Wales",
  [norm("Oliver Partington")]: "England",
  [norm("Joe Cator")]: "England",
  [norm("Chris Atkin")]: "England",
  [norm("Luke Hooley")]: "England",
  [norm("Jack Hughes")]: "England",
  [norm("Bailey Hodgson")]: "England",
  [norm("Owen Dagnall")]: "England",
  [norm("Danny Richardson")]: "England",
  [norm("Will Dagger")]: "England",
  [norm("Denive Balmforth")]: "England",
  [norm("Fletcher Rooney")]: "England",
  [norm("Zac Lipowicz")]: "England",
  [norm("Harvey Wilson")]: "England",
  [norm("Josh Allen")]: "England",
  [norm("Asher O'Donnell")]: "England",
  [norm("Presley Cassell")]: "England",
  [norm("Lee Kershaw")]: "England",
  [norm("Jack Sinfield")]: "England",
  [norm("George Hirst")]: "England",
  [norm("Noah Hodkinson")]: "England",
  [norm("Ewan Irwin")]: "England",
  [norm("Rob Butler")]: "England",
  [norm("Luke Polselli")]: "England",
  [norm("Will Tate")]: "England",
  [norm("Jayden Myers")]: "England",
  [norm("Jacob Douglas")]: "England",
  [norm("Louis Brogan")]: "England",
  [norm("Andrew Badrock")]: "England",
  [norm("Connor Bailey")]: "England",
  [norm("Noah Booth")]: "England",
  [norm("Zach Fishwick")]: "England",
  [norm("Jake Burns")]: "England",
  [norm("Jonathan Bennison")]: "England",
  [norm("Jon Bennison")]: "England",
  [norm("Thomas Burgess")]: "England",
  [norm("Leon Ruan")]: "England",
  [norm("Brandon Douglas")]: "England",
  [norm("Matty Foster")]: "England",
  [norm("Kieran Hudson")]: "England",
  [norm("Jack Billington")]: "England",
  [norm("Connor Carr")]: "England",
  [norm("Matty Laidlaw")]: "England",
  [norm("Lennon Clark")]: "England",
  [norm("Bill Leyland")]: "England",
  [norm("Louix Gorman")]: "England",
  [norm("Harvey Horne")]: "England",
  [norm("Alfie Edgell")]: "England",
  [norm("Ned McCormack")]: "England",
  [norm("Ben Littlewood")]: "England",
  [norm("Tom Nicholson-Watton")]: "England",
  [norm("Eliot Peposhi")]: "England",
  [norm("Jamie Gill")]: "England",
  [norm("Alfie Leake")]: "England",
  [norm("Archie Sykes")]: "England",
};

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  position: string;
  nationality?: string;
  peakRating?: number;
  availableInGame?: boolean;
  dateOfBirth?: string;
  birthYear?: number;
  appearances?: number;
  tries?: number;
  yearsActive?: string;
};

function norm(s: string): string {
  const k = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''`’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return NAME_ALIASES[k] ?? k;
}

function slugify(name: string): string {
  return norm(name).replace(/\s+/g, "-");
}

function buildId(club: string, name: string): string {
  return `${CLUB_SLUGS[club]}-cur-${slugify(name)}`;
}

function stripPos(cell: string): { name: string; pos: string | null } {
  for (const pos of POS_SUFFIXES) {
    if (cell.endsWith(pos)) {
      return { name: cell.slice(0, -pos.length).trim(), pos };
    }
  }
  return { name: cell.trim(), pos: null };
}

function loadFantasy(): Map<string, { minutes: number; pos: Position | null; score: number }> {
  const text = readFileSync(FANTASY_PATH, "utf8");
  const map = new Map<string, { minutes: number; pos: Position | null; score: number }>();
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*\|\s*([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;
    const cell = m[1].trim();
    if (!cell || cell === "Name") continue;
    const { name, pos } = stripPos(cell);
    const minutes = Number(String(m[4]).trim()) || 0;
    const parts = line.split("|");
    const score = Number(String(parts[parts.length - 2] ?? "").trim()) || 0;
    map.set(norm(name), {
      minutes,
      pos: pos ? POS_FROM_FANTASY[pos] ?? null : null,
      score,
    });
  }
  return map;
}

function ratingFromFantasy(score: number, histPeak?: number): number {
  if (typeof histPeak === "number" && histPeak >= 80) {
    return clampCurrentSuperLeagueRating(histPeak);
  }
  // Soft map Fantasy season score → 80–88 band for depth players.
  if (score >= 1200) return 86;
  if (score >= 900) return 84;
  if (score >= 600) return 82;
  if (score >= 300) return 81;
  return 80;
}

function findHistoric(historic: Raw[], name: string): Raw | undefined {
  const key = norm(name);
  const hits = historic.filter((p) => norm(p.name) === key);
  return (
    hits.find(
      (p) =>
        p.nationality &&
        p.nationality !== "Unknown" &&
        !String(p.id).includes("-hist-era-")
    ) ??
    hits.find((p) => p.nationality && p.nationality !== "Unknown") ??
    hits[0]
  );
}

function main() {
  const players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as Raw[];
  const historic = JSON.parse(readFileSync(HISTORIC_PATH, "utf8")) as Raw[];
  const fantasy = loadFantasy();
  const squads = registered as Record<string, string[]>;

  const existingKeys = new Set(
    players
      .filter((p) => p.availableInGame !== false)
      .map((p) => `${norm(p.name)}`)
  );

  const added: string[] = [];
  const skippedNoMinutes: string[] = [];
  const unresolvedDob: string[] = [];
  const unresolvedNat: string[] = [];

  // Mid-season club overrides (current club as of late 2026 season)
  const clubOverrides: Record<string, string> = {
    [norm("Phoenix Laulu-Togaga'e")]: "Castleford Tigers",
    [norm("Tyler Dupree")]: "Castleford Tigers",
  };

  for (const [club, names] of Object.entries(squads)) {
    for (const name of names) {
      const key = norm(name);
      if (existingKeys.has(key)) continue;
      const fant = fantasy.get(key);
      if (!fant || fant.minutes <= 0) {
        skippedNoMinutes.push(`${club}: ${name}`);
        continue;
      }

      const targetClub = clubOverrides[key] ?? club;
      const hist = findHistoric(historic, name);
      const position =
        fant.pos ??
        (hist?.position as Position | undefined) ??
        "CENTRE";
      const rating = ratingFromFantasy(
        fant.score,
        typeof hist?.peakRating === "number" ? hist.peakRating : undefined
      );
      const nationality =
        VERIFIED_NATIONALITY[key] ||
        (hist?.nationality && hist.nationality !== "Unknown"
          ? hist.nationality
          : undefined);
      const dateOfBirth =
        typeof hist?.dateOfBirth === "string" ? hist.dateOfBirth : undefined;
      const birthYear =
        typeof hist?.birthYear === "number"
          ? hist.birthYear
          : dateOfBirth
            ? Number(dateOfBirth.slice(0, 4))
            : undefined;

      if (!nationality) unresolvedNat.push(`${targetClub}: ${name}`);
      if (!dateOfBirth && !birthYear) unresolvedDob.push(`${targetClub}: ${name}`);

      // Skip if we cannot assign a verified nationality — do not invent.
      if (!nationality) continue;

      const id = buildId(targetClub, name);
      const value = computePlayerValue(rating, position, "current");
      const row: Raw = {
        id,
        name,
        club: targetClub,
        currentClub: targetClub,
        team: targetClub,
        displayClub: targetClub,
        position,
        positions: [position],
        primaryPosition: position,
        nationality,
        era: "CONTEMPORARY_ERA",
        yearsActive: hist?.yearsActive ?? "2020–Present",
        category: "current",
        peakRating: rating,
        value,
        appearances: hist?.appearances ?? 0,
        tries: hist?.tries ?? 0,
        teamYearId: buildTeamYearId(targetClub, String(CURRENT_YEAR)),
        year: CURRENT_YEAR,
        cardYear: CURRENT_YEAR,
        status: "Current",
        basePlayerId: id,
        availableInGame: true,
        superLeagueEligible: true,
      };
      if (dateOfBirth) row.dateOfBirth = dateOfBirth;
      if (birthYear) row.birthYear = birthYear;

      players.push(row);
      existingKeys.add(key);
      added.push(id);
    }
  }

  players.sort(
    (a, b) => a.club.localeCompare(b.club) || a.name.localeCompare(b.name)
  );
  writeFileSync(CURRENT_PATH, JSON.stringify(players, null, 2) + "\n");

  const report = {
    generatedAt: new Date().toISOString(),
    addedCount: added.length,
    added,
    skippedNoMinutesCount: skippedNoMinutes.length,
    skippedNoMinutes: skippedNoMinutes.slice(0, 100),
    skippedMissingNationality: unresolvedNat,
    unresolvedDobAmongAdded: unresolvedDob.filter((x) =>
      added.some((id) => id.includes(slugify(x.split(": ").pop() ?? "")))
    ),
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `Added ${added.length}. Skipped no-minutes ${skippedNoMinutes.length}. Skipped no-nationality ${unresolvedNat.length}.`
  );
}

main();
