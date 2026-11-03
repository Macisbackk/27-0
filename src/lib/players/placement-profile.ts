/**
 * Full placement profile: registry + team-year wiki roles. Installed into player-positions by
 * players/index.ts, so it only ships on pages that load the player database (player-positions
 * itself is imported almost everywhere). The require() calls stay lazy, as before, to keep the
 * module cycle (index -> team-year-pools -> players) out of load order.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import type { Player } from "../types";
import {
  collectEligiblePositions,
  setPlacementResolver,
  type PositionEligibilityPlayer,
} from "./player-positions";

function parseRunClubTeamYear(
  runClub: string
): { team: string; year: string } | null {
  const match = runClub.match(/^(.+?)\s+'(\d{2})$/);
  if (!match) return null;
  return { team: match[1]!.trim(), year: `20${match[2]}` };
}

function resolveTeamYearContext(
  player: PositionEligibilityPlayer
): { team: string; year: string } | null {
  if (player.teamYearId) {
    const { getTeamYearPoolById } =
      require("../game/team-year-pools") as typeof import("../game/team-year-pools");
    const pool = getTeamYearPoolById(player.teamYearId);
    if (pool) return { team: pool.team, year: pool.year };
  }

  if (player.runClub) {
    return parseRunClubTeamYear(player.runClub);
  }

  return null;
}

/** Merge registry + team-year wiki roles so squad snapshots keep full dual eligibility. */
function resolveFullPlacementPlayer(player: Player): Player {
  let merged = { ...player };
  const collected = collectEligiblePositions(player);

  if (player.id) {
    const { getPlayerById } =
      require("./index") as typeof import("./index");
    const registry = getPlayerById(player.id);
    if (registry) {
      for (const pos of collectEligiblePositions(registry)) {
        collected.add(pos);
      }
      merged = {
        ...registry,
        ...player,
        position: player.position ?? registry.position,
        primaryPosition: player.primaryPosition ?? registry.primaryPosition,
      };
    }
  }

  const teamYear = resolveTeamYearContext(merged);
  if (teamYear) {
    const { getTeamYearRecruitPositions } =
      require("./team-year-roster-playable") as typeof import("./team-year-roster-playable");
    for (const pos of getTeamYearRecruitPositions(
      teamYear.team,
      teamYear.year,
      merged
    )) {
      collected.add(pos);
    }
  }

  return {
    ...merged,
    positions: [...collected],
  };
}

setPlacementResolver(resolveFullPlacementPlayer);
