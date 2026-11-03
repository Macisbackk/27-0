import { legendAsPlayer, legendById } from "./legends";
import {
  BENCH_SIZE,
  LINEUP_SLOTS,
  SQUAD_MAX,
  SQUAD_MIN,
  SQUAD_TEMPLATE,
  effectiveRating,
  formatMoney,
  generatePlayer,
  playerWage,
  transferFee,
  wageBill,
  wagesDueNow,
} from "./players";
import { randInt, rngFor, shuffle } from "./rng";
import { contractOf, newDealLength, runDownContracts } from "./contracts";
import { buyersFor, pickBuyer } from "./buyers";
import { isWindowOpen, recordDeal, windowStatus } from "./midseason";
import { academySummer } from "./academy";
import { pushEvent } from "./events";
import { tagNews } from "./news";
import { aiLegendSigning, legendAvailable, legendSummer, signLegend } from "./legend-moves";
import { autoPickTeam, fixTeam, repairTeam, squadOf, startSeason, userClub } from "./season";
import { codeOfDivision, type Code } from "./clubs";
import type { CareerPlayer, CareerState, Pos } from "./types";

/** Which game a club plays in: the NRL, or Super League and the Championship. */
export function clubCode(state: Pick<CareerState, "clubs">, clubId: string | null | undefined): Code | null {
  const d = clubId ? state.clubs[clubId]?.division : undefined;
  return d ? codeOfDivision(d) : null;
}

/** NRL salary cap (v1.65): an NRL club's season wage bill can't go past it with a signing. */
export const NRL_SALARY_CAP = 2_400_000;
/** Fee premium for signing a player from the other code (an NRL club buying from Super League, or the other way). */
export const CROSS_CODE_PREMIUM = 1.5;
/** Clubs from the other code whose players show up in a window's market. */
const CROSS_CODE_CLUBS = 4;

export interface MarketListing {
  playerId: string;
  /** Club selling, or null for a free agent / legend. */
  fromClubId: string | null;
  /** Transfer fee. Always 0 for a free agent (he only costs wages); a legend's one-off signing fee. */
  price: number;
  /** His wages for a full season. */
  wages: number;
  legend?: boolean;
}

/** A free agent: no club holds his contract, so there's no fee — only wages. */
export function isFreeAgentListing(l: Pick<MarketListing, "fromClubId" | "legend">): boolean {
  return !l.fromClubId && !l.legend;
}

/** Highest-rated established player who'll join a club of this prestige. */
export function prestigeRatingCap(prestige: number): number {
  return Math.round(79 + prestige * 2.5);
}

/** Season appearances that count as a full season of game time for development. */
export const FULL_SEASON_APPS = 16;

/**
 * How much game time a player had last season, 0–1 (v1.66): young men grow with games.
 * Academy prospects train without first-team games and count as part-time.
 */
export function gameTimeShare(p: Pick<CareerPlayer, "apps">, academyProspect = false): number {
  if (academyProspect) return 0.55;
  return Math.max(0, Math.min(1, (p.apps ?? 0) / FULL_SEASON_APPS));
}

/**
 * A summer older. Young players (23 and under) grow towards their potential, faster with games:
 * a regular gets up to about 1.2× the old rate, a man who barely played about 0.4×.
 */
export function developPlayer(rngRoll: () => number, p: CareerPlayer, share = gameTimeShare(p)) {
  p.age += 1;
  if (p.age <= 23) {
    const room = Math.max(0, p.potential - p.rating);
    // Academy kids who got first-team games last season come on faster.
    const games = p.academy && p.age <= 22 ? (p.apps >= 12 ? 2 : p.apps >= 5 ? 1 : 0) : 0;
    const base = Math.floor(rngRoll() * 4) + (room > 6 ? 1 : 0);
    p.rating += Math.min(room, Math.round(base * (0.4 + 0.8 * share)) + games);
  } else if (p.age <= 28) {
    const room = Math.max(0, p.potential - p.rating);
    if (room > 0 && rngRoll() < 0.25 + 0.25 * share) p.rating += 1;
  } else if (p.age <= 31) {
    if (rngRoll() < 0.5) p.rating -= 1;
  } else {
    p.rating -= 1 + Math.floor(rngRoll() * 3);
  }
  // NRL stars start above 95 (Cleary 98): they keep their level rather than drop to the old cap.
  p.rating = Math.max(55, Math.min(99, p.rating));
}

function retires(rngRoll: () => number, p: CareerPlayer): boolean {
  if (p.age >= 36) return true;
  if (p.age >= 34) return rngRoll() < 0.55;
  if (p.age >= 33) return rngRoll() < 0.2;
  return false;
}

/** Level used when topping up an AI squad: a touch below its current XIII. */
/** Typical first-team level of each division on the 27-0 rating scale (2026 squads). */
const DIVISION_ANCHOR = { "super-league": 81, championship: 74, nrl: 82.5 } as const;

/**
 * Level used when topping up an AI squad. Pulled halfway toward the division norm so the
 * world stays on the real rating scale over decades (no slow inflation or deflation).
 */
function clubLevel(state: CareerState, clubId: string): number {
  const anchor = DIVISION_ANCHOR[state.clubs[clubId]?.division ?? "championship"];
  const squad = squadOf(state, clubId).sort((a, b) => b.rating - a.rating).slice(0, 13);
  if (squad.length === 0) return anchor;
  const current = squad.reduce((s, p) => s + p.rating, 0) / squad.length - 2;
  return (current + anchor) / 2;
}

function topUpSquad(state: CareerState, clubId: string, target = 24) {
  const rng = rngFor(state.seed, state.year, "topup", clubId);
  const club = state.clubs[clubId]!;
  const level = clubLevel(state, clubId);
  const counts: Record<Pos, number> = { FB: 0, WG: 0, CE: 0, SO: 0, SH: 0, PR: 0, HK: 0, SR: 0, LF: 0 };
  for (const p of squadOf(state, clubId)) counts[p.pos]++;
  let guard = 0;
  while (club.squad.length < target && guard++ < 60) {
    const neediest = (Object.keys(SQUAD_TEMPLATE) as Pos[]).sort(
      (a, b) => counts[a] - SQUAD_TEMPLATE[a] - (counts[b] - SQUAD_TEMPLATE[b])
    )[0]!;
    // AI clubs' academies: the first man up each summer is one of their own kids (18–19). He starts
    // a little below the first team and tops out around it, so the world's level doesn't creep up.
    const kid = guard === 1 && clubId !== state.userClubId;
    const p = generatePlayer(rng, {
      clubId,
      pos: neediest,
      level: kid ? level - 3 : level,
      maxPotential: Math.round(level + (kid ? 3 : 5)),
      idPrefix: `g${state.year}`,
      ...(kid ? { age: randInt(rng, 18, 19) } : {}),
    });
    state.players[p.id] = p;
    club.squad.push(p.id);
    counts[neediest]++;
  }
}

/**
 * Season review → the summer: ageing, development, retirements, contracts running down and
 * academy intake. Lands on the "departures" screen; the transfer window opens after it.
 */
export function beginOffseason(state: CareerState): CareerState {
  if (state.phase !== "review") return state;
  const s: CareerState = structuredClone(state);
  const rng = rngFor(s.seed, s.year, "offseason");
  const retired: NonNullable<CareerState["departures"]>["retired"] = [];
  const legendNews: string[] = [];
  const legendNewsClubs: string[] = [];

  // Last summer's +N comes off; the user's men get this summer's.
  for (const p of Object.values(s.players)) delete p.grew;
  const growth: NonNullable<NonNullable<CareerState["departures"]>["growth"]> = [];
  for (const club of Object.values(s.clubs)) {
    club.squad = club.squad.filter((id) => {
      const p = s.players[id];
      if (!p) return false;
      // Legends keep their level (a point a summer) and retire 2–3 seasons after signing.
      if (p.legend) {
        if (!legendSummer(s, p)) return true;
        if (club.id === s.userClubId) {
          retired.push({ name: p.name, pos: p.pos, age: p.age, rating: p.rating });
          pushEvent(s, {
            id: `legend-retired:${s.year}:${p.id}`,
            kind: "legend-retired",
            year: s.year,
            clubId: club.id,
            playerId: p.id,
            name: p.name,
            rating: p.rating,
            title: `${p.name} retires`,
            text: `${p.name} retires. What a servant.`,
            options: [{ id: "ok", label: "Thanks, legend" }],
          });
        } else {
          legendNews.push(`${p.name} retires at ${club.name}.`);
          legendNewsClubs.push(club.id);
        }
        delete s.players[id];
        return false;
      }
      const from = p.rating;
      developPlayer(rng, p);
      if (retires(rng, p)) {
        if (club.id === s.userClubId) retired.push({ name: p.name, pos: p.pos, age: p.age, rating: p.rating });
        delete s.players[id];
        return false;
      }
      if (club.id === s.userClubId && p.rating !== from) {
        p.grew = p.rating - from;
        if (p.age <= 24 || p.grew >= 2) growth.push({ name: p.name, pos: p.pos, age: p.age, from, to: p.rating, apps: p.apps });
      }
      return true;
    });
  }
  // Unattached players age and retire too (and are gone for good, like everyone else who retires).
  s.freeAgents = s.freeAgents.filter((id) => {
    const p = s.players[id];
    if (!p || p.legend) return false;
    developPlayer(rng, p);
    if (retires(rng, p) || p.age >= 34) {
      delete s.players[id];
      return false;
    }
    return true;
  });

  // Contracts count down; the user decides on anyone whose deal has run out.
  const expiring = runDownContracts(s);

  // Academy prospects grow too (the new intake arrives in pre-season); 20-year-olds still there leave.
  for (const id of s.academy ?? []) {
    const p = s.players[id];
    if (p) developPlayer(rng, p, gameTimeShare(p, true));
  }
  const academyLeft = academySummer(s);

  for (const id of Object.keys(s.clubs)) if (id !== s.userClubId) topUpSquad(s, id);
  purgeOrphans(s);
  // Last season's team sheets would show retired and departed men: club sheets start afresh.
  s.lastLineups = undefined;

  growth.sort((a, b) => b.to - b.from - (a.to - a.from) || b.to - a.to);
  s.departures = { year: s.year, retired, expiring, academy: [], growth: growth.filter((g) => g.to > g.from).slice(0, 8) };
  s.year += 1;
  s.seasonNumber += 1;
  fixTeam(s);
  s.phase = "departures";
  s.news = [
    ...(academyLeft.length ? [`Left the academy: ${academyLeft.join(", ")}.`] : []),
    ...(retired.length ? [`Retired: ${retired.map((r) => r.name).join(", ")}.`] : []),
    ...legendNews,
    ...(expiring.length ? [`Out of contract: ${expiring.map((id) => s.players[id]?.name).join(", ")}.`] : []),
    ...s.news,
  ].slice(0, 30);
  legendNews.forEach((line, i) => tagNews(s, line, [legendNewsClubs[i]]));
  s.updatedAt = Date.now();
  return s;
}

/** Drop records of players who are in no squad and not a free agent (retired, or lost by older versions). */
function purgeOrphans(s: CareerState) {
  const keep = new Set<string>([...s.freeAgents, ...(s.academy ?? [])]);
  for (const c of Object.values(s.clubs)) for (const id of c.squad) keep.add(id);
  for (const id of Object.keys(s.players)) if (!keep.has(id)) delete s.players[id];
  s.freeAgents = [...new Set(s.freeAgents)].filter((id) => !!s.players[id]);
}

/**
 * Departures → transfer window. Anyone still undecided leaves on a free; the squad is topped
 * up to the minimum if the summer left it short.
 */
export function finishDepartures(state: CareerState): CareerState {
  if (state.phase !== "departures") return state;
  const s: CareerState = structuredClone(state);
  const me = userClub(s);
  // Only players still at the club can leave on a free.
  const leaving = (s.departures?.expiring ?? []).filter((id) => me.squad.includes(id));
  const leavingNames = leaving.map((id) => s.players[id]?.name ?? id);
  for (const id of leaving) {
    me.squad = me.squad.filter((x) => x !== id);
    const p = s.players[id];
    if (p?.legend) delete s.players[id];
    else if (p) {
      p.contract = undefined;
      p.leftClubId = s.userClubId;
      p.leftYear = s.year;
      if (!s.freeAgents.includes(id)) s.freeAgents.push(id);
    }
  }
  if (s.departures) {
    s.departures.released = [...(s.departures.released ?? []), ...leavingNames];
    s.departures.expiring = [];
  }
  if (me.squad.length < SQUAD_MIN) topUpSquad(s, me.id, SQUAD_MIN);
  for (const id of me.squad) {
    const p = s.players[id];
    if (p && !(typeof p.contract === "number" && p.contract > 0)) p.contract = contractOf(p);
  }
  fixTeam(s);
  s.phase = "transfers";
  s.news = [
    `Transfer window open until the season kicks off. Budget ${formatMoney(s.budget)}.`,
    ...(leaving.length ? [`Left on a free: ${leavingNames.join(", ")}.`] : []),
    ...s.news,
  ].slice(0, 30);
  s.updatedAt = Date.now();
  return s;
}

/** Players the user can buy this window (deterministic per year so refreshes don't re-roll). */
export function buildMarket(state: CareerState, unlockedLegends: string[], salt = ""): MarketListing[] {
  // No salt = the summer list (same seed as before, so saves mid-window keep their list).
  const rng = salt ? rngFor(state.seed, state.year, "market", salt) : rngFor(state.seed, state.year, "market");
  const cap = prestigeRatingCap(state.prestige);
  const userSquad = new Set(userClub(state).squad);
  const listings: MarketListing[] = [];

  // Players at other clubs who'd move: not their club's very best, under the prestige cap.
  // Clubs in your own game first; a few clubs from the other code list someone too, at a premium
  // (an NRL star to Super League, or a Super League man heading down under).
  const myCode = clubCode(state, state.userClubId);
  const ids = shuffle(rng, Object.keys(state.clubs));
  const crossClubs = new Set(
    ids.filter((id) => clubCode(state, id) !== myCode && state.clubs[id]!.division !== "championship").slice(0, CROSS_CODE_CLUBS)
  );
  for (const clubId of ids) {
    if (clubId === state.userClubId) continue;
    const cross = clubCode(state, clubId) !== myCode;
    if (cross && !crossClubs.has(clubId)) continue;
    const squad = squadOf(state, clubId).sort((a, b) => b.rating - a.rating);
    if (squad.length <= SQUAD_MIN + 1) continue;
    const available = squad.slice(2).filter((p) => p.rating <= cap && !p.legend);
    for (const p of shuffle(rng, available).slice(0, 1)) {
      listings.push({ playerId: p.id, fromClubId: clubId, price: transferFee(p, cross ? 1.2 * CROSS_CODE_PREMIUM : 1.2), wages: playerWage(p) });
    }
  }
  // Free agents: no fee, just wages. Same prestige pull as anyone else, and not a man you let go
  // (or sold to nobody) this year.
  for (const id of state.freeAgents) {
    const p = state.players[id];
    if (!p || p.legend || userSquad.has(id) || p.rating > cap) continue;
    if (p.leftClubId === state.userClubId && p.leftYear === state.year) continue;
    listings.push({ playerId: id, fromClubId: null, price: 0, wages: playerWage(p) });
  }

  // Unlocked legends (not at a club, yours or anyone's, and not retired in this career).
  for (const legendId of unlockedLegends) {
    const card = legendById(legendId);
    if (!card || userSquad.has(`legend-${card.id}`) || !legendAvailable(state, `legend-${card.id}`)) continue;
    listings.push({ playerId: `legend-${card.id}`, fromClubId: null, price: card.signingFee, wages: playerWage(legendAsPlayer(card)), legend: true });
  }

  const regular = listings.filter((l) => !l.legend);
  const legends = listings.filter((l) => l.legend);
  const ranked = regular
    .map((l) => ({ l, r: state.players[l.playerId]?.rating ?? 0 }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.l);
  // A mix: the strongest few, plus a random spread so the list feels different every summer.
  const top = ranked.slice(0, 8);
  const rest = shuffle(rng, ranked.slice(8)).slice(0, 10);
  return [...legends, ...top, ...rest];
}

export type TransferError = "budget" | "squad-full" | "squad-min" | "not-available" | "lineup" | "window-shut" | "salary-cap";

/** An NRL club's wage bill with this player added (null for Super League and Championship clubs: no cap). */
export function wagesAfterSigning(state: CareerState, playerWages: number): number | null {
  if (userClub(state).division !== "nrl") return null;
  return wageBill(squadOf(state, state.userClubId)) + playerWages;
}

/** What signing this listing costs right now: the fee (none for a free agent) plus any wages due now. */
export function signingCost(state: CareerState, listing: MarketListing): { fee: number; wagesNow: number; total: number } {
  const p = listing.legend ? (() => {
    const card = legendById(listing.playerId.replace(/^legend-/, ""));
    return card ? legendAsPlayer(card) : undefined;
  })() : state.players[listing.playerId];
  const fee = isFreeAgentListing(listing) ? 0 : listing.price;
  const wagesNow = p ? wagesDueNow(state, p) : 0;
  return { fee, wagesNow, total: fee + wagesNow };
}

export function buyPlayer(
  state: CareerState,
  listing: MarketListing
): { state: CareerState; error?: TransferError } {
  const club = userClub(state);
  if (!isWindowOpen(state)) return { state, error: "window-shut" };
  // A stale or hand-made listing can't charge a fee for a free agent.
  if (isFreeAgentListing(listing) && listing.price !== 0) listing = { ...listing, price: 0 };
  const cost = signingCost(state, listing);
  if (state.budget < cost.total) return { state, error: "budget" };
  if (club.squad.length >= SQUAD_MAX) return { state, error: "squad-full" };
  // The NRL's salary cap: no signing that takes the wage bill past it.
  const capped = wagesAfterSigning(state, listing.wages);
  if (capped != null && capped > NRL_SALARY_CAP) return { state, error: "salary-cap" };
  const s: CareerState = structuredClone(state);
  const me = userClub(s);

  if (listing.legend) {
    const card = legendById(listing.playerId.replace(/^legend-/, ""));
    if (!card) return { state, error: "not-available" };
    // Already at a club (double tap / stale listing)? Then he isn't available.
    if (!legendAvailable(s, `legend-${card.id}`)) return { state, error: "not-available" };
    // Exactly the vault's "plays at" rating, on a deal that runs until he retires.
    s.players[`legend-${card.id}`] = signLegend(s, card);
    s.freeAgents = s.freeAgents.filter((id) => id !== `legend-${card.id}`);
  } else {
    const p = s.players[listing.playerId];
    if (!p) return { state, error: "not-available" };
    if (listing.fromClubId) {
      const seller = s.clubs[listing.fromClubId];
      if (!seller || !seller.squad.includes(p.id)) return { state, error: "not-available" };
      seller.squad = seller.squad.filter((id) => id !== p.id);
    } else {
      if (!s.freeAgents.includes(p.id)) return { state, error: "not-available" };
      if (p.leftClubId === s.userClubId && p.leftYear === s.year) return { state, error: "not-available" };
      s.freeAgents = s.freeAgents.filter((id) => id !== p.id);
    }
  }
  me.squad.push(listing.playerId);
  s.budget -= cost.total;
  const np = s.players[listing.playerId]!;
  np.signedYear = s.year;
  np.fee = cost.fee;
  np.leftClubId = undefined;
  np.leftYear = undefined;
  // New signings come on a fresh deal (legends until they retire).
  if (!listing.legend) np.contract = Math.max(2, newDealLength(np.age));
  if (s.phase === "season") s.lastWages = wageBill(squadOf(s, s.userClubId));
  // A signing who's better than the weakest starter in his position goes straight into the XIII
  // (a 94-rated legend used to sit in the squad until you picked him yourself).
  const startsNow = putInLineupIfBetter(s, np);
  const wageNote = cost.wagesNow > 0 ? ` (${formatMoney(cost.wagesNow)} wages for the rest of the season)` : "";
  s.news = [
    cost.fee > 0
      ? `Signed ${np.name} for ${formatMoney(cost.fee)}${wageNote}.`
      : `Signed ${np.name} on a free: ${formatMoney(playerWage(np))}/yr wages${wageNote}.`,
    ...(startsNow === "xiii"
      ? [`${np.name} goes straight into your starting XIII.`]
      : startsNow === "bench"
        ? [`${np.name} goes on the bench.`]
        : []),
    ...s.news,
  ].slice(0, 30);
  s.updatedAt = Date.now();
  return { state: s };
}

/**
 * Swap a new signing into the XIII when he outrates the weakest starter in his position's slots
 * (the man he replaces drops to the bench if he's better than the weakest bench man). A signing
 * who doesn't start but beats the weakest bench man goes on the bench.
 */
function putInLineupIfBetter(s: CareerState, np: CareerPlayer): "xiii" | "bench" | null {
  const team = repairTeam(s, s.lineup ?? [], s.bench ?? []);
  const lineup = team.lineup;
  let bench = team.bench.filter((id) => id !== np.id);
  const wasOnBench = bench.length < team.bench.length;
  const tryBench = (id: string): boolean => {
    const p = s.players[id];
    if (!p) return false;
    if (bench.length < BENCH_SIZE) {
      bench.push(id);
      return true;
    }
    let weakest = 0;
    bench.forEach((b, i) => {
      if ((s.players[b]?.rating ?? 0) < (s.players[bench[weakest]!]?.rating ?? 0)) weakest = i;
    });
    if (p.rating <= (s.players[bench[weakest]!]?.rating ?? 0)) return false;
    bench = bench.map((b, i) => (i === weakest ? id : b));
    return true;
  };
  let worst = -1;
  let worstScore = Infinity;
  LINEUP_SLOTS.forEach((slot, i) => {
    if (slot !== np.pos) return;
    const cur = s.players[lineup[i] ?? ""];
    const score = cur ? effectiveRating(cur, slot) : -Infinity;
    if (score < worstScore) {
      worstScore = score;
      worst = i;
    }
  });
  let placed: "xiii" | "bench" | null = null;
  // A legend always starts in his position (the weakest man there drops to the bench).
  if (worst >= 0 && (np.legend || effectiveRating(np, np.pos) > worstScore)) {
    const dropped = lineup[worst];
    lineup[worst] = np.id;
    if (dropped) tryBench(dropped);
    placed = "xiii";
  } else if (wasOnBench || tryBench(np.id)) {
    if (wasOnBench) bench.push(np.id);
    placed = "bench";
  }
  const fixed = repairTeam(s, lineup, bench);
  s.lineup = fixed.lineup;
  s.bench = fixed.bench;
  return placed;
}

export function sellPrice(state: CareerState, playerId: string): number {
  const p = state.players[playerId];
  if (!p) return 0;
  let price = transferFee(p, 0.9);
  // Legends are a reward, not an investment: they leave for at most half what you paid.
  if (p.legend) price = Math.min(price, Math.round(((p.fee ?? legendById(playerId.replace(/^legend-/, ""))?.signingFee ?? 0) * 0.5) / 5000) * 5000);
  // No instant flipping: anyone sold in the window you bought them goes for at most what you paid.
  if (p.signedYear === state.year && p.fee != null) price = Math.min(price, p.fee);
  return price;
}

export interface SaleResult {
  state: CareerState;
  error?: TransferError;
  /** Club the player joined (null = nobody had room, so he's a free agent; legends go back to the vault). */
  soldTo?: string | null;
  /** Why they wanted him, e.g. "short of props". */
  reason?: string;
  fee?: number;
}

export function sellPlayer(state: CareerState, playerId: string): SaleResult {
  const club = userClub(state);
  // Selling happens in a window, never while the season review or contract decisions are open.
  if (state.phase === "review" || state.phase === "departures") return { state, error: "not-available" };
  if (!isWindowOpen(state)) return { state, error: "window-shut" };
  if (!club.squad.includes(playerId)) return { state, error: "not-available" };
  if (club.squad.length <= SQUAD_MIN) return { state, error: "squad-min" };
  const s: CareerState = structuredClone(state);
  const me = userClub(s);
  const p = s.players[playerId]!;
  const price = sellPrice(s, playerId);
  const wagesSaved = wagesDueNow(s, p);
  me.squad = me.squad.filter((id) => id !== playerId);
  // The fee, plus the rest of his season's wages off the bill (nothing extra in the summer window).
  s.budget += price + wagesSaved;
  if (s.phase === "season") s.lastWages = wageBill(squadOf(s, s.userClubId));

  let soldTo: string | null = null;
  let reason: string | undefined;
  let line: string;
  if (p.legend) {
    delete s.players[playerId];
    line = `Sold ${p.name} for ${formatMoney(price)}. He goes back to the Legend Vault.`;
  } else {
    // He joins a club that actually needs a player in his position (and has room for him).
    const buyer = pickBuyer(s, p, rngFor(s.seed, s.year, "sell", playerId, s.matchdayIndex));
    if (buyer) {
      soldTo = buyer.clubId;
      reason = buyer.reason;
      s.clubs[buyer.clubId]!.squad.push(playerId);
      p.signedYear = s.year;
      p.fee = price;
      p.contract = Math.max(2, newDealLength(p.age));
      line = `Sold ${p.name} to ${s.clubs[buyer.clubId]!.name} for ${formatMoney(price)}. They were ${buyer.reason}.`;
    } else {
      p.contract = undefined;
      p.leftClubId = s.userClubId;
      p.leftYear = s.year;
      if (!s.freeAgents.includes(playerId)) s.freeAgents.push(playerId);
      line = `Sold ${p.name} for ${formatMoney(price)}. He's now a free agent.`;
    }
  }
  fixTeam(s);
  s.news = [line, ...s.news].slice(0, 30);
  s.updatedAt = Date.now();
  return { state: s, soldTo, reason, fee: price };
}

/** Close the window and kick off the new season. */
export function finishTransfers(state: CareerState): CareerState {
  if (state.phase !== "transfers") return state;
  const s: CareerState = structuredClone(state);
  // Still the summer window: AI clubs pick up free agents they need (no fee), then top up.
  aiSignFreeAgents(s);
  // Now and then a Super League club brings one of its legends home.
  aiLegendSigning(s);
  for (const id of Object.keys(s.clubs)) if (id !== s.userClubId) topUpSquad(s, id);
  // New season, best XIII (so new signings play); the user can still change it.
  Object.assign(s, autoPickTeam(s));
  const next = startSeason(s);
  next.news = [`The window stays open through pre-season and shuts when the season kicks off.`, ...next.news].slice(0, 30);
  return next;
}

/** Most free agents an AI club signs in one summer. */
const AI_FREE_SIGNINGS = 2;

/**
 * Summer window: AI clubs sign free agents who'd fill a gap (a position they're short in or an
 * upgrade on a starter) and are good enough for them. No fee — free agents never cost one.
 */
export function aiSignFreeAgents(s: CareerState): void {
  if (windowStatus(s).kind !== "summer") return;
  const signed: Record<string, number> = {};
  const pool = s.freeAgents
    .map((id) => s.players[id])
    .filter((p): p is CareerPlayer => !!p && !p.legend)
    .sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  for (const p of pool) {
    const need = buyersFor(s, p).find((n) => {
      const club = s.clubs[n.clubId]!;
      return (signed[n.clubId] ?? 0) < AI_FREE_SIGNINGS && club.squad.length < 30 && n.score >= 3 && p.rating >= clubLevel(s, n.clubId) - 4;
    });
    if (!need) continue;
    s.freeAgents = s.freeAgents.filter((id) => id !== p.id);
    s.clubs[need.clubId]!.squad.push(p.id);
    signed[need.clubId] = (signed[need.clubId] ?? 0) + 1;
    p.contract = newDealLength(p.age);
    p.signedYear = s.year;
    p.fee = 0;
    p.leftClubId = undefined;
    p.leftYear = undefined;
    recordDeal(s, { year: s.year, at: 0, playerId: p.id, playerName: p.name, pos: p.pos, rating: p.rating, from: null, to: need.clubId, fee: 0, summer: true });
  }
}
