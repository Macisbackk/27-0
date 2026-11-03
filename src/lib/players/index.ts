import type { Player, PlayerCategory, Position } from "../types";
import { getValueTier as getValueTierFromRating } from "./ratings";
import { getClubByName } from "../clubs";
import { clubsMatch } from "../clubs/club-match";
import { getActiveSuperLeagueClubNames } from "../clubs/super-league-display";
import { isSuperLeagueEligiblePlayer } from "./super-league-eligibility";
import { isHiddenPlayer } from "./goat";
import { isGameplayYearCard, isYearPinnedPlayer } from "./year-card";
import { applyPlayerRegistry, buildPlayerRegistry, buildPlayerRegistryInSlices } from "./registry";
// Installs the registry-aware placement profile into player-positions (see placement-profile.ts).
import "./placement-profile";

const store = {
  all: [] as Player[],
  current: [] as Player[],
  historic: [] as Player[],
  legends: [] as Player[],
  byId: new Map<string, Player>(),
};

let clientLoadPromise: Promise<void> | null = null;
let clientLoadComplete = false;

function bootstrapRegistryFromSync(): void {
  if (store.byId.size > 0) {
    clientLoadComplete = true;
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildSyncPlayerRegistry } = require("./sync-bootstrap") as typeof import("./sync-bootstrap");
  applyPlayerRegistry(store, buildSyncPlayerRegistry());
  clientLoadComplete = true;
}

async function loadClientRegistryFromChunks(): Promise<void> {
  const { loadAllPlayerRawRows } = await import("./player-chunks");
  const raw = await loadAllPlayerRawRows();
  applyPlayerRegistry(
    store,
    buildPlayerRegistry(raw.current, raw.historic, raw.legends)
  );
  clientLoadComplete = true;
}

function ensureRegistrySync(): void {
  bootstrapRegistryFromSync();
}

export function arePlayersLoaded(): boolean {
  return clientLoadComplete && store.byId.size > 0;
}

/** Ensures player registry is ready. Sync bootstrap first; chunks optional in background. */
export function ensurePlayersLoaded(): Promise<void> {
  bootstrapRegistryFromSync();
  if (clientLoadComplete) return Promise.resolve();
  if (!clientLoadPromise) {
    clientLoadPromise = loadClientRegistryFromChunks().catch((error) => {
      clientLoadPromise = null;
      throw error;
    });
  }
  return clientLoadPromise;
}

/**
 * /play sets this flag (players/defer-registry.ts) before this module first loads, so the
 * registry is built in slices by loadPlayersInSlices() instead of in one long task during
 * hydration. Anything that reads a player before then still gets the synchronous build.
 */
const DEFER_REGISTRY_FLAG = "__27_0_deferPlayerRegistry";

function isRegistryDeferred(): boolean {
  return typeof window !== "undefined" && (globalThis as Record<string, unknown>)[DEFER_REGISTRY_FLAG] === true;
}

function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched && typeof sched.yield === "function") return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let sliceLoadPromise: Promise<void> | null = null;

/** Builds the registry without blocking the page (falls back to the one-shot build on error). */
export function loadPlayersInSlices(): Promise<void> {
  if (store.byId.size > 0) {
    clientLoadComplete = true;
    return Promise.resolve();
  }
  if (!sliceLoadPromise) {
    sliceLoadPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSyncRawPlayerRows } = require("./sync-bootstrap") as typeof import("./sync-bootstrap");
      const raw = getSyncRawPlayerRows();
      await yieldToMain();
      const registry = await buildPlayerRegistryInSlices(raw.current, raw.historic, raw.legends, yieldToMain);
      // Something may have needed a player meanwhile and built it synchronously: keep that one.
      if (store.byId.size === 0) applyPlayerRegistry(store, registry);
      clientLoadComplete = true;
    })().catch(() => {
      bootstrapRegistryFromSync();
    });
  }
  return sliceLoadPromise;
}

if (!isRegistryDeferred()) bootstrapRegistryFromSync();

export const PLAYER_POOL = store.all;
export const CURRENT_PLAYERS = store.current;
export const HISTORIC_PLAYERS = store.historic;
export const LEGEND_PLAYERS = store.legends;

export function getAllDatabasePlayers(): Player[] {
  ensureRegistrySync();
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
  ensureRegistrySync();
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
  ensureRegistrySync();
  const canonical = getClubByName(club)?.name ?? club;
  return PLAYER_POOL.filter((p) => clubsMatch(p.club, canonical));
}

/** Active Super League clubs that have at least one player in the database. */
export function getClubsWithPlayers(): string[] {
  ensureRegistrySync();
  const withPlayers = new Set(
    PLAYER_POOL.map((p) => getClubByName(p.club)?.name ?? p.club)
  );
  return getActiveSuperLeagueClubNames()
    .filter((c) => withPlayers.has(c))
    .sort((a, b) => a.localeCompare(b));
}

export { formatValue } from "./format-value";

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
  getPlayerDisplayName,
  resolvePlayerDisplayName,
  normalizePlayerNameWhitespace,
  type PlayerNameSource,
  type PlayerNameResolveResult,
} from "./display-name-resolver";
export {
  toPlayerShowcaseViewModel,
  formatShowcaseDisplayName,
  assertShowcaseCardPopupNameMatch,
  type PlayerShowcaseViewModel,
} from "./showcase-view-model";
export {
  CURRENT_SEASON_YEAR,
  CURRENT_ERA_SEASON_YEARS,
  isCurrentEraSeasonYear,
  isActiveCurrentSeasonYear,
  getUpcomingCurrentEraSeasonYears,
  resolveCurrentCardSeasonYear,
  isShowcaseCurrentPlayer,
  isCurrentSuperLeaguePlayer,
  type CurrentEraSeasonYear,
} from "./current-season";
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

/** Public player pool — includes year cards and canonical career records. */
export function getShowcasePlayers(): Player[] {
  ensureRegistrySync();
  return PLAYER_POOL.filter(
    (p) =>
      !isHiddenPlayer(p) &&
      isAvailableInGame(p)
  );
}

/** Players eligible for recruitment / draft offers — year-pinned only. */
export function getRecruitablePlayers(): Player[] {
  ensureRegistrySync();
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
