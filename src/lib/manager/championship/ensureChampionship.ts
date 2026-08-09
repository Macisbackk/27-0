import type { ManagerCareer } from "../types";
import {
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  isUserInChampionship,
} from "../leagueMembership";
import {
  generateChampionshipSquads,
  GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
} from "./championshipSquads";
import {
  advanceChampionshipToGameWeek,
  createChampionshipCompetition,
  CHAMPIONSHIP_COMPETITION_VERSION,
  CHAMPIONSHIP_ROUNDS,
  migrateChampionshipCompetitionToHomeAndAway,
} from "./championshipLeague";
import {
  createExpandedChallengeCupBracket,
  isExpandedChallengeCup,
  CHALLENGE_CUP_SCHEMA_VERSION,
  standingsToCupSeeding,
} from "./championshipChallengeCup";
import { countCupFixturesPlayed, countLeagueFixturesPlayed } from "../managerChallengeCup";
import {
  generateLeagueListedPlayers,
  migrateTransferOfferCategories,
} from "../managerTransferLeague";
import { buildManagerScheduleFromChampionship } from "../managerFixtures";

const LOAN_MARKET_VERSION = 1;

/**
 * Ensure Championship squads, league, and expanded cup schema exist on a career.
 * Safe for mid-season: does not redraw an in-progress legacy cup.
 * Rating-scale upgrades for existing squads are handled by
 * migratePlayerRatingsV4 / migrateChampionshipFirstSeasonBalance.
 */
export function ensureChampionshipSystems(
  career: ManagerCareer
): ManagerCareer {
  let next = career;

  if (
    !next.championshipSquads ||
    next.championshipSquads.version < 1 ||
    Object.keys(next.championshipSquads.players).length === 0
  ) {
    const squads = generateChampionshipSquads(next.seed, next.seasonYear);
    next = {
      ...next,
      championshipSquads: squads,
      generatedChampionshipSquadsVersion: squads.version,
    };
  } else if (
    next.championshipSquads.version < GENERATED_CHAMPIONSHIP_SQUADS_VERSION
  ) {
    // Ratings already migrated; bump schema marker so we don't regenerate mid-career.
    next = {
      ...next,
      championshipSquads: {
        ...next.championshipSquads,
        version: GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
      },
      generatedChampionshipSquadsVersion: GENERATED_CHAMPIONSHIP_SQUADS_VERSION,
    };
  }

  if (!next.championshipCompetition) {
    // Align processed rounds with current week so we don't backfill a news backlog
    const startRound = Math.min(
      CHAMPIONSHIP_ROUNDS,
      Math.max(0, next.gameWeek)
    );
    let competition = createChampionshipCompetition(
      next.seed,
      next.seasonYear,
      {
        startRound,
        clubNames: getCareerChampionshipClubs(next),
      }
    );
    // Simulate up to current week once so the table is live
    competition = advanceChampionshipToGameWeek(
      competition,
      next.gameWeek,
      next.seed,
      next.championshipSquads
    );
    next = {
      ...next,
      championshipCompetition: competition,
      championshipCompetitionVersion: competition.version,
    };
  } else if (
    (next.championshipCompetition.version ?? 0) <
      CHAMPIONSHIP_COMPETITION_VERSION ||
    next.championshipCompetition.fixtures.reduce(
      (m, f) => Math.max(m, f.round),
      0
    ) < CHAMPIONSHIP_ROUNDS
  ) {
    let competition = migrateChampionshipCompetitionToHomeAndAway(
      next.championshipCompetition,
      next.seasonYear
    );
    competition = advanceChampionshipToGameWeek(
      competition,
      next.gameWeek,
      next.seed,
      next.championshipSquads
    );
    next = {
      ...next,
      championshipCompetition: competition,
      championshipCompetitionVersion: competition.version,
    };
    // Champ user schedule must cover the return legs.
    if (
      isUserInChampionship(next) &&
      (next.schedule?.length ?? 0) < CHAMPIONSHIP_ROUNDS
    ) {
      const rebuilt = buildManagerScheduleFromChampionship(
        next.club,
        competition,
        next.seed
      );
      const playedLeague = countLeagueFixturesPlayed(next);
      next = {
        ...next,
        schedule: rebuilt,
        currentFixtureIndex: Math.min(playedLeague, rebuilt.length),
      };
    }
  }

  const cupPlayed = countCupFixturesPlayed(next);
  const cup = next.challengeCup;
  const expanded = cup && isExpandedChallengeCup(cup);
  const schemaVersion =
    expanded && "expandedMeta" in cup
      ? (cup as { expandedMeta?: { schemaVersion?: number } }).expandedMeta
          ?.schemaVersion ?? 0
      : 0;
  // Rebuild empty cups onto the latest seeded draw.
  if (cupPlayed === 0 && (!expanded || schemaVersion < CHALLENGE_CUP_SCHEMA_VERSION)) {
    next = {
      ...next,
      challengeCup: createExpandedChallengeCupBracket(
        `${next.seed}-cup`,
        next.club,
        {
          previousSeasonLeagueTable: standingsToCupSeeding(
            next.previousSeasonLeagueTable
          ),
          previousSeasonChampionshipTable: standingsToCupSeeding(
            next.previousSeasonChampionshipTable
          ),
          championshipClubs: getCareerChampionshipClubs(next),
          superLeagueClubs: getCareerSuperLeagueClubs(next),
        }
      ),
      challengeCupSchemaVersion: CHALLENGE_CUP_SCHEMA_VERSION,
    };
  } else if (expanded) {
    next = {
      ...next,
      challengeCupSchemaVersion:
        schemaVersion || CHALLENGE_CUP_SCHEMA_VERSION,
    };
  }

  if (next.aiChampionshipTransferVersion == null) {
    next = { ...next, aiChampionshipTransferVersion: 1 };
  }

  if ((next.aiTransferActivityVersion ?? 0) < 3) {
    next = { ...next, aiTransferActivityVersion: 3 };
  }
  if ((next.transferTargetBalanceVersion ?? 0) < 4) {
    next = {
      ...next,
      transferTargetBalanceVersion: 4,
      transferTargetCooldowns: next.transferTargetCooldowns ?? {},
      transferTargetClubCooldowns: next.transferTargetClubCooldowns ?? {},
      reserveToChampionshipClubCooldowns:
        next.reserveToChampionshipClubCooldowns ?? {},
      reserveToChampionshipClubRequestCounts:
        next.reserveToChampionshipClubRequestCounts ?? {},
    };
  }
  if ((next.transferOfferCategoryVersion ?? 0) < 2) {
    next = migrateTransferOfferCategories(next);
  }
  if ((next.matchResolutionRulesVersion ?? 0) < 2) {
    next = { ...next, matchResolutionRulesVersion: 2 };
  }
  if ((next.completedTransferRecordVersion ?? 0) < 2) {
    next = { ...next, completedTransferRecordVersion: 2 };
  }
  if ((next.managerAlignmentSystemVersion ?? 0) < 1) {
    next = { ...next, managerAlignmentSystemVersion: 1 };
  }

  if (next.reserveToChampionshipTransfersVersion == null) {
    next = {
      ...next,
      reserveToChampionshipTransfersVersion: 1,
      reserveToChampionshipCooldowns: next.reserveToChampionshipCooldowns ?? {},
      championshipReserveSigningsThisSeason:
        next.championshipReserveSigningsThisSeason ?? 0,
    };
  }

  if ((next.loanMarketVersion ?? 0) < LOAN_MARKET_VERSION) {
    const listed = generateLeagueListedPlayers(
      next,
      next.seed,
      next.gameWeek
    );
    next = {
      ...next,
      loanMarketVersion: LOAN_MARKET_VERSION,
      leagueListedPlayers: listed,
      transferMarket: listed.map((l) => l.playerId),
    };
  }

  return next;
}

/** Advance Championship league to match Super League game week. */
export function tickChampionshipOnAdvance(
  career: ManagerCareer
): ManagerCareer {
  if (!career.championshipCompetition) {
    return ensureChampionshipSystems(career);
  }
  const competition = advanceChampionshipToGameWeek(
    career.championshipCompetition,
    career.gameWeek,
    career.seed,
    career.championshipSquads
  );
  return { ...career, championshipCompetition: competition };
}
