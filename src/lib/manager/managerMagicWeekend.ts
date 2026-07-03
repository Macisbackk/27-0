import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { MANAGER_SEASON_GAMES } from "./types";
import type { ManagerScheduledFixture } from "./types";
import { RIVAL_CLUBS } from "./managerRivals";

export const MAGIC_WEEKEND_VENUE = "Hill Dickinson Stadium";
export const MAGIC_WEEKEND_ATTENDANCE_MIN = 32_000;
export const MAGIC_WEEKEND_ATTENDANCE_MAX = 44_000;

/** Fixed league round for the mid-season Magic Weekend block. */
export const MAGIC_WEEKEND_ROUND = Math.ceil(MANAGER_SEASON_GAMES / 2);

export function isMagicWeekendFixture(
  fixture: Pick<ManagerScheduledFixture, "competition" | "isNeutral" | "venue">
): boolean {
  return (
    fixture.competition === "league" &&
    fixture.isNeutral === true &&
    fixture.venue === MAGIC_WEEKEND_VENUE
  );
}

export function pickMagicWeekendOpponent(club: string, seed: string): string {
  const opponents = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== club);
  const rivals = (RIVAL_CLUBS[club] ?? []).filter((r) =>
    opponents.includes(r as (typeof opponents)[number])
  );
  const rng = seedrandom(`${seed}-magic-weekend-rival`);
  if (rivals.length > 0) {
    return rivals[Math.floor(rng() * rivals.length)]!;
  }
  return opponents[Math.floor(rng() * opponents.length)]!;
}

export function buildMagicWeekendFixture(
  club: string,
  seed: string
): Omit<
  ManagerScheduledFixture,
  "round" | "id" | "competition" | "label"
> {
  const opponent = pickMagicWeekendOpponent(club, seed);
  return {
    opponent,
    isHome: false,
    isNeutral: true,
    venue: MAGIC_WEEKEND_VENUE,
    listedHome: club,
    listedAway: opponent,
  };
}

export function getLeagueFixtureSides(
  club: string,
  sched: Pick<
    ManagerScheduledFixture,
    "isHome" | "isNeutral" | "opponent" | "listedHome" | "listedAway"
  >
): { homeTeam: string; awayTeam: string } {
  if (sched.isNeutral) {
    return {
      homeTeam: sched.listedHome ?? club,
      awayTeam: sched.listedAway ?? sched.opponent,
    };
  }
  return {
    homeTeam: sched.isHome ? club : sched.opponent,
    awayTeam: sched.isHome ? sched.opponent : club,
  };
}

export function calculateMagicWeekendAttendance(
  seed: string,
  fixtureId: string
): number {
  const rng = seedrandom(`${seed}-magic-att-${fixtureId}`);
  const span =
    MAGIC_WEEKEND_ATTENDANCE_MAX - MAGIC_WEEKEND_ATTENDANCE_MIN + 1;
  return MAGIC_WEEKEND_ATTENDANCE_MIN + Math.floor(rng() * span);
}
