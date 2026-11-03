/**
 * The NRL's clubs and 2026 squads in a career's world (v1.65): new careers get them on day one,
 * older saves when they load (the NRL then runs in the background from the next season).
 */
import { nrlClubSeeds } from "./clubs";
import { registerOccupiedPlayerNames } from "./names";
import { NRL_DATA } from "./nrl";
import { SQUAD_MAX, SQUAD_TEMPLATE, generatePlayer } from "./players";
import { randInt, rngFor } from "./rng";
import type { CareerClub, CareerPlayer, Pos } from "./types";

/** First-team level of generated NRL depth (real fringe players sit in the 70s). */
export const NRL_DEPTH_LEVEL = 77;

/** An NRL squad player (data/nrl/ via nrl-career.runtime.json), aged for `year`. */
export function nrlPlayer(row: (typeof NRL_DATA.players)[number], rng: () => number, year: number): CareerPlayer {
  const age = Math.max(17, year - row.birthYear);
  const headroom = age <= 21 ? 3 + Math.floor(rng() * 6) : age <= 24 ? Math.floor(rng() * 4) : age <= 27 ? Math.floor(rng() * 2) : 0;
  const alt = (row.alt ?? []) as Pos[];
  return {
    id: row.id,
    name: row.name,
    pos: row.pos as Pos,
    ...(alt.length ? { alt } : {}),
    rating: row.rating,
    potential: Math.min(97, Math.max(row.rating, row.rating + headroom)),
    age,
    nationality: row.nationality,
    real: true,
    apps: 0,
    tries: 0,
    careerApps: 0,
    careerTries: 0,
  };
}

/**
 * Add the 17 NRL clubs and their squads (in place), topped up with generated depth so every club
 * has a balanced 24 and trimmed to SQUAD_MAX. Players already in the world (same id) are skipped.
 * Returns the number of real players per club.
 */
export function addNrlWorld(clubs: Record<string, CareerClub>, players: Record<string, CareerPlayer>, seed: string, year: number): Record<string, number> {
  const rng = rngFor(seed, "world-nrl");
  registerOccupiedPlayerNames(NRL_DATA.players.map((r) => r.name));
  const real: Record<string, number> = {};
  for (const s of nrlClubSeeds()) {
    if (clubs[s.id]) continue;
    clubs[s.id] = { id: s.id, name: s.name, short: s.short, primary: s.primary, secondary: s.secondary, accent: s.accent, division: "nrl", squad: [] };
  }
  for (const row of NRL_DATA.players) {
    const club = clubs[row.club];
    if (!club || club.division !== "nrl" || players[row.id]) continue;
    const p = nrlPlayer(row, rng, year);
    players[p.id] = p;
    club.squad.push(p.id);
    real[club.id] = (real[club.id] ?? 0) + 1;
  }
  for (const s of nrlClubSeeds()) {
    const club = clubs[s.id]!;
    const counts: Record<Pos, number> = { FB: 0, WG: 0, CE: 0, SO: 0, SH: 0, PR: 0, HK: 0, SR: 0, LF: 0 };
    for (const id of club.squad) if (players[id]) counts[players[id]!.pos]++;
    for (const pos of Object.keys(SQUAD_TEMPLATE) as Pos[]) {
      while (counts[pos] < SQUAD_TEMPLATE[pos]) {
        const p = generatePlayer(rng, { clubId: s.id, pos, level: NRL_DEPTH_LEVEL, age: randInt(rng, 19, 30), idPrefix: `wn${s.short.toLowerCase()}` });
        players[p.id] = p;
        club.squad.push(p.id);
        counts[pos]++;
      }
    }
    while (club.squad.length > SQUAD_MAX) {
      const spare = club.squad
        .map((id) => players[id]!)
        .filter((p) => p.real && counts[p.pos] > SQUAD_TEMPLATE[p.pos])
        .sort((a, b) => a.rating - b.rating || a.age - b.age || a.id.localeCompare(b.id))[0];
      if (!spare) break;
      club.squad = club.squad.filter((id) => id !== spare.id);
      delete players[spare.id];
      counts[spare.pos]--;
      real[s.id] = (real[s.id] ?? 1) - 1;
    }
  }
  return real;
}
