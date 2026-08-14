/**
 * Authoritative promotion / relegation + season membership swap.
 * Individual screens must not move clubs between competitions.
 */
import type { ManagerCareer, ManagerLeagueRow } from "./types";
import {
  ensureLeagueMembership,
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  getUserCompetitionId,
  isUserInChampionship,
} from "./leagueMembership";
import {
  getAutoPromoteCount,
  getAutoRelegateCount,
} from "./managerLeagues";
import {
  finalizeMillionPoundGameIfNeeded,
  MILLION_POUND_GAME_NAME,
} from "./managerMillionPoundGame";
import { getChampionshipPlayoffWinner } from "./managerChampionshipPlayoffs";
import { getManagerLeagueTable } from "./managerFixtures";
import { pushInboxMessage } from "./managerInbox";
import { deriveCompetitionPhase } from "./competitionPhase";

export type SeasonMembershipMoves = {
  autoPromoted: string[];
  mpgPromoted: string[];
  autoRelegated: string[];
  mpgRelegated: string[];
  promoted: string[];
  relegated: string[];
  userPromoted: boolean;
  userRelegated: boolean;
  mpgWinner?: string;
  mpgLoser?: string;
};

function sortedByPosition(
  rows: { team: string; position: number }[]
): { team: string; position: number }[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

function slStandings(career: ManagerCareer): { team: string; position: number }[] {
  const slClubs = getCareerSuperLeagueClubs(career);
  const rows = isUserInChampionship(career)
    ? (career.aiSuperLeagueStandings?.length
        ? career.aiSuperLeagueStandings
        : career.previousSeasonLeagueTable)
    : getManagerLeagueTable(career);
  const mapped = (rows ?? []).map((r: ManagerLeagueRow | { team: string; position: number }) => ({
    team: r.team,
    position: r.position,
  }));
  return sortedByPosition(
    mapped.length >= slClubs.length
      ? mapped
      : slClubs.map((team, i) => ({ team, position: i + 1 }))
  );
}

function champStandings(
  career: ManagerCareer
): { team: string; position: number }[] {
  const champClubs = getCareerChampionshipClubs(career);
  const rows = isUserInChampionship(career)
    ? getManagerLeagueTable(career)
    : (career.championshipCompetition?.standings ?? []);
  const mapped = rows.map((r) => ({ team: r.team, position: r.position }));
  return sortedByPosition(
    mapped.length >= Math.min(champClubs.length, 1)
      ? mapped
      : champClubs.map((team, i) => ({ team, position: i + 1 }))
  );
}

/**
 * Compute the four membership outcomes from completed competitions.
 * Does not mutate career. Requires MPG result when both sides are known.
 */
export function resolveSeasonMembershipMoves(
  career: ManagerCareer
): SeasonMembershipMoves {
  const ready = finalizeMillionPoundGameIfNeeded(ensureLeagueMembership(career));
  const slClubs = getCareerSuperLeagueClubs(ready);
  const champClubs = getCareerChampionshipClubs(ready);
  const slOrdered = slStandings(ready);
  const champOrdered = champStandings(ready);
  const autoPromoteCount = getAutoPromoteCount();
  const autoRelegateCount = getAutoRelegateCount();

  const autoPromoted = champOrdered
    .filter((r) => r.position <= autoPromoteCount)
    .slice(0, autoPromoteCount)
    .map((r) => r.team)
    .filter((t) => champClubs.includes(t));

  const autoRelegated = slOrdered
    .filter((r) => r.position === 12)
    .slice(0, autoRelegateCount)
    .map((r) => r.team)
    .filter((t) => slClubs.includes(t));

  while (autoRelegated.length < autoRelegateCount && slClubs.length) {
    const candidate = [...slClubs]
      .reverse()
      .find((c) => !autoRelegated.includes(c) && !autoPromoted.includes(c));
    if (!candidate) break;
    autoRelegated.push(candidate);
  }
  while (autoPromoted.length < autoPromoteCount && champClubs.length) {
    const candidate = champClubs.find(
      (c) => !autoPromoted.includes(c) && !autoRelegated.includes(c)
    );
    if (!candidate) break;
    autoPromoted.push(candidate);
  }

  const mpg = ready.millionPoundGame;
  const mpgPromoted: string[] = [];
  const mpgRelegated: string[] = [];
  if (mpg?.status === "complete" && mpg.winner && mpg.loser) {
    if (champClubs.includes(mpg.winner) && !autoPromoted.includes(mpg.winner)) {
      mpgPromoted.push(mpg.winner);
    }
    if (slClubs.includes(mpg.loser) && !autoRelegated.includes(mpg.loser)) {
      mpgRelegated.push(mpg.loser);
    }
  }

  const promoted = [...autoPromoted, ...mpgPromoted];
  const relegated = [...autoRelegated, ...mpgRelegated];

  return {
    autoPromoted,
    mpgPromoted,
    autoRelegated,
    mpgRelegated,
    promoted,
    relegated,
    userPromoted: promoted.includes(ready.club),
    userRelegated: relegated.includes(ready.club),
    mpgWinner: mpg?.winner,
    mpgLoser: mpg?.loser,
  };
}

export function applySeasonMembershipMoves(
  career: ManagerCareer,
  moves: SeasonMembershipMoves
): ManagerCareer {
  const withMembership = ensureLeagueMembership(career);
  const slClubs = getCareerSuperLeagueClubs(withMembership);
  const champClubs = getCareerChampionshipClubs(withMembership);

  const nextSl = [
    ...slClubs.filter((c) => !moves.relegated.includes(c)),
    ...moves.promoted,
  ];
  const nextChamp = [
    ...champClubs.filter((c) => !moves.promoted.includes(c)),
    ...moves.relegated,
  ];

  let userCompetitionId = getUserCompetitionId(withMembership);
  if (moves.userPromoted) userCompetitionId = "super-league";
  if (moves.userRelegated) userCompetitionId = "championship";

  return {
    ...withMembership,
    superLeagueClubNames: nextSl.slice(0, 14),
    championshipClubNames: nextChamp.slice(0, 20),
    userCompetitionId,
  };
}

export function applyPromotionRelegationInbox(
  career: ManagerCareer,
  moves: SeasonMembershipMoves
): ManagerCareer {
  let next = career;
  const mpg = next.millionPoundGame;
  next = pushInboxMessage(next, {
    id: `prom-rel-${next.seasonYear}`,
    type: "news",
    title: "Promotion & Relegation",
    body: `Automatic promotion: ${moves.autoPromoted[0] ?? "none"}. Automatic relegation: ${moves.autoRelegated[0] ?? "none"}. ${
      mpg?.winner ? `${MILLION_POUND_GAME_NAME} winner: ${mpg.winner}.` : ""
    }`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
  });

  if (moves.userPromoted) {
    const viaMpg = moves.mpgPromoted.includes(next.club);
    next = pushInboxMessage(next, {
      id: `user-promoted-${next.seasonYear}`,
      type: "board",
      title: "Promoted to Super League",
      body: viaMpg
        ? `${next.club} promoted to Super League after winning the ${MILLION_POUND_GAME_NAME}.`
        : `${next.club} finished 1st — automatic promotion to Super League.`,
      week: next.gameWeek,
      season: next.seasonYear,
      gameWeek: next.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      sender: "Board",
    });
  }
  if (moves.userRelegated) {
    const viaMpg = moves.mpgRelegated.includes(next.club);
    next = pushInboxMessage(next, {
      id: `user-relegated-${next.seasonYear}`,
      type: "board",
      title: "Relegated to the Championship",
      body: viaMpg
        ? `${next.club} relegated after losing the ${MILLION_POUND_GAME_NAME}.`
        : `${next.club} finished last — automatic relegation to the Championship.`,
      week: next.gameWeek,
      season: next.seasonYear,
      gameWeek: next.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      sender: "Board",
    });
  }

  const promoList = moves.promoted.join(", ");
  const relegList = moves.relegated.join(", ");
  return {
    ...next,
    latestNews: [
      {
        id: `news-prom-rel-${next.seasonYear}`,
        week: next.gameWeek,
        type: "board" as const,
        text: moves.userPromoted
          ? `${next.club} promoted to Super League. Also up: ${promoList}. Down: ${relegList}.`
          : moves.userRelegated
            ? `${next.club} relegated to the Championship. Up: ${promoList}. Also down: ${relegList}.`
            : `Promotion & relegation: ${promoList} up, ${relegList} down.`,
      },
      ...(next.latestNews ?? []),
    ].slice(0, 12),
  };
}

/**
 * Swap Super League ↔ Championship from the authoritative membership resolver.
 * Screens must not call this except via completeSeasonTransition.
 */
export function applyPromotionRelegation(career: ManagerCareer): {
  career: ManagerCareer;
  promoted: string[];
  relegated: string[];
  userPromoted: boolean;
  userRelegated: boolean;
} {
  const withMpg = finalizeMillionPoundGameIfNeeded(ensureLeagueMembership(career));
  const moves = resolveSeasonMembershipMoves(withMpg);
  const swapped = applySeasonMembershipMoves(withMpg, moves);
  const next = applyPromotionRelegationInbox(swapped, moves);
  return {
    career: next,
    promoted: moves.promoted,
    relegated: moves.relegated,
    userPromoted: moves.userPromoted,
    userRelegated: moves.userRelegated,
  };
}

export function championshipPlayoffWinnerClub(
  career: ManagerCareer
): string | null {
  return getChampionshipPlayoffWinner(career.championshipPlayoffs);
}

export function competitionsReadyForTransition(career: ManagerCareer): boolean {
  const phase = deriveCompetitionPhase(career);
  return (
    phase === "SEASON_TRANSITION_READY" ||
    phase === "MILLION_POUND_GAME_COMPLETE" ||
    Boolean(career.isSeasonComplete)
  );
}
