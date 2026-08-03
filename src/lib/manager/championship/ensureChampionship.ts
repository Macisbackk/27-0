import type { ManagerCareer } from "../types";
import { generateChampionshipSquads } from "./championshipSquads";
import {
  advanceChampionshipToGameWeek,
  createChampionshipCompetition,
} from "./championshipLeague";
import {
  createExpandedChallengeCupBracket,
  isExpandedChallengeCup,
} from "./championshipChallengeCup";
import { countCupFixturesPlayed } from "../managerChallengeCup";

/**
 * Ensure Championship squads, league, and expanded cup schema exist on a career.
 * Safe for mid-season: does not redraw an in-progress legacy cup.
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
  }

  if (!next.championshipCompetition) {
    // Align processed rounds with current week so we don't backfill a news backlog
    const startRound = Math.min(19, Math.max(0, next.gameWeek));
    let competition = createChampionshipCompetition(
      next.seed,
      next.seasonYear,
      { startRound }
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
  }

  const cupPlayed = countCupFixturesPlayed(next);
  const cup = next.challengeCup;
  const expanded = cup && isExpandedChallengeCup(cup);
  if (!expanded && cupPlayed === 0) {
    next = {
      ...next,
      challengeCup: createExpandedChallengeCupBracket(
        `${next.seed}-cup`,
        next.club
      ),
      challengeCupSchemaVersion: 2,
    };
  } else if (expanded) {
    next = {
      ...next,
      challengeCupSchemaVersion: 2,
    };
  }

  if (next.aiChampionshipTransferVersion == null) {
    next = { ...next, aiChampionshipTransferVersion: 1 };
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
