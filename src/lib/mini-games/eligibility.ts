import { getClubByName } from "@/lib/clubs";
import { clubsMatch } from "@/lib/clubs/club-match";
import {
  CURRENT_PLAYABLE_CLUBS,
  ERA_PLAYABLE_CLUBS,
  isCurrentPlayableClub,
  isEraPlayableClub,
} from "@/lib/clubs/super-league-display";
import { isSuperLeagueEligiblePlayer } from "@/lib/players/super-league-eligibility";
import type { Player } from "@/lib/types";
import type { QuizTeamId } from "@/lib/quiz/types";

/**
 * Mini Games eligibility — Super League only.
 *
 * Root cause of Championship leakage: Wordle/HoL/Hangman pulled
 * `getShowcasePlayers()` (includes Championship current chunks) and Hangman
 * clubs used raw `SUPER_LEAGUE_CLUBS` (entire clubs.json). Gate everything here.
 */

export function resolveMiniGameClubName(clubName: string): string | null {
  const club = getClubByName(clubName);
  return club?.name ?? (clubName.trim() || null);
}

/** Historic + current clubs that have been Super League (not Championship-only). */
export function isEligibleMiniGameTeam(clubName: string): boolean {
  const resolved = resolveMiniGameClubName(clubName);
  if (!resolved) return false;
  if (isEraPlayableClub(resolved)) return true;
  return ERA_PLAYABLE_CLUBS.some((name) => clubsMatch(name, resolved));
}

/** Current Super League only — Hangman club answers + Team Challenge picker. */
export function isEligibleMiniGameCurrentTeam(clubName: string): boolean {
  const resolved = resolveMiniGameClubName(clubName);
  if (!resolved) return false;
  if (isCurrentPlayableClub(resolved)) return true;
  return CURRENT_PLAYABLE_CLUBS.some((name) => clubsMatch(name, resolved));
}

export function getEligibleMiniGameCurrentTeamNames(): readonly string[] {
  return CURRENT_PLAYABLE_CLUBS;
}

export function isEligibleMiniGamePlayer(player: Player): boolean {
  if (!isSuperLeagueEligiblePlayer(player)) return false;
  if (player.availableInGame === false) return false;
  const club = player.displayClub ?? player.team ?? player.club;
  return isEligibleMiniGameTeam(club);
}

/** Quiz Team Challenge IDs that map to current Super League clubs. */
export const MINI_GAME_QUIZ_TEAM_IDS = [
  "bradford",
  "castleford",
  "catalans",
  "huddersfield",
  "hull-fc",
  "hull-kr",
  "leeds",
  "leigh",
  "st-helens",
  "toulouse",
  "wakefield",
  "warrington",
  "wigan",
  "york",
] as const satisfies readonly QuizTeamId[];

export function isEligibleMiniGameQuizTeamId(id: string): boolean {
  return (MINI_GAME_QUIZ_TEAM_IDS as readonly string[]).includes(id);
}

export function normalizeMiniGameNationKey(nationality: string): string {
  return nationality
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function miniGameClubIdsMatch(a: string, b: string): boolean {
  const clubA = getClubByName(a);
  const clubB = getClubByName(b);
  if (clubA && clubB) return clubA.id === clubB.id;
  return clubsMatch(a, b);
}
