/**
 * Rivals and derbies. Real rivalries for the clubs that have them; any club without one is
 * paired with its nearest club. A derby is any fixture between rivals (league, cup or play-off).
 */
import type { CareerState, Division, Fixture } from "./types";

/** Real rivalries (club ids). Order doesn't matter. */
const RIVALRIES: Array<[string, string]> = [
  ["wigan-warriors", "st-helens"],
  ["hull-fc", "hull-kr"],
  ["leeds-rhinos", "bradford-bulls"],
  ["castleford-tigers", "wakefield-trinity"],
  ["warrington-wolves", "wigan-warriors"],
  ["warrington-wolves", "st-helens"],
  ["huddersfield-giants", "bradford-bulls"],
  ["catalans-dragons", "toulouse-olympique"],
  ["leigh-leopards", "wigan-warriors"],
  ["salford-rlfc", "leigh-leopards"],
  ["york-knights", "hull-kr"],
  ["leeds-rhinos", "castleford-tigers"],
  // Championship and beyond.
  ["featherstone-rovers", "castleford-tigers"],
  ["featherstone-rovers", "wakefield-trinity"],
  ["batley-bulldogs", "dewsbury-rams"],
  ["whitehaven-rlfc", "workington-town"],
  ["barrow-raiders", "workington-town"],
  ["barrow-raiders", "whitehaven-rlfc"],
  ["widnes-vikings", "warrington-wolves"],
  ["widnes-vikings", "st-helens"],
  ["swinton-lions", "salford-rlfc"],
  ["oldham-rlfc", "rochdale-hornets"],
  ["halifax-panthers", "huddersfield-giants"],
  ["halifax-panthers", "bradford-bulls"],
  ["keighley-cougars", "bradford-bulls"],
  ["hunslet-rlfc", "leeds-rhinos"],
  ["sheffield-eagles", "doncaster-rlfc"],
  // The NRL (v1.65).
  ["nrl-sydney-roosters", "nrl-south-sydney-rabbitohs"],
  ["nrl-brisbane-broncos", "nrl-north-queensland-cowboys"],
  ["nrl-brisbane-broncos", "nrl-dolphins"],
  ["nrl-brisbane-broncos", "nrl-gold-coast-titans"],
  ["nrl-st-george-illawarra-dragons", "nrl-cronulla-sharks"],
  ["nrl-st-george-illawarra-dragons", "nrl-sydney-roosters"],
  ["nrl-parramatta-eels", "nrl-canterbury-bulldogs"],
  ["nrl-parramatta-eels", "nrl-wests-tigers"],
  ["nrl-parramatta-eels", "nrl-penrith-panthers"],
  ["nrl-canterbury-bulldogs", "nrl-south-sydney-rabbitohs"],
  ["nrl-melbourne-storm", "nrl-manly-sea-eagles"],
  ["nrl-manly-sea-eagles", "nrl-sydney-roosters"],
  ["nrl-newcastle-knights", "nrl-manly-sea-eagles"],
  ["nrl-canberra-raiders", "nrl-new-zealand-warriors"],
  ["nrl-wests-tigers", "nrl-canterbury-bulldogs"],
];

/** Rough home grounds (lat, lon) for the nearest-club fallback. */
const GROUND: Record<string, [number, number]> = {
  "leeds-rhinos": [53.8, -1.55],
  "st-helens": [53.45, -2.73],
  "wigan-warriors": [53.55, -2.63],
  "hull-kr": [53.75, -0.28],
  "hull-fc": [53.75, -0.37],
  "warrington-wolves": [53.39, -2.59],
  "wakefield-trinity": [53.68, -1.5],
  "catalans-dragons": [42.7, 2.9],
  "leigh-leopards": [53.5, -2.52],
  "huddersfield-giants": [53.65, -1.78],
  "bradford-bulls": [53.79, -1.75],
  "toulouse-olympique": [43.6, 1.44],
  "castleford-tigers": [53.72, -1.36],
  "york-knights": [53.96, -1.08],
  "barrow-raiders": [54.11, -3.23],
  "batley-bulldogs": [53.71, -1.63],
  "cornwall-rlfc": [50.17, -5.1],
  "dewsbury-rams": [53.69, -1.63],
  "doncaster-rlfc": [53.52, -1.13],
  "featherstone-rovers": [53.68, -1.36],
  "goole-vikings": [53.7, -0.87],
  "hunslet-rlfc": [53.77, -1.53],
  "keighley-cougars": [53.87, -1.91],
  "midlands-hurricanes": [52.48, -1.89],
  "newcastle-thunder": [54.98, -1.61],
  "north-wales-crusaders": [53.05, -3.0],
  "rochdale-hornets": [53.62, -2.16],
  "salford-rlfc": [53.48, -2.29],
  "swinton-lions": [53.51, -2.35],
  "whitehaven-rlfc": [54.55, -3.59],
  "workington-town": [54.64, -3.55],
  "london-broncos": [51.51, -0.13],
  "widnes-vikings": [53.36, -2.73],
  "halifax-panthers": [53.72, -1.86],
  "sheffield-eagles": [53.38, -1.47],
  "oldham-rlfc": [53.54, -2.12],
};

function distance(a: string, b: string): number {
  const p = GROUND[a];
  const q = GROUND[b];
  if (!p || !q) return Infinity;
  const dLat = p[0] - q[0];
  const dLon = (p[1] - q[1]) * Math.cos(((p[0] + q[0]) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/** A club's rivals: its real ones, or else its nearest club in this world. */
export function rivalsOf(clubIds: readonly string[], clubId: string): string[] {
  const real = RIVALRIES.filter((r) => r.includes(clubId)).map((r) => (r[0] === clubId ? r[1] : r[0]));
  const known = real.filter((id) => clubIds.includes(id));
  if (known.length) return known;
  const nearest = clubIds
    .filter((id) => id !== clubId)
    .map((id) => ({ id, d: distance(clubId, id) }))
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))[0];
  return nearest ? [nearest.id] : [];
}

/** True when the two clubs are rivals (either side's list counts). */
export function areRivals(clubIds: readonly string[], a: string, b: string): boolean {
  if (a === b) return false;
  return rivalsOf(clubIds, a).includes(b) || rivalsOf(clubIds, b).includes(a);
}

/** A fixture between rivals. */
export function isDerby(state: Pick<CareerState, "clubs">, f: Pick<Fixture, "home" | "away">): boolean {
  return areRivals(Object.keys(state.clubs), f.home, f.away);
}

/** Cash for beating a rival. */
export function derbyBonus(division: Division): number {
  return division === "nrl" ? 40_000 : division === "super-league" ? 30_000 : 15_000;
}
export const DERBY_LEGACY = 3;
/** Rating lift for the next game after a derby win (the dressing room's up). */
export const DERBY_MORALE = 0.3;
