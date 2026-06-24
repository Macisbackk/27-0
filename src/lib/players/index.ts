import currentSquads from "../../../data/current-squads.json";
import historicPlayers from "../../../data/historic-players.json";
import legends from "../../../data/legends.json";
import type { Player, PlayerCategory, Position } from "../types";
import { normalizePlayer } from "./normalize";
import { isHiddenPlayer } from "./goat";
import { getValueTier as getValueTierFromRating } from "./ratings";
import { getClubByName } from "../clubs";
import { clubsMatch, resolveCanonicalClubName } from "../clubs/club-match";
import { getActiveSuperLeagueClubNames } from "../clubs/super-league-display";
import { isSuperLeagueEligiblePlayer } from "./super-league-eligibility";
import { isGameplayYearCard, isYearPinnedPlayer } from "./year-card";

function loadPlayers(): {
  all: Player[];
  current: Player[];
  historic: Player[];
  legends: Player[];
  byId: Map<string, Player>;
} {
  const legendIds = new Set(
    (legends as Record<string, unknown>[]).map((p) => p.id as string)
  );

  const current = (currentSquads as Record<string, unknown>[]).map(normalizePlayer);
  const historicRaw = (historicPlayers as Record<string, unknown>[])
    .filter((p) => !legendIds.has(p.id as string))
    .map(normalizePlayer);
  const legendPlayers = (legends as Record<string, unknown>[]).map(normalizePlayer);

  const byId = new Map<string, Player>();
  const pool: Player[] = [];

  for (const p of [...current, ...historicRaw, ...legendPlayers]) {
    byId.set(p.id, p);
  }

  for (const p of current) {
    if (!isHiddenPlayer(p) && isGameplayYearCard(p)) pool.push(p);
  }

  for (const p of [...historicRaw, ...legendPlayers]) {
    if (isHiddenPlayer(p)) continue;
    if (p.availableInGame === false) continue;
    if (!isGameplayYearCard(p)) continue;
    pool.push(p);
  }

  const all = pool;
  const historic = all.filter((p) => p.category === "historic");
  const legendsOnly = all.filter((p) => p.category === "legend");

  return {
    all,
    current: all.filter((p) => p.category === "current"),
    historic,
    legends: legendsOnly,
    byId,
  };
}

const registry = loadPlayers();

export const PLAYER_POOL = registry.all;
export const CURRENT_PLAYERS = registry.current;
export const HISTORIC_PLAYERS = registry.historic;
export const LEGEND_PLAYERS = registry.legends;

export function getAllDatabasePlayers(): Player[] {
  return [...registry.byId.values()];
}

export function getPlayerById(id: string): Player | undefined {
  return registry.byId.get(id);
}

export function getPlayersByPosition(
  players: Player[],
  position: Position
): Player[] {
  return players.filter((p) => p.position === position);
}

export function getPlayersByCategory(category: PlayerCategory): Player[] {
  switch (category) {
    case "current":
      return CURRENT_PLAYERS;
    case "historic":
      return HISTORIC_PLAYERS;
    case "legend":
      return LEGEND_PLAYERS;
  }
}

/** All database players assigned to a club (current, historic, legends). */
export function getPlayersByClub(club: string): Player[] {
  const canonical = getClubByName(club)?.name ?? club;
  return PLAYER_POOL.filter((p) => clubsMatch(p.club, canonical));
}

/** Active Super League clubs that have at least one player in the database. */
export function getClubsWithPlayers(): string[] {
  const withPlayers = new Set(PLAYER_POOL.map((p) => getClubByName(p.club)?.name ?? p.club));
  return getActiveSuperLeagueClubNames()
    .filter((c) => withPlayers.has(c))
    .sort((a, b) => a.localeCompare(b));
}

export function formatValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `£${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `£${Math.round(value / 1_000)}K`;
  }
  return `£${value.toLocaleString()}`;
}

export {
  compressPeakRating,
  ratingToValue,
  computePlayerValue,
} from "./ratings";
export {
  formatPlayerDisplayName,
  formatPrimeYearSuffix,
  formatShortYear,
  parsePlayerId,
  resolvePrimeYear,
} from "./prime-year";
export {
  isGoatPlayer,
  isHiddenPlayer,
  JOE_MELLOR_ID,
  JOE_MELLOR_NORMAL_ID,
  JOE_MELLOR_GOAT_ID,
  getJoeMellorGoatPlayer,
} from "./goat";
export {
  isSuperSamHallasId,
  isSuperSamHallasPlayer,
  getSuperSamHallasPlayer,
  SAM_HALLAS_ID_PREFIX,
} from "./super-sam-hallas";

export function isAvailableInGame(player: Player): boolean {
  return player.availableInGame !== false;
}

/** Public player pool — year-pinned cards only, excludes hidden/archived. */
export function getShowcasePlayers(): Player[] {
  return PLAYER_POOL.filter(
    (p) =>
      !isHiddenPlayer(p) &&
      isAvailableInGame(p) &&
      isYearPinnedPlayer(p) &&
      isGameplayYearCard(p)
  );
}

/** Players eligible for recruitment / draft offers — year-pinned only. */
export function getRecruitablePlayers(): Player[] {
  return PLAYER_POOL.filter(
    (p) =>
      !isHiddenPlayer(p) &&
      isAvailableInGame(p) &&
      isYearPinnedPlayer(p) &&
      isGameplayYearCard(p) &&
      isSuperLeagueEligiblePlayer(p)
  );
}

export function getValueTier(value: number): string {
  let approxRating = 75;
  if (value >= 500_000) approxRating = 95 + ((value - 500_000) / 250_000) * 4;
  else if (value >= 250_000) approxRating = 90 + ((value - 250_000) / 250_000) * 5;
  else if (value >= 150_000) approxRating = 85 + ((value - 150_000) / 100_000) * 5;
  else if (value >= 90_000) approxRating = 80 + ((value - 90_000) / 60_000) * 5;
  else if (value >= 45_000) approxRating = 75 + ((value - 45_000) / 45_000) * 5;
  else approxRating = 70 + ((value - 20_000) / 25_000) * 5;
  return getValueTierFromRating(Math.round(Math.min(99, approxRating)));
}

export function isHistoricPlayer(player: Player): boolean {
  return player.category === "historic" || player.category === "legend";
}

export { isActivePlayer, resolveCategory } from "./active";
export {
  getPlayerAchievements,
  getPlayerAchievementGroups,
  getManOfSteelYears,
  getDreamTeamYears,
  hasLanceToddTrophy,
  hasDreamTeamSelection,
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENT_CATEGORY_TITLES,
} from "./achievements";
export { formatCareerTries } from "./career-tries";
export {
  buildPlayerTeamYearId,
  formatShowcaseClubYear,
  isGameplayYearCard,
  isYearPinnedPlayer,
  categoryToCardStatus,
} from "./year-card";
export {
  formatPlayerAge,
  formatPlayerAgeLabel,
  getPlayerAge,
  resolveBirthYear,
  resolveCardYear,
  withEraYear,
} from "./player-age";
export {
  getTeamYearRosters,
  getTeamsWithYearRosters,
  getEraTeamsWithYearRosters,
  getYearsForTeam,
  getEraYearsForTeam,
  getRosterPlayerIds,
  getRosterPlayerIdsForTeamAllYears,
  getAllRosterPlayerIds,
  buildTeamYearRosterIndex,
  hasTeamYearRoster,
  getCurrentCalendarYear,
} from "./team-year-rosters";

export const PLAYER_COUNTS = {
  total: PLAYER_POOL.length,
  current: CURRENT_PLAYERS.length,
  historic: HISTORIC_PLAYERS.length,
  legends: LEGEND_PLAYERS.length,
};

export {
  normalizePosition,
  isUtilityPosition,
  resolvePosition,
  inferUtilityPosition,
} from "./position-utils";
