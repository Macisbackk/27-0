import type { Player, PlayerCategory, Position, SquadSlot } from "./types";
import { TOTAL_SLOTS } from "./positions";
import { resolveDisplayClub } from "./clubs/super-league-display";
import { JOE_MELLOR_GOAT_ID } from "./players/goat";
import { getSlotDisplayInfo } from "./squad-display";

export type ClubPlayerDisplayCategory = PlayerCategory | "goat";

export interface ClubBreakdownOptions {
  joeMellorMode?: boolean;
}

export interface ClubPlayerEntry {
  playerId: string;
  name: string;
  /** Position played this run (slot position). */
  position: Position;
  naturalPosition: Position;
  playedPosition: Position;
  positionMismatch: boolean;
  category: PlayerCategory;
  displayCategory: ClubPlayerDisplayCategory;
  /** Effective OVR after run penalties. */
  peakRating: number;
  originalRating: number;
  adjustedRating: number;
  ratingAdjusted: boolean;
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
    const display = getSlotDisplayInfo(slot)!;
    existing.players.push({
      playerId: player.id,
      name: player.name,
      position: display.playedPosition,
      naturalPosition: display.naturalPosition,
      playedPosition: display.playedPosition,
      positionMismatch: display.positionMismatch,
      category: player.category,
      displayCategory: getPlayerDisplayCategory(player, options?.joeMellorMode),
      peakRating: display.adjustedRating,
      originalRating: display.originalRating,
      adjustedRating: display.adjustedRating,
      ratingAdjusted: display.ratingAdjusted,
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

export function getEffectivePeakRating(slot: SquadSlot): number {
  if (!slot.player) return 0;
  const penalty = slot.runRatingPenalty ?? 0;
  return Math.max(75, slot.player.peakRating - penalty);
}

export function getAverageSquadRating(squad: SquadSlot[]): number {
  const filled = squad.filter((s) => s.player);
  if (filled.length === 0) return 0;
  const total = filled.reduce((sum, s) => sum + getEffectivePeakRating(s), 0);
  return Math.round((total / filled.length) * 10) / 10;
}
