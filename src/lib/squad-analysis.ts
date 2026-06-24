import type { Player, PlayerCategory, Position, SquadSlot } from "./types";
import { TOTAL_SLOTS } from "./positions";
import { getPlayerDisplayClub } from "./players/run-club";
import { getPlayerRatingForPosition } from "./players/player-positions";
import { JOE_MELLOR_GOAT_ID } from "./players/goat";
import { isSuperSamHallasId, isSuperSamHallasPlayer } from "./players/super-sam-hallas";
import { getSlotDisplayInfo } from "./squad-display";

export type ClubPlayerDisplayCategory = PlayerCategory | "goat" | "superSam";

export interface ClubBreakdownOptions {
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  /** Era mode: group all squad players under this era team display name. */
  groupClubOverride?: string;
}

export interface ClubPlayerEntry {
  playerId: string;
  name: string;
  /** Position played this run (slot position). */
  position: Position;
  naturalPosition: Position;
  playedPosition: Position;
  positionMismatch: boolean;
  /** Squad slot index for team-sheet ordering. */
  slotIndex: number;
  /** Slot label from team sheet (e.g. Left Wing). */
  slotLabel: string;
  category: PlayerCategory;
  displayCategory: ClubPlayerDisplayCategory;
  /** Effective OVR after run penalties. */
  peakRating: number;
  originalRating: number;
  adjustedRating: number;
  ratingAdjusted: boolean;
  value: number;
  /** Run-context club label (era team display name). */
  displayClub: string;
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
  options?: ClubBreakdownOptions
): ClubPlayerDisplayCategory {
  if (options?.superSamHallasMode && isSuperSamHallasPlayer(player)) {
    return "superSam";
  }
  if (options?.joeMellorMode && player.id === JOE_MELLOR_GOAT_ID) {
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
    const clubName = options?.groupClubOverride
      ? options.groupClubOverride.trim()
      : getPlayerDisplayClub(player).trim();
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
      slotIndex: slot.slotIndex,
      slotLabel: slot.label,
      category: player.category,
      displayCategory: getPlayerDisplayCategory(player, options),
      peakRating: display.adjustedRating,
      originalRating: display.originalRating,
      adjustedRating: display.adjustedRating,
      ratingAdjusted: display.ratingAdjusted,
      value: player.value,
      displayClub: getPlayerDisplayClub(player),
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
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
    .map((entry) => {
      if (
        !options?.superSamHallasMode ||
        !entry.players.every((p) => isSuperSamHallasId(p.playerId))
      ) {
        return entry;
      }

      const totalValue = entry.players.reduce((sum, p) => sum + p.value, 0);
      const rating = entry.players[0]?.adjustedRating ?? 99;

      return {
        ...entry,
        players: [
          {
            playerId: "ssh-sam-hallas-group",
            name: `Sam Hallas ×${entry.count}`,
            position: entry.players[0]!.position,
            naturalPosition: entry.players[0]!.naturalPosition,
            playedPosition: entry.players[0]!.playedPosition,
            positionMismatch: false,
            slotIndex: entry.players[0]!.slotIndex,
            slotLabel: entry.players[0]!.slotLabel,
            category: entry.players[0]!.category,
            displayCategory: "superSam" as const,
            peakRating: rating,
            originalRating: rating,
            adjustedRating: rating,
            ratingAdjusted: false,
            value: totalValue,
            displayClub: entry.players[0]!.displayClub,
          },
        ],
      };
    });
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
  return getPlayerRatingForPosition(
    slot.player,
    slot.position,
    slot.runRatingPenalty
  );
}

export function getAverageSquadRating(squad: SquadSlot[]): number {
  const filled = squad.filter((s) => s.player);
  if (filled.length === 0) return 0;
  const total = filled.reduce((sum, s) => sum + getEffectivePeakRating(s), 0);
  return Math.round((total / filled.length) * 10) / 10;
}
