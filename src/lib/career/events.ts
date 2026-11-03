/**
 * Hub pop-ups: legend signings by AI clubs, legend retirements, and a few rare random events
 * (a transfer request, a record bid, a sponsor windfall, a wonderkid, a takeover at a rival).
 * Queued in the save, shown one at a time, each once. Everything is seeded per save.
 */
import { ACADEMY_MAX } from "./academy";
import { pickBuyer } from "./buyers";
import { recordDeal } from "./midseason";
import { tagNews } from "./news";
import { SQUAD_MAX, SQUAD_MIN, formatMoney, generatePlayer, transferFee, wageBill, wagesDueNow } from "./players";
import { pick, randInt, rngFor } from "./rng";
import { rivalsOf } from "./rivals";
import { fixTeam, squadOf, userFixture } from "./season";
import type { CareerEvent, CareerPlayer, CareerState } from "./types";

/** Seen pop-ups kept in the save (so a reload never shows one twice). */
const KEEP_SEEN = 20;

/** Add a pop-up (in place). Same id twice is ignored. */
export function pushEvent(s: CareerState, e: Omit<CareerEvent, "seen">): void {
  const list = s.events ?? [];
  if (list.some((x) => x.id === e.id)) return;
  s.events = [...list, { ...e }];
}

/** The next pop-up to show, if any. */
export function pendingEvent(state: Pick<CareerState, "events">): CareerEvent | undefined {
  return (state.events ?? []).find((e) => !e.seen);
}

function markSeen(s: CareerState, id: string) {
  const list = (s.events ?? []).map((e) => (e.id === id ? { ...e, seen: true } : e));
  const unseen = list.filter((e) => !e.seen);
  const seen = list.filter((e) => e.seen).slice(-KEEP_SEEN);
  s.events = [...seen, ...unseen];
}

function addNews(s: CareerState, line: string) {
  s.news = [line, ...s.news].slice(0, 30);
}

/** Sell a user player to `clubId` for `fee` as the result of a pop-up. False if it can't happen any more. */
function sellTo(s: CareerState, playerId: string, clubId: string | undefined, fee: number): boolean {
  const me = s.clubs[s.userClubId]!;
  const buyer = clubId ? s.clubs[clubId] : undefined;
  const p = s.players[playerId];
  if (!p || !buyer || !me.squad.includes(playerId) || me.squad.length <= SQUAD_MIN || buyer.squad.length >= SQUAD_MAX) return false;
  me.squad = me.squad.filter((id) => id !== playerId);
  buyer.squad.push(playerId);
  s.budget += fee + wagesDueNow(s, p);
  p.signedYear = s.year;
  p.fee = fee;
  p.contract = 3;
  recordDeal(s, { year: s.year, at: s.matchdayIndex, playerId, playerName: p.name, pos: p.pos, rating: p.rating, from: s.userClubId, to: clubId!, fee, user: true });
  if (s.phase === "season") s.lastWages = wageBill(squadOf(s, s.userClubId));
  fixTeam(s);
  addNews(s, `Sold ${p.name} to ${buyer.name} for ${formatMoney(fee)}.`);
  return true;
}

/** Answer a pop-up. Unknown or already-seen ids change nothing. */
export function resolveEvent(state: CareerState, eventId: string, optionId?: string): CareerState {
  const e = (state.events ?? []).find((x) => x.id === eventId);
  if (!e || e.seen) return state;
  const s: CareerState = structuredClone(state);
  const choice = optionId ?? e.options[0]?.id;
  switch (e.kind) {
    case "transfer-request":
      if (choice === "sell") {
        if (!sellTo(s, e.playerId!, e.clubId, e.amount ?? 0)) addNews(s, "The deal fell through.");
      } else {
        // He stays, but he's not happy: a point off his rating.
        const p = s.players[e.playerId ?? ""];
        if (p && s.clubs[s.userClubId]!.squad.includes(p.id)) {
          p.rating = Math.max(55, p.rating - 1);
          addNews(s, `${p.name} stays, but he's sulking (−1 rating).`);
        }
      }
      break;
    case "record-bid":
      if (choice === "accept" && !sellTo(s, e.playerId!, e.clubId, e.amount ?? 0)) addNews(s, "The deal fell through.");
      break;
    default:
      break;
  }
  markSeen(s, eventId);
  s.updatedAt = Date.now();
  return s;
}

/* ----------------------------------------------------------- random events */

/** Chance of a random event after one of your league games. */
export const EVENT_CHANCE = 0.07;
/** At most this many random events a season, and this many rounds apart. */
export const EVENTS_PER_SEASON = 3;
const EVENT_GAP = 5;
const RANDOM_KINDS = ["transfer-request", "record-bid", "sponsor", "wonderkid", "takeover"] as const;

/** A top-flight club with room (not yours) in your game, for bids: Super League, or the NRL for an NRL club. */
function bidder(s: CareerState, rng: () => number, p: CareerPlayer): string | undefined {
  const top = s.clubs[s.userClubId]?.division === "nrl" ? "nrl" : "super-league";
  const sl = Object.values(s.clubs).filter((c) => c.id !== s.userClubId && c.division === top && c.squad.length < SQUAD_MAX - 1);
  const need = pickBuyer(s, p, rng);
  if (need && sl.some((c) => c.id === need.clubId)) return need.clubId;
  return sl.length ? pick(rng, sl).id : undefined;
}

/**
 * Maybe a random event after the matchday just played (in place). Rare, seeded, never while one
 * is waiting, at most EVENTS_PER_SEASON a season. Returns the event, if one fired.
 */
export function rollRandomEvent(s: CareerState, mdIndex: number): CareerEvent | undefined {
  if (s.phase !== "season" || pendingEvent(s)) return undefined;
  const md = s.calendar[mdIndex];
  const f = userFixture(md, s.userClubId);
  // Not in the first couple of rounds: let the season settle first.
  if (!f || f.kind !== "league" || f.round < 3) return undefined;
  const thisYear = (s.events ?? []).filter((e) => e.year === s.year && (RANDOM_KINDS as readonly string[]).includes(e.kind));
  if (thisYear.length >= EVENTS_PER_SEASON) return undefined;
  const last = thisYear[thisYear.length - 1];
  if (last && mdIndex - Number(last.id.split(":")[2] ?? 0) < EVENT_GAP) return undefined;
  const rng = rngFor(s.seed, s.year, "event", mdIndex);
  if (rng() >= EVENT_CHANCE) return undefined;
  const kind = pick(rng, RANDOM_KINDS);
  const id = `${kind}:${s.year}:${mdIndex}`;
  const me = s.clubs[s.userClubId]!;
  const squad = squadOf(s, me.id).filter((p) => !p.legend).sort((a, b) => b.rating - a.rating);
  const sl = me.division === "super-league" || me.division === "nrl";
  let e: Omit<CareerEvent, "seen"> | undefined;
  switch (kind) {
    case "transfer-request": {
      const star = squad.slice(0, 3)[Math.floor(rng() * Math.min(3, squad.length))];
      const club = star && me.squad.length > SQUAD_MIN ? bidder(s, rng, star) : undefined;
      if (!star || !club) break;
      const fee = transferFee(star, 1.1);
      e = {
        id, kind, year: s.year, clubId: club, playerId: star.id, name: star.name, rating: star.rating, amount: fee,
        title: "Transfer request",
        text: `${star.name} wants to join ${s.clubs[club]!.name}. They'll pay ${formatMoney(fee)}.`,
        options: [{ id: "refuse", label: "Refuse (−1 rating)" }, { id: "sell", label: `Sell · ${formatMoney(fee)}` }],
      };
      break;
    }
    case "record-bid": {
      const star = squad[0];
      const club = star && me.squad.length > SQUAD_MIN ? bidder(s, rng, star) : undefined;
      if (!star || !club) break;
      const fee = transferFee(star, 1.6);
      e = {
        id, kind, year: s.year, clubId: club, playerId: star.id, name: star.name, rating: star.rating, amount: fee,
        title: "Record bid",
        text: `${s.clubs[club]!.name} bid ${formatMoney(fee)} for ${star.name}.`,
        options: [{ id: "reject", label: "Reject" }, { id: "accept", label: `Accept · ${formatMoney(fee)}` }],
      };
      break;
    }
    case "sponsor": {
      const cash = (sl ? 60_000 : 25_000) + randInt(rng, 0, 4) * 5_000;
      s.budget += cash;
      e = { id, kind, year: s.year, clubId: me.id, amount: cash, title: "Sponsor windfall", text: `A new shirt sponsor pays ${formatMoney(cash)}.`, options: [{ id: "ok", label: "Great" }] };
      addNews(s, `Sponsor windfall: +${formatMoney(cash)}.`);
      break;
    }
    case "wonderkid": {
      const list = s.academy ?? [];
      let kid = list.map((id) => s.players[id]).filter((p): p is CareerPlayer => !!p).sort((a, b) => a.potential - b.potential)[0];
      if (!kid && list.length < ACADEMY_MAX) {
        kid = generatePlayer(rng, { clubId: me.id, pos: pick(rng, ["FB", "CE", "SO", "SH", "SR"] as const), level: 66, age: 17, academy: true, idPrefix: `wk${s.year}` });
        kid.rating = Math.max(60, Math.min(70, kid.rating));
        s.players[kid.id] = kid;
        s.academy = [...list, kid.id];
      }
      if (!kid) break;
      kid.potential = Math.max(kid.potential, 91 + randInt(rng, 0, 2));
      kid.rating = Math.min(72, kid.rating + 2);
      e = { id, kind, year: s.year, clubId: me.id, playerId: kid.id, name: kid.name, rating: kid.rating, title: "Wonderkid!", text: `${kid.name} (${kid.pos}, ${kid.age}) is the talk of the academy.`, options: [{ id: "ok", label: "Brilliant" }] };
      addNews(s, `Wonderkid: ${kid.name} is flying in the academy.`);
      break;
    }
    case "takeover": {
      const ids = Object.keys(s.clubs);
      const rival = rivalsOf(ids, me.id).find((id) => id !== me.id);
      if (!rival) break;
      const club = s.clubs[rival]!;
      const level = Math.round(squadOf(s, rival).sort((a, b) => b.rating - a.rating).slice(0, 13).reduce((t, p) => t + p.rating, 0) / 13);
      if (club.squad.length >= SQUAD_MAX) break;
      const signing = generatePlayer(rng, { clubId: rival, pos: pick(rng, ["CE", "PR", "SR", "SO", "FB"] as const), level: level + 2, age: randInt(rng, 25, 29), idPrefix: `tk${s.year}` });
      signing.contract = 3;
      signing.signedYear = s.year;
      s.players[signing.id] = signing;
      club.squad.push(signing.id);
      recordDeal(s, { year: s.year, at: mdIndex, playerId: signing.id, playerName: signing.name, pos: signing.pos, rating: signing.rating, from: null, to: rival, fee: 0 });
      e = {
        id, kind, year: s.year, clubId: rival, playerId: signing.id, name: signing.name, rating: signing.rating,
        title: "Takeover at a rival",
        text: `New owners at ${club.name}. They splash out on ${signing.name} (${signing.rating}).`,
        options: [{ id: "ok", label: "Noted" }],
      };
      addNews(s, `Takeover at ${club.name}: they sign ${signing.name}.`);
      tagNews(s, s.news[0]!, [rival]);
      break;
    }
  }
  if (!e) return undefined;
  pushEvent(s, e);
  return e as CareerEvent;
}
