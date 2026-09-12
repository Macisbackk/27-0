/**
 * Add Sheffield Eagles 1998 Challenge Cup final squad + missing pre-SL
 * Lance Todd Trophy winners into historic-players / honour maps.
 *
 * Run: npx tsx scripts/add-sheffield-1998-and-presl-lance-todd.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { Position } from "../src/lib/types";

const DATA = join(__dirname, "..", "data");

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  position?: string;
  category?: string;
  peakRating?: number;
  year?: number;
  cardYear?: number;
  teamYearId?: string;
  basePlayerId?: string;
  challengeCupWinner?: boolean;
};

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

function saveJson(name: string, data: unknown): void {
  writeFileSync(join(DATA, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function slugifyClub(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeId(club: string, name: string, year?: number): string {
  const clubSlug =
    (
      {
        "Sheffield Eagles": "sheffield",
        "Wakefield Trinity": "wakefield",
        "Bradford Bulls": "bradford",
        "Warrington Wolves": "warrington",
        "Wigan Warriors": "wigan",
        "Huddersfield Giants": "huddersfield",
        "Barrow Raiders": "barrow",
        "Leeds Rhinos": "leeds",
        "Castleford Tigers": "castleford",
        "Widnes Vikings": "widnes",
        "St Helens": "st-helens",
        "Hull FC": "hull-fc",
        "Hull KR": "hull-kr",
        "Leigh Leopards": "leigh",
        "Featherstone Rovers": "featherstone",
        "Workington Town": "workington",
        Hunslet: "hunslet",
        Halifax: "halifax",
      } as Record<string, string>
    )[club] ?? slugifyClub(club);
  const base = `${clubSlug}-hist-${slugifyName(name)}`;
  return year ? `${base}-${year}` : base;
}

/** Sheffield Eagles 1998 Challenge Cup final XVII (Wikipedia). */
const SHEFFIELD_1998: Array<{
  name: string;
  position: Position;
  nationality: string;
  peakRating: number;
}> = [
  { name: "Waisale Sovatabua", position: "FULLBACK", nationality: "Fiji", peakRating: 82 },
  { name: "Nick Pinkney", position: "WING", nationality: "England", peakRating: 81 },
  { name: "Whetu Taewa", position: "CENTRE", nationality: "New Zealand", peakRating: 83 },
  { name: "Keith Senior", position: "CENTRE", nationality: "England", peakRating: 88 },
  { name: "Matt Crowther", position: "WING", nationality: "England", peakRating: 82 },
  { name: "Dave Watson", position: "STAND_OFF", nationality: "New Zealand", peakRating: 81 },
  { name: "Mark Aston", position: "SCRUM_HALF", nationality: "England", peakRating: 86 },
  { name: "Paul Broadbent", position: "PROP", nationality: "England", peakRating: 84 },
  { name: "Johnny Lawless", position: "HOOKER", nationality: "England", peakRating: 81 },
  { name: "Dale Laughton", position: "PROP", nationality: "England", peakRating: 83 },
  { name: "Paul Carr", position: "SECOND_ROW", nationality: "England", peakRating: 81 },
  { name: "Darren Shaw", position: "SECOND_ROW", nationality: "Scotland", peakRating: 81 },
  { name: "Rod Doyle", position: "LOOSE_FORWARD", nationality: "Australia", peakRating: 80 },
  { name: "Martin Wood", position: "LOOSE_FORWARD", nationality: "England", peakRating: 80 },
  { name: "Lynton Stott", position: "FULLBACK", nationality: "England", peakRating: 80 },
  { name: "Darren Turner", position: "HOOKER", nationality: "England", peakRating: 80 },
  { name: "Michael Jackson", position: "SECOND_ROW", nationality: "England", peakRating: 80 },
];

/**
 * Pre-Super League Lance Todd winners (season end year).
 * Shared 1965: Ray Ashby (Wigan) + Brian Gabbitas (Hunslet).
 */
const PRE_SL_LANCE_TODD: Array<{
  year: number;
  name: string;
  club: string;
  position: Position;
  nationality: string;
  peakRating: number;
}> = [
  { year: 1946, name: "Billy Stott", club: "Wakefield Trinity", position: "CENTRE", nationality: "England", peakRating: 84 },
  { year: 1947, name: "Willie Davies", club: "Bradford Bulls", position: "STAND_OFF", nationality: "Wales", peakRating: 84 },
  { year: 1948, name: "Frank Whitcombe", club: "Bradford Bulls", position: "PROP", nationality: "Wales", peakRating: 85 },
  { year: 1949, name: "Ernest Ward", club: "Bradford Bulls", position: "CENTRE", nationality: "England", peakRating: 86 },
  { year: 1950, name: "Gerry Helme", club: "Warrington Wolves", position: "SCRUM_HALF", nationality: "England", peakRating: 88 },
  { year: 1951, name: "Cec Mountford", club: "Wigan Warriors", position: "STAND_OFF", nationality: "New Zealand", peakRating: 87 },
  { year: 1952, name: "Billy Ivison", club: "Workington Town", position: "LOOSE_FORWARD", nationality: "England", peakRating: 84 },
  { year: 1953, name: "Peter Ramsden", club: "Huddersfield Giants", position: "STAND_OFF", nationality: "England", peakRating: 84 },
  { year: 1954, name: "Gerry Helme", club: "Warrington Wolves", position: "SCRUM_HALF", nationality: "England", peakRating: 88 },
  { year: 1955, name: "Jack Grundy", club: "Barrow Raiders", position: "SECOND_ROW", nationality: "England", peakRating: 84 },
  { year: 1956, name: "Alan Prescott", club: "St Helens", position: "PROP", nationality: "England", peakRating: 86 },
  { year: 1957, name: "Jeff Stevenson", club: "Leeds Rhinos", position: "SCRUM_HALF", nationality: "England", peakRating: 85 },
  { year: 1958, name: "Rees Thomas", club: "Wigan Warriors", position: "SCRUM_HALF", nationality: "Wales", peakRating: 84 },
  { year: 1959, name: "Brian McTigue", club: "Wigan Warriors", position: "SECOND_ROW", nationality: "England", peakRating: 87 },
  { year: 1960, name: "Tommy Harris", club: "Hull FC", position: "HOOKER", nationality: "Wales", peakRating: 85 },
  { year: 1961, name: "Dick Huddart", club: "St Helens", position: "SECOND_ROW", nationality: "England", peakRating: 86 },
  { year: 1962, name: "Neil Fox", club: "Wakefield Trinity", position: "CENTRE", nationality: "England", peakRating: 92 },
  { year: 1963, name: "Harold Poynton", club: "Wakefield Trinity", position: "STAND_OFF", nationality: "England", peakRating: 85 },
  { year: 1964, name: "Frank Collier", club: "Widnes Vikings", position: "PROP", nationality: "England", peakRating: 84 },
  { year: 1965, name: "Ray Ashby", club: "Wigan Warriors", position: "FULLBACK", nationality: "England", peakRating: 84 },
  { year: 1965, name: "Brian Gabbitas", club: "Hunslet", position: "STAND_OFF", nationality: "England", peakRating: 83 },
  { year: 1966, name: "Len Killeen", club: "St Helens", position: "WING", nationality: "South Africa", peakRating: 85 },
  { year: 1967, name: "Carl Dooler", club: "Featherstone Rovers", position: "SCRUM_HALF", nationality: "England", peakRating: 83 },
  { year: 1968, name: "Don Fox", club: "Wakefield Trinity", position: "PROP", nationality: "England", peakRating: 84 },
  { year: 1969, name: "Malcolm Reilly", club: "Castleford Tigers", position: "LOOSE_FORWARD", nationality: "England", peakRating: 90 },
  { year: 1970, name: "Bill Kirkbride", club: "Castleford Tigers", position: "SECOND_ROW", nationality: "England", peakRating: 83 },
  { year: 1971, name: "Alex Murphy", club: "Leigh Leopards", position: "SCRUM_HALF", nationality: "England", peakRating: 93 },
  { year: 1972, name: "Kel Coslett", club: "St Helens", position: "FULLBACK", nationality: "Wales", peakRating: 86 },
  { year: 1973, name: "Steve Nash", club: "Featherstone Rovers", position: "SCRUM_HALF", nationality: "England", peakRating: 84 },
  { year: 1974, name: "Derek Whitehead", club: "Warrington Wolves", position: "FULLBACK", nationality: "England", peakRating: 84 },
  { year: 1975, name: "Ray Dutton", club: "Widnes Vikings", position: "FULLBACK", nationality: "England", peakRating: 84 },
  { year: 1976, name: "Geoff Pimblett", club: "St Helens", position: "FULLBACK", nationality: "England", peakRating: 85 },
  { year: 1977, name: "Steve Pitchford", club: "Leeds Rhinos", position: "PROP", nationality: "England", peakRating: 84 },
  { year: 1978, name: "George Nicholls", club: "St Helens", position: "PROP", nationality: "England", peakRating: 87 },
  { year: 1979, name: "David Topliss", club: "Wakefield Trinity", position: "STAND_OFF", nationality: "England", peakRating: 86 },
  { year: 1980, name: "Brian Lockwood", club: "Hull KR", position: "PROP", nationality: "England", peakRating: 85 },
  { year: 1981, name: "Mick Burke", club: "Widnes Vikings", position: "FULLBACK", nationality: "England", peakRating: 86 },
  { year: 1982, name: "Eddie Cunningham", club: "Widnes Vikings", position: "CENTRE", nationality: "England", peakRating: 84 },
  { year: 1983, name: "David Hobbs", club: "Featherstone Rovers", position: "PROP", nationality: "England", peakRating: 84 },
  { year: 1984, name: "Joe Lydon", club: "Widnes Vikings", position: "CENTRE", nationality: "England", peakRating: 88 },
  { year: 1985, name: "Brett Kenny", club: "Wigan Warriors", position: "STAND_OFF", nationality: "Australia", peakRating: 91 },
  { year: 1986, name: "Bob Beardmore", club: "Castleford Tigers", position: "SCRUM_HALF", nationality: "England", peakRating: 84 },
  { year: 1987, name: "Graham Eadie", club: "Halifax", position: "FULLBACK", nationality: "Australia", peakRating: 88 },
  { year: 1988, name: "Andy Gregory", club: "Wigan Warriors", position: "SCRUM_HALF", nationality: "England", peakRating: 90 },
  { year: 1989, name: "Ellery Hanley", club: "Wigan Warriors", position: "LOOSE_FORWARD", nationality: "England", peakRating: 94 },
  { year: 1990, name: "Andy Gregory", club: "Wigan Warriors", position: "SCRUM_HALF", nationality: "England", peakRating: 90 },
  { year: 1991, name: "Denis Betts", club: "Wigan Warriors", position: "SECOND_ROW", nationality: "England", peakRating: 88 },
  { year: 1992, name: "Martin Offiah", club: "Wigan Warriors", position: "WING", nationality: "England", peakRating: 92 },
  { year: 1993, name: "Dean Bell", club: "Wigan Warriors", position: "CENTRE", nationality: "New Zealand", peakRating: 88 },
  { year: 1994, name: "Martin Offiah", club: "Wigan Warriors", position: "WING", nationality: "England", peakRating: 92 },
  { year: 1995, name: "Jason Robinson", club: "Wigan Warriors", position: "WING", nationality: "England", peakRating: 90 },
];

function findExisting(
  players: Raw[],
  name: string,
  club?: string,
  year?: number
): Raw | undefined {
  const key = name.toLowerCase();
  const hits = players.filter((p) => p.name.toLowerCase() === key);
  if (hits.length === 0) return undefined;
  if (year != null) {
    const yearHit = hits.find(
      (p) =>
        (p.year === year || p.cardYear === year || p.id.endsWith(`-${year}`)) &&
        (!club || p.club === club)
    );
    if (yearHit) return yearHit;
  }
  if (club) {
    const clubHit = hits.find((p) => p.club === club);
    if (clubHit) return clubHit;
  }
  return hits[0];
}

function buildCard(opts: {
  name: string;
  club: string;
  position: Position;
  nationality: string;
  peakRating: number;
  year: number;
  challengeCupWinner?: boolean;
}): Raw {
  const id = makeId(opts.club, opts.name, opts.year);
  const basePlayerId = makeId(opts.club, opts.name);
  return {
    id,
    name: opts.name,
    position: opts.position,
    positions: [opts.position],
    primaryPosition: opts.position,
    club: opts.club,
    displayClub: opts.club,
    team: opts.club,
    nationality: opts.nationality,
    era: opts.year >= 1996 ? "MODERN_ERA" : opts.year >= 1980 ? "MODERN_ERA" : "CLASSIC_ERA",
    yearsActive: `${opts.year}–${opts.year}`,
    category: "historic",
    status: "Historic",
    peakRating: opts.peakRating,
    value: computePlayerValue(opts.peakRating, opts.position, "historic"),
    year: opts.year,
    cardYear: opts.year,
    teamYearId: `${slugifyClub(opts.club)}-${opts.year}`,
    basePlayerId,
    availableInGame: true,
    challengeCupWinner: opts.challengeCupWinner ? true : undefined,
    source: "sheffield-1998-presl-lance-todd",
  };
}

function main(): void {
  const historic = loadJson<Raw[]>("historic-players.json");
  const legends = loadJson<Raw[]>("legends.json");
  const current = loadJson<Raw[]>("current-squads.json");
  const all = [...historic, ...legends, ...current];
  const byId = new Map(all.map((p) => [p.id, p]));

  let added = 0;
  let updated = 0;
  const report: {
    sheffieldAdded: string[];
    sheffieldExisting: string[];
    lanceToddAdded: string[];
    lanceToddExisting: string[];
    lanceToddIds: string[];
  } = {
    sheffieldAdded: [],
    sheffieldExisting: [],
    lanceToddAdded: [],
    lanceToddExisting: [],
    lanceToddIds: [],
  };

  // --- Sheffield 1998 ---
  for (const row of SHEFFIELD_1998) {
    const existing = findExisting(all, row.name, "Sheffield Eagles", 1998);
    if (existing && (existing.year === 1998 || existing.id.endsWith("-1998"))) {
      existing.challengeCupWinner = true;
      if (!existing.club) existing.club = "Sheffield Eagles";
      updated++;
      report.sheffieldExisting.push(existing.id);
      continue;
    }
    // Prefer creating a dedicated 1998 Sheffield card even if player exists elsewhere
    const card = buildCard({
      ...row,
      club: "Sheffield Eagles",
      year: 1998,
      challengeCupWinner: true,
    });
    if (byId.has(card.id)) {
      const hit = byId.get(card.id)!;
      hit.challengeCupWinner = true;
      updated++;
      report.sheffieldExisting.push(hit.id);
      continue;
    }
    // If a non-year Sheffield card exists, still add 1998 year card
    historic.push(card);
    byId.set(card.id, card);
    all.push(card);
    added++;
    report.sheffieldAdded.push(card.id);
  }

  // --- Pre-SL Lance Todd winners ---
  const ltIds = new Set(loadJson<string[]>("lance-todd-winners.json"));
  // Remove known false Sheffield LT attribution if present
  ltIds.delete("sheffield-hist-lynton-stott");

  for (const row of PRE_SL_LANCE_TODD) {
    let existing = findExisting(all, row.name, row.club, row.year);
    if (!existing) existing = findExisting(all, row.name);
    let id: string;
    if (existing) {
      id = existing.id;
      // Ensure a year card for the winning season when club matches / no year card
      if (
        existing.club === row.club &&
        existing.year !== row.year &&
        !existing.id.endsWith(`-${row.year}`)
      ) {
        const yearCard = buildCard({
          name: row.name,
          club: row.club,
          position: row.position,
          nationality: row.nationality,
          peakRating: Math.max(row.peakRating, Number(existing.peakRating ?? 80)),
          year: row.year,
          challengeCupWinner: true,
        });
        yearCard.basePlayerId = String(existing.basePlayerId ?? existing.id);
        if (!byId.has(yearCard.id)) {
          historic.push(yearCard);
          byId.set(yearCard.id, yearCard);
          all.push(yearCard);
          added++;
          report.lanceToddAdded.push(yearCard.id);
          id = yearCard.id;
        } else {
          id = yearCard.id;
        }
      } else {
        existing.challengeCupWinner = true;
        updated++;
        report.lanceToddExisting.push(existing.id);
      }
    } else {
      const card = buildCard({
        ...row,
        challengeCupWinner: true,
      });
      historic.push(card);
      byId.set(card.id, card);
      all.push(card);
      added++;
      report.lanceToddAdded.push(card.id);
      id = card.id;
    }
    ltIds.add(id);
    // Also tag base id when year card was used
    const player = byId.get(id);
    if (player?.basePlayerId) ltIds.add(String(player.basePlayerId));
    report.lanceToddIds.push(id);
  }

  // Mark Aston LT (1998)
  const aston =
    findExisting(all, "Mark Aston", "Sheffield Eagles", 1998) ??
    findExisting(all, "Mark Aston");
  if (aston) {
    ltIds.add(aston.id);
    if (aston.basePlayerId) ltIds.add(String(aston.basePlayerId));
  }

  // Ensure Ellery Hanley / Martin Offiah / Jason Robinson existing legend ids stay linked
  for (const name of ["Ellery Hanley", "Martin Offiah", "Jason Robinson", "Denis Betts"]) {
    const hit = findExisting(all, name);
    if (hit) {
      ltIds.add(hit.id);
      if (hit.basePlayerId) ltIds.add(String(hit.basePlayerId));
    }
  }

  saveJson("historic-players.json", historic);
  saveJson(
    "lance-todd-winners.json",
    [...ltIds].sort((a, b) => a.localeCompare(b))
  );

  // Merge Sheffield 1998 into era-starting-17s for CC year builder
  const era = loadJson<
    Array<{ club: string; year: number; squad: Array<{ number: number; position: string; name: string }> }>
  >("era-starting-17s.json");
  const filtered = era.filter(
    (row) => !(row.club === "Sheffield Eagles" && row.year === 1998)
  );
  filtered.push({
    club: "Sheffield Eagles",
    year: 1998,
    squad: SHEFFIELD_1998.map((row, index) => ({
      number: index + 1,
      position: row.position,
      name: row.name,
    })),
  });
  saveJson("era-starting-17s.json", filtered);

  const out = {
    generatedAt: new Date().toISOString(),
    added,
    updated,
    ...report,
  };
  saveJson("sheffield-1998-presl-lance-todd-report.json", out);
  console.log(JSON.stringify(out, null, 2));
}

main();
