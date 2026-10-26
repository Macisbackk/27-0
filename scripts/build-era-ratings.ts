/**
 * Era card ratings audit (Oct 2026): writes data/era-season-ratings.json, applied in
 * normalize.ts after the manual overrides and the career-arc audit, for historic and legend
 * season cards only (never a current 2026 card).
 *
 * Evidence: data/era-rating-anchors.json — Man of Steel, Dream Team, Young Player, Lance Todd
 * and Harry Sunderland winners, and every Super League final table 1996–2025 (Wikipedia).
 *
 * Model, per player (all his cards grouped by name + birth year):
 *   1. Peak P = his best card, then anchored by honours:
 *        Man of Steel ≥ 95 · Dream Team ×4 ≥ 94 · ×3 ≥ 93 · ×2 ≥ 91 · ×1 ≥ 89.
 *      Without a Man of Steel the honours also cap it (Super League-era players):
 *        no Dream Team 91 · ×1 93 · ×2 94 · ×3 95, +1 for a Lance Todd / Harry Sunderland
 *        (+2 with no Dream Team) — a journeyman or one-season winger can't outrate MoS winners.
 *   2. Season cards follow the career arc (same curve as scripts/audit-ratings.ts):
 *        Man of Steel season → P, Dream Team season → P − 1 (less for teenagers / veterans);
 *        other seasons capped at P − age curve − distance from his best seasons;
 *        a prime-age season (23–31) next to a Dream Team season can't be a placeholder
 *        (≥ P − 2 − 2 × distance); Lance Todd / Harry Sunderland season ≥ P − 3;
 *        Young Player of the Year season ≥ its age cap − 1.
 *   3. Club seasons: each club-season's best 13 cards vs its real final league position
 *      (champions count as 2nd or better). Sides rated well above/below where they finished
 *      move up to 3 points (ordinary cards only; award seasons are left alone).
 *
 * Run: bun scripts/build-era-ratings.ts [--write]
 * Writes data/era-season-ratings.json (what the game loads: rating + short reason) and
 * data/era-season-ratings-report.json (from/to, full reasons, club-season shifts).
 * Idempotent: cards in the report read back their "from" value as the base.
 */
import fs from "node:fs";
import path from "node:path";
import { getAllDatabasePlayers, getShowcasePlayers } from "../src/lib/players";
import { getAllEraTeams } from "../src/lib/players/era-teams";
import { isGameplayYearCard } from "../src/lib/players/year-card";
import { getEraModeTeamYearPools } from "../src/lib/game/player-pool-eligibility";
import type { Player } from "../src/lib/types";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");
const OUT = path.join(ROOT, "data", "era-season-ratings.json");
const REPORT = path.join(ROOT, "data", "era-season-ratings-report.json");
const SEASON = 2026;

type Anchors = {
  manOfSteel: Record<string, [string, string]>;
  dreamTeam: Record<string, [string, string][]>;
  youngPlayer: Record<string, string>;
  lanceTodd: Record<string, [string, string][]>;
  harrySunderland: Record<string, [string, string][]>;
  champions: Record<string, string>;
  leagueTables: Record<string, string[]>;
};
const A = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "era-rating-anchors.json"), "utf8")) as Anchors;

type Entry = { id: string; name: string; club: string; year: number; from: number; to: number; why: string };
const prev: Record<string, Entry> = {};
if (fs.existsSync(REPORT)) {
  for (const e of (JSON.parse(fs.readFileSync(REPORT, "utf8")) as { changes: Entry[] }).changes) prev[e.id] = e;
}
// Peaks come from ratings before the career-arc audit (data/player-rating-audit-report.json):
// that audit already lowered young/old cards against those peaks, so measuring against the
// lowered values would apply the age curve twice.
const preAudit: Record<string, number> = {};
for (const c of (JSON.parse(fs.readFileSync(path.join(ROOT, "data", "player-rating-audit-report.json"), "utf8")) as {
  changes: Array<{ id: string; from: number }>;
}).changes) preAudit[c.id] = c.from;

// ---- names -------------------------------------------------------------------------------
const ALIASES: Record<string, string> = {
  andrewfarrell: "andyfarrell",
  tommymakinson: "thomasmakinson",
  garyconnolly: "garryconnolly",
  matthewgidley: "mattgidley",
  robbiepaul: "robbiehunterpaul",
  nenemcdonald: "nenemacdonald",
  matthewdaylight: "mattdaylight",
  mattyashurst: "matashurst",
};
function nameKey(name: string): string {
  const k = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return ALIASES[k] ?? k;
}

// ---- cards -------------------------------------------------------------------------------
// Era Classic cards: Super League-era season cards that can be drafted (showcase year cards) or
// appear in an era side (spin pools, era starting 17s). Stale career records (unavailable, or a
// "year" that is only a career start) are left alone, as are pre-1996 cards (no awards data).
const showcase = new Set(getShowcasePlayers().map((p) => p.id));
const eraIds = new Set<string>();
for (const t of getAllEraTeams()) for (const id of t.playerIds) eraIds.add(id);
for (const pool of getEraModeTeamYearPools()) for (const id of pool.playerIds) eraIds.add(id);

type Card = { p: Player; base: number; year: number | undefined; editable: boolean };
const cards: Card[] = getAllDatabasePlayers()
  // (cards rated by an earlier run stay in, so a rating change that swaps which card an era
  // starting 17 picks for a name can't make the next run drop it)
  .filter((p) => showcase.has(p.id) || eraIds.has(p.id) || prev[p.id] !== undefined)
  .map((p) => {
    const year = p.year ?? p.cardYear;
    const base = prev[p.id]?.from ?? p.peakRating;
    const editable =
      p.category !== "current" &&
      year !== undefined &&
      year >= 1996 &&
      year < SEASON &&
      (eraIds.has(p.id) || prev[p.id] !== undefined || isGameplayYearCard(p));
    return { p, base, year, editable };
  });

const groups = new Map<string, Card[]>();
for (const c of cards) {
  const key = `${nameKey(c.p.name)}|${c.p.birthYear ?? "?"}`;
  groups.set(key, [...(groups.get(key) ?? []), c]);
}
const keysByName = new Map<string, string[]>();
for (const key of groups.keys()) {
  const n = key.split("|")[0]!;
  keysByName.set(n, [...(keysByName.get(n) ?? []), key]);
}

/** The player group an award belongs to: same name, preferring a card at that club near that year. */
function findGroup(name: string, club: string, year: number): string | undefined {
  const keys = keysByName.get(nameKey(name)) ?? [];
  let best: string | undefined;
  let bestScore = Infinity;
  for (const key of keys) {
    for (const c of groups.get(key)!) {
      const score = Math.abs((c.year ?? 0) - year) + (c.p.club === club ? 0 : 5);
      if (score < bestScore) [best, bestScore] = [key, score];
    }
  }
  return best;
}

type Honours = { dt: Set<number>; mos: Set<number>; big: Set<number>; yp: Set<number> };
const honours = new Map<string, Honours>();
const unmatched: string[] = [];
function honour(kind: keyof Honours, name: string, club: string, year: number) {
  const key = findGroup(name, club, year);
  if (!key) {
    unmatched.push(`${kind} ${year} ${name}`);
    return;
  }
  const h = honours.get(key) ?? { dt: new Set(), mos: new Set(), big: new Set(), yp: new Set() };
  h[kind].add(year);
  honours.set(key, h);
}
for (const [y, team] of Object.entries(A.dreamTeam)) for (const [n, c] of team) honour("dt", n, c, +y);
for (const [y, [n, c]] of Object.entries(A.manOfSteel)) honour("mos", n, c, +y);
for (const [y, list] of Object.entries(A.lanceTodd)) for (const [n, c] of list) honour("big", n, c, +y);
for (const [y, list] of Object.entries(A.harrySunderland)) for (const [n, c] of list) honour("big", n, c, +y);
for (const [y, n] of Object.entries(A.youngPlayer)) honour("yp", n, "", +y);
// This season's awards (on the 2026 cards) and Golden Boots count as award seasons too.
for (const [key, group] of groups) {
  for (const { p } of group) {
    const add = (kind: "dt" | "mos", y: number) => {
      const h = honours.get(key) ?? { dt: new Set(), mos: new Set(), big: new Set(), yp: new Set() };
      h[kind].add(y);
      honours.set(key, h);
    };
    if (p.category === "current" && p.dreamTeamYears?.includes(SEASON)) add("dt", SEASON);
    for (const y of p.goldenBootYears ?? []) add("dt", y);
  }
}

// ---- curve (shared with scripts/audit-ratings.ts) ------------------------------------------
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
const elitePenalty = (age: number | null) => (age === null ? 0 : age <= 21 ? 2 : age >= 33 ? age - 32 : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---- 1 + 2: player arcs ---------------------------------------------------------------------
const to = new Map<string, number>();
const why = new Map<string, string[]>();
const short = new Map<string, string[]>();
const isAward = new Set<string>(); // cards in a Dream Team / Man of Steel season: team step leaves them alone
const capOf = new Map<string, number>();
const note = (id: string, s: string, brief: string) => {
  why.set(id, [...(why.get(id) ?? []), s]);
  short.set(id, [...(short.get(id) ?? []), brief]);
};
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

for (const [key, group] of groups) {
  const h = honours.get(key) ?? { dt: new Set<number>(), mos: new Set<number>(), big: new Set<number>(), yp: new Set<number>() };
  const p0 = Math.max(...group.map((c) => Math.max(c.base, preAudit[c.p.id] ?? 0)));
  const nDt = h.dt.size;
  const floor = h.mos.size ? 95 : nDt >= 4 ? 94 : nDt === 3 ? 93 : nDt === 2 ? 91 : nDt === 1 ? 89 : 0;
  const birth = group[0]!.p.birthYear;
  const slEraOnly =
    birth !== undefined && birth >= 1972 && group.every((c) => (c.year ?? 0) >= 1996) &&
    group.every((c) => c.p.category !== "legend");
  let peak = Math.max(p0, floor);
  let peakWhy = floor > p0 ? `honours put his peak at ${floor} (${honourText(h)})` : "";
  let peakShort = floor > p0 ? `peak ${floor}: ${h.mos.size ? "Man of Steel" : `Dream Team ×${nDt}`}` : "";
  if (!h.mos.size && slEraOnly) {
    // Without a Man of Steel, his honours bound his peak: no-one outrates the award winners on
    // a couple of good seasons. A Lance Todd / Harry Sunderland is worth a point (two if he has
    // no Dream Team).
    const base = nDt >= 4 ? 99 : nDt === 3 ? 95 : nDt === 2 ? 94 : nDt === 1 ? 93 : 91;
    const cap = Math.min(99, base + (h.big.size ? (nDt ? 1 : 2) : 0));
    if (peak > cap) {
      peakWhy = `${nDt ? `Dream Team ×${nDt}` : "no Dream Team"}, no Man of Steel${h.big.size ? ", big-match award" : ""}: peak ${p0} → ${cap}`;
      peakShort = `peak capped ${cap}: ${nDt ? `Dream Team ×${nDt}` : "no Dream Team"}, no MoS`;
      peak = cap;
    }
  }
  const elite = new Set([...h.dt, ...h.mos]);
  // One card and no honours: that card is the only evidence of his level, so the age curve has
  // nothing to measure it against (same rule as scripts/audit-ratings.ts).
  const lone = group.length < 2 && !floor;
  for (const c of group) {
    if (!c.editable) continue;
    const y = c.year!;
    const age = birth !== undefined ? y - birth : null;
    const dist = elite.size ? Math.min(3, ...[...elite].map((e) => Math.abs(e - y))) : 0;
    const cap = lone ? peak : peak - (age === null ? 0 : ageCurve(age)) - dist;
    let r = c.base;
    const reasons: string[] = [];
    const briefs: string[] = [];
    if (h.mos.has(y)) {
      const f = peak - elitePenalty(age);
      if (r < f) [r, reasons[0], briefs[0]] = [f, `${y} Man of Steel`, `${y} Man of Steel`];
      isAward.add(c.p.id);
    } else if (h.dt.has(y)) {
      const f = peak - 1 - elitePenalty(age);
      if (r < f) [r, reasons[0], briefs[0]] = [f, `${y} Dream Team`, `${y} Dream Team`];
      isAward.add(c.p.id);
    } else {
      if (r > cap) {
        r = cap;
        reasons[0] = `age ${age ?? "?"}${elite.size ? `, ${dist} yr from his award seasons` : ""}`;
        briefs[0] = `age ${age ?? "?"}${elite.size ? `, ${dist} yr off his best` : ""}`;
      }
      let f = 0;
      let fw = "";
      let fb = "";
      if (elite.size && dist <= 2 && age !== null && age >= 23 && age <= 31) {
        f = peak - 2 - 2 * dist;
        fw = `prime season ${dist} yr from a Dream Team year`;
        fb = `prime, ${dist} yr from a Dream Team year`;
      }
      if (h.big.has(y) && peak - 3 > f) [f, fw, fb] = [peak - 3, `${y} Lance Todd / Harry Sunderland`, `${y} Lance Todd / Harry Sunderland`];
      if (h.yp.has(y) && cap - 1 > f) [f, fw, fb] = [cap - 1, `${y} Young Player of the Year`, `${y} Young Player of the Year`];
      f = Math.min(f, cap);
      if (r < f) [r, reasons[0], briefs[0]] = [f, fw, fb];
    }
    if (r > peak) {
      r = peak;
      reasons[0] ??= "above his anchored peak";
      briefs[0] ??= "above his peak";
    }
    r = clamp(r, 80, 99);
    capOf.set(c.p.id, clamp(h.mos.has(y) || h.dt.has(y) ? peak : cap, 80, 99));
    to.set(c.p.id, r);
    if (r !== c.base) {
      if (peakWhy) note(c.p.id, peakWhy, peakShort);
      note(c.p.id, `${reasons[0]}; peak ${peak}`, briefs[0]!);
    }
  }
}
function honourText(h: Honours): string {
  const parts: string[] = [];
  if (h.mos.size) parts.push(`Man of Steel ${[...h.mos].sort().join(", ")}`);
  if (h.dt.size) parts.push(`Dream Team ${[...h.dt].sort().join(", ")}`);
  return parts.join("; ");
}

// ---- 3: club seasons vs real league finishes -------------------------------------------------
type TeamRow = { club: string; year: number; pos: number; n: number; eff: number; score: number; ids: string[] };
function teamRows(): TeamRow[] {
  const rows: TeamRow[] = [];
  const bySeason = new Map<string, Card[]>();
  for (const c of cards) {
    if (!c.editable) continue;
    const k = `${c.p.club}|${c.year}`;
    bySeason.set(k, [...(bySeason.get(k) ?? []), c]);
  }
  for (const [k, cs] of bySeason) {
    const [club, ys] = k.split("|") as [string, string];
    const table = A.leagueTables[ys];
    if (!table || cs.length < 10) continue;
    const pos = table.indexOf(club) + 1;
    if (!pos) continue;
    const eff = A.champions[ys] === club ? Math.min(pos, 2) : pos;
    const top = cs.map((c) => to.get(c.p.id)!).sort((a, b) => b - a).slice(0, 13);
    rows.push({
      club, year: +ys, pos, n: table.length, eff,
      score: top.reduce((s, v) => s + v, 0) / top.length,
      ids: cs.map((c) => c.p.id),
    });
  }
  return rows;
}
function fit(rows: TeamRow[]) {
  const xs = rows.map((r) => (r.eff - 1) / (r.n - 1));
  const ys = rows.map((r) => r.score);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  const b = sxy / sxx;
  return { a: my - b * mx, b, r: sxy / Math.sqrt(sxx * syy) };
}

const before = teamRows();
const line = fit(before);
const teamShift: string[] = [];
for (const row of before) {
  const pred = line.a + line.b * (row.eff - 1) / (row.n - 1);
  const resid = row.score - pred;
  if (Math.abs(resid) < 1) continue;
  const shift = clamp(-Math.round(resid * 0.6), -3, 3);
  // Only fix contradictions: a top-half side rated too low comes up, a bottom-half side rated
  // too high comes down. Dominant title sides stay stacked; strugglers aren't propped up.
  const topHalf = row.eff <= row.n / 2;
  if (!shift || (shift > 0 && !topHalf) || (shift < 0 && topHalf)) continue;
  teamShift.push(`${row.club} ${row.year} (finished ${row.pos}/${row.n}${A.champions[row.year] === row.club ? ", champions" : ""}): best-13 ${row.score.toFixed(1)} vs ${pred.toFixed(1)} expected → ${shift > 0 ? "+" : ""}${shift}`);
  for (const id of row.ids) {
    if (isAward.has(id)) continue;
    const cur = to.get(id)!;
    const next = shift > 0 ? Math.min(cur + shift, Math.max(cur, capOf.get(id)!)) : Math.max(80, cur + shift);
    if (next === cur) continue;
    to.set(id, next);
    note(
      id,
      `${row.club} ${row.year} finished ${row.pos}/${row.n}${A.champions[row.year] === row.club ? " (champions)" : ""}: side rated ${resid > 0 ? "above" : "below"} its finish, ${shift > 0 ? "+" : ""}${next - cur}`,
      `side finished ${ordinal(row.pos)}${A.champions[row.year] === row.club ? ", champions" : ""}: ${shift > 0 ? "+" : ""}${next - cur}`
    );
  }
}
const after = teamRows();
const lineAfter = fit(after);

// ---- 4: same player, same season, different cards → one rating --------------------------------
for (const group of groups.values()) {
  const byYear = new Map<number, Card[]>();
  for (const c of group) if (c.editable) byYear.set(c.year!, [...(byYear.get(c.year!) ?? []), c]);
  for (const [y, cs] of byYear) {
    if (cs.length < 2) continue;
    const vals = cs.map((c) => to.get(c.p.id)!);
    const hi = Math.max(...vals);
    if (Math.min(...vals) === hi) continue;
    for (const c of cs) {
      if (to.get(c.p.id) === hi) continue;
      to.set(c.p.id, hi);
      note(c.p.id, `same ${y} season as his other card (${hi})`, `same season as his other ${y} card`);
    }
  }
}

// ---- report --------------------------------------------------------------------------------
const out: Record<string, Entry> = {};
const runtime: Record<string, { to: number; why: string }> = {};
for (const c of cards) {
  if (!c.editable) continue;
  const r = to.get(c.p.id)!;
  if (r === c.base) continue;
  out[c.p.id] = { id: c.p.id, name: c.p.name, club: c.p.club, year: c.year!, from: c.base, to: r, why: (why.get(c.p.id) ?? []).join("; ") };
  runtime[c.p.id] = { to: r, why: (short.get(c.p.id) ?? []).filter(Boolean).join("; ") };
}
const changes = Object.entries(out).sort(
  ([, a], [, b]) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.name.localeCompare(b.name)
);
const up = changes.filter(([, e]) => e.to > e.from).length;
console.log(`${cards.filter((c) => c.editable).length} era cards, ${groups.size} players; ${changes.length} changes (${up} up, ${changes.length - up} down)`);
console.log(`unmatched honours (no era card): ${unmatched.length}`);
if (process.env.VERBOSE) console.log(unmatched.join("\n"));
console.log(`club seasons vs finish: r=${line.r.toFixed(2)} before → r=${lineAfter.r.toFixed(2)} after (${before.length} club-seasons)`);
for (const s of teamShift) console.log(`  ${s}`);
for (const [id, e] of changes.slice(0, Number(process.env.SHOW ?? 40))) {
  console.log(`${e.from} → ${e.to}  ${e.name} ${e.year} (${e.club}) — ${e.why}  [${id}]`);
}

if (process.argv.includes("--write")) {
  const ids = Object.keys(runtime).sort();
  fs.writeFileSync(OUT, `{\n${ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(runtime[id])}`).join(",\n")}\n}\n`);
  fs.writeFileSync(
    REPORT,
    JSON.stringify(
      {
        generated: "2026-10",
        cards: cards.filter((c) => c.editable).length,
        up,
        down: changes.length - up,
        clubSeasonsVsFinish: { before: +line.r.toFixed(3), after: +lineAfter.r.toFixed(3), clubSeasons: before.length },
        clubSeasonShifts: teamShift,
        changes: changes.map(([, e]) => e),
      },
      null,
      1
    ) + "\n"
  );
  console.log(`wrote ${changes.length} era ratings to data/era-season-ratings.json (+ report)`);
}
