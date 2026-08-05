import type { Position } from "../../types";
import {
  CHAMPIONSHIP_PLAYER_MAX_RATING,
  CHAMPIONSHIP_PLAYER_MIN_RATING,
  clampChampionshipPlayerRating,
} from "../../players/rating-floors";
import type { ChampionshipClub } from "../../clubs/championship-clubs";
import { getChampionshipClubById } from "../../clubs/championship-clubs";
import type { ChampionshipGeneratedPlayer } from "./championshipSquads";

/**
 * Championship rating bands (70–89) — clearly below Super League (~86–88):
 * 70–72 development / emergency depth
 * 73–75 squad / fringe
 * 76–78 established starters
 * 79–81 good Championship players
 * 82–84 leading club performers
 * 85–89 elite (very rare)
 *
 * Target overall squad average ~73–76.
 */
export function ratingForChampionshipClub(
  club: ChampionshipClub,
  slotIndex: number,
  rng: () => number
): number {
  const strengthT = Math.max(
    0,
    Math.min(1, (club.baseStrength - 54) / 20)
  );
  const starterT = Math.max(0, Math.min(1, 1 - slotIndex / 24));
  const quality = strengthT * 0.55 + starterT * 0.45;
  const roll = rng();
  const bandRoll =
    roll + quality * 0.16 - (slotIndex >= 20 ? 0.14 : slotIndex >= 17 ? 0.06 : 0);

  if (bandRoll > 0.988 && quality > 0.7) {
    return clampChampionshipPlayerRating(85 + Math.floor(rng() * 5));
  }
  if (bandRoll > 0.968 && quality > 0.55) {
    return clampChampionshipPlayerRating(82 + Math.floor(rng() * 3));
  }
  if (bandRoll > 0.86 && quality > 0.42) {
    return clampChampionshipPlayerRating(79 + Math.floor(rng() * 3));
  }
  if (bandRoll > 0.38) {
    const base = 75 + quality * 2.2 + rng() * 2;
    return clampChampionshipPlayerRating(
      Math.round(Math.max(76, Math.min(78, base)))
    );
  }
  if (bandRoll > 0.14) {
    const base = 72 + quality * 1.8 + rng() * 2;
    return clampChampionshipPlayerRating(
      Math.round(Math.max(73, Math.min(75, base)))
    );
  }
  return clampChampionshipPlayerRating(70 + Math.floor(rng() * 3));
}

export function championshipTransferValue(peakRating: number): number {
  const r = clampChampionshipPlayerRating(peakRating);
  // Champ fees stay below SL bands for equivalent numbers.
  if (r >= 85) return Math.round(95_000 + (r - 85) * 35_000);
  if (r >= 82) return Math.round(65_000 + (r - 82) * 10_000);
  if (r >= 79) return Math.round(42_000 + (r - 79) * 7_500);
  if (r >= 76) return Math.round(28_000 + (r - 76) * 4_500);
  if (r >= 73) return Math.round(18_000 + (r - 73) * 3_000);
  return Math.round(12_000 + (r - 70) * 2_000);
}

export function championshipWageFromRating(
  peakRating: number,
  age?: number
): number {
  const r = clampChampionshipPlayerRating(peakRating);
  if (r >= 85) return 70_000 + (r - 85) * 12_000;
  if (r >= 82) return 48_000 + (r - 82) * 7_000;
  if (r >= 79) return 32_000 + (r - 79) * 5_000;
  if (r >= 76) return 22_000 + (r - 76) * 3_000;
  if (r >= 73) return 15_000 + (r - 73) * 2_000;
  const youth = age !== undefined && age <= 21 ? 0.9 : 1;
  return Math.round((10_000 + (r - 70) * 1_500) * youth);
}

/**
 * Correct ratings that were wrongly floored onto the 80–89 Championship band.
 * Uses club strength + peer rank — not a flat −10.
 */
export function correctMistakenChampionshipFloor80Rating(
  oldRating: number,
  context: {
    clubId: string;
    peerRatings: number[];
    position: Position;
    slotHint?: number;
  }
): number {
  if (!Number.isFinite(oldRating)) {
    return 74;
  }

  // Already on the corrected Championship scale.
  if (
    oldRating >= CHAMPIONSHIP_PLAYER_MIN_RATING &&
    oldRating < 80
  ) {
    return clampChampionshipPlayerRating(oldRating);
  }

  if (oldRating > CHAMPIONSHIP_PLAYER_MAX_RATING) {
    return CHAMPIONSHIP_PLAYER_MAX_RATING;
  }

  const club = getChampionshipClubById(context.clubId);
  const strength = club?.baseStrength ?? 58;
  const peers = context.peerRatings.filter((r) => Number.isFinite(r));
  const sorted = [...peers].sort((a, b) => a - b);
  const rankT =
    sorted.length <= 1
      ? 0.5
      : sorted.findIndex((r) => r >= oldRating) / (sorted.length - 1);

  // Mistaken band was 80–89; stretch into 70–89 with club/role shaping.
  const clampedOld = Math.max(80, Math.min(89, oldRating));
  const ratingT = (clampedOld - 80) / 9;
  const strengthT = (strength - 54) / 20; // 0..1 across Champ clubs

  // Keep the elite tail of the mistaken band at Championship elite (85–89).
  if (clampedOld >= 87) {
    return clampChampionshipPlayerRating(
      Math.round(84 + (clampedOld - 87) * 1.25 + strengthT * 0.5)
    );
  }
  if (clampedOld >= 85) {
    return clampChampionshipPlayerRating(
      Math.round(81 + (clampedOld - 85) + strengthT)
    );
  }

  // Depth positions (late roster) bias lower even if old clamp made them 80+.
  const depthBias =
    context.slotHint != null && context.slotHint >= 17
      ? -0.14
      : context.position === "PROP" && ratingT < 0.35
        ? -0.06
        : 0;

  const t = Math.max(
    0,
    Math.min(
      1,
      0.5 * ratingT + 0.3 * rankT + 0.2 * strengthT + depthBias
    )
  );

  // Strong clubs shift the mid of the stretch slightly upward.
  const low = 70 + strengthT * 1.5;
  const high = 82 - (1 - strengthT) * 2;
  const mapped = Math.round(low + t * (high - low));
  return clampChampionshipPlayerRating(mapped);
}

export function remapChampionshipSquadRatings(
  players: Record<string, ChampionshipGeneratedPlayer>
): Record<string, ChampionshipGeneratedPlayer> {
  const byClub: Record<string, ChampionshipGeneratedPlayer[]> = {};
  for (const p of Object.values(players)) {
    (byClub[p.clubId] ??= []).push(p);
  }

  const next: Record<string, ChampionshipGeneratedPlayer> = {};
  for (const [clubId, clubPlayers] of Object.entries(byClub)) {
    const peers = clubPlayers.map((p) => p.peakRating);
    const sortedByRating = [...clubPlayers].sort(
      (a, b) => a.peakRating - b.peakRating
    );
    for (const p of clubPlayers) {
      const slotHint = sortedByRating.findIndex((x) => x.id === p.id);
      next[p.id] = {
        ...p,
        peakRating: correctMistakenChampionshipFloor80Rating(p.peakRating, {
          clubId,
          peerRatings: peers,
          position: p.position,
          slotHint,
        }),
      };
    }
  }
  return next;
}
