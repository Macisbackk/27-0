import { generateRandomPlayerName } from "./names";
import { randInt, rngFor, type Rng } from "./rng";
import type { CareerPlayer, CareerState, Pos } from "./types";
import { formatPounds } from "../format-money";

/** Shirt numbers 1–13. */
export const LINEUP_SLOTS: readonly Pos[] = [
  "FB", "WG", "CE", "CE", "WG", "SO", "SH", "PR", "HK", "PR", "SR", "SR", "LF",
];

export const POS_LABEL: Record<Pos, string> = {
  FB: "Fullback",
  WG: "Wing",
  CE: "Centre",
  SO: "Stand-off",
  SH: "Scrum-half",
  PR: "Prop",
  HK: "Hooker",
  SR: "Second row",
  LF: "Loose forward",
};

/** Target squad shape used when generating depth. Sums to 24. */
export const SQUAD_TEMPLATE: Record<Pos, number> = {
  FB: 2, WG: 3, CE: 3, SO: 2, SH: 2, PR: 4, HK: 2, SR: 4, LF: 2,
};

export const SQUAD_MIN = 20;
/** Room for every real 2026 registered squad (the biggest is 35) plus a few signings. */
export const SQUAD_MAX = 38;

const DATA_POS: Record<string, Pos> = {
  FULLBACK: "FB",
  WING: "WG",
  CENTRE: "CE",
  STAND_OFF: "SO",
  SCRUM_HALF: "SH",
  PROP: "PR",
  HOOKER: "HK",
  SECOND_ROW: "SR",
  LOOSE_FORWARD: "LF",
};

export function posFromData(position: string | undefined): Pos {
  return DATA_POS[(position ?? "").toUpperCase()] ?? "SR";
}

/** Rating penalty for playing `player` at `slot`. */
export function positionPenalty(playerPos: Pos, slot: Pos): number {
  if (playerPos === slot) return 0;
  const pair = [playerPos, slot].sort().join("-");
  const near: Record<string, number> = {
    "CE-WG": 1,
    "CE-FB": 2,
    "FB-WG": 2,
    "SH-SO": 1,
    "FB-SO": 3,
    "LF-SR": 1,
    "PR-SR": 2,
    "LF-PR": 3,
    "HK-SH": 3,
    "HK-LF": 3,
    "CE-SR": 4,
    "LF-SO": 4,
  };
  return near[pair] ?? 8;
}

export function effectiveRating(player: CareerPlayer, slot: Pos): number {
  return player.rating - positionPenalty(player.pos, slot);
}

/** Transfer value in pounds. */
export function playerValue(player: Pick<CareerPlayer, "rating" | "age" | "potential">): number {
  const base = 10_000 * Math.pow(1.28, player.rating - 70);
  const ageFactor =
    player.age <= 21 ? 1.25 : player.age <= 24 ? 1.15 : player.age <= 28 ? 1 : player.age <= 30 ? 0.8 : player.age <= 32 ? 0.55 : 0.35;
  const upside = Math.max(0, player.potential - player.rating) * 0.03;
  const raw = base * ageFactor * (1 + upside);
  return Math.max(5_000, Math.round(raw / 5_000) * 5_000);
}

/** Seasons left on a deal, including the current one. Older saves had none: derive a stable 1–3. */
export function contractYearsLeft(p: Pick<CareerPlayer, "id" | "age" | "contract">): number {
  if (typeof p.contract === "number" && p.contract > 0) return p.contract;
  const roll = rngFor("contract", p.id)();
  if (p.age >= 32) return roll < 0.6 ? 1 : 2;
  return 1 + Math.floor(roll * 3);
}

/** Clubs take less for a man whose deal is running down (they'd lose him for nothing next summer). */
export function contractFeeFactor(yearsLeft: number): number {
  return yearsLeft <= 1 ? 0.75 : yearsLeft === 2 ? 0.9 : 1;
}

/**
 * Fee to prise a player away from the club that holds his contract: his value (rating, age,
 * upside) times the buyer's premium, cheaper in the last year of his deal.
 * Free agents have no club and no fee — see `isFreeAgentListing`.
 */
export function transferFee(p: Pick<CareerPlayer, "id" | "rating" | "age" | "potential" | "contract">, premium = 1): number {
  const raw = playerValue(p) * premium * contractFeeFactor(contractYearsLeft(p));
  return Math.max(5_000, Math.round(raw / 5_000) * 5_000);
}

/** A season's wages for one player (the wage bill is the same share of the whole squad's value). */
export function playerWage(p: Pick<CareerPlayer, "rating" | "age" | "potential">): number {
  return Math.max(1_000, Math.round((playerValue(p) * WAGE_SHARE) / 1_000) * 1_000);
}

/**
 * Share of this season's wages still to pay. The bill for the whole squad is paid when the season
 * starts, so a signing in the summer window costs nothing extra now (he's on the bill at kick-off);
 * from pre-season on, a new man's wages for the rest of the season are paid when he signs, and a
 * player who leaves takes the rest of his wages off the bill.
 */
export function seasonWageShareLeft(state: Pick<CareerState, "phase" | "calendar">): number {
  if (state.phase !== "season") return 0;
  const rounds = state.calendar.filter((m) => m.label.startsWith("Round "));
  if (rounds.length === 0) return 0;
  return rounds.filter((m) => !m.played).length / rounds.length;
}

/** Wages paid now for signing this player (or saved by letting him go). */
export function wagesDueNow(state: Pick<CareerState, "phase" | "calendar">, p: Pick<CareerPlayer, "rating" | "age" | "potential">): number {
  return Math.round((playerWage(p) * seasonWageShareLeft(state)) / 1_000) * 1_000;
}

/** Manager Mode money (budgets, fees, wages): the game's one £ format. */
export function formatMoney(pounds: number): string {
  return formatPounds(pounds);
}

/** A season's wages for a squad: a share of its total value. */
export const WAGE_SHARE = 0.11;
export function wageBill(players: CareerPlayer[]): number {
  const total = players.reduce((sum, p) => sum + playerValue(p), 0);
  return Math.round((total * WAGE_SHARE) / 5_000) * 5_000;
}

let generatedCounter = 0;

export function generatePlayer(
  rng: Rng,
  opts: { clubId?: string; pos: Pos; level: number; age?: number; academy?: boolean; idPrefix: string; maxPotential?: number }
): CareerPlayer {
  const age = opts.age ?? randInt(rng, 19, 31);
  const rating = Math.max(60, Math.min(88, Math.round(opts.level + (rng() - 0.5) * 8)));
  const youthHeadroom = age <= 20 ? randInt(rng, 4, 12) : age <= 23 ? randInt(rng, 2, 7) : age <= 26 ? randInt(rng, 0, 3) : 0;
  const { fullName, nationality } = generateRandomPlayerName(opts.clubId ?? null);
  generatedCounter += 1;
  return {
    id: `${opts.idPrefix}-${generatedCounter.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`,
    name: fullName,
    pos: opts.pos,
    rating,
    potential: Math.min(opts.maxPotential ?? 94, Math.max(rating, rating + youthHeadroom)),
    age,
    nationality,
    real: false,
    academy: opts.academy,
    apps: 0,
    tries: 0,
    careerApps: 0,
    careerTries: 0,
  };
}

/**
 * Best available XIII: global greedy over every (slot, player) pairing by effective rating,
 * so a strong centre can beat a weak natural fullback. Ties favour natural positions.
 */
export function autoPickLineup(squad: CareerPlayer[]): string[] {
  const pairs: Array<{ i: number; id: string; score: number }> = [];
  LINEUP_SLOTS.forEach((slot, i) => {
    for (const p of squad) {
      pairs.push({ i, id: p.id, score: effectiveRating(p, slot) + (p.pos === slot ? 0.01 : 0) });
    }
  });
  pairs.sort((a, b) => b.score - a.score || a.i - b.i);
  const lineup: string[] = new Array(LINEUP_SLOTS.length).fill("");
  const used = new Set<string>();
  for (const pair of pairs) {
    if (lineup[pair.i] || used.has(pair.id)) continue;
    lineup[pair.i] = pair.id;
    used.add(pair.id);
  }
  return lineup;
}

/** Average effective rating of a lineup (missing slots count as 50). */
export function lineupRating(lineup: string[], players: Record<string, CareerPlayer>): number {
  let sum = 0;
  LINEUP_SLOTS.forEach((slot, i) => {
    const p = players[lineup[i] ?? ""];
    sum += p ? effectiveRating(p, slot) : 50;
  });
  return sum / LINEUP_SLOTS.length;
}

/** "Stars" for a prospect's potential, 1–5. */
export function potentialStars(potential: number): number {
  if (potential >= 90) return 5;
  if (potential >= 86) return 4;
  if (potential >= 82) return 3;
  if (potential >= 78) return 2;
  return 1;
}
