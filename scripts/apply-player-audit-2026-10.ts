/**
 * Apply the October 2026 player data audit (researched with sources).
 *
 * Inputs (each section runs only if its file exists):
 *   data/historic-age-fill-2026-10.json     — era birth dates + researched card fixes
 *   data/estimated-season-fixes-2026-10.json — real seasons for birthYear+18 placeholder cards
 *   data/current-player-bio-fill-2026-10.json — 2026 players: DOB, caps, apps/tries, nationality
 *   data/honours-fill-2026-10.json           — missing honour years (2026 GF, MoS, Dream Team, League Leaders…)
 *
 * After this, run: bun scripts/fix-era-card-years.ts --apply --skip-file=data/historic-age-fill-2026-10.json
 * (re-dates the remaining placeholder cards from verified squad lists), then rebuild chunks,
 * rosters and runtime data. Writes data/player-audit-2026-10-report.json.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

type Row = Record<string, unknown> & { id: string; name: string; club: string };
type Sourced = { sources?: string[] };

const DATA = join(__dirname, "..", "data");
const path = (f: string) => join(DATA, f);
const readJson = <T>(f: string): T => JSON.parse(readFileSync(path(f), "utf8")) as T;
const writeJson = (f: string, v: unknown) => writeFileSync(path(f), `${JSON.stringify(v, null, 2)}\n`);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const current = readJson<Row[]>("current-squads.json");
const historic = readJson<Row[]>("historic-players.json");
const legends = readJson<Row[]>("legends.json");
const all = [...current, ...historic, ...legends];
const byId = new Map(all.map((p) => [p.id, p]));

const log: Record<string, unknown[]> = {
  births: [],
  cardMoves: [],
  cardsHidden: [],
  other: [],
  currentBios: [],
  honours: [],
  skipped: [],
};

function setBirth(p: Row, dob: string | undefined, year: number | undefined, why: string) {
  const before = { dateOfBirth: p.dateOfBirth, birthYear: p.birthYear };
  if (dob) {
    p.dateOfBirth = dob;
    p.birthYear = Number(dob.slice(0, 4));
  } else if (year) {
    p.birthYear = year;
    if (typeof p.dateOfBirth === "string" && !p.dateOfBirth.startsWith(String(year))) delete p.dateOfBirth;
  }
  if (before.dateOfBirth !== p.dateOfBirth || before.birthYear !== p.birthYear) {
    log.births.push({ id: p.id, name: p.name, before, after: { dateOfBirth: p.dateOfBirth, birthYear: p.birthYear }, why });
  }
}

/** Has this person (same name) already got a card at this club for this season? */
function seasonTaken(p: Row, year: number): boolean {
  return all.some(
    (o) => o !== p && o.club === p.club && norm(o.name) === norm(p.name) && o.cardYear === year && o.availableInGame !== false
  );
}

function moveCard(p: Row, year: number, why: string) {
  if (p.cardYear === year) return;
  if (seasonTaken(p, year)) {
    hideCard(p, `${why} — a ${year} card already exists`);
    return;
  }
  log.cardMoves.push({ id: p.id, name: p.name, club: p.club, from: p.cardYear, to: year, why });
  p.year = year;
  p.cardYear = year;
  p.yearsActive = `${year}–${year}`;
  p.teamYearId = `${slug(p.club)}-${year}`;
}

function hideCard(p: Row, why: string) {
  if (p.availableInGame === false) return;
  p.availableInGame = false;
  log.cardsHidden.push({ id: p.id, name: p.name, club: p.club, year: p.cardYear, why });
}

// ── 1. Era birth dates and researched card fixes ─────────────────────────────
if (existsSync(path("historic-age-fill-2026-10.json"))) {
  const fill = readJson<{
    births: (Sourced & { ids: string[]; name: string; dateOfBirth?: string; birthYear?: number })[];
    cardFixes: (Sourced & {
      id: string;
      name: string;
      suggestedYear: number | null;
      correctDateOfBirth?: string;
      correctBirthYear?: number;
      suggestedAction?: string;
    })[];
  }>("historic-age-fill-2026-10.json");

  for (const b of fill.births) {
    for (const id of b.ids) {
      const p = byId.get(id);
      if (!p) {
        log.skipped.push({ id, reason: "birth: unknown id" });
        continue;
      }
      setBirth(p, b.dateOfBirth, b.birthYear, `researched: ${b.sources?.[0] ?? ""}`);
    }
  }

  // Wrong-person birth dates that apply to every card of that person.
  const byName = (name: string) => all.filter((p) => norm(p.name) === norm(name));
  for (const p of byName("Paul Anderson")) setBirth(p, "1971-10-25", undefined, "all Paul Anderson cards are the 1971 'Baloo' (Bradford/St Helens)");
  for (const p of byName("James Bentley")) setBirth(p, "1997-10-19", undefined, "James Bentley born 1997 (RLP)");
  for (const p of byName("Danny Williams")) {
    if (["Salford Red Devils", "Bradford Bulls"].includes(p.club)) setBirth(p, "1986-09-26", undefined, "Salford/Bradford winger born 1986");
  }

  for (const f of fill.cardFixes) {
    const p = byId.get(f.id);
    if (!p) {
      log.skipped.push({ id: f.id, reason: "cardFix: unknown id" });
      continue;
    }
    if (f.correctDateOfBirth || f.correctBirthYear) {
      setBirth(p, f.correctDateOfBirth, f.correctBirthYear, `cardFix: ${f.sources?.[0] ?? ""}`);
    }
    if (f.suggestedYear === null || f.suggestedYear === undefined) {
      hideCard(p, `never at ${p.club} that season (researched): ${f.suggestedAction ?? ""}`.trim());
    } else {
      moveCard(p, f.suggestedYear, `researched season at ${p.club}`);
    }
  }

  // Specific follow-ups from the research notes.
  for (const id of ["bradford-hist-aaron-smith-2004", "hull-fc-hist-paul-johnson-2013"]) {
    const p = byId.get(id);
    if (p && p.basePlayerId !== id) {
      log.other.push({ id, change: `basePlayerId ${String(p.basePlayerId)} → ${id} (different person)` });
      p.basePlayerId = id;
    }
  }
  const barnett = byId.get("london-hist-richie-barnett");
  if (barnett && barnett.nationality !== "New Zealand") {
    log.other.push({ id: barnett.id, change: `nationality ${String(barnett.nationality)} → New Zealand (London's Richie Barnett, b.1972)` });
    barnett.nationality = "New Zealand";
  }
  // Toulouse 2022–2025 cards back-filled for players who joined later.
  for (const p of historic) {
    if (p.club !== "Toulouse Olympique") continue;
    const y = p.cardYear as number;
    const joined: Record<string, number> = { "Luke Polselli": 2026, "Henry O'Kane": 2026, "Joe Cator": 2024, "Reubenn Rennie": 2023 };
    const first = joined[p.name];
    if (first !== undefined && y < first) hideCard(p, `${p.name} joined Toulouse in ${first}`);
  }
}

// ── 2. Real seasons for birthYear+18 placeholder cards with no verified squad data ─────
if (existsSync(path("estimated-season-fixes-2026-10.json"))) {
  const fx = readJson<{ fixes: (Sourced & { id: string; suggestedYear?: number | null; neverAtClubSince1996?: boolean })[] }>(
    "estimated-season-fixes-2026-10.json"
  );
  for (const f of fx.fixes) {
    const p = byId.get(f.id);
    if (!p) continue;
    if (f.neverAtClubSince1996 || !f.suggestedYear) hideCard(p, "no Super League-era season at this club (researched)");
    else moveCard(p, f.suggestedYear, `researched season at ${p.club}`);
  }
}

// ── 3. 2026 players: DOB, caps, appearances, tries, nationality ──────────────
if (existsSync(path("current-player-bio-fill-2026-10.json"))) {
  const bio = readJson<{
    players: (Sourced & {
      id: string;
      dateOfBirth?: string;
      birthYear?: number;
      intlCaps?: number;
      appearances?: number;
      tries?: number;
      nationality?: string;
    })[];
  }>("current-player-bio-fill-2026-10.json");
  const caps = readJson<Record<string, number>>("intl-caps-corrections.json");
  let capsChanged = false;
  for (const b of bio.players) {
    const p = current.find((r) => r.id === b.id);
    if (!p) {
      log.skipped.push({ id: b.id, reason: "bio: not a current card" });
      continue;
    }
    const changes: Record<string, [unknown, unknown]> = {};
    const set = (k: string, v: unknown) => {
      if (v === undefined || v === null || p[k] === v) return;
      changes[k] = [p[k], v];
      p[k] = v;
    };
    if (b.dateOfBirth || b.birthYear) {
      const before = { d: p.dateOfBirth, y: p.birthYear };
      setBirth(p, b.dateOfBirth, b.birthYear, `bio: ${b.sources?.[0] ?? ""}`);
      if (before.d !== p.dateOfBirth || before.y !== p.birthYear) changes.birth = [before, { d: p.dateOfBirth, y: p.birthYear }];
    }
    set("intlCaps", b.intlCaps);
    if (b.intlCaps !== undefined && caps[p.id] !== undefined && caps[p.id] !== b.intlCaps) {
      caps[p.id] = b.intlCaps;
      capsChanged = true;
    }
    set("appearances", b.appearances);
    set("tries", b.tries);
    set("nationality", b.nationality);
    if (Object.keys(changes).length > 0) log.currentBios.push({ id: p.id, name: p.name, changes, source: b.sources?.[0] });
  }
  if (capsChanged) writeJson("intl-caps-corrections.json", caps);
}

// ── 4. Honours ───────────────────────────────────────────────────────────────
if (existsSync(path("honours-fill-2026-10.json"))) {
  const hon = readJson<{
    entries: (Sourced & { honour: string; year: number; club: string; players: { name: string; ids: string[] }[] })[];
  }>("honours-fill-2026-10.json");
  const FILES: Record<string, string> = {
    superLeagueChampion: "super-league-champion-years.json",
    leagueLeaders: "league-leaders-years.json",
    dreamTeam: "dream-team-years.json",
    manOfSteel: "man-of-steel-winners.json",
  };
  const maps: Record<string, Record<string, number[]>> = {};
  for (const [k, f] of Object.entries(FILES)) maps[k] = readJson<Record<string, number[]>>(f);
  for (const e of hon.entries) {
    const map = maps[e.honour];
    if (!map) {
      log.skipped.push({ honour: e.honour, year: e.year, reason: "unknown honour" });
      continue;
    }
    for (const pl of e.players) {
      const ids = pl.ids.filter((id) => byId.has(id));
      if (ids.length === 0) {
        log.skipped.push({ honour: e.honour, year: e.year, name: pl.name, reason: "no matching card id" });
        continue;
      }
      for (const id of ids) {
        const years = new Set(map[id] ?? []);
        if (years.has(e.year)) continue;
        years.add(e.year);
        map[id] = [...years].sort((a, b) => a - b);
        log.honours.push({ honour: e.honour, year: e.year, id });
      }
    }
  }
  for (const [k, f] of Object.entries(FILES)) writeJson(f, maps[k]);
}

writeJson("current-squads.json", current);
writeJson("historic-players.json", historic);
writeJson("legends.json", legends);
writeJson("player-audit-2026-10-report.json", {
  generatedAt: new Date().toISOString(),
  script: "scripts/apply-player-audit-2026-10.ts",
  counts: Object.fromEntries(Object.entries(log).map(([k, v]) => [k, v.length])),
  ...log,
});
console.log(Object.fromEntries(Object.entries(log).map(([k, v]) => [k, v.length])));
