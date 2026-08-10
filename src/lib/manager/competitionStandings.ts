import {
  getCareerClubsForLeague,
  getLeagueSeasonGames,
} from "./managerLeagues";
import { isUserInChampionship } from "./leagueMembership";
import {
  buildLeagueTableFromMatches,
  simulateFullLeagueRound,
} from "./managerFixtures";
import type {
  ManagerCareer,
  ManagerCompetitionId,
  ManagerLeagueRow,
  ManagerRoundMatch,
} from "./types";

/**
 * Resolve standings for a competition tab — never confuse the user's league
 * table with the other competition when they manage a Champ club.
 */
export function getCompetitionStandings(
  career: ManagerCareer,
  competitionId: ManagerCompetitionId
): ManagerLeagueRow[] {
  const userInChamp = isUserInChampionship(career);

  if (competitionId === "championship") {
    if (userInChamp) return career.leagueTable ?? [];
    return career.championshipCompetition?.standings ?? [];
  }

  // Super League (user table when managed; AI table when user is in Champ)
  if (!userInChamp && competitionId === "super-league") {
    return career.leagueTable ?? [];
  }
  if (competitionId === "super-league") {
    return career.aiSuperLeagueStandings?.length
      ? career.aiSuperLeagueStandings
      : buildLeagueTableFromMatches(
          career.aiSuperLeagueRoundMatches ?? [],
          career.club,
          getCareerClubsForLeague(career, "super-league")
        );
  }

  // Future leagues: membership list with empty table until a parallel AI world exists.
  return buildLeagueTableFromMatches(
    [],
    career.club,
    getCareerClubsForLeague(career, competitionId)
  );
}

/** Clubs listed in the Across-the-League squad browser for a competition. */
export function getCompetitionClubNames(
  career: ManagerCareer,
  competitionId: ManagerCompetitionId
): string[] {
  return getCareerClubsForLeague(career, competitionId);
}

function emptySlTable(career: ManagerCareer): ManagerLeagueRow[] {
  return buildLeagueTableFromMatches(
    [],
    career.club,
    getCareerClubsForLeague(career, "super-league")
  );
}

/** Ensure AI Super League state exists when the user is in the Championship. */
export function ensureAiSuperLeague(career: ManagerCareer): ManagerCareer {
  if (!isUserInChampionship(career)) {
    if (
      career.aiSuperLeagueStandings == null &&
      career.aiSuperLeagueRoundMatches == null &&
      career.aiSuperLeagueLastRound == null
    ) {
      return career;
    }
    return {
      ...career,
      aiSuperLeagueStandings: undefined,
      aiSuperLeagueRoundMatches: undefined,
      aiSuperLeagueLastRound: undefined,
    };
  }

  if (
    career.aiSuperLeagueStandings?.length &&
    career.aiSuperLeagueLastRound != null
  ) {
    return career;
  }

  return {
    ...career,
    aiSuperLeagueStandings: emptySlTable(career),
    aiSuperLeagueRoundMatches: career.aiSuperLeagueRoundMatches ?? [],
    aiSuperLeagueLastRound: career.aiSuperLeagueLastRound ?? 0,
  };
}

/**
 * Advance the parallel AI Super League up to the user's game week (Champ careers).
 */
export function tickAiSuperLeagueOnAdvance(
  career: ManagerCareer
): ManagerCareer {
  if (!isUserInChampionship(career)) return career;

  let next = ensureAiSuperLeague(career);
  const clubs = getCareerClubsForLeague(next, "super-league");
  if (clubs.length < 2) return next;

  const targetRound = Math.min(
    getLeagueSeasonGames("super-league"),
    Math.max(0, next.gameWeek)
  );
  let lastRound = next.aiSuperLeagueLastRound ?? 0;
  let roundMatches: ManagerRoundMatch[] = [
    ...(next.aiSuperLeagueRoundMatches ?? []),
  ];

  // Heal saves from the old 0–0 placeholder bug (clubs[0] vs clubs[1] drawn every week).
  if (isCorruptAiSuperLeaguePlaceholder(roundMatches, clubs)) {
    roundMatches = [];
    lastRound = 0;
  }

  while (lastRound < targetRound) {
    const round = lastRound + 1;
    // Full SL round — do not reuse simulateRoundOtherMatches with a 0–0
    // placeholder (that locked clubs[0] vs clubs[1] into D every week).
    const simulated = simulateFullLeagueRound(
      clubs,
      round,
      `${next.seed}-ai-sl`,
      next.leagueClubStates,
      {
        ...next,
        userCompetitionId: "super-league",
        superLeagueClubNames: clubs,
        championshipClubNames: next.championshipClubNames,
      }
    );
    roundMatches = [
      ...roundMatches.filter((m) => m.round !== round),
      ...simulated,
    ];
    lastRound = round;
  }

  const standings = buildLeagueTableFromMatches(
    roundMatches,
    next.club,
    clubs
  );

  return {
    ...next,
    aiSuperLeagueRoundMatches: roundMatches,
    aiSuperLeagueStandings: standings,
    aiSuperLeagueLastRound: lastRound,
  };
}

/** Old bug locked the first two SL clubs into a 0–0 “user” placeholder every round. */
function isCorruptAiSuperLeaguePlaceholder(
  matches: ManagerRoundMatch[],
  clubs: readonly string[]
): boolean {
  if (clubs.length < 2 || matches.length === 0) return false;
  const a = clubs[0]!;
  const b = clubs[1]!;
  let zeroZeroAnchors = 0;
  for (const m of matches) {
    if (m.homeScore !== 0 || m.awayScore !== 0) continue;
    const pair =
      (m.homeTeam === a && m.awayTeam === b) ||
      (m.homeTeam === b && m.awayTeam === a);
    if (pair) zeroZeroAnchors += 1;
  }
  return zeroZeroAnchors >= 3;
}
