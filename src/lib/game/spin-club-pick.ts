import type { SpinPoolVariant } from "./player-pool-eligibility";
import type { TeamYearPool } from "./team-year-pools";

export function groupPoolsByClub(
  pools: TeamYearPool[]
): Map<string, TeamYearPool[]> {
  const map = new Map<string, TeamYearPool[]>();
  for (const pool of pools) {
    const list = map.get(pool.team) ?? [];
    list.push(pool);
    map.set(pool.team, list);
  }
  return map;
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export interface ClubUniformPickResult {
  pool: TeamYearPool | null;
  club: string | null;
  rerollCount: number;
  rejectedIncomplete: number;
}

function pickUniformTeamYearFromClubPools(
  clubPools: TeamYearPool[],
  rng: () => number,
  hasEligiblePlayers: (pool: TeamYearPool) => boolean
): TeamYearPool | null {
  const eligible = clubPools.filter((pool) => hasEligiblePlayers(pool));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(rng() * eligible.length)]!;
}

/**
 * Uniform club pick, then uniform team-year within that club.
 * If the draw cannot supply players, remove that club and reroll.
 */
export function pickClubUniformTeamYearPool(
  eligiblePools: TeamYearPool[],
  rng: () => number,
  hasEligiblePlayers: (pool: TeamYearPool) => boolean,
  _variant: SpinPoolVariant = "era"
): ClubUniformPickResult {
  if (eligiblePools.length === 0) {
    return { pool: null, club: null, rerollCount: 0, rejectedIncomplete: 0 };
  }

  const byClub = groupPoolsByClub(eligiblePools);
  let remainingClubs = shuffleArray([...byClub.keys()], rng);
  let rerollCount = 0;
  let rejectedIncomplete = 0;

  while (remainingClubs.length > 0) {
    const clubIndex = Math.floor(rng() * remainingClubs.length);
    const club = remainingClubs[clubIndex]!;
    const clubPools = byClub.get(club) ?? [];
    const pick = pickUniformTeamYearFromClubPools(
      clubPools,
      rng,
      hasEligiblePlayers
    );

    if (!pick) {
      rerollCount += 1;
      rejectedIncomplete += clubPools.length;
      remainingClubs = remainingClubs.filter((c) => c !== club);
      continue;
    }

    return { pool: pick, club, rerollCount, rejectedIncomplete };
  }

  return { pool: null, club: null, rerollCount, rejectedIncomplete };
}
