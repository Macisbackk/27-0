import type { Player, SquadSlot } from "./types";
import type { SeasonResult } from "./game/season-simulation";
import type { PlayerTryTotal } from "./game/season-tries";
import { getPlayerTryWeight } from "./game/try-weights";

export interface SeasonAward {
  title: string;
  playerName: string;
  club: string;
  detail: string;
  narrative?: string;
  rankedLines?: string[];
  variant?: "positive" | "negative" | "neutral";
}

interface PlayerPerformance {
  playerId: string;
  name: string;
  club: string;
  position: Player["position"];
  peakRating: number;
  slotLabel: string;
  tries: number;
  expectedTries: number;
  impactScore: number;
}

function getPlayers(squad: SquadSlot[]): { player: Player; slot: SquadSlot }[] {
  return squad
    .filter((s) => s.player)
    .map((s) => ({ player: s.player!, slot: s }));
}

function buildPerformances(
  squad: SquadSlot[],
  tryScorers: PlayerTryTotal[],
  seasonWins: number
): PlayerPerformance[] {
  const entries = getPlayers(squad);
  if (entries.length === 0) return [];

  const tryMap = new Map(tryScorers.map((t) => [t.playerId, t.tries]));
  const totalTries = tryScorers.reduce((sum, t) => sum + t.tries, 0);
  const avgRating =
    entries.reduce((sum, e) => sum + e.player.peakRating, 0) / entries.length;

  const weightSum = entries.reduce(
    (sum, e) => sum + getPlayerTryWeight(e.player),
    0
  );

  return entries.map(({ player, slot }) => {
    const tries = tryMap.get(player.id) ?? 0;
    const playerWeight = getPlayerTryWeight(player);
    const expectedTries =
      weightSum > 0 ? (playerWeight * totalTries) / weightSum : 0;

    const tryDelta = tries - expectedTries;
    const consistencyBonus = tries >= Math.max(2, expectedTries * 0.85) ? 2 : 0;
    const underperformPenalty =
      player.peakRating >= avgRating + 6 && tries < expectedTries * 0.45
        ? -6
        : 0;
    const overperformBonus =
      player.peakRating < avgRating - 4 && tries >= expectedTries * 1.1
        ? 3
        : 0;
    const winBonus = (seasonWins / 27) * 1.5;

    const impactScore =
      tryDelta * 2.2 +
      consistencyBonus +
      underperformPenalty +
      overperformBonus +
      winBonus;

    return {
      playerId: player.id,
      name: player.name,
      club: player.club,
      position: player.position,
      peakRating: player.peakRating,
      slotLabel: slot.label,
      tries,
      expectedTries,
      impactScore: Math.round(impactScore * 10) / 10,
    };
  });
}

function getPotyNarrative(
  perf: PlayerPerformance,
  seasonResult: SeasonResult
): string {
  if (seasonResult.isPerfect) {
    return "Dominated throughout an unbeaten campaign and led the team to 27-0 glory.";
  }
  if (perf.tries >= 20) {
    return "A prolific attacking threat who consistently delivered when it mattered.";
  }
  if (seasonResult.wins >= 20) {
    return "Dominated throughout the campaign and drove the team deep into title contention.";
  }
  return "Stood above the rest with consistent match-winning contributions all season.";
}

function getWorstNarrative(perf: PlayerPerformance): string {
  if (perf.tries === 0) {
    return "Failed to register a try all season and struggled to influence games.";
  }
  if (perf.peakRating >= 85) {
    return "Fell well short of expectations despite his reputation and price tag.";
  }
  if (perf.tries < perf.expectedTries * 0.4) {
    return "Struggled to make an impact and failed to meet positional expectations.";
  }
  return "Underwhelmed across the campaign with limited contribution to team success.";
}

export function generateSeasonAwards(
  squad: SquadSlot[],
  seasonResult: SeasonResult
): SeasonAward[] {
  const entries = getPlayers(squad);
  if (entries.length === 0) return [];

  const performances = buildPerformances(
    squad,
    seasonResult.tryScorers,
    seasonResult.wins
  );

  const sortedBest = [...performances].sort(
    (a, b) => b.impactScore - a.impactScore
  );
  const playerOfSeason = sortedBest[0];
  const awardedIds = new Set<string>([playerOfSeason.playerId]);

  const worstCandidates = sortedBest.filter(
    (p) => !awardedIds.has(p.playerId)
  );
  const worstPlayer =
    worstCandidates.length > 0
      ? worstCandidates[worstCandidates.length - 1]
      : sortedBest[sortedBest.length - 1];

  const topThree = seasonResult.tryScorers.slice(0, 3);
  const rankedLines = topThree.map((scorer, index) => {
    const rank = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd";
    return `${rank} — ${scorer.name} — ${scorer.tries} Tries`;
  });

  return [
    {
      title: "Player of the Season",
      playerName: playerOfSeason.name,
      club: playerOfSeason.club,
      detail: `${playerOfSeason.tries} tries · Impact ${playerOfSeason.impactScore}`,
      narrative: getPotyNarrative(playerOfSeason, seasonResult),
      variant: "positive",
    },
    {
      title: "Worst Player of the Season",
      playerName: worstPlayer.name,
      club: worstPlayer.club,
      detail: `${worstPlayer.tries} tries · Impact ${worstPlayer.impactScore}`,
      narrative: getWorstNarrative(worstPlayer),
      variant: "negative",
    },
    {
      title: "Top 3 Try Scorers",
      playerName: topThree[0]?.name ?? "—",
      club: topThree[0]?.club ?? "—",
      detail: rankedLines.join("\n"),
      rankedLines,
      variant: "neutral",
    },
  ];
}
