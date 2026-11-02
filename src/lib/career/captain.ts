/**
 * Captains. The user picks one on the Team tab; by default it's the best senior starter. AI clubs
 * have one too (the same rule), so the small lift he gives (CAPTAIN_BOOST in match.ts) is fair.
 */
import type { CareerPlayer, CareerState } from "./types";

/** Starters this old or older count as senior men for the armband. */
const SENIOR_AGE = 22;

/** Best senior starter in a XIII (highest rating; anyone if there are no senior men). Banned men can't lead. */
export function defaultCaptain(lineup: readonly string[], players: Record<string, CareerPlayer>): string | undefined {
  const xiii = lineup.map((id) => players[id]).filter((p): p is CareerPlayer => !!p && !p.ban);
  const seniors = xiii.filter((p) => p.age >= SENIOR_AGE);
  const pool = seniors.length ? seniors : xiii;
  return [...pool].sort((a, b) => b.rating - a.rating || b.age - a.age || a.id.localeCompare(b.id))[0]?.id;
}

/** Who leads the user's side next game: the chosen captain if he's in the XIII, otherwise the best senior starter. */
export function userCaptain(state: Pick<CareerState, "captainId" | "lineup" | "players">): string | undefined {
  const c = state.captainId;
  const p = c ? state.players[c] : undefined;
  if (c && p && !p.ban && state.lineup.includes(c)) return c;
  return defaultCaptain(state.lineup, state.players);
}

/** The chosen captain, or the default when none is set (for the Team tab). */
export function chosenCaptain(state: Pick<CareerState, "captainId" | "lineup" | "players" | "clubs" | "userClubId">): string | undefined {
  const c = state.captainId;
  if (c && state.players[c] && state.clubs[state.userClubId]?.squad.includes(c)) return c;
  return defaultCaptain(state.lineup, state.players);
}

/**
 * Keep the captain valid in place (callers clone first; arrays are replaced, not mutated):
 * if he's left the club, the best senior starter takes the armband and it makes the news.
 */
export function syncCaptain(s: CareerState): void {
  const squad = s.clubs[s.userClubId]?.squad ?? [];
  const c = s.captainId;
  if (c && squad.includes(c) && s.players[c]) return;
  const next = defaultCaptain(s.lineup ?? [], s.players);
  s.captainId = next;
  if (c && next && next !== c) {
    const old = s.players[c]?.name;
    s.news = [`${s.players[next]!.name} is the new captain${old ? ` after ${old} left` : ""}.`, ...(s.news ?? [])].slice(0, 30);
  }
}

/** Give the armband to a squad player. */
export function setCaptain(state: CareerState, playerId: string): CareerState {
  if (!state.clubs[state.userClubId]?.squad.includes(playerId) || state.captainId === playerId) return state;
  const p = state.players[playerId];
  if (!p) return state;
  return { ...state, captainId: playerId, news: [`${p.name} named captain.`, ...state.news].slice(0, 30), updatedAt: Date.now() };
}
