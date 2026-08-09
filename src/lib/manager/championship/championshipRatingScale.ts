import type { Position } from "../../types";
import {
  CHAMPIONSHIP_PLAYER_MAX_RATING,
  CHAMPIONSHIP_PLAYER_MIN_RATING,
  GENERATED_CHAMPIONSHIP_MAX_RATING,
  clampChampionshipPlayerRating,
} from "../../players/rating-floors";
import type { ChampionshipClub } from "../../clubs/championship-clubs";
import { getChampionshipClubById } from "../../clubs/championship-clubs";
import type { ChampionshipGeneratedPlayer } from "./championshipSquads";

/** Clamp for first-season generated Championship players only (≤83). */
function clampGeneratedChampionshipRating(rating: number): number {
  return Math.max(
    CHAMPIONSHIP_PLAYER_MIN_RATING,
    Math.min(GENERATED_CHAMPIONSHIP_MAX_RATING, Math.round(rating))
  );
}
/**
 * First-season Championship rating bands (65–78) — clearly below Super League 80+:
 * 65–68 depth · 69–72 fringe · 73–75 starters · 76–77 leaders · 78 rare
 * Target squad average ~70–73.
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

  if (bandRoll > 0.997 && quality > 0.78) {
    return clampGeneratedChampionshipRating(78);
  }
  if (bandRoll > 0.92 && quality > 0.52) {
    return clampGeneratedChampionshipRating(76 + Math.floor(rng() * 2));
  }
  if (bandRoll > 0.42) {
    const base = 71.5 + quality * 2.0 + rng() * 2;
    return clampGeneratedChampionshipRating(
      Math.round(Math.max(73, Math.min(75, base)))
    );
  }
  if (bandRoll > 0.16) {
    return clampGeneratedChampionshipRating(69 + Math.floor(rng() * 4));
  }
  return clampGeneratedChampionshipRating(65 + Math.floor(rng() * 4));
}

export function championshipTransferValue(peakRating: number): number {
  const r = clampChampionshipPlayerRating(peakRating);
  // Champ fees stay below SL bands for equivalent numbers.
  if (r >= 81) return Math.round(65_000 + (r - 81) * 12_000);
  if (r >= 79) return Math.round(42_000 + (r - 79) * 10_000);
  if (r >= 76) return Math.round(28_000 + (r - 76) * 4_500);
  if (r >= 73) return Math.round(18_000 + (r - 73) * 3_000);
  return Math.round(12_000 + (r - 70) * 2_000);
}

export function championshipWageFromRating(
  peakRating: number,
  age?: number
): number {
  const r = clampChampionshipPlayerRating(peakRating);
  if (r >= 81) return 48_000 + (r - 81) * 8_000;
  if (r >= 79) return 32_000 + (r - 79) * 7_000;
  if (r >= 76) return 22_000 + (r - 76) * 3_000;
  if (r >= 73) return 15_000 + (r - 73) * 2_000;
  const youth = age !== undefined && age <= 21 ? 0.9 : 1;
  return Math.round((10_000 + (r - 70) * 1_500) * youth);
}

/**
 * Correct ratings that were wrongly floored onto the 80–89 Championship band.
 * Uses club strength + peer rank — not a flat −10.
 * Elite mistaken (85–89) remap into the first-season standout ceiling (≤83).
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

  // Already on the corrected Championship scale (leading band and below).
  if (
    oldRating >= CHAMPIONSHIP_PLAYER_MIN_RATING &&
    oldRating <= 80
  ) {
    return clampChampionshipPlayerRating(oldRating);
  }

  if (oldRating > CHAMPIONSHIP_PLAYER_MAX_RATING) {
    return GENERATED_CHAMPIONSHIP_MAX_RATING;
  }

  const club = getChampionshipClubById(context.clubId);
  const strength = club?.baseStrength ?? 58;
  const peers = context.peerRatings.filter((r) => Number.isFinite(r));
  const sorted = [...peers].sort((a, b) => a - b);
  const rankT =
    sorted.length <= 1
      ? 0.5
      : sorted.findIndex((r) => r >= oldRating) / (sorted.length - 1);

  // Mistaken band was 80–89; stretch into 70–83 with club/role shaping.
  const clampedOld = Math.max(80, Math.min(89, oldRating));
  const ratingT = (clampedOld - 80) / 9;
  const strengthT = (strength - 54) / 20; // 0..1 across Champ clubs

  // Elite mistaken → rare standout ceiling (81–83), never 84+.
  if (clampedOld >= 87) {
    return clampGeneratedChampionshipRating(
      Math.round(81 + (clampedOld - 87) * 0.75 + strengthT * 0.5)
    );
  }
  if (clampedOld >= 85) {
    return clampGeneratedChampionshipRating(
      Math.round(79 + (clampedOld - 85) + strengthT)
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
  const high = 80 - (1 - strengthT) * 2;
  const mapped = Math.round(low + t * (high - low));
  return clampGeneratedChampionshipRating(mapped);
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

/**
 * Remap generated Championship players above the first-season leading band
 * (peakRating > 80) down onto the 70–83 scale. Leaves real transferred /
 * non-generated IDs untouched.
 */
export function remapChampionshipFirstSeasonOverrated(
  players: Record<string, ChampionshipGeneratedPlayer>
): Record<string, ChampionshipGeneratedPlayer> {
  const byClub: Record<string, ChampionshipGeneratedPlayer[]> = {};
  for (const p of Object.values(players)) {
    (byClub[p.clubId] ??= []).push(p);
  }

  const next: Record<string, ChampionshipGeneratedPlayer> = { ...players };
  for (const [clubId, clubPlayers] of Object.entries(byClub)) {
    const peers = clubPlayers.map((p) => p.peakRating);
    const sortedByRating = [...clubPlayers].sort(
      (a, b) => a.peakRating - b.peakRating
    );
    for (const p of clubPlayers) {
      if (!p.id.startsWith("generated-championship-")) continue;
      if (p.peakRating <= 80) continue;
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
