import type { Player, PlayerCategory, Position } from "../types";
import { getValueTier as getValueTierFromRating } from "./ratings";
import { getClubByName } from "../clubs";
import { clubsMatch } from "../clubs/club-match";
import { getActiveSuperLeagueClubNames } from "../clubs/super-league-display";
import { isSuperLeagueEligiblePlayer } from "./super-league-eligibility";
import { isHiddenPlayer } from "./goat";
import { isGameplayYearCard, isYearPinnedPlayer } from "./year-card";
import { applyPlayerRegistry, buildPlayerRegistry } from "./registry";

const store = {
  all: [] as Player[],
  current: [] as Player[],
  historic: [] as Player[],
  legends: [] as Player[],
  byId: new Map<string, Player>(),
};

let clientLoadPromise: Promise<void> | null = null;
let clientLoadComplete = false;

async function loadClientRegistry(): Promise<void> {
  const { loadAllPlayerRawRows } = await import("./player-chunks");
  const raw = await loadAllPlayerRawRows();
  applyPlayerRegistry(
    store,
    buildPlayerRegistry(raw.current, raw.historic, raw.legends)
  );
  clientLoadComplete = true;
}

function ensureRegistrySync(): void {
  if (store.byId.size > 0 || typeof window !== "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildSyncPlayerRegistry } = require("./sync-bootstrap") as typeof import("./sync-bootstrap");
  applyPlayerRegistry(store, buildSyncPlayerRegistry());
  clientLoadComplete = true;
}

/** Load chunked player JSON on the client (no-op on server). */
export function ensurePlayersLoaded(): Promise<void> {
  if (clientLoadComplete) return Promise.resolve();
  if (typeof window === "undefined") {
    ensureRegistrySync();
    return Promise.resolve();
  }
  if (!clientLoadPromise) {
    clientLoadPromise = loadClientRegistry().catch((error) => {
      clientLoadPromise = null;
      throw error;
    });
  }
  return clientLoadPromise;
}

if (typeof window !== "undefined") {
  void ensurePlayersLoaded();
}

export const PLAYER_POOL = store.all;
export const CURRENT_PLAYERS = store.current;
export const HISTORIC_PLAYERS = store.historic;
export const LEGEND_PLAYERS = store.legends;

export function getAllDatabasePlayers(): Player[] {
  return [...store.byId.values()];
}

export function getPlayerById(id: string): Player | undefined {
  ensureRegistrySync();
  return store.byId.get(id);
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
  const withPlayers = new Set(
    PLAYER_POOL.map((p) => getClubByName(p.club)?.name ?? p.club)
  );
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
  syncPlayerValueFromRating,
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
  parsePositionAbbreviations,
  formatPositionAbbreviations,
  formatPlayerPositionLabel,
  getEligiblePositions,
  getPlayerEligiblePositions,
  canPlayPosition,
  getPlayerRatingForPosition,
  applyOutOfPositionPenalty,
  OUT_OF_POSITION_PENALTY,
  playerEligibleForSlot,
} from "./player-positions";
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
  get total() {
    return PLAYER_POOL.length;
  },
  get current() {
    return CURRENT_PLAYERS.length;
  },
  get historic() {
    return HISTORIC_PLAYERS.length;
  },
  get legends() {
    return LEGEND_PLAYERS.length;
  },
};

export {
  normalizePosition,
  isUtilityPosition,
  resolvePosition,
  inferUtilityPosition,
} from "./position-utils";
