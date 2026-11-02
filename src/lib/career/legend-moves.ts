/**
 * Legends in a career: they play at exactly the rating the vault shows, lose a point a summer,
 * and retire 2–3 seasons after signing (seeded). Now and then a Super League AI club brings back
 * one of its own legends (any legend in the catalogue, unlocked or not) — more likely when you're
 * doing well and it's your rival. A legend at a club is off the market until he retires.
 */
import { pushEvent } from "./events";
import { legendAsPlayer, legendCatalog, type LegendCard } from "./legends";
import { recordDeal } from "./midseason";
import { tagNews } from "./news";
import { SQUAD_MAX } from "./players";
import { rngFor, weightedPick } from "./rng";
import { rivalsOf } from "./rivals";
import type { CareerPlayer, CareerState } from "./types";

/** Last season a legend signed in `signedYear` plays: 2 or 3 seasons in all (seeded). */
export function legendRetireAfter(seed: string, playerId: string, signedYear: number): number {
  return signedYear + (rngFor(seed, "legend-retire", playerId, signedYear)() < 0.5 ? 1 : 2);
}

/** His last season (older saves: two seasons after signing). */
export function legendLastSeason(p: Pick<CareerPlayer, "retireAfter" | "signedYear">, year: number): number {
  return p.retireAfter ?? (p.signedYear ?? year) + 1;
}

/** Fresh legend on a deal that runs to his retirement. */
export function signLegend(s: Pick<CareerState, "seed" | "year">, card: LegendCard): CareerPlayer {
  const p = legendAsPlayer(card);
  p.signedYear = s.year;
  p.retireAfter = legendRetireAfter(s.seed, p.id, s.year);
  p.contract = p.retireAfter - s.year + 1;
  return p;
}

/** At a club now (yours or an AI club's). */
export function legendAtClub(state: Pick<CareerState, "clubs">, playerId: string): string | undefined {
  return Object.values(state.clubs).find((c) => c.squad.includes(playerId))?.id;
}

/** Free to sign: not at a club and not retired in this career. */
export function legendAvailable(state: Pick<CareerState, "clubs" | "retiredLegends">, playerId: string): boolean {
  return !legendAtClub(state, playerId) && !(state.retiredLegends ?? []).includes(playerId);
}

/**
 * Summer for a legend (in place): retire after his last season, otherwise a point off his
 * rating and a year older. Returns true when he retires.
 */
export function legendSummer(s: CareerState, p: CareerPlayer): boolean {
  if (s.year >= legendLastSeason(p, s.year)) {
    s.retiredLegends = [...new Set([...(s.retiredLegends ?? []), p.id])];
    return true;
  }
  p.age += 1;
  p.rating = Math.max(60, p.rating - 1);
  p.potential = p.rating;
  return false;
}

/** Chance a Super League AI club brings back a legend in a summer. */
export const AI_LEGEND_CHANCE = 0.3;
export const AI_LEGEND_CHANCE_HOT = 0.5;

/**
 * Summer window, in place: maybe one AI club signs one of its own legends. Only Super League
 * clubs, only the club the legend is known for, at most one a season. Returns the signing.
 */
export function aiLegendSigning(s: CareerState): CareerPlayer | undefined {
  const rng = rngFor(s.seed, s.year, "ai-legend");
  const last = s.history[s.history.length - 1];
  const hot = !!last && last.year === s.year - 1 && ((last.division === "super-league" && last.position <= 4) || last.trophies.some((t) => t !== "promotion"));
  if (rng() >= (hot ? AI_LEGEND_CHANCE_HOT : AI_LEGEND_CHANCE)) return undefined;
  const byName = new Map(Object.values(s.clubs).map((c) => [c.name.toLowerCase(), c]));
  const rivals = new Set(rivalsOf(Object.keys(s.clubs), s.userClubId));
  const options = legendCatalog()
    .map((card) => ({ card, club: byName.get(card.club.toLowerCase()) }))
    .filter(
      (x): x is { card: LegendCard; club: NonNullable<typeof x.club> } =>
        !!x.club &&
        x.club.id !== s.userClubId &&
        x.club.division === "super-league" &&
        x.club.squad.length < SQUAD_MAX - 2 &&
        legendAvailable(s, `legend-${x.card.id}`)
    );
  if (!options.length) return undefined;
  // Your rivals are keener to land a big name when you're winning.
  const pickd = weightedPick(rng, options, (x) => (rivals.has(x.club.id) ? (hot ? 6 : 3) : 1));
  const p = signLegend(s, pickd.card);
  p.fee = pickd.card.signingFee;
  s.players[p.id] = p;
  pickd.club.squad.push(p.id);
  recordDeal(s, { year: s.year, at: 0, playerId: p.id, playerName: p.name, pos: p.pos, rating: p.rating, from: null, to: pickd.club.id, fee: 0, summer: true });
  s.news = [`${pickd.club.name} sign legend ${p.name} (${p.rating})!`, ...s.news].slice(0, 30);
  tagNews(s, s.news[0]!, [pickd.club.id]);
  pushEvent(s, {
    id: `legend-signing:${s.year}:${p.id}`,
    kind: "legend-signing",
    year: s.year,
    clubId: pickd.club.id,
    playerId: p.id,
    name: p.name,
    rating: p.rating,
    title: `${pickd.club.name} sign ${p.name}!`,
    text: `A club legend is back at ${pickd.club.name}${rivals.has(pickd.club.id) ? ", and they're your rivals" : ""}.`,
    options: [{ id: "ok", label: "Bring it on" }],
  });
  return p;
}
