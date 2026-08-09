import type { ManagerCompetitionId } from "./types";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { CHAMPIONSHIP_CLUB_NAMES } from "../clubs/championship-clubs";
import { CHAMPIONSHIP_ROUNDS } from "./championship/championshipLeague";
import { pushInboxMessage } from "./managerInbox";
import { MANAGER_SEASON_GAMES, type ManagerCareer } from "./types";

export type { ManagerCompetitionId };

export const PROMOTE_RELEGATE_COUNT = 2;

export function defaultSuperLeagueClubs(): string[] {
  return [...CURRENT_PLAYABLE_CLUBS];
}

export function defaultChampionshipClubs(): string[] {
  return [...CHAMPIONSHIP_CLUB_NAMES];
}

export function getCareerSuperLeagueClubs(career: ManagerCareer): string[] {
  return career.superLeagueClubNames?.length
    ? [...career.superLeagueClubNames]
    : defaultSuperLeagueClubs();
}

export function getCareerChampionshipClubs(career: ManagerCareer): string[] {
  return career.championshipClubNames?.length
    ? [...career.championshipClubNames]
    : defaultChampionshipClubs();
}

export function getUserCompetitionId(career: ManagerCareer): ManagerCompetitionId {
  if (career.userCompetitionId === "championship") return "championship";
  if (career.userCompetitionId === "super-league") return "super-league";
  // Legacy saves: infer from static Champ list only when membership unset.
  if (
    !career.superLeagueClubNames &&
    !career.championshipClubNames &&
    CHAMPIONSHIP_CLUB_NAMES.includes(career.club)
  ) {
    return "championship";
  }
  return "super-league";
}

export function isUserInChampionship(career: ManagerCareer): boolean {
  return getUserCompetitionId(career) === "championship";
}

export function getUserLeagueClubs(career: ManagerCareer): string[] {
  return isUserInChampionship(career)
    ? getCareerChampionshipClubs(career)
    : getCareerSuperLeagueClubs(career);
}

export function getUserSeasonGames(career: ManagerCareer): number {
  return isUserInChampionship(career)
    ? CHAMPIONSHIP_ROUNDS
    : MANAGER_SEASON_GAMES;
}

/** Ensure membership arrays + competition id exist on a career. */
export function ensureLeagueMembership(career: ManagerCareer): ManagerCareer {
  const superLeagueClubNames = career.superLeagueClubNames?.length
    ? career.superLeagueClubNames
    : defaultSuperLeagueClubs();
  const championshipClubNames = career.championshipClubNames?.length
    ? career.championshipClubNames
    : defaultChampionshipClubs();
  const userCompetitionId =
    career.userCompetitionId ??
    (CHAMPIONSHIP_CLUB_NAMES.includes(career.club) &&
    championshipClubNames.includes(career.club)
      ? "championship"
      : "super-league");

  if (
    career.superLeagueClubNames === superLeagueClubNames &&
    career.championshipClubNames === championshipClubNames &&
    career.userCompetitionId === userCompetitionId
  ) {
    return career;
  }

  return {
    ...career,
    superLeagueClubNames,
    championshipClubNames,
    userCompetitionId,
  };
}

function sortedByPosition(
  rows: { team: string; position: number }[]
): { team: string; position: number }[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

/**
 * Swap bottom N Super League ↔ top N Championship.
 * Updates membership arrays and the user's competition when affected.
 */
export function applyPromotionRelegation(career: ManagerCareer): {
  career: ManagerCareer;
  promoted: string[];
  relegated: string[];
  userPromoted: boolean;
  userRelegated: boolean;
} {
  const withMembership = ensureLeagueMembership(career);
  const slClubs = getCareerSuperLeagueClubs(withMembership);
  const champClubs = getCareerChampionshipClubs(withMembership);

  // Prefer cached tables on the career (authoritative at season end).
  const slTable = sortedByPosition(
    isUserInChampionship(withMembership)
      ? (withMembership.previousSeasonLeagueTable ??
          slClubs.map((team, i) => ({ team, position: i + 1 })))
      : (withMembership.leagueTable ?? []).map((r) => ({
          team: r.team,
          position: r.position,
        }))
  );

  const champTable = sortedByPosition(
    isUserInChampionship(withMembership)
      ? (withMembership.leagueTable ?? []).map((r) => ({
          team: r.team,
          position: r.position,
        }))
      : (withMembership.championshipCompetition?.standings ?? []).map((r) => ({
          team: r.team,
          position: r.position,
        }))
  );

  // Fallback when Champ AI table missing: use membership order.
  const champOrdered =
    champTable.length >= PROMOTE_RELEGATE_COUNT
      ? champTable
      : champClubs.map((team, i) => ({ team, position: i + 1 }));
  const slOrdered =
    slTable.length >= PROMOTE_RELEGATE_COUNT
      ? slTable
      : slClubs.map((team, i) => ({ team, position: i + 1 }));

  const relegated = slOrdered
    .slice(-PROMOTE_RELEGATE_COUNT)
    .map((r) => r.team)
    .filter((t) => slClubs.includes(t));
  const promoted = champOrdered
    .slice(0, PROMOTE_RELEGATE_COUNT)
    .map((r) => r.team)
    .filter((t) => champClubs.includes(t));

  // Keep sizes stable if tables were incomplete.
  while (relegated.length < PROMOTE_RELEGATE_COUNT && slClubs.length) {
    const candidate = [...slClubs]
      .reverse()
      .find((c) => !relegated.includes(c) && !promoted.includes(c));
    if (!candidate) break;
    relegated.push(candidate);
  }
  while (promoted.length < PROMOTE_RELEGATE_COUNT && champClubs.length) {
    const candidate = champClubs.find(
      (c) => !promoted.includes(c) && !relegated.includes(c)
    );
    if (!candidate) break;
    promoted.push(candidate);
  }

  const nextSl = [
    ...slClubs.filter((c) => !relegated.includes(c)),
    ...promoted,
  ];
  const nextChamp = [
    ...champClubs.filter((c) => !promoted.includes(c)),
    ...relegated,
  ];

  // Enforce expected sizes.
  const superLeagueClubNames = nextSl.slice(0, 14);
  const championshipClubNames = nextChamp.slice(0, 20);

  const userPromoted = promoted.includes(withMembership.club);
  const userRelegated = relegated.includes(withMembership.club);

  let userCompetitionId = getUserCompetitionId(withMembership);
  if (userPromoted) userCompetitionId = "super-league";
  if (userRelegated) userCompetitionId = "championship";

  let next: ManagerCareer = {
    ...withMembership,
    superLeagueClubNames,
    championshipClubNames,
    userCompetitionId,
  };

  const promoList = promoted.join(", ");
  const relegList = relegated.join(", ");
  next = pushInboxMessage(next, {
    id: `prom-rel-${next.seasonYear}`,
    type: "news",
    title: "Promotion & Relegation",
    body: `Promoted to Super League: ${promoList}. Relegated to the Championship: ${relegList}.`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
  });

  if (userPromoted) {
    next = pushInboxMessage(next, {
      id: `user-promoted-${next.seasonYear}`,
      type: "board",
      title: "Promoted to Super League",
      body: `Congratulations — ${next.club} finished in the Championship promotion places and will play Super League next season.`,
      week: next.gameWeek,
      season: next.seasonYear,
      gameWeek: next.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      sender: "Board",
    });
  }
  if (userRelegated) {
    next = pushInboxMessage(next, {
      id: `user-relegated-${next.seasonYear}`,
      type: "board",
      title: "Relegated to the Championship",
      body: `${next.club} finished in the Super League relegation places and will play in the Championship next season.`,
      week: next.gameWeek,
      season: next.seasonYear,
      gameWeek: next.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      sender: "Board",
    });
  }

  next = {
    ...next,
    latestNews: [
      {
        id: `news-prom-rel-${next.seasonYear}`,
        week: next.gameWeek,
        type: "board" as const,
        text: userPromoted
          ? `${next.club} promoted to Super League. Also up: ${promoList}. Down: ${relegList}.`
          : userRelegated
            ? `${next.club} relegated to the Championship. Up: ${promoList}. Also down: ${relegList}.`
            : `Promotion & relegation: ${promoList} up, ${relegList} down.`,
      },
      ...(next.latestNews ?? []),
    ].slice(0, 12),
  };

  return {
    career: next,
    promoted,
    relegated,
    userPromoted,
    userRelegated,
  };
}
