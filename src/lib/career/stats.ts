/**
 * Player stats, match ratings, league leaders and club records (Hall of Fame).
 *
 * Every match (user and AI, quick sim and live) is rated once it's played: each of the 17 gets a
 * mark out of 10 (one decimal) from what he did (tries, goals), how his team did (result, margin),
 * whether he was sent off, and starter vs bench minutes, nudged a little by his rating so stars
 * average higher. Seeded per fixture, so the same game always gets the same marks. Player of the
 * Match is the top mark.
 */
import recordsData from "../../../data/club-records.json";
import { nrlSeedRecords } from "./nrl";
import { rngFor } from "./rng";
import type { CareerPlayer, CareerState, ClubRecord, ClubTotals, Division, Fixture, FixtureResult, RecordKind } from "./types";
import type { TeamSheet } from "./match";

/* ------------------------------------------------------------------ ratings */

export const RATING_MIN = 3;
export const RATING_MAX = 10;
/** Fewest games for the average-rating leaderboard. */
export const LEADER_MIN_APPS = 5;

/** The side's goal-kicker: the best-rated of the halves and full-back still on the field. */
export function goalKicker(lineup: readonly string[], players: Record<string, CareerPlayer>, sentOff: readonly string[] = []): string | undefined {
  let best: CareerPlayer | undefined;
  // Halfbacks first (scrum-half, stand-off), then the full-back, on equal ratings.
  for (const slot of [6, 5, 0]) {
    const id = lineup[slot];
    const p = id ? players[id] : undefined;
    if (!p || sentOff.includes(p.id)) continue;
    if (!best || p.rating > best.rating) best = p;
  }
  if (best) return best.id;
  return lineup.find((id) => players[id] && !sentOff.includes(id));
}

/** Goals (conversions + penalties) a side kicked: whatever isn't tries or a one-point drop goal. */
export function goalsFrom(score: number, tries: number): number {
  return Math.max(0, Math.floor((score - tries * 4) / 2));
}

function count(list: readonly string[], id: string): number {
  let n = 0;
  for (const x of list) if (x === id) n++;
  return n;
}

export interface MatchRatings {
  ratings: Record<string, number>;
  /** Goals kicked by each side's kicker. */
  goals: Record<string, number>;
  motm?: string;
}

/**
 * Rate both 17s for a played result. Deterministic for (seed, fixture id). Ties for Player of the
 * Match go to the winning side, then the better player.
 */
export function rateMatch(
  seed: string | number,
  fixtureId: string,
  home: TeamSheet,
  away: TeamSheet,
  r: FixtureResult,
  players: Record<string, CareerPlayer>
): MatchRatings {
  const rng = rngFor(seed, fixtureId, "ratings");
  const ratings: Record<string, number> = {};
  const goals: Record<string, number> = {};
  const sides = [
    { sheet: home, us: r.homeScore, them: r.awayScore, tries: r.homeTries, red: r.homeSentOff ?? [] },
    { sheet: away, us: r.awayScore, them: r.homeScore, tries: r.awayTries, red: r.awaySentOff ?? [] },
  ];
  for (const side of sides) {
    const kicker = goalKicker(side.sheet.lineup, players, side.red);
    const g = goalsFrom(side.us, side.tries.length);
    if (kicker && g > 0) goals[kicker] = (goals[kicker] ?? 0) + g;
    const margin = side.us - side.them;
    // Team result: a win lifts everyone (more for a big one), a heavy defeat drags everyone down.
    const team =
      margin > 0 ? 0.35 + Math.min(0.6, margin * 0.022) : margin < 0 ? -0.3 - Math.min(0.6, -margin * 0.02) - (margin <= -24 ? 0.3 : 0) : 0.05;
    const seventeen = [...side.sheet.lineup.map((id) => ({ id, bench: false })), ...(side.sheet.bench ?? []).map((id) => ({ id, bench: true }))];
    for (const { id, bench } of seventeen) {
      const p = players[id];
      if (!p || id in ratings) continue;
      const tries = count(side.tries, id);
      const kicks = goals[id] ?? 0;
      // Fewer minutes off the bench: less chance to shine (or to sink).
      const share = bench ? 0.6 : 1;
      let v = 6.25 + (p.rating - 76) * 0.035;
      v += share * team;
      v += tries * 0.75 + (tries >= 3 ? 0.4 : 0);
      v += kicks * 0.12;
      // Forwards rarely score: a little credit for the graft when the pack wins the battle.
      if (!tries && ["PR", "HK", "SR", "LF"].includes(p.pos) && margin > 0) v += 0.15 * share;
      // Seeded spread: some days it just clicks.
      v += (rng() + rng() - 1) * 0.9 * share;
      if (bench) v -= 0.15;
      if (side.red.includes(id)) v = Math.min(v - 2.2, 4.5);
      ratings[id] = Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, v)) * 10) / 10;
    }
  }
  const winners = new Set(r.homeScore >= r.awayScore ? [...home.lineup, ...(home.bench ?? [])] : [...away.lineup, ...(away.bench ?? [])]);
  let motm: string | undefined;
  for (const id of Object.keys(ratings)) {
    if (!motm) {
      motm = id;
      continue;
    }
    const a = ratings[id]!;
    const b = ratings[motm]!;
    if (a > b || (a === b && (winners.has(id) && !winners.has(motm) || (winners.has(id) === winners.has(motm) && (players[id]!.rating > players[motm]!.rating || (players[id]!.rating === players[motm]!.rating && id < motm)))))) motm = id;
  }
  return { ratings, goals, motm };
}

/* ------------------------------------------------------------------ crediting */

function totalsFor(p: CareerPlayer, clubId: string): ClubTotals {
  const all = (p.clubTotals ??= {});
  return (all[clubId] ??= { apps: 0, ratingSum: 0 });
}

/**
 * Credit one side's 17 after a match (in place): appearances, tries, goals and match ratings, for
 * the season, the career and at this club.
 */
export function creditSide(state: CareerState, clubId: string, sheet: TeamSheet, tries: readonly string[], rated: MatchRatings): void {
  const seen = new Set<string>();
  for (const id of [...sheet.lineup, ...(sheet.bench ?? [])]) {
    const p = state.players[id];
    if (!p || seen.has(id)) continue;
    seen.add(id);
    const t = totalsFor(p, clubId);
    p.apps++;
    p.careerApps++;
    t.apps++;
    const mark = rated.ratings[id];
    if (mark != null) {
      p.rated = (p.rated ?? 0) + 1;
      p.ratingSum = Math.round(((p.ratingSum ?? 0) + mark) * 10) / 10;
      t.ratingSum = Math.round((t.ratingSum + mark) * 10) / 10;
    }
    const g = rated.goals[id] ?? 0;
    if (g) {
      p.goals = (p.goals ?? 0) + g;
      p.careerGoals = (p.careerGoals ?? 0) + g;
      t.goals = (t.goals ?? 0) + g;
    }
  }
  for (const id of tries) {
    const p = state.players[id];
    if (!p) continue;
    p.tries++;
    p.careerTries++;
    const t = totalsFor(p, clubId);
    t.tries = (t.tries ?? 0) + 1;
  }
}

/** Season average match rating (one decimal), or null before his first rated game. */
export function avgRating(p: Pick<CareerPlayer, "rated" | "ratingSum">): number | null {
  return p.rated ? Math.round(((p.ratingSum ?? 0) / p.rated) * 10) / 10 : null;
}

export function pointsOf(tries: number, goals: number): number {
  return tries * 4 + goals * 2;
}

/* ------------------------------------------------------------------ squad stats */

export interface PlayerStatRow {
  id: string;
  name: string;
  pos: CareerPlayer["pos"];
  apps: number;
  tries: number;
  goals: number;
  points: number;
  avg: number | null;
  /** Totals at this club in this career. */
  clubApps: number;
  clubTries: number;
  clubGoals: number;
  clubPoints: number;
  clubAvg: number | null;
}

export function playerStatRow(p: CareerPlayer, clubId: string): PlayerStatRow {
  const t = p.clubTotals?.[clubId];
  const goals = p.goals ?? 0;
  return {
    id: p.id,
    name: p.name,
    pos: p.pos,
    apps: p.apps,
    tries: p.tries,
    goals,
    points: pointsOf(p.tries, goals),
    avg: avgRating(p),
    clubApps: t?.apps ?? 0,
    clubTries: t?.tries ?? 0,
    clubGoals: t?.goals ?? 0,
    clubPoints: t ? pointsOf(t.tries ?? 0, t.goals ?? 0) : 0,
    clubAvg: t?.apps ? Math.round((t.ratingSum / t.apps) * 10) / 10 : null,
  };
}

export function squadStats(state: CareerState, clubId: string = state.userClubId): PlayerStatRow[] {
  return (state.clubs[clubId]?.squad ?? [])
    .map((id) => state.players[id])
    .filter((p): p is CareerPlayer => !!p)
    .map((p) => playerStatRow(p, clubId));
}

/* ------------------------------------------------------------------ league leaders */

export interface LeaderRow {
  playerId: string;
  name: string;
  clubId: string;
  value: number;
  apps: number;
}

/** Top try scorers and best average match ratings (min LEADER_MIN_APPS games) in a division. */
export function leagueLeaders(state: CareerState, division: Division, limit = 10): { tries: LeaderRow[]; ratings: LeaderRow[] } {
  const rows: Array<{ p: CareerPlayer; clubId: string }> = [];
  for (const c of Object.values(state.clubs)) {
    if (c.division !== division) continue;
    for (const id of c.squad) {
      const p = state.players[id];
      if (p) rows.push({ p, clubId: c.id });
    }
  }
  const tries = rows
    .filter((x) => x.p.tries > 0)
    .sort((a, b) => b.p.tries - a.p.tries || a.p.apps - b.p.apps || b.p.rating - a.p.rating || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => ({ playerId: x.p.id, name: x.p.name, clubId: x.clubId, value: x.p.tries, apps: x.p.apps }));
  const ratings = rows
    .filter((x) => (x.p.rated ?? 0) >= LEADER_MIN_APPS)
    .map((x) => ({ ...x, avg: (x.p.ratingSum ?? 0) / (x.p.rated ?? 1) }))
    .sort((a, b) => b.avg - a.avg || (b.p.rated ?? 0) - (a.p.rated ?? 0) || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => ({ playerId: x.p.id, name: x.p.name, clubId: x.clubId, value: Math.round(x.avg * 10) / 10, apps: x.p.rated ?? 0 }));
  return { tries, ratings };
}

/* ------------------------------------------------------------------ club records */

export const RECORD_KINDS: RecordKind[] = ["tries", "goals", "points", "apps"];
export const RECORD_LABEL: Record<RecordKind, string> = { tries: "Tries", goals: "Goals", points: "Points", apps: "Appearances" };
const RECORD_NOUN: Record<RecordKind, string> = { tries: "try", goals: "goals", points: "points", apps: "appearances" };
const RECORD_PLURAL: Record<RecordKind, string> = { tries: "tries", goals: "goals", points: "points", apps: "appearances" };

type SeedRecords = Partial<Record<RecordKind, ClubRecord>> & { sources?: string[]; notes?: string };
const SEED = (recordsData as { clubs: Record<string, SeedRecords> }).clubs;

/** The real all-time records a club starts with (empty where we found no reliable figure). */
export function seedRecords(clubId: string): Partial<Record<RecordKind, ClubRecord>> {
  // NRL clubs (v1.65): their records since 1998 from data/nrl/ (AFL Tables season rows).
  const nrl = clubId.startsWith("nrl-") ? nrlSeedRecords(clubId) : undefined;
  if (nrl) {
    const out: Partial<Record<RecordKind, ClubRecord>> = {};
    for (const k of RECORD_KINDS) if (nrl[k]) out[k] = { ...nrl[k]! };
    return out;
  }
  const r = SEED[clubId];
  if (!r) return {};
  const out: Partial<Record<RecordKind, ClubRecord>> = {};
  for (const k of RECORD_KINDS) if (r[k]) out[k] = { ...r[k]! };
  return out;
}

export function recordSources(clubId: string): string[] {
  if (clubId.startsWith("nrl-")) return ["NRL era only (1998–2026): AFL Tables season scorers"];
  return SEED[clubId]?.sources ?? [];
}

function totalOf(t: ClubTotals, kind: RecordKind): number {
  const tries = t.tries ?? 0;
  const goals = t.goals ?? 0;
  return kind === "apps" ? t.apps : kind === "tries" ? tries : kind === "goals" ? goals : pointsOf(tries, goals);
}

export interface HallOfFameRow {
  kind: RecordKind;
  /** The record (real or broken in this career); null when there's no real figure and nobody has played yet. */
  record: ClubRecord | null;
  /** True when the club has no real figure for this record: the holder is this career's best. */
  careerOnly: boolean;
  /** The best current squad player at the club and how far off he is. */
  chaser?: { playerId: string; name: string; value: number };
}

/** A club's records right now: the real seed, overridden by anything set in this career. */
export function clubRecord(state: CareerState, clubId: string, kind: RecordKind): ClubRecord | undefined {
  return state.clubRecords?.[clubId]?.[kind] ?? seedRecords(clubId)[kind];
}

export function hallOfFame(state: CareerState, clubId: string): HallOfFameRow[] {
  const seed = seedRecords(clubId);
  const squad = (state.clubs[clubId]?.squad ?? []).map((id) => state.players[id]).filter((p): p is CareerPlayer => !!p);
  return RECORD_KINDS.map((kind) => {
    let chaser: HallOfFameRow["chaser"];
    for (const p of squad) {
      const t = p.clubTotals?.[clubId];
      const v = t ? totalOf(t, kind) : 0;
      if (v > 0 && (!chaser || v > chaser.value)) chaser = { playerId: p.id, name: p.name, value: v };
    }
    return { kind, record: clubRecord(state, clubId, kind) ?? null, careerOnly: !seed[kind], chaser };
  });
}

/**
 * After a match: has anyone in these 17 passed his club's record (in place)? A real record broken
 * at the user's club makes a pop-up and the news. Where the club has no real figure, the best in
 * this career simply holds it (no fanfare: it was never a real record).
 */
export function checkRecords(state: CareerState, clubId: string, ids: readonly string[]): void {
  const seed = seedRecords(clubId);
  for (const id of ids) {
    const p = state.players[id];
    const t = p?.clubTotals?.[clubId];
    if (!p || !t) continue;
    for (const kind of RECORD_KINDS) {
      const value = totalOf(t, kind);
      if (value <= 0) continue;
      const cur = clubRecord(state, clubId, kind);
      if (cur?.playerId === p.id) {
        if (value > cur.value) setRecord(state, clubId, kind, { ...cur, value });
        continue;
      }
      if (cur && value <= cur.value) continue;
      setRecord(state, clubId, kind, { name: p.name, value, playerId: p.id, year: state.year });
      if (!seed[kind] || clubId !== state.userClubId) continue;
      const club = state.clubs[clubId]!;
      const surname = p.name.split(" ").slice(-1)[0] ?? p.name;
      const title = `${surname} breaks the club ${RECORD_NOUN[kind]} record!`;
      const old = cur ?? seed[kind]!;
      state.events = [
        ...(state.events ?? []).filter((e) => e.id !== `club-record:${clubId}:${kind}:${p.id}`),
        {
          id: `club-record:${clubId}:${kind}:${p.id}`,
          kind: "club-record",
          year: state.year,
          title,
          text: `He passes ${old.name}'s ${old.value} ${RECORD_PLURAL[kind]} for ${club.name}.`,
          clubId,
          playerId: p.id,
          name: p.name,
          rating: p.rating,
          options: [{ id: "ok", label: "Legend" }],
        },
      ];
      state.news = [title, ...state.news].slice(0, 30);
    }
  }
}

function setRecord(state: CareerState, clubId: string, kind: RecordKind, rec: ClubRecord) {
  const all = (state.clubRecords ??= {});
  all[clubId] = { ...(all[clubId] ?? {}), [kind]: rec };
}

/**
 * Rate, credit and check records for a played fixture (in place). Only the user's latest game keeps
 * its ratings (shown with the last result); older games and other clubs' games drop them.
 */
export function settleFixture(state: CareerState, f: Fixture, home: TeamSheet, away: TeamSheet): void {
  const r = f.result;
  if (!r) return;
  const rated = rateMatch(state.seed, `${state.year}:${f.id}`, home, away, r, state.players);
  creditSide(state, f.home, home, r.homeTries, rated);
  creditSide(state, f.away, away, r.awayTries, rated);
  if (rated.motm) r.motm = rated.motm;
  if (f.home === state.userClubId || f.away === state.userClubId) {
    for (const m of state.calendar) for (const x of m.fixtures) if (x.result?.ratings) delete x.result.ratings;
    r.ratings = rated.ratings;
  } else delete r.ratings;
  checkRecords(state, f.home, [...home.lineup, ...(home.bench ?? [])]);
  checkRecords(state, f.away, [...away.lineup, ...(away.bench ?? [])]);
  // Other clubs' try scorers are credited above and never shown again: drop them (v1.65, saves
  // stay small with the NRL running alongside). Your own games keep theirs.
  if (f.home !== state.userClubId && f.away !== state.userClubId) {
    r.homeTries = [];
    r.awayTries = [];
    // Player of the Match is only shown for finals (the Clive Churchill Medal is the NRL Grand Final's).
    if (f.kind === "league") delete r.motm;
  }
}
