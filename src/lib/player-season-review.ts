import type { PlayerTryTotal } from "./game/season-tries";
import type { SeasonAward } from "./season-awards";
import type { SquadSlot } from "./types";
import { formatValue } from "./players";
import { POSITION_LABELS } from "./positions";
import { canPlayPosition, getPlayerRatingForPosition } from "./players/player-positions";

export interface PlayerSeasonReviewStats {
  tries?: number;
  matchesPlayed?: number;
  rating?: number;
  valueLabel?: string;
  awardWon?: string;
  contributionSummary?: string;
}

export function buildPlayerSeasonReviewStats(
  slot: SquadSlot,
  options?: {
    tryScorers?: PlayerTryTotal[];
    awards?: SeasonAward[];
    totalMatches?: number;
    hardMode?: boolean;
  }
): PlayerSeasonReviewStats {
  const player = slot.player;
  if (!player) return {};

  const stats: PlayerSeasonReviewStats = {};
  const tryRow = options?.tryScorers?.find((row) => row.playerId === player.id);
  if (tryRow) {
    stats.tries = tryRow.tries;
  }

  if (options?.totalMatches !== undefined && options.totalMatches > 0) {
    stats.matchesPlayed = options.totalMatches;
  }

  if (!options?.hardMode) {
    stats.rating = Math.round(
      getPlayerRatingForPosition(player, slot.position, slot.runRatingPenalty)
    );
    stats.valueLabel = formatValue(player.value);
  }

  const award = options?.awards?.find((row) => row.playerName === player.name);
  if (award) {
    stats.awardWon = award.title;
    if (award.narrative) {
      stats.contributionSummary = award.narrative;
    }
  }

  if (!stats.contributionSummary && tryRow && tryRow.tries > 0) {
    const playedLabel = POSITION_LABELS[slot.position];
    stats.contributionSummary = `${tryRow.tries} try${
      tryRow.tries === 1 ? "" : "ies"
    } from ${playedLabel} this season.`;
  }

  return stats;
}

/** Try scorer line — no arrow for valid dual-position deployments. */
export function formatTryScorerPosition(
  scorer: PlayerTryTotal,
  squad?: SquadSlot[]
): string {
  if (!scorer.playedPosition || scorer.playedPosition === scorer.position) {
    return POSITION_LABELS[scorer.position];
  }

  const slot = squad?.find((s) => s.player?.id === scorer.playerId);
  if (
    slot?.player &&
    canPlayPosition(slot.player, scorer.playedPosition)
  ) {
    return POSITION_LABELS[scorer.playedPosition];
  }

  return `${POSITION_LABELS[scorer.position]} → ${POSITION_LABELS[scorer.playedPosition]}`;
}
