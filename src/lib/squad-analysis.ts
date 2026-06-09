import type { Player, PlayerCategory, Position, SquadSlot } from "./types";
import { TOTAL_SLOTS } from "./positions";
import { resolveDisplayClub } from "./clubs/super-league-display";
import { JOE_MELLOR_GOAT_ID } from "./players/goat";

export type ClubPlayerDisplayCategory = PlayerCategory | "goat";

export interface ClubBreakdownOptions {
  joeMellorMode?: boolean;
}

export interface ClubPlayerEntry {
  playerId: string;
  name: string;
  position: Position;
  category: PlayerCategory;
  displayCategory: ClubPlayerDisplayCategory;
  peakRating: number;
  value: number;
}

export interface ClubBreakdown {
  club: string;
  count: number;
  totalValue: number;
  players: ClubPlayerEntry[];
}

export interface ClubBreakdownSummary {
  clubs: ClubBreakdown[];
  totalPlayers: number;
  expectedPlayers: number;
  isValid: boolean;
}

function getFilledSquadCount(squad: SquadSlot[]): number {
  return squad.filter((s) => s.player).length;
}

function getPlayerDisplayCategory(
  player: Player,
  joeMellorMode?: boolean
): ClubPlayerDisplayCategory {
  if (joeMellorMode && player.id === JOE_MELLOR_GOAT_ID) {
    return "goat";
  }
  return player.category;
}

export function getClubBreakdown(
  squad: SquadSlot[],
  options?: ClubBreakdownOptions
): ClubBreakdown[] {
  const map = new Map<
    string,
    { count: number; totalValue: number; players: ClubPlayerEntry[] }
  >();

  for (const slot of squad) {
    if (!slot.player) continue;
    const player = slot.player;
    const clubName = resolveDisplayClub(
      player.id,
      player.club,
      player.name
    ).trim();
    const existing = map.get(clubName) ?? {
      count: 0,
      totalValue: 0,
      players: [],
    };
    existing.count++;
    existing.totalValue += player.value;
    existing.players.push({
      playerId: player.id,
      name: player.name,
      position: player.position,
      category: player.category,
      displayCategory: getPlayerDisplayCategory(player, options?.joeMellorMode),
      peakRating: player.peakRating,
      value: player.value,
    });
    map.set(clubName, existing);
  }

  return Array.from(map.entries())
    .map(([club, data]) => ({
      club,
      count: data.count,
      totalValue: data.totalValue,
      players: data.players.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue);
}

export function getClubBreakdownSummary(
  squad: SquadSlot[],
  expectedPlayers = TOTAL_SLOTS,
  options?: ClubBreakdownOptions
): ClubBreakdownSummary {
  const filledCount = getFilledSquadCount(squad);
  const expected = expectedPlayers ?? filledCount;

  let clubs = getClubBreakdown(squad, options);
  let totalPlayers = clubs.reduce((sum, c) => sum + c.count, 0);

  if (totalPlayers !== filledCount) {
    clubs = getClubBreakdown(squad, options);
    totalPlayers = clubs.reduce((sum, c) => sum + c.count, 0);
  }

  return {
    clubs,
    totalPlayers,
    expectedPlayers: expected,
    isValid: totalPlayers === expected,
  };
}

export function getAverageSquadRating(squad: SquadSlot[]): number {
  const players = squad.filter((s) => s.player).map((s) => s.player!);
  if (players.length === 0) return 0;
  const total = players.reduce((sum, p) => sum + p.peakRating, 0);
  return Math.round((total / players.length) * 10) / 10;
}
