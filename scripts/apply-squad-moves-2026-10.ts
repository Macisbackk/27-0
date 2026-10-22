/**
 * Apply researched mid-2026 Super League squad moves (data/squad-moves-2026-10.json).
 *
 * - Moved to another Super League club: the card moves club (or, if he already has a card
 *   at the new club, the old one is retired from the game).
 * - Moved out of Super League (Championship / NRL / QLD Cup / retired): the card follows
 *   him to his new club where we have one and leaves Classic (availableInGame: false), the
 *   same way the existing Championship cards are flagged.
 * - Joiners with no card get a new 2026 card at a depth rating (80, never above an
 *   established starter), matching scripts/add-2026-missing-squad-players.ts.
 * - Moved players are taken out of their old club's matchday 17.
 * Moves announced for 2027 are left alone.
 *
 * Run: bun scripts/apply-squad-moves-2026-10.ts, then rebuild chunks/rosters/runtime data.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type Row = Record<string, unknown> & { id: string; name: string; club: string };
type Move = {
  name: string;
  from: string;
  to: string;
  toLeague?: string;
  date?: string;
  type?: string;
  existingIds?: string[];
  sources?: string[];
};
type Joiner = {
  name: string;
  to: string;
  from?: string;
  position?: string;
  nationality?: string;
  dateOfBirth?: string;
  appearances?: number;
  tries?: number;
  date?: string;
  sources?: string[];
};

const DATA = join(__dirname, "..", "data");
const readJson = <T>(f: string): T => JSON.parse(readFileSync(join(DATA, f), "utf8")) as T;
const writeJson = (f: string, v: unknown) => writeFileSync(join(DATA, f), `${JSON.stringify(v, null, 2)}\n`);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SL_CLUBS = new Set([
  "Bradford Bulls", "Castleford Tigers", "Catalans Dragons", "Huddersfield Giants", "Hull FC", "Hull KR",
  "Leeds Rhinos", "Leigh Leopards", "St Helens", "Toulouse Olympique", "Wakefield Trinity",
  "Warrington Wolves", "Wigan Warriors", "York Knights",
]);
const POSITIONS = new Set(["FULLBACK", "WING", "CENTRE", "STAND_OFF", "SCRUM_HALF", "PROP", "HOOKER", "SECOND_ROW", "LOOSE_FORWARD"]);

const current = readJson<Row[]>("current-squads.json");
const squads17 = readJson<Record<string, Record<string, { playerIds: string[] }>>>("current-team-year-squads-2026.json");
const input = readJson<{ moves: Move[]; joinersWithNoCard?: Joiner[] }>("squad-moves-2026-10.json");

// Clubs that already have current cards (Championship sides in Manager Mode, etc.).
const knownClubs = new Set(current.map((p) => p.club));
const idPrefixFor = new Map<string, string>();
for (const p of current) {
  const m = p.id.match(/^(.*)-cur-/);
  if (m && !idPrefixFor.has(p.club)) idPrefixFor.set(p.club, m[1]!);
}

const log = { moved: [] as unknown[], retiredDuplicates: [] as unknown[], leftSuperLeague: [] as unknown[], added: [] as unknown[], skipped: [] as unknown[] };

const cardsOf = (name: string) => current.filter((p) => norm(p.name) === norm(name));
const removeFrom17 = (id: string) => {
  for (const [club, years] of Object.entries(squads17)) {
    const e = years["2026"];
    if (e?.playerIds.includes(id)) {
      e.playerIds = e.playerIds.filter((x) => x !== id);
      (log.moved as { id: string; removedFrom17?: string }[]).push({ id, removedFrom17: club });
    }
  }
};
const setClub = (p: Row, club: string) => {
  p.club = club;
  p.team = club;
  p.displayClub = club;
  p.currentClub = club;
  p.teamYearId = `${slug(club)}-2026`;
};

for (const mv of input.moves) {
  if (/2027/.test(mv.date ?? "") || mv.type === "2027") continue;
  const cards = cardsOf(mv.name);
  const old = cards.find((p) => p.club === mv.from && p.availableInGame !== false) ?? cards.find((p) => p.club === mv.from);
  const atNew = cards.find((p) => p.club === mv.to);
  if (!old) {
    log.skipped.push({ name: mv.name, reason: `no card at ${mv.from}` });
    continue;
  }
  const toSuperLeague = SL_CLUBS.has(mv.to);
  if (toSuperLeague) {
    if (atNew) {
      atNew.availableInGame = true;
      atNew.superLeagueEligible = true;
      old.availableInGame = false;
      log.retiredDuplicates.push({ keep: atNew.id, retired: old.id, from: mv.from, to: mv.to, source: mv.sources?.[0] });
    } else {
      setClub(old, mv.to);
      log.moved.push({ id: old.id, name: old.name, from: mv.from, to: mv.to, date: mv.date, source: mv.sources?.[0] });
    }
    removeFrom17(old.id);
    continue;
  }
  // Out of Super League.
  if (atNew) {
    old.availableInGame = false;
    old.superLeagueEligible = false;
  } else if (knownClubs.has(mv.to)) {
    setClub(old, mv.to);
    old.availableInGame = false;
    old.superLeagueEligible = false;
  } else {
    old.availableInGame = false;
    old.superLeagueEligible = false;
  }
  removeFrom17(old.id);
  log.leftSuperLeague.push({ id: old.id, name: old.name, from: mv.from, to: mv.to, league: mv.toLeague, date: mv.date, source: mv.sources?.[0] });
}

for (const j of input.joinersWithNoCard ?? []) {
  if (!SL_CLUBS.has(j.to)) continue;
  if (cardsOf(j.name).some((p) => p.club === j.to)) continue;
  const position = (j.position ?? "").toUpperCase();
  if (!POSITIONS.has(position) || !j.nationality) {
    log.skipped.push({ name: j.name, reason: "joiner missing position or nationality" });
    continue;
  }
  const prefix = idPrefixFor.get(j.to) ?? slug(j.to);
  const id = `${prefix}-cur-${slug(j.name)}`;
  if (current.some((p) => p.id === id)) {
    log.skipped.push({ name: j.name, reason: `id ${id} exists` });
    continue;
  }
  const template = current.find((p) => p.club === j.to && p.category === "current")!;
  const row: Row = {
    id,
    name: j.name,
    position,
    club: j.to,
    nationality: j.nationality,
    era: template.era,
    yearsActive: "2026–Present",
    category: "current",
    peakRating: 80,
    value: template.value,
    year: 2026,
    cardYear: 2026,
    teamYearId: `${slug(j.to)}-2026`,
    team: j.to,
    displayClub: j.to,
    basePlayerId: id,
    status: template.status,
    primaryPosition: position,
    availableInGame: true,
    superLeagueEligible: true,
    currentClub: j.to,
    positions: [position],
  };
  if (j.dateOfBirth) {
    row.dateOfBirth = j.dateOfBirth;
    row.birthYear = Number(j.dateOfBirth.slice(0, 4));
  }
  if (typeof j.appearances === "number") row.appearances = j.appearances;
  if (typeof j.tries === "number") row.tries = j.tries;
  current.push(row);
  log.added.push({ id, name: j.name, club: j.to, from: j.from, date: j.date, source: j.sources?.[0] });
}

writeJson("current-squads.json", current);
writeJson("current-team-year-squads-2026.json", squads17);
writeJson("squad-moves-2026-10-report.json", { generatedAt: new Date().toISOString(), script: "scripts/apply-squad-moves-2026-10.ts", ...log });
console.log(Object.fromEntries(Object.entries(log).map(([k, v]) => [k, v.length])));
