import { getClubBaseStrength } from "../game/club-strength";
import { getClubByName } from "../clubs";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  ERA_BENCH_FROM_STARTING_17,
  ERA_XIII_FROM_STARTING_17,
} from "../players/era-starting-17s";
import {
  computeManagerTeamRating,
  getManagerClubTeamRating,
  getManagerRosterIds,
} from "./managerRating";

export interface ManagerClubConfig {
  name: string;
  expectation: string;
  budget: number;
  difficulty: number;
  squadRating: number;
  primaryColor: string;
  secondaryColor: string;
}

const CLUB_EXPECTATIONS: Record<string, string> = {
  "Wigan Warriors": "Win the title",
  "St Helens": "Win the title",
  "Leeds Rhinos": "Reach playoffs",
  "Warrington Wolves": "Reach playoffs",
  "Hull KR": "Reach playoffs",
  "Catalans Dragons": "Reach playoffs",
  "Hull FC": "Mid-table push",
  "Toulouse Olympique": "Mid-table push",
  "Leigh Leopards": "Mid-table push",
  "Huddersfield Giants": "Avoid bottom",
  "Castleford Tigers": "Avoid bottom",
  "Bradford Bulls": "Mid-table push",
  "Wakefield Trinity": "Survive and develop",
  "York Knights": "Survive and develop",
};

const CLUB_BUDGET: Record<string, number> = {
  "Wigan Warriors": 1_200_000,
  "St Helens": 1_150_000,
  "Leeds Rhinos": 1_000_000,
  "Warrington Wolves": 950_000,
  "Hull KR": 850_000,
  "Catalans Dragons": 820_000,
  "Hull FC": 780_000,
  "Toulouse Olympique": 760_000,
  "Leigh Leopards": 740_000,
  "Huddersfield Giants": 680_000,
  "Castleford Tigers": 620_000,
  "Bradford Bulls": 650_000,
  "Wakefield Trinity": 520_000,
  "York Knights": 500_000,
};

function difficultyFromStrength(strength: number): number {
  if (strength >= 82) return 5;
  if (strength >= 78) return 4;
  if (strength >= 74) return 3;
  if (strength >= 70) return 2;
  return 1;
}

export function getManagerClubRating(clubName: string): number {
  return getManagerClubTeamRating(clubName);
}

export function getManagerClubConfig(clubName: string): ManagerClubConfig {
  const club = getClubByName(clubName);
  const strength = getClubBaseStrength(clubName);
  return {
    name: clubName,
    expectation: CLUB_EXPECTATIONS[clubName] ?? "Compete in Super League",
    budget: CLUB_BUDGET[clubName] ?? 600_000,
    difficulty: difficultyFromStrength(strength),
    squadRating: getManagerClubRating(clubName),
    primaryColor: club?.primaryColor ?? "#1e293b",
    secondaryColor: club?.secondaryColor ?? "#334155",
  };
}

export function getAllManagerClubConfigs(): ManagerClubConfig[] {
  return CURRENT_PLAYABLE_CLUBS.map((name) => getManagerClubConfig(name));
}

export function buildDefaultLineup(playerIds: readonly string[]): {
  xiiiIds: string[];
  slotPositions: Position[];
  benchIds: string[];
} | null {
  const players = playerIds
    .map((id) => getPlayerById(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => (b.rating ?? b.peakRating) - (a.rating ?? a.peakRating));

  const lineup: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    for (let i = 0; i < count; i++) lineup.push(position);
  }

  const used = new Set<string>();
  const xiiiIds: string[] = [];
  const slotPositions: Position[] = [];

  for (const position of lineup) {
    const pick = players.find(
      (p) =>
        !used.has(p.id) && getPlayerEligiblePositions(p).includes(position)
    );
    if (!pick) return null;
    used.add(pick.id);
    xiiiIds.push(pick.id);
    slotPositions.push(position);
  }

  const benchIds = playerIds
    .filter((id) => !used.has(id))
    .slice(0, ERA_BENCH_FROM_STARTING_17);

  return { xiiiIds, slotPositions, benchIds };
}
