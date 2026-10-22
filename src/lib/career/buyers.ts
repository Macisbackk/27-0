/**
 * Who wants a player? Used when you sell (the player has to go somewhere real) and when rivals bid.
 * A club "needs" a player when he'd walk into their XIII at his position, or when they're short
 * of bodies there compared with a normal squad.
 */
import { LINEUP_SLOTS, POS_LABEL, SQUAD_MAX, SQUAD_TEMPLATE } from "./players";
import { pick, type Rng } from "./rng";
import type { CareerPlayer, CareerState } from "./types";

export interface BuyerNeed {
  clubId: string;
  /** Higher = needs him more. */
  score: number;
  /** Plain-English reason, e.g. "short of props" or "an upgrade at hooker". */
  reason: string;
}

const plural: Record<string, string> = {
  Fullback: "fullbacks",
  Wing: "wingers",
  Centre: "centres",
  "Stand-off": "stand-offs",
  "Scrum-half": "scrum-halves",
  Prop: "props",
  Hooker: "hookers",
  "Second row": "second rowers",
  "Loose forward": "loose forwards",
};

export function clubNeed(state: CareerState, clubId: string, p: CareerPlayer): BuyerNeed | null {
  const club = state.clubs[clubId];
  if (!club || clubId === state.userClubId || club.squad.length >= SQUAD_MAX || club.squad.includes(p.id)) return null;
  const atPos = club.squad
    .map((id) => state.players[id])
    .filter((x): x is CareerPlayer => !!x && x.pos === p.pos)
    .sort((a, b) => b.rating - a.rating);
  const starters = LINEUP_SLOTS.filter((s) => s === p.pos).length;
  const weakestStarter = atPos[starters - 1]?.rating ?? 0;
  const gain = p.rating - weakestStarter;
  const short = Math.max(0, (SQUAD_TEMPLATE[p.pos] ?? 2) - atPos.length);
  const label = POS_LABEL[p.pos];
  // A big upgrade beats depth; a club already well stocked and better there doesn't need him.
  const score = Math.max(0, gain) + short * 4;
  if (score <= 0) return null;
  const reason = gain >= 2 && gain * 1 >= short * 4 ? `an upgrade at ${label.toLowerCase()}` : `short of ${plural[label] ?? `${label.toLowerCase()}s`}`;
  return { clubId, score, reason };
}

/** Clubs that need this player, best fit first. */
export function buyersFor(state: CareerState, p: CareerPlayer): BuyerNeed[] {
  return Object.keys(state.clubs)
    .map((id) => clubNeed(state, id, p))
    .filter((x): x is BuyerNeed => !!x)
    .sort((a, b) => b.score - a.score);
}

/**
 * The club a sold player joins: one of the clubs that need him most (a little variety among the
 * top few so it isn't always the same team). Falls back to the club with the fewest at his position
 * that has room, so a sale always has a real destination.
 */
export function pickBuyer(state: CareerState, p: CareerPlayer, rng: Rng): BuyerNeed | null {
  const needs = buyersFor(state, p);
  if (needs.length) {
    const top = needs[0]!.score;
    const close = needs.filter((n) => n.score >= top - 2).slice(0, 3);
    return pick(rng, close);
  }
  const roomy = Object.values(state.clubs)
    .filter((c) => c.id !== state.userClubId && c.squad.length < SQUAD_MAX && !c.squad.includes(p.id))
    .map((c) => ({ c, n: c.squad.filter((id) => state.players[id]?.pos === p.pos).length }))
    .sort((a, b) => a.n - b.n || a.c.squad.length - b.c.squad.length);
  const c = roomy[0]?.c;
  return c ? { clubId: c.id, score: 0, reason: `cover at ${POS_LABEL[p.pos].toLowerCase()}` } : null;
}
