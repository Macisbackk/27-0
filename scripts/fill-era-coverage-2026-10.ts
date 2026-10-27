/**
 * Era coverage fill (Oct 2026): every Super League club-season 1996–2025 gets
 *   1. an Era Classic spin XIII (data/sl-era-verified-squads.json) when it has none, taken from
 *      the season's verified starting 17 (data/era-starting-17s.json, jersey 1–13, Rugby League
 *      Project / the verified 17s list) — the same derivation fill-team-year-gaps-2009-2016 used;
 *   2. a season card (club + that exact year) for every player in that 17 / XIII, and for that
 *      club-season's Man of Steel, Dream Team, Lance Todd and Harry Sunderland winners
 *      (data/era-rating-anchors.json, Wikipedia).
 *
 * A new card is a copy of the same player's nearest-season card (name, nationality, date of
 * birth carried over; same person = same name and a plausible age / career gap). Position is the
 * jersey position he wore in that 17 (bench: his card position; Dream Team: the Dream Team slot).
 * Rating: his nearest card's rating moved along the age curve (scripts/build-era-ratings.ts),
 * never above his best card. Run build-era-ratings afterwards for the honours / club-finish layer.
 * A name with no card anywhere in the database is not invented: it is listed as unresolved.
 *
 * An era-only card ("-hist-era-", never offered in spins) for the same player and season is
 * superseded by the new card (availableInGame: false + supersededBy) so the season has one card.
 *
 * Run: bun scripts/fill-era-coverage-2026-10.ts [--write]
 * Then: bun scripts/build-era-ratings.ts --write && bun scripts/generate-team-year-rosters.ts
 */
import fs from "node:fs";
import path from "node:path";
import { getAllDatabasePlayers } from "../src/lib/players";
import { expandNameLookupKeys } from "../src/lib/players/player-name-resolve";
import { buildPlayerTeamYearId } from "../src/lib/players/year-card";
import { parsePlayerId } from "../src/lib/players/prime-year";
import { computePlayerValue } from "../src/lib/players/ratings";
import { isPlayableTeamYearRoster } from "../src/lib/players/team-year-roster-playable";
import { superLeagueSeasons, GAME_CLUB } from "./era-coverage-report";
import type { Player, Position } from "../src/lib/types";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");
const D = (f: string) => path.join(ROOT, "data", f);
const WRITE = process.argv.includes("--write");
const TAG = "era-coverage-2026-10";

type Raw = Record<string, unknown> & { id: string; name: string };
type S17 = { club: string; year: number; source?: string; squad: { number: number; position: string; name: string }[] };
type Verified = Record<string, Record<string, { playerIds: string[]; positions?: string[]; source?: string; wikipediaPlayers?: string[]; verifiedAt?: string }>>;

const historic = JSON.parse(fs.readFileSync(D("historic-players.json"), "utf8")) as Raw[];
const s17 = JSON.parse(fs.readFileSync(D("era-starting-17s.json"), "utf8")) as S17[];
// Match-day 17s researched for club-seasons with no verified 17 (Rugby League Project match
// pages / Wikipedia final pages; data/era-coverage-lineups-2026-10.json, one source per side).
const lineups = (fs.existsSync(D("era-coverage-lineups-2026-10.json"))
  ? JSON.parse(fs.readFileSync(D("era-coverage-lineups-2026-10.json"), "utf8"))
  : []) as Array<S17 & { match: string }>;
// Players with no card anywhere in the database: verified bio (nationality, birth) per name.
type Bio = { nationality: string; dateOfBirth?: string; birthYear?: number; position?: string; source: string };
const bios = (fs.existsSync(D("era-coverage-new-players-2026-10.json"))
  ? JSON.parse(fs.readFileSync(D("era-coverage-new-players-2026-10.json"), "utf8"))
  : {}) as Record<string, Bio>;
const s17Added: S17[] = [];
const wiki = JSON.parse(fs.readFileSync(D("era-wikipedia-squads.json"), "utf8")) as Verified;
const slVerified = JSON.parse(fs.readFileSync(D("sl-era-verified-squads.json"), "utf8")) as Verified;
const anchors = JSON.parse(fs.readFileSync(D("era-rating-anchors.json"), "utf8")) as {
  manOfSteel: Record<string, [string, string]>;
  dreamTeam: Record<string, [string, string][]>;
  lanceTodd: Record<string, [string, string][]>;
  harrySunderland: Record<string, [string, string][]>;
};

const POS: Record<string, Position> = {
  FB: "FULLBACK", W: "WING", C: "CENTRE", FE: "STAND_OFF", HB: "SCRUM_HALF",
  FR: "PROP", HK: "HOOKER", "2R": "SECOND_ROW", L: "LOOSE_FORWARD",
};
const DT_SLOTS: Position[] = [
  "FULLBACK", "WING", "CENTRE", "CENTRE", "WING", "STAND_OFF", "SCRUM_HALF",
  "PROP", "HOOKER", "PROP", "SECOND_ROW", "SECOND_ROW", "LOOSE_FORWARD",
];
const PREFIX: Record<string, string> = {
  "Bradford Bulls": "bradford", "Castleford Tigers": "castleford", "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield", "Hull FC": "hull-fc", "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds", "Leigh Leopards": "leigh", "London Broncos": "london",
  "Salford Red Devils": "salford", "St Helens": "st-helens", "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington", "Widnes Vikings": "widnes", "Wigan Warriors": "wigan",
  "Toulouse Olympique": "toulouse", "York Knights": "york", "Halifax Panthers": "halifax",
  "Sheffield Eagles": "sheffield", "Oldham RLFC": "oldham", "Paris Saint-Germain RL": "psg",
  "Workington Town": "workington", "Gateshead Thunder": "gateshead", "Crusaders RL": "crusaders",
  "Toronto Wolfpack": "toronto",
};

const slugify = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cardYear = (p: Player) => p.year ?? p.cardYear;
const clubMatches = (p: Player, club: string) => p.club === club || p.displayClub === club || p.team === club;
function ageCurve(age: number): number {
  if (age <= 19) return 7;
  if (age === 20) return 5;
  if (age === 21) return 4;
  if (age === 22) return 2;
  if (age === 23) return 1;
  if (age <= 32) return 0;
  if (age === 33) return 1;
  if (age === 34) return 2;
  if (age === 35) return 3;
  return 4;
}

// ---- player index (normalized: final in-game ratings) ----------------------------------------
const players = getAllDatabasePlayers();
const rawById = new Map<string, Raw>(historic.map((r) => [r.id, r]));
const byKey = new Map<string, Player[]>();
const allIds = new Set(players.map((p) => p.id));
function index(p: Player) {
  for (const k of expandNameLookupKeys(p.name)) byKey.set(k, [...(byKey.get(k) ?? []), p]);
}
players.forEach(index);
function candidates(name: string): Player[] {
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const k of expandNameLookupKeys(name)) {
    for (const p of byKey.get(k) ?? []) if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
  }
  return out;
}

/** Same person plausibly playing club-season (club, year)? */
function plausible(p: Player, year: number): boolean {
  if (p.birthYear !== undefined) {
    const age = year - p.birthYear;
    if (age < 16 || age > 41) return false;
  }
  const y = cardYear(p);
  if (y !== undefined && Math.abs(y - year) > 16) return false;
  return true;
}

function exactCard(name: string, club: string, year: number): Player | null {
  const list = candidates(name).filter(
    (p) => cardYear(p) === year && clubMatches(p, club) && (p.category !== "current" || rawById.has(p.id))
  );
  list.sort((a, b) =>
    Number(a.id.includes("-hist-era-")) - Number(b.id.includes("-hist-era-")) ||
    Number(a.availableInGame === false) - Number(b.availableInGame === false) ||
    Number(a.category === "current") - Number(b.category === "current")
  );
  return list[0] ?? null;
}

function baseCard(name: string, club: string, year: number): Player | null {
  const list = candidates(name).filter((p) => plausible(p, year));
  if (!list.length) return null;
  // Two different people under one name: if birth years disagree by > 2, keep the group whose
  // cards sit nearest this season.
  const dist = (p: Player) => {
    const y = cardYear(p);
    return (y === undefined ? 30 : Math.abs(y - year)) + (clubMatches(p, club) ? 0 : 2) +
      (p.availableInGame === false ? 5 : 0) + (p.category === "current" ? 1 : 0);
  };
  list.sort((a, b) => dist(a) - dist(b));
  return list[0]!;
}

function peakOf(base: Player): number {
  const births = base.birthYear;
  const same = candidates(base.name).filter(
    (p) => births === undefined || p.birthYear === undefined || Math.abs(p.birthYear - births) <= 1
  );
  return Math.max(...same.map((p) => p.peakRating));
}

function seasonRating(base: Player, year: number): number {
  let r = base.peakRating;
  const by = base.birthYear;
  const y0 = cardYear(base);
  if (by !== undefined && y0 !== undefined) r += ageCurve(y0 - by) - ageCurve(year - by);
  if (y0 !== undefined && Math.abs(year - y0) > 4) r -= Math.min(3, Math.abs(year - y0) - 4);
  return Math.max(80, Math.min(peakOf(base), Math.round(r)));
}

function eraLabel(year: number): string {
  return year <= 2001 ? "SUPER_LEAGUE_ORIGINS" : year <= 2012 ? "MODERN_ERA" : "CONTEMPORARY_ERA";
}

const created: Raw[] = [];
const superseded: string[] = [];
const unresolved: string[] = [];
const report: Record<string, { source: string; created: string[]; existing: number; unresolved: string[]; xiii: "added" | "existing" | "none" }> = {};

function newId(club: string, name: string, year: number): string {
  const prefix = PREFIX[club] ?? slugify(club);
  let id = `${prefix}-hist-${slugify(name)}-${year}`;
  let i = 2;
  while (allIds.has(id)) id = `${prefix}-hist-${slugify(name)}-${i++}-${year}`;
  allIds.add(id);
  return id;
}

/** Ensure a card for (name, club, year); returns its id, or null when the player is unknown. */
function ensureCard(name: string, club: string, year: number, position: Position | null, sourceUrl: string, key: string): string | null {
  const exact = exactCard(name, club, year);
  if (exact && !exact.id.includes("-hist-era-") && exact.availableInGame !== false && exact.category !== "current") {
    report[key]!.existing++;
    return exact.id;
  }
  const base = exact ?? baseCard(name, club, year);
  if (!base) {
    const bio = bios[name];
    const pos = position ?? (bio?.position as Position | undefined) ?? null;
    if (!bio || !pos) {
      report[key]!.unresolved.push(name);
      unresolved.push(`${club} ${year}: ${name}${bio ? " (no position)" : ""}`);
      return null;
    }
    // No card anywhere: a fresh season card from the line-up + his verified bio. No other
    // evidence of his level, so a squad-player rating (starter 82, bench 81); the club-finish
    // layer of build-era-ratings then moves the side as a whole.
    const rating = position ? 82 : 81;
    const raw: Raw = {
      id: newId(club, name, year),
      name,
      position: pos,
      primaryPosition: pos,
      club,
      nationality: bio.nationality,
      era: eraLabel(year),
      yearsActive: `${year}–${year}`,
      category: "historic",
      peakRating: rating,
      value: computePlayerValue(rating, pos, "historic"),
      year,
      cardYear: year,
      teamYearId: buildPlayerTeamYearId(club, year),
      team: club,
      displayClub: club,
      status: "Historic",
      ...(bio.dateOfBirth ? { dateOfBirth: bio.dateOfBirth } : {}),
      ...(bio.birthYear !== undefined ? { birthYear: bio.birthYear } : {}),
      availableInGame: true,
      source: TAG,
      sourceUrl,
      bioSource: bio.source,
    };
    created.push(raw);
    report[key]!.created.push(raw.id);
    index({ ...(raw as unknown as Player), positions: [pos], availableInGame: undefined } as Player);
    return raw.id as string;
  }
  const pos = position ?? base.position;
  const positions = [...new Set([pos, ...(base.positions ?? [base.position])])];
  const rating = exact ? exact.peakRating : seasonRating(base, year);
  const raw: Raw = {
    id: newId(club, base.name, year),
    name: base.name,
    position: pos,
    primaryPosition: pos,
    ...(positions.length > 1 ? { positions } : {}),
    club,
    nationality: base.nationality,
    era: eraLabel(year),
    yearsActive: `${year}–${year}`,
    category: "historic",
    peakRating: rating,
    value: computePlayerValue(rating, pos, "historic"),
    year,
    cardYear: year,
    teamYearId: buildPlayerTeamYearId(club, year),
    team: club,
    displayClub: club,
    basePlayerId: base.basePlayerId ?? parsePlayerId(base.id).baseId,
    status: "Historic",
    ...(base.dateOfBirth ? { dateOfBirth: base.dateOfBirth } : {}),
    ...(base.birthYear !== undefined ? { birthYear: base.birthYear } : {}),
    availableInGame: true,
    source: TAG,
    sourceUrl,
    copiedFrom: base.id,
  };
  created.push(raw);
  report[key]!.created.push(raw.id);
  if (exact) {
    // the era-only / hidden card for this exact season gives way to the new one
    const old = rawById.get(exact.id);
    // (or a historic-file card mislabelled "current", which no historic pool can use)
    if (old && (exact.id.includes("-hist-era-") || exact.category === "current")) {
      old.availableInGame = false;
      old.supersededBy = raw.id;
      superseded.push(exact.id);
    }
  }
  const p = { ...base, id: raw.id, year, cardYear: year, club, displayClub: club, team: club, peakRating: rating, position: pos, positions: positions as Position[], availableInGame: undefined, category: "historic" } as Player;
  index(p);
  return raw.id;
}

// ---- which club-seasons ------------------------------------------------------------------------
const real = superLeagueSeasons().filter((s) => s.year <= 2025);
const s17By = new Map(s17.map((e) => [`${e.club}|${e.year}`, e]));
const merged = (club: string, year: number) => slVerified[club]?.[year] ?? wiki[club]?.[year];

const awards = new Map<string, Array<{ name: string; position: Position | null; award: string; source: string }>>();
const addAward = (club: string, y: string, name: string, position: Position | null, award: string, source: string) => {
  const k = `${GAME_CLUB[club] ?? club}|${y}`;
  awards.set(k, [...(awards.get(k) ?? []), { name, position, award, source }]);
};
for (const [y, [n, c]] of Object.entries(anchors.manOfSteel)) addAward(c, y, n, null, "Man of Steel", "https://en.wikipedia.org/wiki/Man_of_Steel_Awards");
for (const [y, t] of Object.entries(anchors.dreamTeam)) t.forEach(([n, c], i) => addAward(c, y, n, t.length === 13 ? DT_SLOTS[i]! : null, "Dream Team", "https://en.wikipedia.org/wiki/Super_League_Dream_Team"));
for (const [y, t] of Object.entries(anchors.lanceTodd)) for (const [n, c] of t) addAward(c, y, n, null, "Lance Todd", "https://en.wikipedia.org/wiki/Lance_Todd_Trophy");
for (const [y, t] of Object.entries(anchors.harrySunderland)) for (const [n, c] of t) addAward(c, y, n, null, "Harry Sunderland", "https://en.wikipedia.org/wiki/Harry_Sunderland_Trophy");

let xiiiAdded = 0;
for (const { club, year } of real) {
  const key = `${club}|${year}`;
  let e17 = s17By.get(key);
  if (!e17) {
    const lu = lineups.find((l) => l.club === club && l.year === year);
    if (lu) {
      e17 = { club, year, source: lu.source, squad: lu.squad };
      // a full match-day 17 also gives the club-season an era side
      if (lu.squad.length === 17) s17Added.push({ club, year, source: `${lu.source} (${lu.match})`, squad: lu.squad });
    }
  }
  const existing = merged(club, year);
  const source = e17?.source && e17.source.startsWith("http")
    ? e17.source
    : existing?.source ?? (e17 ? `era-starting-17s.json (${e17.source ?? "verified starting 17"})` : "");
  report[key] = { source, created: [], existing: 0, unresolved: [], xiii: "none" };

  // 17 (or the verified XIII when there is no 17)
  const xiiiIds: string[] = [];
  const xiiiPos: Position[] = [];
  const xiiiNames: string[] = [];
  if (e17) {
    for (const m of [...e17.squad].sort((a, b) => a.number - b.number)) {
      const code = m.position.trim().toUpperCase();
      const pos = POS[code] ?? (Object.values(POS).includes(code as Position) ? (code as Position) : null);
      const id = ensureCard(m.name, club, year, pos, source, key);
      if (m.number <= 13 && pos) {
        if (id) xiiiIds.push(id);
        xiiiPos.push(pos);
        xiiiNames.push(m.name);
      }
    }
  } else if (existing?.wikipediaPlayers?.length === 13) {
    existing.wikipediaPlayers.forEach((n, i) => ensureCard(n, club, year, (existing.positions?.[i] as Position) ?? null, existing.source ?? "", key));
  }
  for (const a of awards.get(key) ?? []) ensureCard(a.name, club, year, a.position, a.source, key);

  // spin XIII: only when the club-season has none that works
  if (e17 && xiiiIds.length === 13 && xiiiPos.length === 13) {
    const ex = merged(club, year);
    const exWorks = ex && ex.playerIds.length === 13;
    if (!exWorks) {
      slVerified[club] ??= {};
      slVerified[club]![String(year)] = {
        source,
        playerIds: xiiiIds,
        positions: xiiiPos,
        wikipediaPlayers: xiiiNames,
        verifiedAt: `${TAG} (era-starting-17s jersey 1–13)`,
      };
      report[key]!.xiii = "added";
      xiiiAdded++;
    } else report[key]!.xiii = "existing";
  } else if (merged(club, year)) report[key]!.xiii = "existing";
}

// ---- summary ------------------------------------------------------------------------------------
const rows = Object.entries(report);
console.log(`club-seasons ${rows.length}; spin XIIIs added ${xiiiAdded}; cards created ${created.length}; era-only cards superseded ${superseded.length}; unresolved names ${unresolved.length}`);
for (const u of unresolved) console.log(`  ? ${u}`);
const noXiii = rows.filter(([, r]) => r.xiii === "none").map(([k]) => k);
console.log(`club-seasons with no XIII source: ${noXiii.length}\n  ${noXiii.join(", ")}`);

if (WRITE) {
  const merged2 = [...historic, ...created];
  if (s17Added.length) {
    fs.writeFileSync(D("era-starting-17s.json"), `${JSON.stringify([...s17, ...s17Added], null, 2)}\n`);
    console.log(`era-starting-17s.json: +${s17Added.length} match-day 17s`);
  }
  const prevReport = fs.existsSync(D("era-coverage-fill-2026-10-report.json"))
    ? (JSON.parse(fs.readFileSync(D("era-coverage-fill-2026-10-report.json"), "utf8")) as { cardsCreated: number; xiiiAdded: number; superseded: string[]; clubSeasons: typeof report })
    : null;
  if (prevReport) {
    for (const [k, r] of Object.entries(prevReport.clubSeasons)) {
      const cur = report[k];
      if (!cur) { report[k] = r; continue; }
      cur.created = [...r.created, ...cur.created];
      if (r.xiii === "added") cur.xiii = "added";
      cur.source = cur.source || r.source;
    }
  }
  const allCreated = Object.values(report).reduce((n, r) => n + r.created.length, 0);
  const allXiii = Object.values(report).filter((r) => r.xiii === "added").length;
  fs.writeFileSync(D("historic-players.json"), `${JSON.stringify(merged2, null, 2)}\n`);
  fs.writeFileSync(D("sl-era-verified-squads.json"), `${JSON.stringify(slVerified, null, 2)}\n`);
  fs.writeFileSync(
    D("era-coverage-fill-2026-10-report.json"),
    `${JSON.stringify({ generated: TAG, xiiiAdded: allXiii, cardsCreated: allCreated, superseded: [...(prevReport?.superseded ?? []), ...superseded], unresolved, clubSeasons: report }, null, 1)}\n`
  );
  console.log("wrote historic-players.json, sl-era-verified-squads.json, era-coverage-fill-2026-10-report.json");
}
void isPlayableTeamYearRoster;
