/**
 * Pre-season friendlies: before Round 1 the manager can arrange up to two warm-up games.
 * Each one played gives the XIII a little match sharpness for the opening three rounds
 * and brings in gate money (home) or an appearance fee (away). Deterministic per save + year.
 */
import { formatMoney } from "./players";
import { rngFor, shuffle } from "./rng";
import { clubRating, sheetFor } from "./season";
import { simulateMatch } from "./match";
import type { CareerState, FriendlyResult } from "./types";

export const MAX_FRIENDLIES = 2;
/** Rating bonus per friendly played, for the first SHARPNESS_ROUNDS matchdays. */
export const SHARPNESS_PER_FRIENDLY = 0.5;
export const SHARPNESS_ROUNDS = 3;

export interface FriendlyOption {
  opponentId: string;
  home: boolean;
  label: "Big test" | "Even game" | "Easy run-out";
  money: number;
}

export function preseasonOpen(state: CareerState): boolean {
  return state.phase === "season" && state.matchdayIndex === 0 && !(state.preseason?.year === state.year && state.preseason.done);
}

/** Six options: two tougher sides, two around your level, two easier. */
export function friendlyOptions(state: CareerState): FriendlyOption[] {
  const rng = rngFor(state.seed, state.year, "friendlies");
  const me = clubRating(state, state.userClubId);
  const others = Object.keys(state.clubs)
    .filter((id) => id !== state.userClubId)
    .map((id) => ({ id, gap: clubRating(state, id) - me }));
  const pickFrom = (list: typeof others, n: number) => shuffle(rng, list).slice(0, n);
  const tough = pickFrom(others.filter((o) => o.gap > 1.5), 2);
  const even = pickFrom(others.filter((o) => Math.abs(o.gap) <= 1.5), 2);
  const easy = pickFrom(others.filter((o) => o.gap < -1.5), 2);
  const out: FriendlyOption[] = [];
  const add = (o: { id: string }, label: FriendlyOption["label"], i: number) => {
    const home = i % 2 === 0;
    const opp = state.clubs[o.id]!;
    const draw = opp.division === "super-league" ? 45_000 : 20_000;
    out.push({ opponentId: o.id, home, label, money: home ? draw : 10_000 });
  };
  tough.forEach((o, i) => add(o, "Big test", i));
  even.forEach((o, i) => add(o, "Even game", i + 1));
  easy.forEach((o, i) => add(o, "Easy run-out", i));
  return out;
}

/** Play the chosen friendlies (or none) and close pre-season. */
export function playFriendlies(state: CareerState, picks: FriendlyOption[]): CareerState {
  if (!preseasonOpen(state)) return state;
  const s: CareerState = structuredClone(state);
  const results: FriendlyResult[] = [];
  // Each opponent once, at most two games, whatever the caller sends.
  const unique = picks.filter((p, i) => picks.findIndex((q) => q.opponentId === p.opponentId) === i);
  for (const [i, opt] of unique.slice(0, MAX_FRIENDLIES).entries()) {
    const rng = rngFor(s.seed, s.year, "friendly", i, opt.opponentId);
    const mine = { ...sheetFor(s, s.userClubId), boost: 0 };
    const theirs = sheetFor(s, opt.opponentId);
    const r = simulateMatch(rng, opt.home ? mine : theirs, opt.home ? theirs : mine, s.players, { knockout: false });
    const us = opt.home ? r.homeScore : r.awayScore;
    const them = opt.home ? r.awayScore : r.homeScore;
    results.push({ opponentId: opt.opponentId, home: opt.home, us, them, money: opt.money });
    s.budget += opt.money;
  }
  s.preseason = { year: s.year, done: true, results };
  if (results.length) {
    const line = results
      .map((r) => `${r.us > r.them ? "beat" : r.us < r.them ? "lost to" : "drew with"} ${s.clubs[r.opponentId]?.name} ${r.us}-${r.them}`)
      .join(", ");
    const cash = results.reduce((t, r) => t + r.money, 0);
    s.news = [`Pre-season: you ${line}. ${formatMoney(cash)} banked and the squad is match-sharp.`, ...s.news].slice(0, 30);
  }
  s.updatedAt = Date.now();
  return s;
}

/** Rating bonus the user's XIII carries into the opening rounds. */
export function sharpnessBoost(state: CareerState): number {
  const pre = state.preseason;
  if (!pre || pre.year !== state.year || state.matchdayIndex >= SHARPNESS_ROUNDS) return 0;
  return pre.results.length * SHARPNESS_PER_FRIENDLY;
}
