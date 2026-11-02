/**
 * Youth academy. Each pre-season 3–4 teenage prospects (16–18, rated about 60–70) join the
 * user's academy list. Their potential is hidden (shown as stars). The manager promotes them to
 * the first-team squad (squad limit and wages apply), releases them, or leaves them to grow.
 * Prospects age and develop each summer; anyone still there at 20 leaves. AI clubs bring kids
 * through implicitly (young generated players when squads are topped up), with no list.
 */
import { LINEUP_SLOTS, SQUAD_MAX, formatMoney, generatePlayer, playerWage, wageBill, wagesDueNow } from "./players";
import { pick, randInt, rngFor } from "./rng";
import { fixTeam, squadOf } from "./season";
import type { CareerPlayer, CareerState } from "./types";

/** Most prospects on the list at once. */
export const ACADEMY_MAX = 8;
/** Prospects still in the academy at this age leave in the summer. */
export const ACADEMY_LEAVE_AGE = 20;

export function academyPlayers(state: Pick<CareerState, "academy" | "players">): CareerPlayer[] {
  return (state.academy ?? []).map((id) => state.players[id]).filter((p): p is CareerPlayer => !!p);
}

/** Pre-season intake (in place; callers clone first). Returns the new prospects. */
export function academyIntake(s: CareerState): CareerPlayer[] {
  const rng = rngFor(s.seed, s.year, "academy-intake");
  const list = (s.academy ?? []).filter((id) => !!s.players[id]);
  const count = Math.min(3 + (rng() < 0.5 ? 1 : 0), Math.max(0, ACADEMY_MAX - list.length));
  const out: CareerPlayer[] = [];
  for (let i = 0; i < count; i++) {
    const p = generatePlayer(rng, {
      clubId: s.userClubId,
      pos: pick(rng, LINEUP_SLOTS),
      // Better clubs attract better kids, but they all start well short of the first team.
      level: 62 + s.prestige,
      age: randInt(rng, 16, 18),
      academy: true,
      idPrefix: `ac${s.year}`,
    });
    p.rating = Math.max(60, Math.min(70, p.rating));
    p.potential = Math.max(p.rating + 6, Math.min(94, 74 + Math.round(s.prestige * 2) + randInt(rng, 0, 10)));
    s.players[p.id] = p;
    list.push(p.id);
    out.push(p);
  }
  s.academy = list;
  if (out.length) {
    s.news = [`Academy intake: ${out.map((p) => `${p.name} (${p.pos}, ${p.age})`).join(", ")}.`, ...s.news].slice(0, 30);
  }
  return out;
}

/** Summer, in place: prospects have aged and developed with everyone else; the over-age ones leave. */
export function academySummer(s: CareerState): string[] {
  const left: string[] = [];
  s.academy = (s.academy ?? []).filter((id) => {
    const p = s.players[id];
    if (!p) return false;
    if (p.age >= ACADEMY_LEAVE_AGE) {
      left.push(p.name);
      delete s.players[id];
      return false;
    }
    return true;
  });
  return left;
}

export type AcademyError = "squad-full" | "budget" | "not-found" | "phase";

/** What promoting him costs now: the rest of this season's wages (nothing in the summer window). */
export function promotionCost(state: CareerState, p: CareerPlayer): number {
  return wagesDueNow(state, p);
}

/** Move a prospect into the first-team squad on a three-year deal. */
export function promoteAcademy(state: CareerState, playerId: string): { state: CareerState; error?: AcademyError } {
  if (state.phase === "review") return { state, error: "phase" };
  const p = state.players[playerId];
  if (!p || !(state.academy ?? []).includes(playerId)) return { state, error: "not-found" };
  const club = state.clubs[state.userClubId]!;
  if (club.squad.length >= SQUAD_MAX) return { state, error: "squad-full" };
  const cost = promotionCost(state, p);
  if (state.budget < cost) return { state, error: "budget" };
  const s: CareerState = structuredClone(state);
  const np = s.players[playerId]!;
  s.academy = (s.academy ?? []).filter((id) => id !== playerId);
  s.clubs[s.userClubId]!.squad.push(playerId);
  np.contract = 3;
  np.signedYear = s.year;
  np.fee = 0;
  s.budget -= cost;
  if (s.phase === "season") s.lastWages = wageBill(squadOf(s, s.userClubId));
  fixTeam(s);
  s.news = [`${np.name} promoted from the academy (${formatMoney(playerWage(np))}/yr).`, ...s.news].slice(0, 30);
  s.updatedAt = Date.now();
  return { state: s };
}

/** Let a prospect go. He's gone for good. */
export function releaseAcademy(state: CareerState, playerId: string): CareerState {
  if (!(state.academy ?? []).includes(playerId)) return state;
  const s: CareerState = structuredClone(state);
  const name = s.players[playerId]?.name ?? "A prospect";
  s.academy = (s.academy ?? []).filter((id) => id !== playerId);
  delete s.players[playerId];
  s.news = [`${name} released from the academy.`, ...s.news].slice(0, 30);
  s.updatedAt = Date.now();
  return s;
}
