/**
 * Injuries (v1.66): after every game each side may lose a man or two for a while. Like a ban,
 * an injured player misses his club's next game(s) and drops out of the XIII (the bench covers).
 * Rates: about one or two injuries per club every five games; most last 1–3 games, a few are long.
 */
import { weightedPick, type Rng } from "./rng";
import type { CareerPlayer, Pos } from "./types";

/** Chance that each of the 17 is hurt in a game (17 × 0.018 ≈ 0.3 injuries a club a game). */
export const INJURY_CHANCE = 0.018;
/** A lay-off this long or longer is news (and a pop-up for the user). */
export const LONG_INJURY = 4;

/** Forwards take more knocks. */
const INJURY_WEIGHT: Record<Pos, number> = { PR: 1.35, HK: 1.1, SR: 1.2, LF: 1.2, CE: 1, SO: 0.8, SH: 0.8, FB: 0.9, WG: 0.8 };

/** Games out: mostly a week or two, sometimes a month, now and then a big one. */
export function rollLayoff(rng: Rng): number {
  const r = rng();
  if (r < 0.45) return 1;
  if (r < 0.7) return 2;
  if (r < 0.85) return 3;
  if (r < 0.96) return 4 + Math.floor(rng() * 3); // 4–6
  return 8 + Math.floor(rng() * 7); // 8–14
}

/**
 * Injuries in one side's game: `ids` is the 17 who played. `knocks` (from a live match) are men
 * who went off hurt: each one is injured, with his lay-off rolled here. Returns id → games out.
 */
export function rollInjuries(rng: Rng, ids: readonly string[], players: Record<string, CareerPlayer>, knocks: readonly string[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of knocks) if (players[id] && ids.includes(id)) out[id] = rollLayoff(rng);
  for (const id of ids) {
    const p = players[id];
    if (!p || out[id]) continue;
    if (rng() < INJURY_CHANCE * (INJURY_WEIGHT[p.pos] ?? 1) * (p.age >= 31 ? 1.2 : 1)) out[id] = rollLayoff(rng);
  }
  // Never more than two in one game (a live knock counts).
  const hurt = Object.keys(out);
  if (hurt.length > 2) {
    const keep = new Set<string>(knocks.filter((id) => out[id]).slice(0, 2));
    while (keep.size < 2) keep.add(weightedPick(rng, hurt.filter((id) => !keep.has(id)), () => 1));
    for (const id of hurt) if (!keep.has(id)) delete out[id];
  }
  return out;
}

/** "a hamstring strain" etc. for the news and the pop-up (picked from the lay-off and the man). */
export function injuryName(games: number, seed: number): string {
  const short = ["a dead leg", "a rolled ankle", "a cork", "a stinger", "a head knock (HIA)", "a tight hamstring"];
  const mid = ["a hamstring strain", "an ankle sprain", "a calf strain", "a shoulder injury", "a rib injury"];
  const long = ["a knee ligament injury", "a broken arm", "a dislocated shoulder", "a torn hamstring", "a broken jaw"];
  const list = games >= 8 ? long : games >= LONG_INJURY ? mid : short;
  return list[Math.abs(seed) % list.length]!;
}

/** Can he be picked? (Not banned, not injured.) */
export function isAvailable(p: Pick<CareerPlayer, "ban" | "injury"> | undefined): boolean {
  return !!p && !p.ban && !p.injury;
}
