import slClubYearsData from "../../../data/super-league-club-years.json";

type ClubYearRanges = Record<string, { ranges: [number, number][] }>;

const SL_CLUB_YEARS = slClubYearsData as unknown as ClubYearRanges;

const YEARS_BY_CLUB = new Map<string, Set<number>>();

function buildYearSet(): void {
  if (YEARS_BY_CLUB.size > 0) return;
  for (const [club, { ranges }] of Object.entries(SL_CLUB_YEARS)) {
    const years = new Set<number>();
    for (const [start, end] of ranges) {
      for (let y = start; y <= end; y++) years.add(y);
    }
    YEARS_BY_CLUB.set(club, years);
  }
}

/** True when the club competed in the Super League top flight that calendar year. */
export function isSuperLeagueSeason(club: string, year: number | string): boolean {
  buildYearSet();
  const y = typeof year === "string" ? Number.parseInt(year, 10) : year;
  if (!Number.isFinite(y)) return false;
  return YEARS_BY_CLUB.get(club)?.has(y) ?? false;
}

export function getSuperLeagueYearsForClub(club: string): number[] {
  buildYearSet();
  const years = YEARS_BY_CLUB.get(club);
  if (!years) return [];
  return [...years].sort((a, b) => a - b);
}

export function getSuperLeagueClubs(): string[] {
  buildYearSet();
  return [...YEARS_BY_CLUB.keys()].sort((a, b) => a.localeCompare(b));
}
