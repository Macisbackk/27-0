/**
 * The NRL in Manager Mode (v1.64) and the World Club Challenge.
 *
 * The NRL is its own competition: 17 clubs on the real 2026 squads (data/nrl/, built into
 * nrl-career.runtime.json), 27 rounds in which every club plays 24 games and has 3 byes (2 ladder
 * points each, as in the real NRL), then the top-eight finals:
 *   week 1  qualifying finals 1v4 and 2v3 (winners go straight to week 3), elimination finals 5v8 and 6v7
 *   week 2  semi-finals: the qualifying-final losers host the elimination-final winners
 *   week 3  preliminary finals: the qualifying-final winners host the semi-final winners
 *   week 4  the Grand Final.
 * No promotion or relegation, no Challenge Cup. It shares the season calendar with Super League:
 * the rounds sit on Super League's round weeks (plus the Challenge Cup semi-final week), the
 * finals on the Cup final, play-off and Grand Final weeks.
 *
 * The World Club Challenge opens every season (before Round 1): last year's Super League champions
 * v the NRL premiers. Year one uses the real 2025 champions (Hull KR, Brisbane Broncos). The
 * Super League champions host in even years, the NRL premiers in odd ones.
 */
import nrlData from "../players/generated/nrl-career.runtime.json";
import { shuffle, type Rng } from "./rng";
import type { CareerState, Division, Fixture, FixtureKind, Matchday } from "./types";

export const NRL_ROUNDS = 27;
/** Games and byes each club gets over the 27 rounds. */
export const NRL_GAMES = 24;
export const NRL_BYES = 3;
export const NRL_BYE_POINTS = 2;
export const NRL_FINALISTS = 8;

export const NRL_FINALS_LABEL = {
  qf: "Qualifying final",
  ef: "Elimination final",
  sf: "Semi-final",
  pf: "Preliminary final",
  gf: "NRL Grand Final",
} as const;
/** Matchday labels for an NRL manager. */
export const NRL_WEEK_LABEL: Record<NonNullable<Matchday["nrlDraw"]>, string> = {
  "nrl-w1": "Finals week 1",
  "nrl-w2": "Semi-finals",
  "nrl-w3": "Preliminary finals",
  "nrl-gf": "NRL Grand Final",
};
export const WCC_LABEL = "World Club Challenge";

export function isNrlDivision(d: Division | undefined): boolean {
  return d === "nrl";
}

export function isUserNrl(state: Pick<CareerState, "clubs" | "userClubId">): boolean {
  return state.clubs[state.userClubId]?.division === "nrl";
}

/** True for NRL finals (any week, Grand Final included). */
export function isNrlFinalKind(kind: FixtureKind): boolean {
  return kind === "nrl-final" || kind === "nrl-gf";
}

/* ---------------------------------------------------------------- data */

type NrlRecord = { name: string; value: number; years: string };
const DATA = nrlData as unknown as {
  clubs: Array<{ id: string; name: string; short: string; nickname: string; primary: string; secondary: string; accent?: string }>;
  players: Array<{ id: string; name: string; club: string; pos: string; alt?: string[]; rating: number; birthYear: number; nationality: string }>;
  records: Record<string, Partial<Record<"tries" | "goals" | "points" | "apps", NrlRecord>>>;
  premiers: Record<string, string>;
  minorPremiers: Record<string, string>;
};

export const NRL_DATA = DATA;

/** NRL club records since 1998 (data/nrl/, AFL Tables season rows). */
export function nrlSeedRecords(clubId: string): Partial<Record<"tries" | "goals" | "points" | "apps", NrlRecord>> | undefined {
  return DATA.records[clubId];
}

/** Real premierships and minor premierships 1998–2026 for a club (data/nrl/). */
export function nrlHonours(clubId: string): { premierships: number[]; minorPremierships: number[] } {
  const years = (m: Record<string, string>) =>
    Object.entries(m)
      .filter(([, id]) => id === clubId)
      .map(([y]) => Number(y))
      .sort((a, b) => a - b);
  return { premierships: years(DATA.premiers), minorPremierships: years(DATA.minorPremiers) };
}

/* ------------------------------------------------------------- the draw */

/** One NRL round: its games (home, away) and the clubs with a bye. */
export interface NrlRound {
  pairs: Array<[string, string]>;
  byes: string[];
}

/**
 * 27 rounds for 17 clubs, 24 games and 3 byes each (as in the real NRL). Rounds 1–17 are a full
 * round robin (one bye each); rounds 18–27 replay rounds 1–10 with home and away swapped. Twelve
 * of those repeat-round games are then dropped, in twelve different rounds, so every club ends on
 * exactly three byes (no pair loses both its meetings).
 */
export function nrlSchedule(rng: Rng, clubIds: string[]): NrlRound[] {
  const teams = shuffle(rng, clubIds);
  const BYE = "__bye__";
  const ring = teams.length % 2 ? [...teams, BYE] : [...teams];
  const n = ring.length;
  const pass: Array<Array<[string, string]>> = [];
  const order = [...ring];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i]!;
      const b = order[n - 1 - i]!;
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    pass.push(pairs);
    const fixed = order[0]!;
    const rest = order.slice(1);
    rest.unshift(rest.pop()!);
    order.splice(0, n, fixed, ...rest);
  }
  // Even out home games: in each round, the side with fewer home games so far hosts.
  const homes = new Map<string, number>();
  for (const round of pass) {
    round.forEach((p, i) => {
      if (p[0] === BYE || p[1] === BYE) return;
      const [a, b] = p;
      const host = (homes.get(b) ?? 0) < (homes.get(a) ?? 0) ? b : a;
      round[i] = host === a ? [a, b] : [b, a];
      homes.set(host, (homes.get(host) ?? 0) + 1);
    });
  }
  const extra = NRL_ROUNDS - pass.length;
  const rounds: Array<Array<[string, string]>> = [...pass, ...pass.slice(0, extra).map((round) => round.map(([h, a]) => [a, h] as [string, string]))];
  const real = (p: [string, string]) => p[0] !== BYE && p[1] !== BYE;
  const games = rounds.map((round) => round.filter(real));

  // Who needs extra byes: a club already has one bye per pass-1 round it sat out.
  const byes = new Map<string, number>(clubIds.map((id) => [id, 0]));
  rounds.forEach((round) => round.filter((p) => !real(p)).forEach(([h, a]) => byes.set(h === BYE ? a : h, (byes.get(h === BYE ? a : h) ?? 0) + 1)));
  const need = new Map<string, number>(clubIds.map((id) => [id, Math.max(0, NRL_BYES - (byes.get(id) ?? 0))]));
  const totalNeed = [...need.values()].reduce((t, v) => t + v, 0);
  // Candidate rounds: the repeated ones (both copies), so a dropped game's pair still meets once.
  const candidates: Array<{ round: number; i: number }> = [];
  for (let r = 0; r < rounds.length; r++) {
    const repeated = r < extra || r >= pass.length;
    if (!repeated) continue;
    games[r]!.forEach((_, i) => candidates.push({ round: r, i }));
  }
  const pairKey = ([h, a]: [string, string]) => [h, a].sort().join("|");
  let dropped: Array<{ round: number; i: number }> | null = null;
  for (let attempt = 0; attempt < 400 && !dropped && totalNeed % 2 === 0; attempt++) {
    const left = new Map(need);
    const usedRounds = new Set<number>();
    const usedPairs = new Set<string>();
    const picks: Array<{ round: number; i: number }> = [];
    const pool = shuffle(rng, candidates);
    let steps = 0;
    const solve = (): boolean => {
      if (++steps > 5000) return false;
      const club = [...left.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || (rng() < 0.5 ? -1 : 1))[0]?.[0];
      if (!club) return true;
      for (const c of pool) {
        if (usedRounds.has(c.round)) continue;
        const g = games[c.round]![c.i]!;
        if (g[0] !== club && g[1] !== club) continue;
        const other = g[0] === club ? g[1] : g[0];
        if ((left.get(other) ?? 0) <= 0 || usedPairs.has(pairKey(g))) continue;
        usedRounds.add(c.round);
        usedPairs.add(pairKey(g));
        left.set(club, left.get(club)! - 1);
        left.set(other, left.get(other)! - 1);
        picks.push(c);
        if (solve()) return true;
        picks.pop();
        usedRounds.delete(c.round);
        usedPairs.delete(pairKey(g));
        left.set(club, left.get(club)! + 1);
        left.set(other, left.get(other)! + 1);
      }
      return false;
    };
    if (solve()) dropped = picks;
  }
  const drop = new Set((dropped ?? []).map((d) => `${d.round}:${d.i}`));
  return games.map((round, r) => {
    const pairs = round.filter((_, i) => !drop.has(`${r}:${i}`));
    const playing = new Set(pairs.flat());
    return { pairs, byes: clubIds.filter((id) => !playing.has(id)) };
  });
}

/* ------------------------------------------------------------- the calendar */

/**
 * Put the NRL on a calendar built for Super League: round k on the k-th league week (Super League's
 * 26 round weeks plus the Challenge Cup semi-final week), the finals on the last four weeks. For an
 * NRL manager the weeks are labelled the NRL way ("Round 20", "Finals week 1"…).
 */
export function addNrlToCalendar(matchdays: Matchday[], rng: Rng, year: number, clubIds: string[], nrlLabels: boolean): void {
  if (clubIds.length < NRL_FINALISTS) return;
  const schedule = nrlSchedule(rng, clubIds);
  const slots = matchdays
    .filter((m) => /^Round \d+$/.test(m.label) || m.label === "Challenge Cup Semi-final")
    .map((m) => m.index)
    .sort((a, b) => a - b);
  schedule.forEach((round, k) => {
    const md = matchdays[slots[k]!];
    if (!md) return;
    const r = k + 1;
    round.pairs.forEach(([home, away], i) =>
      md.fixtures.push({ id: `${year}-nrl-r${r}-${i}`, kind: "league", round: r, label: `Round ${r}`, division: "nrl", home, away })
    );
    md.byes = round.byes;
    if (nrlLabels) md.label = `Round ${r}`;
  });
  const weeks: Array<[NonNullable<Matchday["nrlDraw"]>, (m: Matchday) => boolean]> = [
    ["nrl-w1", (m) => m.pendingDraw === "cup-final"],
    ["nrl-w2", (m) => m.pendingDraw === "playoff-elims"],
    ["nrl-w3", (m) => m.pendingDraw === "playoff-semis"],
    ["nrl-gf", (m) => m.pendingDraw === "grand-final"],
  ];
  for (const [draw, match] of weeks) {
    const md = matchdays.find(match);
    if (!md) continue;
    md.nrlDraw = draw;
    if (nrlLabels) md.label = NRL_WEEK_LABEL[draw];
  }
  // For an NRL manager, weeks with no NRL game (Challenge Cup rounds) say so.
  if (nrlLabels) {
    for (const m of matchdays) {
      if (m.label.startsWith("Challenge Cup")) m.label = `${m.label} (no NRL)`;
    }
  }
}

/** The World Club Challenge fixture for `year` (Super League champions host in even years). */
export function wccFixture(year: number, sl: string, nrl: string): Fixture {
  const slHosts = year % 2 === 0;
  return {
    id: `${year}-wcc`,
    kind: "wcc",
    round: 1,
    label: WCC_LABEL,
    home: slHosts ? sl : nrl,
    away: slHosts ? nrl : sl,
  };
}

/** Real champions the first World Club Challenge uses (the season before the career starts). */
export const REAL_SL_CHAMPIONS: Record<number, string> = { 2025: "hull-kr" };

/**
 * Who plays this year's World Club Challenge: last year's Super League and NRL Grand Final winners
 * (from this career, or the real champions for the years before it). A club missing from this
 * world falls back to its league's strongest side.
 */
export function wccParticipants(
  state: Pick<CareerState, "clubs" | "champions">,
  year: number,
  strongest: (division: Division) => string | undefined
): { sl: string; nrl: string } | null {
  const last = state.champions?.find((c) => c.year === year - 1);
  const inWorld = (id: string | undefined, division: Division) => (id && state.clubs[id]?.division === division ? id : undefined);
  const sl = inWorld(last?.sl, "super-league") ?? inWorld(REAL_SL_CHAMPIONS[year - 1], "super-league") ?? strongest("super-league");
  const nrl = inWorld(last?.nrl, "nrl") ?? inWorld(DATA.premiers[String(year - 1)], "nrl") ?? strongest("nrl");
  return sl && nrl ? { sl, nrl } : null;
}

/** Remember a season's champions (in place), keeping the last few. */
export function recordChampions(state: CareerState, year: number, sl: string | undefined, nrl: string | undefined): void {
  const list = (state.champions ?? []).filter((c) => c.year !== year);
  list.push({ year, ...(sl ? { sl } : {}), ...(nrl ? { nrl } : {}) });
  state.champions = list.sort((a, b) => a.year - b.year).slice(-6);
}
