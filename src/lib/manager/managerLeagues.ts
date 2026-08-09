/**
 * Canonical Manager Mode league registry.
 *
 * To add a new playable league, follow `.cursor/rules/manager-leagues.mdc`
 * and extend this module first — UI, season length, economy, and board rules
 * should read from here instead of hardcoding Super League / Championship.
 */
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { CHAMPIONSHIP_CLUB_NAMES } from "../clubs/championship-clubs";
import { CHAMPIONSHIP_ROUNDS } from "./championship/championshipLeague";
import {
  CHAMPIONSHIP_STAR_TIER_BIOS,
  MANAGER_STAR_TIER_BIOS,
} from "./managerLeagueCopy";
import type { ManagerCareer, ManagerCompetitionId } from "./types";
import { MANAGER_SEASON_GAMES } from "./types";
import type { ManagerClubExpectationTier } from "./club-config";

/** Board thresholds for season evaluation (positions are 1-based). */
export interface ManagerLeagueBoardRules {
  /** League table position that meets "title" when playoff finish is not required. */
  titleLeaguePosition: number;
  /**
   * If set, "title" also requires this playoff finish label
   * (e.g. Super League Champions). Null = league position alone.
   */
  titlePlayoffFinish: string | null;
  topMaxPosition: number;
  playoffsMaxPosition: number;
  midTableMaxPosition: number;
  /** Finish at or above this position to "survive" / avoid bottom. */
  surviveMaxPosition: number;
}

/** Optional promotion / relegation link between two leagues. */
export interface ManagerLeaguePropRel {
  /** Clubs promoted from this league each season. */
  promoteCount: number;
  /** Clubs relegated into this league from `linkedLeagueId`. */
  relegateFromLinkedCount: number;
  /** Partner competition (e.g. Champ ↔ Super League). */
  linkedLeagueId: ManagerCompetitionId;
}

/**
 * Full runtime definition for a Manager competition.
 * Keep display + sim knobs here so new leagues are data-driven.
 */
export interface ManagerLeagueDefinition {
  id: ManagerCompetitionId;
  name: string;
  shortName: string;
  /** League-select bio. */
  bio: string;
  /** Club-select header blurb after a league is chosen. */
  clubSelectBlurb: string;
  sortOrder: number;
  /** Appears on new-career league select when true and clubs exist. */
  selectable: boolean;
  /** Regular-season fixtures for a managed club in this league. */
  seasonGames: number;
  /** Include Magic Weekend in schedule generation. */
  includeMagicWeekend: boolean;
  /** User enters SL-style playoffs after the league phase. */
  hasPlayoffs: boolean;
  /** Trophy / season-review label for finishing 1st (or GF winners when playoffs). */
  leagueTitleLabel: string;
  /** Transfer/wage budget multiplier vs Super League baseline (1 = full SL). */
  economyScale: number;
  /** Subtracted from comfort signing rating (Champ is weaker). */
  comfortRatingOffset: number;
  starTierBios: Record<number, string>;
  boardRules: ManagerLeagueBoardRules;
  /** Present when this league swaps clubs with another at season end. */
  promotionRelegation?: ManagerLeaguePropRel;
  /** Default membership when a career has no saved list for this league. */
  defaultClubNames: () => string[];
}

const SUPER_LEAGUE_DEF: ManagerLeagueDefinition = {
  id: "super-league",
  name: "Super League",
  shortName: "SL",
  bio: "England's top flight — the biggest budgets, best squads, and Grand Final glory.",
  clubSelectBlurb:
    "Top-tier money, ratings, and board targets. Lift the Super League trophy.",
  sortOrder: 1,
  selectable: true,
  seasonGames: MANAGER_SEASON_GAMES,
  includeMagicWeekend: true,
  hasPlayoffs: true,
  leagueTitleLabel: "Super League Champions",
  economyScale: 1,
  comfortRatingOffset: 0,
  starTierBios: MANAGER_STAR_TIER_BIOS,
  boardRules: {
    titleLeaguePosition: 1,
    titlePlayoffFinish: "Super League Champions",
    topMaxPosition: 3,
    playoffsMaxPosition: 6,
    midTableMaxPosition: 10,
    surviveMaxPosition: 12,
  },
  promotionRelegation: {
    promoteCount: 0,
    relegateFromLinkedCount: 2,
    linkedLeagueId: "championship",
  },
  defaultClubNames: () => [...CURRENT_PLAYABLE_CLUBS],
};

const CHAMPIONSHIP_DEF: ManagerLeagueDefinition = {
  id: "championship",
  name: "Championship",
  shortName: "Champ",
  bio: "England's second tier — tighter budgets, tougher builds, and promotion on the line.",
  clubSelectBlurb:
    "Home-and-away Championship — tighter budgets than Super League, finish top two to earn promotion.",
  sortOrder: 2,
  selectable: true,
  seasonGames: CHAMPIONSHIP_ROUNDS,
  includeMagicWeekend: false,
  hasPlayoffs: false,
  leagueTitleLabel: "Championship Champions",
  economyScale: 0.48,
  comfortRatingOffset: 8,
  starTierBios: CHAMPIONSHIP_STAR_TIER_BIOS,
  boardRules: {
    titleLeaguePosition: 1,
    titlePlayoffFinish: null,
    topMaxPosition: 2,
    playoffsMaxPosition: 4,
    midTableMaxPosition: 10,
    surviveMaxPosition: 18,
  },
  promotionRelegation: {
    promoteCount: 2,
    relegateFromLinkedCount: 0,
    linkedLeagueId: "super-league",
  },
  defaultClubNames: () => [...CHAMPIONSHIP_CLUB_NAMES],
};

/**
 * Exhaustive registry — TypeScript errors if a ManagerCompetitionId is missing.
 * Add new leagues here first, then wire clubs + career systems.
 */
export const MANAGER_LEAGUES: Record<
  ManagerCompetitionId,
  ManagerLeagueDefinition
> = {
  "super-league": SUPER_LEAGUE_DEF,
  championship: CHAMPIONSHIP_DEF,
};

export const MANAGER_LEAGUE_IDS = Object.keys(
  MANAGER_LEAGUES
) as ManagerCompetitionId[];

/** @deprecated Prefer ManagerLeagueDefinition */
export type ManagerPlayableLeagueDefinition = ManagerLeagueDefinition;

/** Sorted list of all registered leagues (including non-selectable stubs). */
export const MANAGER_PLAYABLE_LEAGUES: readonly ManagerLeagueDefinition[] =
  MANAGER_LEAGUE_IDS.map((id) => MANAGER_LEAGUES[id]).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

export function getManagerLeague(
  id: ManagerCompetitionId
): ManagerLeagueDefinition {
  return MANAGER_LEAGUES[id];
}

export function getManagerPlayableLeague(
  id: ManagerCompetitionId
): ManagerLeagueDefinition | undefined {
  return MANAGER_LEAGUES[id];
}

export function getLeagueDisplayName(id: ManagerCompetitionId): string {
  return MANAGER_LEAGUES[id].name;
}

export function getLeagueShortName(id: ManagerCompetitionId): string {
  return MANAGER_LEAGUES[id].shortName;
}

export function getLeagueSeasonGames(id: ManagerCompetitionId): number {
  return MANAGER_LEAGUES[id].seasonGames;
}

export function leagueHasPlayoffs(id: ManagerCompetitionId): boolean {
  return MANAGER_LEAGUES[id].hasPlayoffs;
}

export function leagueIncludesMagicWeekend(id: ManagerCompetitionId): boolean {
  return MANAGER_LEAGUES[id].includeMagicWeekend;
}

export function getLeagueEconomyScale(id: ManagerCompetitionId): number {
  return MANAGER_LEAGUES[id].economyScale;
}

export function getLeagueComfortRatingOffset(id: ManagerCompetitionId): number {
  return MANAGER_LEAGUES[id].comfortRatingOffset;
}

export function getLeagueTitleLabel(id: ManagerCompetitionId): string {
  return MANAGER_LEAGUES[id].leagueTitleLabel;
}

/** Promote/relegate swap size for the linked SL ↔ Champ pair. */
export function getLinkedPromoteRelegateCount(): number {
  const sl = MANAGER_LEAGUES["super-league"].promotionRelegation;
  const ch = MANAGER_LEAGUES.championship.promotionRelegation;
  return Math.max(
    sl?.relegateFromLinkedCount ?? 0,
    ch?.promoteCount ?? 0,
    2
  );
}

export function getDefaultClubsForLeague(id: ManagerCompetitionId): string[] {
  return MANAGER_LEAGUES[id].defaultClubNames();
}

/**
 * Membership for a competition on a career.
 * SL / Champ use legacy fields; other ids use leagueMembershipById.
 */
/**
 * Membership for a competition on a career.
 * SL / Champ use legacy fields. When adding a league id, extend this switch
 * (and optionally `leagueMembershipById` for non-legacy storage).
 */
export function getCareerClubsForLeague(
  career: ManagerCareer,
  id: ManagerCompetitionId
): string[] {
  switch (id) {
    case "super-league":
      return career.superLeagueClubNames?.length
        ? [...career.superLeagueClubNames]
        : getDefaultClubsForLeague(id);
    case "championship":
      return career.championshipClubNames?.length
        ? [...career.championshipClubNames]
        : getDefaultClubsForLeague(id);
  }
}

export function setCareerClubsForLeague(
  career: ManagerCareer,
  id: ManagerCompetitionId,
  clubs: string[]
): ManagerCareer {
  switch (id) {
    case "super-league":
      return { ...career, superLeagueClubNames: [...clubs] };
    case "championship":
      return { ...career, championshipClubNames: [...clubs] };
  }
}

export function didMeetLeagueBoardExpectation(
  competition: ManagerCompetitionId,
  tier: ManagerClubExpectationTier,
  position: number,
  playoffFinish: string | null
): boolean {
  const rules = MANAGER_LEAGUES[competition].boardRules;
  switch (tier) {
    case "title":
      if (rules.titlePlayoffFinish) {
        return playoffFinish === rules.titlePlayoffFinish;
      }
      return position <= rules.titleLeaguePosition;
    case "top":
      return position <= rules.topMaxPosition;
    case "playoffs":
      return position <= rules.playoffsMaxPosition;
    case "mid-table":
      return position <= rules.midTableMaxPosition;
    case "avoid-bottom":
    case "survive":
      return position <= rules.surviveMaxPosition;
  }
}
