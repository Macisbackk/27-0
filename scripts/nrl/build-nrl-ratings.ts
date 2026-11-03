/**
 * NRL player ratings audit — a card rating for every NRL player-season (1998-2025, 80-99 like the
 * Super League era cards) and a current 2026 rating for every 2026 squad player (70-99, like the
 * current Super League cards). Mirrors scripts/build-era-ratings.ts so NRL cards can sit next to
 * Super League cards later. Standalone: nothing in src/ reads the outputs.
 *
 *   bun scripts/nrl/build-nrl-ratings.ts        (after build-nrl-honours.ts and build-nrl-card-info.ts)
 *
 * Model (all numbers documented in data/nrl/RATINGS.md):
 *  1. Peak P per player, from what he did over his career:
 *       base 82 + longevity (1998+ NRL games: +1 per 40, max +5) + scoring (backs +0..2 by tries per game;
 *       forwards/unknown +0..1) + representative level (Origin or Australia/NZ Test +4, both +5,
 *       Tonga/Samoa/Fiji/PNG/England Test +2)
 *     then honours anchors (floors), as Super League uses Man of Steel / Dream Team:
 *       Dally M Medals + Golden Boots ×1 97 · ×2 98 · ×3+ 99 (+1 with Hall of Fame or 2+ Clive
 *       Churchill / Wally Lewis medals) · Immortal 99 · Hall of Fame 96
 *       Dally M Team of the Year ×1 93 · ×2 94 · ×3 95 · ×4+ 96 · Origin / Aus-NZ Test 89 · other Test 87
 *     and caps — no-one outrates the award winners on games alone:
 *       no rep, no award 89 (fewer than 50 NRL games: 87) · Pacific/England Test 91 · Origin/Aus-NZ Test 93
 *       (each +1 with a Clive Churchill / Wally Lewis) · Team of the Year ×1 95(+1), ×2 96, ×3+ 97 ·
 *       Hall of Fame 98 · Medal/Golden Boot 99
 *  2. Season cards follow the career arc (same curve as scripts/build-era-ratings.ts):
 *       Dally M Medal season → P; Team of the Year season → P − 1 (less for ≤21 / 33+);
 *       other seasons ≤ P − age curve − distance (yrs, max 3) from his award seasons, minus a
 *       part-season penalty (1-2 games −5, 3-7 −3, 8-12 −1); prime seasons (23-31) next to a Team
 *       of the Year season ≥ P − 2 − 2×distance; Clive Churchill / Wally Lewis season ≥ P − 2;
 *       premiership-winning season with 15+ games +1 (within his cap).
 *     Age: date of birth / birth year from nrl-card-info.json; otherwise estimated as 20 in his first
 *     season when that season is after 1998 (flagged "age est."), else no age adjustment.
 *  3. Club seasons vs the real ladder (nrl-ladders.json): each club-season's best-13 average against
 *     its finish (premiers count as 2nd or better); top-half sides rated too low come up and
 *     bottom-half sides rated too high come down, up to 3 points (award seasons untouched).
 *  4. 2026 current ratings (70-99): the 2026 season card on the wider scale — the same arc but the
 *     floor is 70, a part season costs more (1-2 games −8, 3-7 −5, 8-12 −2), the 2026 ladder nudges
 *     regulars ±1 (top 4 +1, bottom 3 −1), and the card sits 2 below the era scale (1 for a 2025 Team
 *     of the Year player; none for the 2026 Dally M Medallist), as Super League current cards sit
 *     below its era cards. Players without a 2026 game are rated from their last season card (−2 a
 *     year away) or, with no NRL games, 72 (Top 30) / 70 (development list).
 *
 * Writes data/nrl/nrl-ratings.json (player-season → rating + why), data/nrl/nrl-ratings-2026.json,
 * and the audit tables used by data/nrl/RATINGS.md (data/nrl/nrl-ratings-report.json).
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, readJson, writeLinesJson, type NrlPlayer } from "./lib";

const GEN = "2026-11-03";
const CUR = 2026;
const players: NrlPlayer[] = readJson("nrl-players.json").players;
const info = new Map<string, any>(readJson("nrl-card-info.json").players.map((r: any) => [r.id, r]));
const ladders = readJson("nrl-ladders.json").seasons as Record<string, { teams: number; table: { position: number; clubId: string }[] }>;
const grandFinals = readJson("nrl-grand-finals.json").grandFinals as any[];
const premiers = new Map<number, string>(grandFinals.filter((g) => !g.stripped).map((g) => [g.season, g.premiersClubId]));
const dm = readJson("nrl-dally-m.json");
const origin = readJson("nrl-origin.json");
const tests = readJson("nrl-test-players.json");
const golden = readJson("nrl-golden-boot.json").winners as any[];
const hof = readJson("nrl-hall-of-fame.json");
const squads = readJson("nrl-current-squads-2026.json").clubs as any[];

// ---------------------------------------------------------------- honours per player
type H = { medal: Set<number>; toty: Set<number>; gb: Set<number>; ccm: Set<number>; wl: Set<number>; originYears: Set<number>; origin: boolean; test: boolean; tier2: boolean; hof: boolean; immortal: boolean };
const H = new Map<string, H>();
const h = (id: string) => { if (!H.has(id)) H.set(id, { medal: new Set(), toty: new Set(), gb: new Set(), ccm: new Set(), wl: new Set(), originYears: new Set(), origin: false, test: false, tier2: false, hof: false, immortal: false }); return H.get(id)!; };
for (const m of dm.medal) if (m.playerId) h(m.playerId).medal.add(m.season); // includes 2026 (a career honour for the peak)
for (const t of dm.teamOfTheYear) for (const x of t.team) if (x.playerId && x.position !== "IC") h(x.playerId).toty.add(t.season);
for (const g of golden) if (g.playerId) h(g.playerId).gb.add(g.season);
for (const g of grandFinals) if (g.cliveChurchillMedal.playerId) h(g.cliveChurchillMedal.playerId).ccm.add(g.season);
for (const s of origin.series) if (s.wallyLewisMedal.playerId) h(s.wallyLewisMedal.playerId).wl.add(s.season);
for (const o of origin.players) if (o.playerId) { h(o.playerId).origin = true; h(o.playerId).originYears.add(o.debut); }
// Test level: Australia / New Zealand Tests count like Origin; Tonga, Samoa, Fiji, PNG, England and
// Great Britain are a tier below; the developing nations (Lebanon, Italy, Cook Islands, …) don't move a rating.
const TIER1 = new Set(["Australia", "New Zealand"]);
const TIER2 = new Set(["Tonga", "Samoa", "Fiji", "Papua New Guinea", "England", "Great Britain"]);
for (const t of [...tests.testDebuts, ...tests.tournamentSquads]) if (t.playerId) { if (TIER1.has(t.nation)) h(t.playerId).test = true; else if (TIER2.has(t.nation)) h(t.playerId).tier2 = true; }
for (const x of hof.hallOfFame) if (x.playerId) h(x.playerId).hof = true;
for (const x of hof.immortals) if (x.playerId) h(x.playerId).immortal = true;
for (const [id, r] of info) {
  if (r.stateOfOrigin) h(id).origin = true;
  for (const n of r.internationalTeams ?? []) { if (TIER1.has(n)) h(id).test = true; else if (TIER2.has(n)) h(id).tier2 = true; }
}
const H0 = (id: string) => H.get(id) ?? h(id);

// ---------------------------------------------------------------- curves (shared with scripts/build-era-ratings.ts)
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
const partSeason = (apps: number, current = false) => (apps <= 2 ? (current ? 8 : 5) : apps <= 7 ? (current ? 5 : 3) : apps <= 12 ? (current ? 2 : 1) : 0);
const BASE = 82;
const BACKS = new Set(["FB", "WG", "CE", "SO", "SH"]);

function birthYearOf(id: string): { by: number | null; how: string } {
  const r = info.get(id);
  if (r?.birthYear) return { by: r.birthYear, how: "" };
  if (r?.birthYearRange) return { by: Math.round((r.birthYearRange[0] + r.birthYearRange[1]) / 2), how: "" };
  const p = players.find((x) => x.id === id)!;
  if (p.firstSeason > 1998) return { by: p.firstSeason - 20, how: "age est." };
  // Hall of Fame entries give the first season of the whole career: taken as age 19
  const hf = hof.hallOfFame.find((x: any) => x.playerId === id);
  const start = hf ? +String(hf.career).split(/[–-]/)[0]! : NaN;
  if (start) return { by: start - 19, how: "age est." };
  return { by: null, how: "" };
}

// ---------------------------------------------------------------- 1: peaks
type Peak = { peak: number; why: string; cap: number; floor: number };
const peaks = new Map<string, Peak>();
for (const p of players) {
  const hh = H0(p.id);
  const r = info.get(p.id);
  const pos = r?.primaryPosition as string | null;
  const apps = p.seasons.filter((s) => s.season < CUR + 1).reduce((a, s) => a + s.apps, 0);
  const tries = p.seasons.reduce((a, s) => a + s.tries, 0);
  const tpg = apps ? tries / apps : 0;
  const longevity = Math.min(5, Math.floor(apps / 40));
  // try-scoring credit: backs by tries per game; forwards (or unknown) only a little — props, hookers
  // and backrowers are credited through games played and selection instead
  const isBack = pos ? BACKS.has(pos) : false;
  const scoring = apps < 20 ? 0 : isBack ? (tpg >= 0.6 ? 2 : tpg >= 0.42 ? 1.5 : tpg >= 0.3 ? 1 : 0) : (tpg >= 0.45 ? 1 : tpg >= 0.25 ? 0.5 : 0);
  const rep = hh.origin && hh.test ? 5 : hh.origin || hh.test ? 4 : hh.tier2 ? 2 : 0;
  let peak = Math.round(BASE + longevity + scoring + rep);
  const nT = hh.toty.size, nM = hh.medal.size;
  const nBig = hh.ccm.size + hh.wl.size; // Clive Churchill + Wally Lewis medals
  const nTop = nM + hh.gb.size; // Dally M Medals + Golden Boots
  let floor = Math.max(
    hh.immortal ? 99 : 0,
    nTop ? 96 + Math.min(3, nTop) : 0,
    hh.hof ? 96 : 0,
    nT >= 4 ? 96 : nT === 3 ? 95 : nT === 2 ? 94 : nT === 1 ? 93 : 0,
    hh.origin || hh.test ? 89 : hh.tier2 ? 87 : 0,
  );
  if (floor >= 97 && (hh.hof || nBig >= 2)) floor = Math.min(99, floor + 1);
  const big = nBig ? 1 : 0;
  const cap = nTop || hh.immortal ? 99 : hh.hof ? 98 : nT >= 3 ? 97 : nT === 2 ? 96 : nT === 1 ? 95 + big : hh.origin || hh.test ? 93 + big : hh.tier2 ? 91 + big : apps < 50 ? 87 + big : 89 + big;
  const why: string[] = [`base ${BASE} +${longevity} games (${apps})${scoring ? ` +${scoring} tries/game ${tpg.toFixed(2)}` : ""}${rep ? ` +${rep} ${hh.origin && hh.test ? "Origin & Test" : hh.origin ? "Origin" : hh.test ? "Test" : "Pacific/England Test"}` : ""}`];
  if (peak < floor) { why.push(`honours floor ${floor}`); peak = floor; }
  if (peak > cap) { why.push(`capped ${cap}`); peak = cap; }
  if (nM) peak = Math.max(peak, floor);
  const honourBits = [nM ? `Dally M Medal ${[...hh.medal].join(",")}` : "", nT ? `Team of the Year ×${nT}` : "", hh.gb.size ? `Golden Boot ×${hh.gb.size}` : "", hh.ccm.size ? "Clive Churchill" : "", hh.wl.size ? "Wally Lewis" : "", hh.hof ? "Hall of Fame" : "", hh.immortal ? "Immortal" : ""].filter(Boolean);
  if (honourBits.length) why.push(honourBits.join(", "));
  peaks.set(p.id, { peak: clamp(peak, 80, 99), why: why.join("; "), cap, floor });
}

// ---------------------------------------------------------------- 2: season arcs
type Card = { id: string; name: string; season: number; clubId: string; apps: number; rating: number; raw: number; why: string[]; award: boolean; cap: number };
const cards: Card[] = [];
for (const p of players) {
  const hh = H0(p.id);
  const { peak, cap: pcap } = peaks.get(p.id)!;
  const { by, how } = birthYearOf(p.id);
  const elite = new Set([...hh.toty, ...hh.medal, ...hh.gb]);
  for (const s of p.seasons) {
    if (s.season >= CUR) continue;
    const y = s.season;
    const age = by === null ? null : y - by;
    const dist = elite.size ? Math.min(3, ...[...elite].map((e) => Math.abs(e - y))) : 0;
    const part = partSeason(s.apps);
    const ageTxt = age === null ? "" : `age ${age}${how ? " (est.)" : ""}`;
    let r: number, why: string[] = [], award = false;
    if (hh.medal.has(y) || hh.gb.has(y)) { r = peak - elitePenalty(age); why.push(`${y} ${hh.medal.has(y) ? "Dally M Medal" : "Golden Boot"}`); award = true; }
    else if (hh.toty.has(y)) { r = peak - 1 - elitePenalty(age); why.push(`${y} Dally M Team of the Year`); award = true; }
    else {
      r = peak - (age === null ? 0 : ageCurve(age)) - dist - part;
      const bits = [ageTxt && ageCurve(age!) ? ageTxt : "", dist ? `${dist} yr from his award seasons` : "", part ? `${s.apps} games` : ""].filter(Boolean);
      if (bits.length) why.push(bits.join(", "));
      let f = 0, fw = "";
      if (elite.size && dist <= 2 && age !== null && age >= 23 && age <= 31 && s.apps >= 10) { f = peak - 2 - 2 * dist; fw = `prime season ${dist} yr from a Team of the Year season`; }
      if ((hh.ccm.has(y) || hh.wl.has(y)) && peak - 2 > f) { f = peak - 2; fw = `${y} ${hh.ccm.has(y) ? "Clive Churchill Medal" : "Wally Lewis Medal"}`; }
      if (r < f) { r = f; why.push(fw); }
    }
    if (premiers.get(y) && (s.clubIds ?? [s.clubId]).includes(premiers.get(y)!) && s.apps >= 15 && !award && r < pcap) { r += 1; why.push(`${y} premiers (+1)`); }
    const raw = r;
    r = clamp(Math.min(r, peak), 80, 99);
    cards.push({ id: p.id, name: p.name, season: y, clubId: s.clubId, apps: s.apps, rating: r, raw, why, award, cap: Math.min(peak, 99) });
  }
}

// ---------------------------------------------------------------- 3: club seasons vs ladder
type Row = { clubId: string; season: number; pos: number; n: number; eff: number; score: number; cards: Card[] };
function teamRows(): Row[] {
  const by = new Map<string, Card[]>();
  for (const c of cards) { const k = `${c.clubId}|${c.season}`; by.set(k, [...(by.get(k) ?? []), c]); }
  const rows: Row[] = [];
  for (const [k, cs] of by) {
    const [clubId, ys] = k.split("|") as [string, string];
    const lad = ladders[ys];
    if (!lad || cs.length < 13) continue;
    const pos = lad.table.find((t) => t.clubId === clubId)?.position;
    if (!pos) continue;
    const eff = premiers.get(+ys) === clubId ? Math.min(pos, 2) : pos;
    const top = cs.filter((c) => c.apps >= 5).map((c) => c.rating).sort((a, b) => b - a).slice(0, 13);
    if (top.length < 10) continue;
    rows.push({ clubId, season: +ys, pos, n: lad.teams, eff, score: top.reduce((a, b) => a + b, 0) / top.length, cards: cs });
  }
  return rows;
}
function fit(rows: Row[]) {
  const xs = rows.map((r) => (r.eff - 1) / (r.n - 1)), ys = rows.map((r) => r.score);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; syy += (ys[i]! - my) ** 2; }
  const b = sxy / sxx;
  return { a: my - b * mx, b, r: sxy / Math.sqrt(sxx * syy) };
}
const before = teamRows();
const line = fit(before);
const shifts: string[] = [];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
for (const row of before) {
  const pred = line.a + (line.b * (row.eff - 1)) / (row.n - 1);
  const resid = row.score - pred;
  if (Math.abs(resid) < 1) continue;
  const shift = clamp(-Math.round(resid * 0.6), -3, 3);
  const topHalf = row.eff <= row.n / 2;
  if (!shift || (shift > 0 && !topHalf) || (shift < 0 && topHalf)) continue;
  shifts.push(`${row.clubId} ${row.season} finished ${row.pos}/${row.n}${premiers.get(row.season) === row.clubId ? " (premiers)" : ""}: best-13 ${row.score.toFixed(1)} vs ${pred.toFixed(1)} → ${shift > 0 ? "+" : ""}${shift}`);
  for (const c of row.cards) {
    if (c.award) continue;
    const next = shift > 0 ? Math.min(c.rating + shift, Math.max(c.rating, c.cap)) : Math.max(80, c.rating + shift);
    if (next === c.rating) continue;
    c.why.push(`side finished ${ordinal(row.pos)}${premiers.get(row.season) === row.clubId ? ", premiers" : ""}: ${next > c.rating ? "+" : ""}${next - c.rating}`);
    c.rating = next;
  }
}
const after = teamRows();
const lineAfter = fit(after);

// ---------------------------------------------------------------- 4: 2026 current ratings (70-99)
const dallyM2026 = new Set<string>(dm.medal.filter((m: any) => m.season === CUR && m.playerId).map((m: any) => m.playerId));
const origin2026 = new Set<string>(origin.players.filter((o: any) => o.debut === CUR && o.playerId).map((o: any) => o.playerId));
const wl2026 = new Set<string>(origin.series.filter((s: any) => s.season === CUR && s.wallyLewisMedal.playerId).map((s: any) => s.wallyLewisMedal.playerId));
const ladder2026 = ladders[String(CUR)]!;
const current: any[] = [];
for (const club of squads) {
  for (const sp of club.players) {
    const p = sp.playerId ? players.find((x) => x.id === sp.playerId) : null;
    const why: string[] = [];
    let rating: number;
    if (!p) {
      rating = sp.developmentList ? 70 : 72;
      why.push(sp.developmentList ? "development list, no NRL games" : "Top 30, no NRL games found");
    } else {
      const pk = peaks.get(p.id)!;
      const hh = H0(p.id);
      let peak = pk.peak;
      if (dallyM2026.has(p.id)) { peak = Math.max(peak, 97); why.push("2026 Dally M Medal"); }
      if (origin2026.has(p.id) && peak < 90) { peak = 90; why.push("2026 Origin debut"); }
      const { by, how } = birthYearOf(p.id);
      const age = by === null ? null : CUR - by;
      const s26 = p.seasons.find((s) => s.season === CUR);
      const elite = new Set([...hh.toty, ...hh.medal, ...hh.gb, ...(dallyM2026.has(p.id) ? [CUR] : [])]);
      const dist = elite.size ? Math.min(3, ...[...elite].map((e) => Math.abs(e - CUR))) : 0;
      if (s26) {
        if (dallyM2026.has(p.id)) rating = peak - elitePenalty(age);
        else {
          const part = partSeason(s26.apps, true);
          rating = peak - (age === null ? 0 : ageCurve(age)) - dist - part;
          const bits = [age !== null && ageCurve(age) ? `age ${age}${how ? " (est.)" : ""}` : "", dist ? `${dist} yr from his award seasons` : "", part ? `${s26.apps} games in 2026` : ""].filter(Boolean);
          if (bits.length) why.push(bits.join(", "));
          if (wl2026.has(p.id) && rating < peak - 1) { rating = peak - 1; why.push("2026 Wally Lewis Medal"); }
          if (elite.size && dist <= 1 && age !== null && age >= 23 && age <= 31 && s26.apps >= 10 && rating < peak - 2 - 2 * dist) { rating = peak - 2 - 2 * dist; why.push("prime, next to an award season"); }
        }
        // 2026 ladder: same direction-only nudge as the era step, smaller (±1)
        const pos = ladder2026.table.find((t) => t.clubId === club.clubId)?.position;
        if (pos && s26.apps >= 10 && !dallyM2026.has(p.id)) {
          if (pos <= 4 && rating < peak) { rating += 1; why.push(`2026 side finished ${ordinal(pos)}: +1`); }
          if (pos >= ladder2026.teams - 2) { rating -= 1; why.push(`2026 side finished ${ordinal(pos)}: -1`); }
        }
      } else {
        const last = cards.filter((c) => c.id === p.id).sort((a, b) => b.season - a.season)[0];
        const gap = last ? CUR - last.season : 0;
        rating = (last ? last.rating : 76) - 2 * gap - (age !== null && age >= 33 ? age - 32 : 0);
        why.push(last ? `no 2026 NRL game; last card ${last.season} (${last.rating}) −${2 * gap}` : "no NRL season card");
      }
      rating = Math.min(rating, peak);
      // current cards sit below the era scale, as Super League's do (SL current mean 82.4 vs era 85.8):
      // −2, or −1 for a 2025 Dally M Team of the Year player; the 2026 Dally M Medallist keeps his rating
      if (!dallyM2026.has(p.id)) { const d = hh.toty.has(CUR - 1) ? 1 : 2; rating -= d; why.push(`current scale −${d}`); }
      why.unshift(`peak ${peak}`);
    }
    rating = clamp(Math.round(rating), 70, 99);
    current.push({ playerId: sp.playerId, name: p?.name ?? sp.name, clubId: club.clubId, rating, apps2026: sp.apps2026 ?? 0, primaryPosition: sp.playerId ? info.get(sp.playerId)?.primaryPosition ?? null : null, basis: sp.basis, why: why.join("; ") });
  }
}

// ---------------------------------------------------------------- write
const seasonOut = cards.sort((a, b) => a.id.localeCompare(b.id) || a.season - b.season).map((c) => ({ playerId: c.id, name: c.name, season: c.season, clubId: c.clubId, apps: c.apps, rating: c.rating, why: c.why.filter(Boolean).join("; ") || "peak season" }));
writeLinesJson("nrl-ratings.json", {
  about: "NRL season card ratings 1998-2025 on the Super League era scale (80-99). One row per player-season (multi-club seasons use the first club). Model: scripts/nrl/build-nrl-ratings.ts, audit: data/nrl/RATINGS.md. Standalone; not used by the game.",
  generatedAt: GEN,
  peaks: Object.fromEntries([...peaks].map(([id, v]) => [id, { peak: v.peak, why: v.why }])),
  clubSeasonsVsLadder: { before: +line.r.toFixed(3), after: +lineAfter.r.toFixed(3), clubSeasons: before.length, shifts },
}, "seasons", seasonOut);
writeLinesJson("nrl-ratings-2026.json", {
  about: "Current 2026 NRL ratings on the current-card scale (70-99) for every 2026 squad player (data/nrl/nrl-current-squads-2026.json). Model: scripts/nrl/build-nrl-ratings.ts, audit: data/nrl/RATINGS.md. Standalone; not used by the game.",
  generatedAt: GEN,
}, "players", current.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)));

// summary for RATINGS.md
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const reg = seasonOut.filter((s) => s.apps >= 10);
console.log(`season cards ${seasonOut.length}; mean ${mean(seasonOut.map((s) => s.rating)).toFixed(2)}; regulars (10+ games) ${reg.length} mean ${mean(reg.map((s) => s.rating)).toFixed(2)}`);
console.log(`club seasons vs ladder r=${line.r.toFixed(2)} → ${lineAfter.r.toFixed(2)} (${before.length}); shifts ${shifts.length}`);
const c26 = current.filter((c) => c.apps2026 >= 10);
console.log(`2026 players ${current.length}; mean ${mean(current.map((c) => c.rating)).toFixed(2)}; regulars mean ${mean(c26.map((c) => c.rating)).toFixed(2)}`);

// ---------------------------------------------------------------- RATINGS.md (generated audit)
{
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
  const stat = (xs: number[]) => xs.length ? `${xs.length} | ${mean(xs).toFixed(1)} | ${pct(xs, 0.5)} | ${pct(xs, 0.9)} | ${Math.max(...xs)} | ${((100 * xs.filter((x) => x >= 90).length) / xs.length).toFixed(1)}%` : "0 | – | – | – | – | –";
  const L: string[] = [];
  const posName: Record<string, string> = { FB: "Fullback", WG: "Wing", CE: "Centre", SO: "Five-eighth (SO)", SH: "Halfback (SH)", PR: "Prop", HK: "Hooker", SR: "Second row", LF: "Lock (LF)" };
  L.push("# NRL ratings audit", "");
  L.push("Generated by `scripts/nrl/build-nrl-ratings.ts` (re-run it to refresh this file). Standalone: nothing in the game reads these ratings yet.", "");
  L.push("## Scales", "");
  L.push("* **Season (era) cards 1998–2025: 80–99, minimum 80** — the same scale as the Super League era cards (`data/era-season-ratings.json`). File: `data/nrl/nrl-ratings.json` (one row per player-season with the reason).");
  L.push("* **Current 2026 cards: 70–99** — fringe, young and yet-to-debut players can sit in the 70s. File: `data/nrl/nrl-ratings-2026.json` (every player in `nrl-current-squads-2026.json`).", "");
  L.push("## Formula (mirrors `scripts/build-era-ratings.ts`)", "");
  L.push("1. **Peak** per player = 82 + games (1998+ NRL games, +1 per 40, max +5) + scoring (backs +1/+1.5/+2 at 0.30/0.42/0.60 tries a game; forwards and unknown positions +0.5/+1 at 0.25/0.45 — props, hookers and back-rowers are credited through games and selection instead) + representative level (Origin or Australia/New Zealand Test +4, both +5; Tonga/Samoa/Fiji/PNG/England Test +2).");
  L.push("   * Honours **floors**: Dally M Medals + Golden Boots ×1 97, ×2 98, ×3+ 99 (+1 with the Hall of Fame or two Clive Churchill / Wally Lewis medals); Immortal 99; Hall of Fame 96; Dally M Team of the Year ×1 93, ×2 94, ×3 95, ×4+ 96; Origin / Australia–NZ Test 89; other Test nations 87.");
  L.push("   * Honours **caps** (no-one outrates the award winners on games alone): no representative football 89 (under 50 NRL games 87); Pacific/England Test 91; Origin / Australia–NZ Test 93; Team of the Year ×1 95, ×2 96, ×3+ 97; Hall of Fame 98; Medal / Golden Boot 99. Each of the first four gets +1 for a Clive Churchill or Wally Lewis Medal.");
  L.push("2. **Season arc**: Dally M Medal / Golden Boot season = peak (−2 at 21 or under, −1 a year past 32); Team of the Year season = peak − 1 (same age penalty); every other season ≤ peak − age curve (19: −7, 20: −5, 21: −4, 22: −2, 23: −1, 24–32: 0, 33: −1 … 36+: −4) − years from his nearest award season (max 3) − part season (1–2 games −5, 3–7 −3, 8–12 −1). A prime-age (23–31) season of 10+ games within two years of a Team of the Year season is at least peak − 2 − 2×distance; a Clive Churchill / Wally Lewis season at least peak − 2; a premiership season with 15+ games +1 (within his cap).");
  L.push("   * Age comes from `nrl-card-info.json` (date of birth, birth year, or the middle of a birth-year range from a dated age). With none, a player whose first NRL season is after 1998 is taken to be 20 that season, and a Hall of Famer 19 in the first season of his career span (both marked `age est.` in the reason); other 1998 starters with no birth date get no age adjustment.");
  L.push("3. **Club finish**: each club-season's best-13 average against its final ladder position (`nrl-ladders.json`, premiers count as 2nd or better). A least-squares line of rating vs finish is fitted; top-half sides more than a point below the line come up and bottom-half sides more than a point above it come down, by 0.6 × the gap (max 3). Award seasons are left alone.");
  L.push("4. **2026 current**: the 2026 season on the wider scale — part season −8/−5/−2, 2026 ladder ±1 for regulars (top 4 +1, bottom 3 −1), then 2 below the era scale (1 for a 2025 Team of the Year player; the 2026 Dally M Medallist keeps his rating), as Super League current cards sit below its era cards. 2026 Dally M Medal and 2026 Origin debuts count. Squad members with no 2026 game: last season card − 2 a year away; no NRL games: 72 (Top 30) or 70 (development list).", "");
  const reg = seasonOut.filter((s) => s.apps >= 10);
  const cur = current.filter((c) => c.apps2026 >= 10);
  L.push("## Calibration against Super League", "");
  L.push("| | Super League | NRL |", "|---|---|---|");
  L.push(`| Era season cards, mean (all) | 85.8 (6,975 cards, 1996+) | ${mean(seasonOut.map((s) => s.rating)).toFixed(1)} (${seasonOut.length} cards) |`);
  L.push(`| Era cards, first-graders with 10+ games | – | ${mean(reg.map((s) => s.rating)).toFixed(1)} (${reg.length}) |`);
  L.push(`| Current cards, mean | 82.4 (444, old 80 floor) | ${mean(current.map((c) => c.rating)).toFixed(1)} (${current.length}); regulars (10+ 2026 games) ${mean(cur.map((c) => c.rating)).toFixed(1)} |`, "");
  L.push("Decision: the NRL is the stronger league, so an established NRL first-grader (10+ games in a season) averages about 87 on the era scale — 1–1.5 above the average Super League era card — while the whole NRL database (every fringe player AFL Tables lists) averages the same as Super League's. The very best land 97–99 (Johns, Thurston, Smith, Slater, Cronk, Lockyer, Cleary, Tedesco).", "");
  L.push(`Club seasons vs ladder: correlation of best-13 rating with finish r = ${line.r.toFixed(2)} before the club step, ${lineAfter.r.toFixed(2)} after (${before.length} club-seasons; ${shifts.length} sides moved; negative = higher-rated sides finish higher).`, "");
  L.push("## Distribution by position (era cards)", "");
  L.push("Position is the card-info primary position; most journeymen have no sourced position yet (`unknown`).", "");
  L.push("| Position | cards | mean | median | 90th pct | max | ≥90 |", "|---|---|---|---|---|---|---|");
  for (const code of [...Object.keys(posName), "unknown"]) {
    const xs = seasonOut.filter((s) => (info.get(s.playerId)?.primaryPosition ?? "unknown") === code).map((s) => s.rating);
    L.push(`| ${posName[code] ?? "unknown"} | ${stat(xs)} |`);
  }
  L.push("", "## Distribution by era (era cards)", "", "| Seasons | cards | mean | median | 90th pct | max | ≥90 |", "|---|---|---|---|---|---|---|");
  for (const [a, b] of [[1998, 2004], [2005, 2011], [2012, 2018], [2019, 2025]]) {
    L.push(`| ${a}–${b} | ${stat(seasonOut.filter((s) => s.season >= a! && s.season <= b!).map((s) => s.rating))} |`);
  }
  L.push("", "## 2026 current ratings distribution", "", "| Band | players |", "|---|---|");
  for (const [a, b] of [[95, 99], [90, 94], [85, 89], [80, 84], [75, 79], [70, 74]]) L.push(`| ${a}–${b} | ${current.filter((c) => c.rating >= a! && c.rating <= b!).length} |`);
  L.push("", "## Top 50 all-time peaks (1998–2025 season cards)", "", "| # | Player | Best card | Season | Peak reason |", "|---|---|---|---|---|");
  const best = new Map<string, (typeof seasonOut)[number]>();
  for (const s of seasonOut) { const b = best.get(s.playerId); if (!b || s.rating > b.rating) best.set(s.playerId, s); }
  [...best.values()].sort((a, b) => b.rating - a.rating || (peaks.get(b.playerId)!.peak - peaks.get(a.playerId)!.peak) || a.name.localeCompare(b.name)).slice(0, 50)
    .forEach((s, i) => L.push(`| ${i + 1} | ${s.name} | ${s.rating} | ${s.season} | ${peaks.get(s.playerId)!.why.replace(/\|/g, "/")} |`));
  L.push("", "## Top 30 current (2026)", "", "| # | Player | Club | Rating | Why |", "|---|---|---|---|---|");
  current.slice(0, 30).forEach((c, i) => L.push(`| ${i + 1} | ${c.name} | ${c.clubId.replace("nrl-", "")} | ${c.rating} | ${c.why.replace(/\|/g, "/")} |`));
  // sanity checks
  L.push("", "## Sanity checks", "");
  const fringe = seasonOut.filter((s) => { const hh = H0(s.playerId); return s.rating > 90 && !hh.origin && !hh.test && !hh.tier2 && !hh.toty.size && !hh.medal.size && !hh.gb.size && !hh.hof; });
  L.push(`* **No fringe player above 90 without honours** (no Origin, Test, Team of the Year, Medal, Golden Boot or Hall of Fame): ${fringe.length ? `FAIL — ${fringe.length} cards: ${fringe.slice(0, 10).map((s) => `${s.name} ${s.season} (${s.rating})`).join(", ")}` : "pass (0 cards)"}.`);
  const dmFails: string[] = [];
  for (const m of dm.medal) {
    if (!m.playerId || m.season >= CUR) continue;
    const c = seasonOut.find((s) => s.playerId === m.playerId && s.season === m.season);
    if (!c) dmFails.push(`${m.name} ${m.season} (no season card)`); else if (c.rating < 96) dmFails.push(`${m.name} ${m.season} (${c.rating})`);
  }
  const dmCards = dm.medal.filter((m: any) => m.playerId && m.season < CUR).map((m: any) => `${m.name} ${m.season} ${seasonOut.find((s) => s.playerId === m.playerId && s.season === m.season)?.rating ?? "–"}`);
  L.push(`* **Every Dally M Medallist ≥ 96 in his medal season**: ${dmFails.length ? `FAIL — ${dmFails.join(", ")}` : "pass"} (${dmCards.join(" · ")}; 2003 not awarded; 2026 Nathan Cleary — current card ${current.find((c) => c.name === "Nathan Cleary")?.rating}).`);
  const capFails = seasonOut.filter((s) => s.rating < 80 || s.rating > 99).length + current.filter((c) => c.rating < 70 || c.rating > 99).length;
  L.push(`* Ranges: era cards 80–99, current 70–99 — ${capFails ? `FAIL (${capFails})` : "pass"}.`);
  // spot checks
  const SPOT: [string, string][] = [
    ["Andrew Johns", "three Dally M Medals, two Golden Boots, Immortal"], ["Johnathan Thurston", "four Dally M Medals, three Golden Boots"], ["Cameron Smith", "two Medals, two Golden Boots, 400+ games"],
    ["Billy Slater", "Medal 2011, Golden Boot 2008, two Clive Churchills"], ["Darren Lockyer", "two Golden Boots, Team of the Year at FB and SO, Hall of Fame"], ["Cooper Cronk", "two Medals, Golden Boot 2016"],
    ["Greg Inglis", "Golden Boot 2009, Clive Churchill, Hall of Fame"], ["Nathan Cleary", "2026 Medal, two Clive Churchills, 2026 Wally Lewis"], ["James Tedesco", "Medals 2019 and 2025, Team of the Year ×4"],
    ["Jarryd Hayne", "Medals 2009 and 2014"], ["Brad Fittler", "Golden Boot 2000, Team of the Year at SO, Hall of Fame"], ["Payne Haas", "Team of the Year prop ×5, Origin and Test"],
    ["Isaah Yeo", "Golden Boot 2024, Team of the Year lock ×4"], ["Harry Grant", "Golden Boot 2025, Team of the Year hooker"], ["Kalyn Ponga", "Medal 2023, Origin"],
    ["Paul Gallen", "Team of the Year lock ×3, Wally Lewis 2014"], ["Nathan Hindmarsh", "Team of the Year second row ×5, Origin and Test"], ["Shane Webcke", "Team of the Year prop ×3, Hall of Fame"],
    ["Reece Walsh", "2025 Clive Churchill, Origin and Test; young"], ["Josh Addo-Carr", "Origin/Test winger, Team of the Year 2020"],
  ];
  L.push("", "## Spot checks (known stars)", "", "| Player | Peak | Best season card | 2026 | Expected because |", "|---|---|---|---|---|");
  for (const [n, because] of SPOT) {
    const p = players.find((x) => x.name === n);
    if (!p) { L.push(`| ${n} | – | – | – | not in database |`); continue; }
    const b = best.get(p.id);
    const c = current.find((x) => x.playerId === p.id);
    L.push(`| ${n} | ${peaks.get(p.id)!.peak} | ${b ? `${b.rating} (${b.season})` : "–"} | ${c ? c.rating : "–"} | ${because} |`);
  }
  // oddities
  L.push("", "## Things that look off / known limits", "");
  const odd: string[] = [];
  const noAge = new Set(seasonOut.filter((s) => birthYearOf(s.playerId).by === null).map((s) => s.playerId));
  odd.push(`${noAge.size} players (all 1998 starters without a sourced birth date) get no age adjustment, so their late-career seasons are not lowered.`);
  const est = new Set(seasonOut.filter((s) => birthYearOf(s.playerId).how).map((s) => s.playerId));
  odd.push(`${est.size} players have an estimated age (20 in their first NRL season). A late starter (e.g. a 25-year-old debutant) is treated as younger, so his early seasons are rated a little low.`);
  odd.push("Origin and Test selections are known by debut year (and the 2017/2021/2025 tournament squads), not season by season, so representative credit lifts a player's whole career peak rather than the seasons he was picked.");
  odd.push("Positions are sourced for about a third of priority players; the rest are rated with the forward/unknown scoring credit (at most +1), so try-scoring wingers without a sourced position can be a point low.");
  odd.push("Pre-1998 games are not counted, so players who debuted before 1998 (Fittler, Langer, Daley, Ettingshausen …) get less longevity credit; honours floors cover the stars.");
  const twoClub = seasonOut.filter((s) => players.find((p) => p.id === s.playerId)!.seasons.find((x) => x.season === s.season)?.multiClubSeason).length;
  odd.push(`${twoClub} season cards are for players who changed club mid-season; the card uses the first club for the club-finish step.`);
  odd.push("2026 Top-30 lists were found for 11 clubs (Top-30 web lists for 9, plus Rugby League Project pages for Cronulla and the Warriors); Dolphins, Melbourne, Newcastle, North Queensland, Parramatta and South Sydney list only players who played a 2026 game.");
  const hiFew = seasonOut.filter((s) => s.apps <= 3 && s.rating >= 92);
  if (hiFew.length) odd.push(`High cards from very few games (≤3 games, ≥92) — honours-driven, check: ${hiFew.slice(0, 12).map((s) => `${s.name} ${s.season} (${s.apps} g, ${s.rating})`).join(", ")}.`);
  const bigShift = shifts.filter((x) => /→ [+-]3/.test(x));
  if (bigShift.length) odd.push(`Club-season shifts of ±3: ${bigShift.slice(0, 8).join("; ")}.`);
  for (const o of odd) L.push(`* ${o}`);
  fs.writeFileSync(path.join(DATA, "RATINGS.md"), L.join("\n") + "\n");
}
