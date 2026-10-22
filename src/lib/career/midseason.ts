/**
 * In-season transfer window + Deadline Day.
 *
 * The window opens after Round 10 and shuts when Round 16 kicks off. While it's open:
 * - AI clubs do deals with each other (and with free agents) after every round, so the league
 *   genuinely changes shape mid-season;
 * - rival clubs sometimes bid for your players (accept or turn them down);
 * - you can buy and sell from a market that refreshes every round.
 * The last stop before Round 16 is Deadline Day: a burst of late deals and your last chance.
 * Everything is deterministic per save + round, so reloading never re-rolls a deal.
 */
import { LINEUP_SLOTS, SQUAD_MAX, SQUAD_MIN, effectiveRating, formatMoney, playerValue } from "./players";
import { pick, rngFor, shuffle, type Rng } from "./rng";
import type { CareerPlayer, CareerState, IncomingBid, Pos, TransferDeal } from "./types";

export const WINDOW_OPENS_AFTER_ROUND = 10;
export const WINDOW_CLOSES_BEFORE_ROUND = 16;

const roundIndex = (state: CareerState, round: number) =>
  state.calendar.findIndex((m) => m.label === `Round ${round}`);

/** Matchday indices: first one the window is open for, and Deadline Day (the last). */
export function windowBounds(state: CareerState): { open: number; deadline: number } | null {
  const open = roundIndex(state, WINDOW_OPENS_AFTER_ROUND + 1);
  const deadline = roundIndex(state, WINDOW_CLOSES_BEFORE_ROUND);
  if (open < 0 || deadline < 0 || deadline < open) return null;
  return { open, deadline };
}

export function isWindowOpen(state: CareerState): boolean {
  if (state.phase !== "season") return false;
  const b = windowBounds(state);
  return !!b && state.matchdayIndex >= b.open && state.matchdayIndex <= b.deadline;
}

export function isDeadlineDay(state: CareerState): boolean {
  if (state.phase !== "season") return false;
  const b = windowBounds(state);
  return !!b && state.matchdayIndex === b.deadline;
}

/** Deadline Day stops the clock until the manager says they're done. */
export function deadlineDecisionPending(state: CareerState): boolean {
  return isDeadlineDay(state) && state.deadlineClosedYear !== state.year;
}

/** The manager shuts the window: their business is done and Round 16 can kick off. */
export function closeDeadlineDay(state: CareerState): CareerState {
  if (!deadlineDecisionPending(state)) return state;
  const s: CareerState = structuredClone(state);
  s.deadlineClosedYear = s.year;
  const mine = seasonDeals(s).filter((d) => d.user && d.deadlineDay).length;
  addNews(s, mine ? `Deadline Day done: ${mine} deal${mine === 1 ? "" : "s"} for you. The window is shut.` : "You stood firm on Deadline Day. The window is shut.");
  s.updatedAt = Date.now();
  return s;
}

/** League rounds left before the window shuts (0 on Deadline Day). */
export function roundsLeftInWindow(state: CareerState): number {
  const b = windowBounds(state);
  if (!b) return 0;
  return state.calendar.slice(state.matchdayIndex, b.deadline).filter((m) => m.label.startsWith("Round ")).length;
}

export function seasonDeals(state: CareerState): TransferDeal[] {
  return (state.transfers ?? []).filter((d) => d.year === state.year);
}

function recordDeal(state: CareerState, deal: TransferDeal) {
  state.transfers = [deal, ...(state.transfers ?? [])].slice(0, 120);
}

function dealLine(state: CareerState, d: TransferDeal): string {
  const to = d.to ? state.clubs[d.to]?.name : "free agency";
  const from = d.from ? state.clubs[d.from]?.name : null;
  const fee = d.fee > 0 ? ` for ${formatMoney(d.fee)}` : " on a free";
  return `${d.deadlineDay ? "Deadline Day: " : ""}${to} sign ${d.playerName}${from ? ` from ${from}` : ""}${fee}.`;
}

function addNews(state: CareerState, line: string) {
  state.news = [line, ...state.news].slice(0, 30);
}

function squad(state: CareerState, clubId: string): CareerPlayer[] {
  return (state.clubs[clubId]?.squad ?? []).map((id) => state.players[id]!).filter(Boolean);
}

/** The XIII slot where a club is weakest, and how good its current man there is. */
function weakestSlot(state: CareerState, clubId: string): { pos: Pos; rating: number } | null {
  const players = squad(state, clubId);
  if (players.length === 0) return null;
  const used = new Set<string>();
  let worst: { pos: Pos; rating: number } | null = null;
  for (const slot of LINEUP_SLOTS) {
    const best = players
      .filter((p) => !used.has(p.id))
      .sort((a, b) => effectiveRating(b, slot) - effectiveRating(a, slot))[0];
    if (!best) continue;
    used.add(best.id);
    const r = effectiveRating(best, slot);
    if (!worst || r < worst.rating) worst = { pos: slot, rating: r };
  }
  return worst;
}

const roundFee = (n: number) => Math.max(0, Math.round(n / 5000) * 5000);

/** One AI club tries to strengthen its weakest position. Returns the deal, if any. */
function aiDeal(state: CareerState, rng: Rng, buyerId: string, deadlineDay: boolean): TransferDeal | null {
  const buyer = state.clubs[buyerId];
  if (!buyer || buyer.squad.length >= SQUAD_MAX) return null;
  const need = weakestSlot(state, buyerId);
  if (!need) return null;
  const minRating = need.rating + 2;
  const maxRating = need.rating + (deadlineDay ? 9 : 7);

  type Cand = { p: CareerPlayer; from: string | null };
  const candidates: Cand[] = [];
  for (const club of Object.values(state.clubs)) {
    if (club.id === buyerId || club.id === state.userClubId) continue;
    if (club.squad.length <= SQUAD_MIN + 2) continue;
    // Clubs don't sell their two best players mid-season.
    const sorted = squad(state, club.id).sort((a, b) => b.rating - a.rating);
    for (const p of sorted.slice(2)) {
      if (p.legend || p.pos !== need.pos || p.rating < minRating || p.rating > maxRating) continue;
      candidates.push({ p, from: club.id });
    }
  }
  for (const id of state.freeAgents) {
    const p = state.players[id];
    if (p && !p.legend && p.pos === need.pos && p.rating >= minRating - 1 && p.rating <= maxRating) candidates.push({ p, from: null });
  }
  if (candidates.length === 0) return null;
  const choice = pick(rng, shuffle(rng, candidates).slice(0, 4));
  const fee = choice.from ? roundFee(playerValue(choice.p) * (deadlineDay ? 1.25 : 1.1)) : 0;

  if (choice.from) {
    const seller = state.clubs[choice.from]!;
    seller.squad = seller.squad.filter((id) => id !== choice.p.id);
  } else {
    state.freeAgents = state.freeAgents.filter((id) => id !== choice.p.id);
  }
  buyer.squad.push(choice.p.id);
  return {
    year: state.year,
    at: state.matchdayIndex,
    playerId: choice.p.id,
    playerName: choice.p.name,
    pos: choice.p.pos,
    rating: choice.p.rating,
    from: choice.from,
    to: buyerId,
    fee,
    deadlineDay: deadlineDay || undefined,
  };
}

/** A rival bids for one of your better players (not your legends, not someone you just signed). */
function maybeBid(state: CareerState, rng: Rng): IncomingBid | null {
  const me = state.clubs[state.userClubId]!;
  if (me.squad.length <= SQUAD_MIN) return null;
  const mine = squad(state, me.id)
    .filter((p) => !p.legend && p.signedYear !== state.year)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8);
  if (mine.length === 0) return null;
  const target = pick(rng, mine);
  const bidders = Object.values(state.clubs).filter(
    (c) => c.id !== me.id && c.squad.length < SQUAD_MAX && (c.division === "super-league" || me.division === "championship")
  );
  if (bidders.length === 0) return null;
  const club = pick(rng, bidders);
  const fee = roundFee(playerValue(target) * (1.15 + rng() * 0.35));
  return { clubId: club.id, playerId: target.id, fee, at: state.matchdayIndex };
}

/**
 * Called once each time a new matchday becomes current (after a round is played).
 * Runs the window's AI deals, Deadline Day's late flurry, and rival bids.
 */
export function onMatchdayReached(state: CareerState): void {
  if (state.phase !== "season") return;
  const b = windowBounds(state);
  if (!b) return;
  // A bid lapses once the round it was made before is played.
  if (state.incomingBid && state.incomingBid.at < state.matchdayIndex) {
    const lapsed = state.incomingBid;
    addNews(state, `${state.clubs[lapsed.clubId]?.name ?? "A club"} withdraw their bid for ${state.players[lapsed.playerId]?.name ?? "your player"}.`);
    state.incomingBid = undefined;
  }
  if (state.matchdayIndex < b.open || state.matchdayIndex > b.deadline) {
    if (state.matchdayIndex === b.deadline + 1) addNews(state, "The transfer window has closed.");
    return;
  }
  // Only league rounds move the clock (cup weeks inside the window don't double up deals).
  if (!state.calendar[state.matchdayIndex]?.label.startsWith("Round ")) return;

  const deadline = state.matchdayIndex === b.deadline;
  const rng = rngFor(state.seed, state.year, "midseason", state.matchdayIndex);
  if (state.matchdayIndex === b.open) addNews(state, `Transfer window open until Round ${WINDOW_CLOSES_BEFORE_ROUND} kicks off.`);

  const aiClubs = shuffle(rng, Object.keys(state.clubs).filter((id) => id !== state.userClubId));
  const wanted = deadline ? 5 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
  let done = 0;
  for (const clubId of aiClubs) {
    if (done >= wanted) break;
    const deal = aiDeal(state, rng, clubId, deadline);
    if (!deal) continue;
    recordDeal(state, deal);
    addNews(state, dealLine(state, deal));
    done++;
  }

  if (!state.incomingBid && rng() < (deadline ? 0.6 : 0.3)) {
    const bid = maybeBid(state, rng);
    if (bid) {
      state.incomingBid = bid;
      addNews(state, `${state.clubs[bid.clubId]!.name} bid ${formatMoney(bid.fee)} for ${state.players[bid.playerId]!.name}.`);
    }
  }
}

/** Accept the bid on the table: the player leaves, the fee lands. */
export function acceptBid(state: CareerState): CareerState {
  const bid = state.incomingBid;
  if (!bid || !isWindowOpen(state)) return state;
  const me = state.clubs[state.userClubId]!;
  const buyer = state.clubs[bid.clubId];
  const p = state.players[bid.playerId];
  if (!buyer || !p || !me.squad.includes(p.id) || me.squad.length <= SQUAD_MIN) {
    return { ...state, incomingBid: undefined };
  }
  const s: CareerState = structuredClone(state);
  const mine = s.clubs[s.userClubId]!;
  mine.squad = mine.squad.filter((id) => id !== bid.playerId);
  s.clubs[bid.clubId]!.squad.push(bid.playerId);
  // The caller repairs the XIII (repairLineup lives in season.ts, which imports this file).
  s.lineup = s.lineup.filter((id) => id !== bid.playerId);
  s.budget += bid.fee;
  const deal: TransferDeal = {
    year: s.year,
    at: s.matchdayIndex,
    playerId: p.id,
    playerName: p.name,
    pos: p.pos,
    rating: p.rating,
    from: s.userClubId,
    to: bid.clubId,
    fee: bid.fee,
    deadlineDay: isDeadlineDay(s) || undefined,
    user: true,
  };
  recordDeal(s, deal);
  addNews(s, `Sold ${p.name} to ${buyer.name} for ${formatMoney(bid.fee)}.`);
  s.incomingBid = undefined;
  s.updatedAt = Date.now();
  return s;
}

export function rejectBid(state: CareerState): CareerState {
  const bid = state.incomingBid;
  if (!bid) return state;
  const s: CareerState = structuredClone(state);
  addNews(s, `You turn down ${s.clubs[bid.clubId]?.name ?? "the"} bid for ${s.players[bid.playerId]?.name ?? "your player"}.`);
  s.incomingBid = undefined;
  s.updatedAt = Date.now();
  return s;
}

/** Record a user buy/sell made during the window so it shows in the deals list. */
export function recordUserDeal(state: CareerState, deal: Omit<TransferDeal, "year" | "at" | "user" | "deadlineDay">): void {
  recordDeal(state, { ...deal, year: state.year, at: state.matchdayIndex, user: true, deadlineDay: isDeadlineDay(state) || undefined });
}

/** Players who joined this club during the current season (for the "New" tag). */
export function newArrivals(state: CareerState, clubId: string): Set<string> {
  return new Set(seasonDeals(state).filter((d) => d.to === clubId).map((d) => d.playerId));
}
