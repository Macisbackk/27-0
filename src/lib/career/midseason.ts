/**
 * In-season transfers happen on one day only: Deadline Day, the stop before Round 16.
 * (Kept simple on purpose: no deals between rounds, just one big day.)
 * On Deadline Day: a 12-hour clock counts down, and deals, offers for
 * your players and fresh names on the market land as it runs. The window shuts at 0:00.
 * Everything is deterministic per save + round (+ half-hour slot), so reloading never re-rolls a deal.
 */
import { LINEUP_SLOTS, SQUAD_MAX, SQUAD_MIN, effectiveRating, formatMoney, playerValue } from "./players";
import { buyersFor } from "./buyers";
import { pick, rngFor, shuffle, type Rng } from "./rng";
import type { CareerPlayer, CareerState, DeadlineClock, DeadlineOffer, Pos, TransferDeal } from "./types";

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

/** In-season transfers: Deadline Day only, until its clock hits 0:00 (or you shut it). */
export function isWindowOpen(state: CareerState): boolean {
  return deadlineDecisionPending(state);
}

/** League rounds until Deadline Day (null once it's been). */
export function roundsUntilDeadline(state: CareerState): number | null {
  if (state.phase !== "season") return null;
  const b = windowBounds(state);
  if (!b || state.matchdayIndex >= b.deadline) return null;
  return state.calendar.slice(state.matchdayIndex, b.deadline).filter((m) => m.label.startsWith("Round ")).length;
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

/** The manager shuts the window early: the rest of the day plays out without them and Round 16 can kick off. */
export function closeDeadlineDay(state: CareerState): CareerState {
  if (!deadlineDecisionPending(state)) return state;
  return tickDeadline(state, Math.max(1, deadlineClock(state).minutesLeft), { quiet: true });
}

// ---------------------------------------------------------------------------------------------
// Deadline Day clock
// ---------------------------------------------------------------------------------------------

export const DEADLINE_MINUTES = 12 * 60;
const SLOT_MINUTES = 30;
const SLOTS = DEADLINE_MINUTES / SLOT_MINUTES;
const MAX_OPEN_OFFERS = 3;

function freshClock(state: CareerState): DeadlineClock {
  return {
    year: state.year,
    minutesLeft: DEADLINE_MINUTES,
    slotsDone: 0,
    offers: [],
    feed: [{ at: DEADLINE_MINUTES, kind: "info", text: "Deadline Day! 12 hours until the window slams shut." }],
  };
}

/** Today's clock (a fresh one if the save predates it). */
export function deadlineClock(state: CareerState): DeadlineClock {
  const d = state.deadline;
  const ok =
    !!d &&
    d.year === state.year &&
    Number.isFinite(d.minutesLeft) &&
    d.minutesLeft >= 0 &&
    d.minutesLeft <= DEADLINE_MINUTES &&
    Number.isInteger(d.slotsDone) &&
    Array.isArray(d.offers) &&
    Array.isArray(d.feed);
  return ok ? d! : freshClock(state);
}

/** "11:30" style countdown. */
export function clockLabel(minutesLeft: number): string {
  const m = Math.max(0, Math.round(minutesLeft));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Which batch of late listings the market is showing (changes every 3 hours). */
export function deadlineMarketBatch(state: CareerState): number {
  return Math.floor(deadlineClock(state).slotsDone / 6);
}

function feed(clock: DeadlineClock, kind: DeadlineClock["feed"][number]["kind"], text: string) {
  clock.feed = [{ at: clock.minutesLeft, kind, text }, ...clock.feed].slice(0, 40);
}

/** Open offers that haven't lapsed, for players still at your club. */
export function liveOffers(state: CareerState): DeadlineOffer[] {
  if (!deadlineDecisionPending(state)) return [];
  const clock = deadlineClock(state);
  const mine = new Set(state.clubs[state.userClubId]?.squad ?? []);
  return clock.offers.filter((o) => o.expiresAt < clock.minutesLeft && mine.has(o.playerId));
}

function makeOffer(state: CareerState, clock: DeadlineClock, rng: Rng): DeadlineOffer | null {
  const me = state.clubs[state.userClubId]!;
  if (me.squad.length <= SQUAD_MIN) return null;
  const mine = squad(state, me.id)
    .filter((p) => !p.legend && p.signedYear !== state.year)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
  if (mine.length === 0) return null;
  const open = clock.offers;
  // Sometimes a second club goes for a player who already has an offer: a bidding war.
  const contested = open.length && rng() < 0.35 ? mine.filter((p) => open.some((o) => o.playerId === p.id)) : [];
  const target = contested.length ? pick(rng, contested) : pick(rng, mine.filter((p) => !open.some((o) => o.playerId === p.id)).concat(mine).slice(0, 10));
  const already = open.filter((o) => o.playerId === target.id);
  const needs = buyersFor(state, target).filter(
    (n) =>
      !already.some((o) => o.clubId === n.clubId) &&
      (state.clubs[n.clubId]!.division === "super-league" || me.division === "championship")
  );
  if (needs.length === 0) return null;
  const need = pick(rng, needs.slice(0, 4));
  const best = Math.max(0, ...already.map((o) => o.fee));
  const fee = best > 0 ? roundFee(best * (1.1 + rng() * 0.15)) : roundFee(playerValue(target) * (1.15 + rng() * 0.35));
  const life = SLOT_MINUTES * (3 + Math.floor(rng() * 3)); // 1.5 to 2.5 hours
  return {
    id: `${clock.year}-${clock.slotsDone}-${need.clubId}-${target.id}`,
    clubId: need.clubId,
    playerId: target.id,
    fee,
    madeAt: clock.minutesLeft,
    expiresAt: Math.max(0, clock.minutesLeft - life),
    reason: need.reason,
    raised: best > 0 || undefined,
  };
}

/** One half-hour of Deadline Day: AI deals (busier as the clock runs down), offers, late listings. */
function runSlot(state: CareerState, clock: DeadlineClock, slot: number, quiet: boolean) {
  const rng = rngFor(state.seed, state.year, "deadline", slot);
  const progress = slot / SLOTS;
  const dealChance = 0.15 + 0.5 * progress;
  const attempts = slot >= SLOTS - 1 ? 2 : 1;
  for (let a = 0; a < attempts; a++) {
    if (rng() >= dealChance) continue;
    for (const clubId of shuffle(rng, Object.keys(state.clubs).filter((id) => id !== state.userClubId)).slice(0, 6)) {
      const deal = aiDeal(state, rng, clubId, true);
      if (!deal) continue;
      recordDeal(state, deal);
      const line = dealLine(state, deal);
      addNews(state, line);
      feed(clock, "deal", line.replace(/^Deadline Day: /, ""));
      break;
    }
  }
  if (!quiet && clock.offers.length < MAX_OPEN_OFFERS && rng() < (slot >= SLOTS - 6 ? 0.3 : 0.2)) {
    const offer = makeOffer(state, clock, rng);
    if (offer) {
      clock.offers = [offer, ...clock.offers];
      const club = state.clubs[offer.clubId]!.name;
      const name = state.players[offer.playerId]!.name;
      const line = offer.raised ? `${club} trump that with ${formatMoney(offer.fee)} for ${name}!` : `${club} bid ${formatMoney(offer.fee)} for ${name}.`;
      feed(clock, "offer", line);
      addNews(state, `Deadline Day: ${line}`);
    }
  }
  if (!quiet && slot % 6 === 0 && slot < SLOTS) feed(clock, "market", "Fresh names on the market.");
}

/**
 * Run Deadline Day's clock forward. Each half-hour crossed has its own events. At 0:00 the window
 * shuts. `quiet` = the manager has walked away: no more offers for them, the rest of the league
 * still does its deals.
 */
export function tickDeadline(state: CareerState, minutes: number, opts: { quiet?: boolean } = {}): CareerState {
  if (!deadlineDecisionPending(state) || !(minutes > 0)) return state;
  const s: CareerState = structuredClone(state);
  const clock = deadlineClock(s);
  s.deadline = clock;
  const target = Math.max(0, clock.minutesLeft - minutes);
  while (clock.slotsDone < SLOTS && DEADLINE_MINUTES - (clock.slotsDone + 1) * SLOT_MINUTES >= target) {
    clock.slotsDone += 1;
    clock.minutesLeft = DEADLINE_MINUTES - clock.slotsDone * SLOT_MINUTES;
    // Offers whose time is up lapse before anything new lands.
    lapseOffers(s, clock, !!opts.quiet);
    runSlot(s, clock, clock.slotsDone, !!opts.quiet);
  }
  clock.minutesLeft = target;
  lapseOffers(s, clock, !!opts.quiet || target === 0);
  if (target === 0) {
    s.deadlineClosedYear = s.year;
    clock.paused = undefined;
    const mine = seasonDeals(s).filter((d) => d.user && d.deadlineDay).length;
    feed(clock, "info", "0:00. The window is shut.");
    addNews(
      s,
      mine ? `Deadline Day done: ${mine} deal${mine === 1 ? "" : "s"} for you. The window is shut.` : "The window is shut. You stood firm on Deadline Day."
    );
  }
  s.updatedAt = Date.now();
  return s;
}

function lapseOffers(state: CareerState, clock: DeadlineClock, all: boolean) {
  const keep: DeadlineOffer[] = [];
  for (const o of clock.offers) {
    if (all || o.expiresAt >= clock.minutesLeft || !state.clubs[state.userClubId]!.squad.includes(o.playerId)) {
      if (!all && state.clubs[state.userClubId]!.squad.includes(o.playerId)) {
        feed(clock, "offer", `${state.clubs[o.clubId]?.name ?? "A club"} pull out of the deal for ${state.players[o.playerId]?.name ?? "your player"}.`);
      }
      continue;
    }
    keep.push(o);
  }
  clock.offers = keep;
}

export function pauseDeadline(state: CareerState, paused: boolean): CareerState {
  if (!deadlineDecisionPending(state)) return state;
  const clock = deadlineClock(state);
  if (!!clock.paused === paused && state.deadline) return state;
  return { ...state, deadline: { ...clock, paused: paused || undefined }, updatedAt: Date.now() };
}

export type OfferError = "gone" | "squad-min" | "no-room";

/** Accept a Deadline Day offer: the player joins the bidding club, the fee lands, other offers for him go. */
export function acceptOffer(state: CareerState, offerId: string): { state: CareerState; error?: OfferError } {
  const offer = liveOffers(state).find((o) => o.id === offerId);
  if (!offer) return { state, error: "gone" };
  const me = state.clubs[state.userClubId]!;
  if (me.squad.length <= SQUAD_MIN) return { state, error: "squad-min" };
  const buyer = state.clubs[offer.clubId];
  if (!buyer || buyer.squad.length >= SQUAD_MAX) return { state, error: "no-room" };
  const s: CareerState = structuredClone(state);
  const clock = deadlineClock(s);
  s.deadline = clock;
  const p = s.players[offer.playerId]!;
  const mine = s.clubs[s.userClubId]!;
  mine.squad = mine.squad.filter((id) => id !== p.id);
  s.clubs[offer.clubId]!.squad.push(p.id);
  s.lineup = s.lineup.filter((id) => id !== p.id); // caller repairs the XIII
  s.budget += offer.fee;
  p.signedYear = s.year;
  p.fee = offer.fee;
  recordDeal(s, {
    year: s.year,
    at: s.matchdayIndex,
    playerId: p.id,
    playerName: p.name,
    pos: p.pos,
    rating: p.rating,
    from: s.userClubId,
    to: offer.clubId,
    fee: offer.fee,
    deadlineDay: true,
    user: true,
  });
  const others = clock.offers.filter((o) => o.playerId === p.id && o.id !== offer.id).length;
  clock.offers = clock.offers.filter((o) => o.playerId !== p.id);
  const line = `You sell ${p.name} to ${s.clubs[offer.clubId]!.name} for ${formatMoney(offer.fee)}.`;
  feed(clock, "you", others ? `${line} ${others === 1 ? "The other bid falls away." : "The other bids fall away."}` : line);
  addNews(s, `Sold ${p.name} to ${s.clubs[offer.clubId]!.name} for ${formatMoney(offer.fee)}.`);
  s.updatedAt = Date.now();
  return { state: s };
}

export function rejectOffer(state: CareerState, offerId: string): CareerState {
  const offer = liveOffers(state).find((o) => o.id === offerId);
  if (!offer) return state;
  const s: CareerState = structuredClone(state);
  const clock = deadlineClock(s);
  s.deadline = clock;
  clock.offers = clock.offers.filter((o) => o.id !== offerId);
  feed(clock, "you", `You turn down ${s.clubs[offer.clubId]?.name ?? "the"} bid for ${s.players[offer.playerId]?.name ?? "your player"}.`);
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

/**
 * Called once each time a new matchday becomes current (after a round is played).
 * Runs the window's AI deals, Deadline Day's late flurry, and rival bids.
 */
export function onMatchdayReached(state: CareerState): void {
  if (state.phase !== "season") return;
  const b = windowBounds(state);
  if (!b) return;
  // Older saves could have a between-rounds bid open: it lapses.
  if (state.incomingBid && state.incomingBid.at < state.matchdayIndex) state.incomingBid = undefined;
  if (state.matchdayIndex !== b.deadline) return;
  // Deadline Day runs on its own 12-hour clock (tickDeadline); nothing lands until it starts.
  if (state.deadlineClosedYear !== state.year && state.deadline?.year !== state.year) {
    state.deadline = freshClock(state);
    addNews(state, "Deadline Day! 12 hours until the window shuts.");
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
  const dd = isDeadlineDay(state);
  recordDeal(state, { ...deal, year: state.year, at: state.matchdayIndex, user: true, deadlineDay: dd || undefined });
  if (dd && deadlinePendingRaw(state)) {
    const clock = deadlineClock(state);
    state.deadline = clock;
    const to = deal.to ? state.clubs[deal.to]?.name : null;
    const from = deal.from ? state.clubs[deal.from]?.name : null;
    const fee = deal.fee > 0 ? formatMoney(deal.fee) : "a free";
    feed(clock, "you", deal.to === state.userClubId ? `You sign ${deal.playerName}${from ? ` from ${from}` : ""} for ${fee}.` : `You sell ${deal.playerName}${to ? ` to ${to}` : ""} for ${fee}.`);
    // Offers for a player you've just sold elsewhere fall away.
    clock.offers = clock.offers.filter((o) => o.playerId !== deal.playerId);
  }
}

const deadlinePendingRaw = (state: CareerState) => state.deadlineClosedYear !== state.year;

/** Players who joined this club during the current season (for the "New" tag). */
export function newArrivals(state: CareerState, clubId: string): Set<string> {
  return new Set(seasonDeals(state).filter((d) => d.to === clubId).map((d) => d.playerId));
}
