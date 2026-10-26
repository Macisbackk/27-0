import type { GameMode, SquadSlot } from "./types";
import type { SeasonResult } from "./game/season-simulation";
import type { MissionEvent } from "./daily-missions";
import { computeChemistry } from "./game/chemistry";
import { getPlayerDisplayClub } from "./players/run-club";
import { resolveEraTeamClubName } from "./players/era-teams";
import { resolveCanonicalClubName } from "./clubs/club-match";

/**
 * Builds the Daily Missions "season" event from a finished Classic squad. Kept apart from
 * daily-missions.ts because chemistry / era-team helpers pull in the player database.
 */
export function seasonMissionEvent(input: {
  squad: SquadSlot[];
  result: Pick<SeasonResult, "wins" | "losses" | "pointsDifference">;
  leaguePosition: number;
  mode: GameMode;
  era?: boolean;
  daily?: boolean;
  hidden?: boolean;
}): MissionEvent {
  const clubsBySlot: (string | null)[] = Array.from({ length: 13 }, () => null);
  for (const slot of input.squad) {
    if (!slot.player || slot.slotIndex < 0 || slot.slotIndex >= clubsBySlot.length) continue;
    const club = resolveCanonicalClubName(
      resolveEraTeamClubName(getPlayerDisplayClub(slot.player))
    ).trim();
    clubsBySlot[slot.slotIndex] = club ? club.toLowerCase() : null;
  }
  return {
    kind: "season",
    mode: input.mode,
    era: Boolean(input.era),
    daily: Boolean(input.daily),
    hidden: Boolean(input.hidden),
    wins: input.result.wins,
    losses: input.result.losses,
    leaguePosition: input.leaguePosition,
    pointsDifference: input.result.pointsDifference,
    chemistryLinks: computeChemistry(input.squad).links.length,
    clubsBySlot,
  };
}
