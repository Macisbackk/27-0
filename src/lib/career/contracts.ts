/**
 * Contracts, kept deliberately simple.
 *
 * Every player has a number of seasons left on his deal (1–3, sometimes 4). Each summer it
 * counts down by one. When it hits zero at your club you decide: renew (pay a one-off
 * signing-on fee for a fresh 1–3 year deal) or let him go for nothing. AI clubs just renew.
 */
import { autoPickLineup, contractYearsLeft, formatMoney, playerValue } from "./players";
import { rngFor } from "./rng";
import { repairLineup, squadOf } from "./season";
import type { CareerPlayer, CareerState } from "./types";

/** Seasons left on a deal, including the current one. Older saves had none: derive a stable 1–3. */
export function contractOf(p: Pick<CareerPlayer, "id" | "age" | "contract">): number {
  return contractYearsLeft(p);
}

/** Length of a new deal: young players commit longer, veterans year to year. */
export function newDealLength(age: number): number {
  if (age <= 24) return 3;
  if (age <= 30) return 2;
  return 1;
}

/** One-off signing-on fee to renew: a fifth of his value, never under £10k. */
export function renewalFee(p: Pick<CareerPlayer, "rating" | "age" | "potential">): number {
  return Math.max(10_000, Math.round((playerValue(p) * 0.2) / 5000) * 5000);
}

export function contractLabel(years: number): string {
  return years <= 1 ? "Final year" : `${years} yrs`;
}

/** AI squads keep at least this many after letting fringe men go (they're topped back up to 24). */
const AI_KEEP = 22;

/**
 * Summer countdown for every club. Returns the user's players whose deals have run out.
 * AI clubs renew their regulars; fringe players (outside their best 17) and veterans whose deals
 * end are sometimes let go, and join the free-agent pool with no fee on their heads.
 */
export function runDownContracts(state: CareerState): string[] {
  const expiring: string[] = [];
  for (const club of Object.values(state.clubs)) {
    const ranked = [...club.squad].sort((a, b) => (state.players[b]?.rating ?? 0) - (state.players[a]?.rating ?? 0));
    const rng = rngFor(state.seed, state.year, "release", club.id);
    const released: string[] = [];
    for (const id of club.squad) {
      const p = state.players[id];
      if (!p) continue;
      const left = contractOf(p) - 1;
      if (left > 0) {
        p.contract = left;
      } else if (club.id === state.userClubId) {
        p.contract = 0;
        expiring.push(id);
      } else {
        // Never their best XIII-and-bench: only fringe men, or veterans outside the first 13.
        const rank = ranked.indexOf(id);
        const roll = rng();
        if (!p.legend && club.squad.length - released.length > AI_KEEP && ((rank >= 17 && roll < 0.5) || (rank >= 13 && p.age >= 32 && roll < 0.35))) {
          released.push(id);
        } else {
          p.contract = newDealLength(p.age);
        }
      }
    }
    if (released.length) {
      club.squad = club.squad.filter((id) => !released.includes(id));
      for (const id of released) {
        const p = state.players[id]!;
        p.contract = undefined;
        p.leftClubId = club.id;
        p.leftYear = state.year + 1;
        if (!state.freeAgents.includes(id)) state.freeAgents.push(id);
      }
    }
  }
  return expiring;
}

export type ContractError = "budget" | "not-expiring";

/** Renew an expiring player at the user's club. */
export function renewContract(state: CareerState, playerId: string): { state: CareerState; error?: ContractError } {
  const d = state.departures;
  const p = state.players[playerId];
  if (state.phase !== "departures" || !d || !d.expiring.includes(playerId) || !p) return { state, error: "not-expiring" };
  if (!state.clubs[state.userClubId]!.squad.includes(playerId)) return { state, error: "not-expiring" };
  const fee = renewalFee(p);
  if (state.budget < fee) return { state, error: "budget" };
  const s: CareerState = structuredClone(state);
  const sp = s.players[playerId]!;
  sp.contract = newDealLength(sp.age);
  s.budget -= fee;
  s.departures!.expiring = s.departures!.expiring.filter((id) => id !== playerId);
  s.departures!.renewed = [...(s.departures!.renewed ?? []), playerId];
  s.news = [`${sp.name} signs a new ${sp.contract}-year deal (${formatMoney(fee)}).`, ...s.news].slice(0, 30);
  s.updatedAt = Date.now();
  return { state: s };
}

/** Let an expiring player go: he leaves on a free and joins the free-agent pool. */
export function releaseExpiring(state: CareerState, playerId: string): CareerState {
  const d = state.departures;
  if (state.phase !== "departures" || !d || !d.expiring.includes(playerId)) return state;
  if (!state.clubs[state.userClubId]!.squad.includes(playerId)) return state;
  const s: CareerState = structuredClone(state);
  const me = s.clubs[s.userClubId]!;
  const p = s.players[playerId];
  me.squad = me.squad.filter((id) => id !== playerId);
  s.lineup = repairLineup(s, s.lineup.filter((id) => id !== playerId));
  if (p?.legend) {
    // Legends are a reward, not a market asset: when his deal ends he's gone (sign him again from the vault).
    delete s.players[playerId];
  } else if (p) {
    p.contract = undefined;
    // He won't come straight back for nothing: no re-signing him on a free this summer.
    p.leftClubId = s.userClubId;
    p.leftYear = s.year;
    s.freeAgents = [...s.freeAgents.filter((id) => id !== playerId), playerId];
  }
  s.departures!.expiring = s.departures!.expiring.filter((id) => id !== playerId);
  s.departures!.released = [...(s.departures!.released ?? []), p?.name ?? playerId];
  s.news = [`${p?.name ?? "A player"} leaves at the end of his contract.`, ...s.news].slice(0, 30);
  s.updatedAt = Date.now();
  return s;
}

/**
 * Out-of-contract players worth keeping, best first, within the budget: anyone in the best XIII
 * from the squad as it stands, or a young player with room to grow. A suggestion only — the
 * manager still taps to renew them.
 */
export function recommendedRenewals(state: CareerState): string[] {
  const d = state.departures;
  if (state.phase !== "departures" || !d?.expiring.length) return [];
  const squad = squadOf(state, state.userClubId);
  const best = new Set(autoPickLineup(squad));
  const worth = d.expiring
    .map((id) => state.players[id])
    .filter((p): p is CareerPlayer => !!p)
    .filter((p) => best.has(p.id) || (p.age <= 23 && p.potential >= p.rating + 4))
    .sort((a, b) => b.rating - a.rating);
  const out: string[] = [];
  let left = state.budget;
  for (const p of worth) {
    const fee = renewalFee(p);
    if (fee > left) continue;
    left -= fee;
    out.push(p.id);
  }
  return out;
}
