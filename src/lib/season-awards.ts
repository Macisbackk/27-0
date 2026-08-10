import type { Player, SquadSlot } from "./types";
import type { SeasonResult } from "./game/season-simulation";
import type { PlayerTryTotal } from "./game/season-tries";
import { getPlayerTryWeight } from "./game/try-weights";
import { isGoatPlayer, JOE_MELLOR_GOAT_ID } from "./players/goat";
import { isSuperSamHallasPlayer } from "./players/super-sam-hallas";
import { getEffectivePeakRating } from "./squad-analysis";
import { getPlayerDisplayClub } from "./players/run-club";
import {
  findSlotByPlayerId,
  formatPlayerLineExtras,
  getSlotDisplayInfo,
} from "./squad-display";
import { POSITION_LABELS } from "./positions";

export interface SeasonAward {
  title: string;
  playerName: string;
  club: string;
  detail: string;
  narrative?: string;
  rankedLines?: string[];
  positionNote?: string;
  ratingNote?: string;
  variant?: "positive" | "negative" | "neutral";
}

interface PlayerPerformance {
  playerId: string;
  name: string;
  club: string;
  position: Player["position"];
  playedPosition: Player["position"];
  positionNote: string | null;
  peakRating: number;
  originalRating: number;
  ratingNote: string | null;
  slotLabel: string;
  tries: number;
  expectedTries: number;
  impactScore: number;
  /** Impact score without season win bonus — used for worst-player selection. */
  impactScoreNoWinBonus: number;
}

function getPlayers(squad: SquadSlot[]): { player: Player; slot: SquadSlot }[] {
  return squad
    .filter((s) => s.player)
    .map((s) => ({ player: s.player!, slot: s }));
}

function buildPerformances(
  squad: SquadSlot[],
  tryScorers: PlayerTryTotal[],
  seasonWins: number,
  joeMellorMode?: boolean,
  superSamHallasMode?: boolean
): PlayerPerformance[] {
  const entries = getPlayers(squad);
  if (entries.length === 0) return [];

  const tryMap = new Map(tryScorers.map((t) => [t.playerId, t.tries]));
  const totalTries = tryScorers.reduce((sum, t) => sum + t.tries, 0);
  const avgRating =
    entries.reduce((sum, e) => sum + getEffectivePeakRating(e.slot), 0) /
    entries.length;

  const weightSum = entries.reduce(
    (sum, e) => sum + getPlayerTryWeight(e.player, e.slot.position),
    0
  );

  return entries.map(({ player, slot }) => {
    const tries = tryMap.get(player.id) ?? 0;
    const playerWeight = getPlayerTryWeight(player, slot.position);
    const expectedTries =
      weightSum > 0 ? (playerWeight * totalTries) / weightSum : 0;

    const tryDelta = tries - expectedTries;
    const consistencyBonus = tries >= Math.max(2, expectedTries * 0.85) ? 2 : 0;
    const effectiveRating = getEffectivePeakRating(slot);
    const underperformPenalty =
      effectiveRating >= avgRating + 6 && tries < expectedTries * 0.45
        ? -6
        : 0;
    const overperformBonus =
      effectiveRating < avgRating - 4 && tries >= expectedTries * 1.1
        ? 3
        : 0;
    const winBonus = (seasonWins / 27) * 1.5;

    const impactScoreNoWinBonus =
      tryDelta * 2.2 +
      consistencyBonus +
      underperformPenalty +
      overperformBonus;

    let impactScore = impactScoreNoWinBonus + winBonus;

    if (joeMellorMode && isGoatPlayer(player)) {
      impactScore += 500 + tries * 8;
    }

    if (superSamHallasMode && isSuperSamHallasPlayer(player)) {
      impactScore += 800 + tries * 10;
    }

    const display = getSlotDisplayInfo(slot);

    return {
      playerId: player.id,
      name: player.name,
      club: getPlayerDisplayClub(player),
      position: player.position,
      playedPosition: slot.position,
      positionNote: display?.positionCompact ?? null,
      peakRating: effectiveRating,
      originalRating: player.peakRating,
      ratingNote: display?.ratingCompact ?? `${player.peakRating} OVR`,
      slotLabel: slot.label,
      tries,
      expectedTries,
      impactScore: Math.round(impactScore * 10) / 10,
      impactScoreNoWinBonus: Math.round(impactScoreNoWinBonus * 10) / 10,
    };
  });
}

const BACKLINE_POSITIONS: Player["position"][] = [
  "WING",
  "CENTRE",
  "FULLBACK",
  "STAND_OFF",
  "SCRUM_HALF",
];

function pickFromPool(pool: string[], playerId: string): string {
  const hash = playerId
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

const ZERO_TRY_NARRATIVES = [
  "Zero tries. Little impact.",
  "Barren. Invisible in attack.",
  "Never crossed the whitewash.",
  "Ghosted. No scoreboard threat.",
];

const HIGH_RATED_UNDERPERFORMER_NARRATIVES = [
  "Big name. Soft returns.",
  "Never justified the hype.",
  "Premium rating. Bargain output.",
  "Expected to lead. Underwhelmed.",
];

const LOW_IMPACT_FORWARD_NARRATIVES = [
  "Little impact up front.",
  "Passenger in the tight.",
  "Never imposed in the pack.",
  "Quiet. Minimal contribution.",
];

const BACKLINE_UNDERPERFORMER_NARRATIVES = [
  "Blunt out wide.",
  "Defences never worried.",
  "Went missing in the channels.",
  "No running threat.",
];

const BAD_TEAM_SEASON_NARRATIVES = [
  "Limited contribution.",
  "Struggling side. Still no standout.",
  "Could not lift a tough year.",
  "Forgettable. Mirrored the team.",
];

const POOR_SEASON_NARRATIVES = [
  "Weak contributor.",
  "Out of step with the role.",
  "Season to forget.",
  "Never found best form.",
];

const FORWARD_POSITIONS: Player["position"][] = [
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];
const HALF_POSITIONS: Player["position"][] = ["STAND_OFF", "SCRUM_HALF"];
const BACK_POSITIONS: Player["position"][] = ["FULLBACK", "WING", "CENTRE"];

function getPotyNarrative(
  perf: PlayerPerformance,
  seasonResult: SeasonResult,
  isTopTryScorer: boolean
): string {
  const seed = perf.playerId.length + perf.tries * 7 + perf.peakRating;

  if (seasonResult.isPerfect) {
    return pickFromPool(
      [
        "Led a 27-0 campaign.",
        "Standout in a perfect season.",
        "Club-great season.",
      ],
      `${perf.playerId}-perfect`
    );
  }

  if (perf.peakRating >= 90 && perf.tries >= 15) {
    return pickFromPool(
      [
        "Club-great season.",
        "Elite form all year.",
        "Star quality. Numbers to match.",
      ],
      `${perf.playerId}-elite`
    );
  }

  if (isTopTryScorer && perf.tries >= 12) {
    return pickFromPool(
      [
        "Led the try tally.",
        "Sharpest finisher.",
        "Constant threat.",
      ],
      `${perf.playerId}-tries`
    );
  }

  if (FORWARD_POSITIONS.includes(perf.playedPosition)) {
    return pickFromPool(
      [
        "Set the tone through the middle.",
        "Engine room all season.",
        "Led from the front.",
      ],
      `${perf.playerId}-fwd`
    );
  }

  if (HALF_POSITIONS.includes(perf.playedPosition)) {
    return pickFromPool(
      [
        "Controlled tempo. Delivered.",
        "Hub of everything good.",
        "Organised a standout year.",
      ],
      `${perf.playerId}-half`
    );
  }

  if (BACK_POSITIONS.includes(perf.playedPosition)) {
    return pickFromPool(
      [
        "Constant threat all year.",
        "Explosive when it mattered.",
        "Broke the line. Finished moves.",
      ],
      `${perf.playerId}-back`
    );
  }

  if (perf.tries >= 20) {
    return pickFromPool(
      [
        "Prolific. Delivered.",
        "Tries flowed all season.",
      ],
      `${perf.playerId}-prolific`
    );
  }

  if (seasonResult.wins >= 20) {
    return pickFromPool(
      [
        "Drove title contention.",
        "Match-winning all year.",
      ],
      `${perf.playerId}-wins`
    );
  }

  void seed;
  return pickFromPool(
    [
      "Match-winning all season.",
      "Pick of the squad.",
      "Raised the standard weekly.",
    ],
    perf.playerId
  );
}

function getWorstNarrative(
  perf: PlayerPerformance,
  seasonWins: number,
  seasonLosses: number
): string {
  if (perf.tries === 0) {
    return pickFromPool(ZERO_TRY_NARRATIVES, perf.playerId);
  }
  if (
    perf.peakRating >= 85 &&
    perf.tries < perf.expectedTries * 0.5
  ) {
    return pickFromPool(HIGH_RATED_UNDERPERFORMER_NARRATIVES, perf.playerId);
  }
  if (
    BACKLINE_POSITIONS.includes(perf.playedPosition) &&
    perf.tries < perf.expectedTries * 0.45
  ) {
    return pickFromPool(BACKLINE_UNDERPERFORMER_NARRATIVES, perf.playerId);
  }
  if (
    !BACKLINE_POSITIONS.includes(perf.playedPosition) &&
    perf.tries < perf.expectedTries * 0.4
  ) {
    return pickFromPool(LOW_IMPACT_FORWARD_NARRATIVES, perf.playerId);
  }
  if (seasonWins <= 10 || seasonLosses >= 17) {
    return pickFromPool(BAD_TEAM_SEASON_NARRATIVES, perf.playerId);
  }
  return pickFromPool(POOR_SEASON_NARRATIVES, perf.playerId);
}

function isHighPerformer(perf: PlayerPerformance): boolean {
  return (
    perf.tries >= 8 ||
    perf.tries >= perf.expectedTries * 0.65 ||
    perf.impactScoreNoWinBonus >= 6
  );
}

function selectWorstPlayer(
  performances: PlayerPerformance[],
  playerOfSeasonId: string,
  topTryScorerIds: Set<string>,
  joeMellorMode: boolean,
  superSamHallasMode: boolean
): PlayerPerformance {
  const sortedByImpact = [...performances].sort(
    (a, b) => b.impactScoreNoWinBonus - a.impactScoreNoWinBonus
  );
  const topQuarterCutoff = Math.ceil(sortedByImpact.length * 0.25);
  const topQuarterIds = new Set(
    sortedByImpact.slice(0, topQuarterCutoff).map((p) => p.playerId)
  );

  const avgImpact =
    performances.reduce((sum, p) => sum + p.impactScoreNoWinBonus, 0) /
    performances.length;
  const avgRating =
    performances.reduce((sum, p) => sum + p.peakRating, 0) /
    performances.length;

  const candidates = performances.filter(
    (p) =>
      p.playerId !== playerOfSeasonId &&
      !topTryScorerIds.has(p.playerId) &&
      !topQuarterIds.has(p.playerId) &&
      !isHighPerformer(p) &&
      !(joeMellorMode && p.playerId === JOE_MELLOR_GOAT_ID) &&
      !(superSamHallasMode && isSuperSamHallasPlayer(p.playerId))
  );

  const pool =
    candidates.length > 0
      ? candidates
      : performances.filter(
          (p) =>
            p.playerId !== playerOfSeasonId &&
            !(joeMellorMode && p.playerId === JOE_MELLOR_GOAT_ID) &&
      !(superSamHallasMode && isSuperSamHallasPlayer(p.playerId))
        );

  const scored = pool.map((p) => {
    const tryRatio =
      p.expectedTries > 0 ? p.tries / p.expectedTries : p.tries > 0 ? 1 : 0;
    const tryUnderperf = (1 - tryRatio) * 10;
    const lowImpact = (avgImpact - p.impactScoreNoWinBonus) * 0.6;
    const ratingGap =
      p.peakRating >= avgRating + 4 && p.tries < p.expectedTries * 0.5
        ? 5
        : 0;
    const zeroTryPenalty = p.tries === 0 ? 6 : 0;
    const worstScore =
      tryUnderperf + lowImpact + ratingGap + zeroTryPenalty;
    return { perf: p, worstScore };
  });

  scored.sort((a, b) => b.worstScore - a.worstScore);
  return scored[0]?.perf ?? performances[performances.length - 1];
}

export function generateSeasonAwards(
  squad: SquadSlot[],
  seasonResult: SeasonResult,
  options?: { joeMellorMode?: boolean; superSamHallasMode?: boolean }
): SeasonAward[] {
  const entries = getPlayers(squad);
  if (entries.length === 0) return [];

  const joeMellorMode = options?.joeMellorMode ?? false;
  const superSamHallasMode = options?.superSamHallasMode ?? false;

  const performances = buildPerformances(
    squad,
    seasonResult.tryScorers,
    seasonResult.wins,
    joeMellorMode,
    superSamHallasMode
  );

  const sortedBest = [...performances].sort(
    (a, b) => b.impactScore - a.impactScore
  );
  const playerOfSeason = sortedBest[0];

  const topTryScorerIds = new Set(
    seasonResult.tryScorers.slice(0, 3).map((t) => t.playerId)
  );
  const worstPlayer = superSamHallasMode
    ? performances[0]
    : selectWorstPlayer(
        performances,
        playerOfSeason.playerId,
        topTryScorerIds,
        joeMellorMode,
        superSamHallasMode
      );

  const topThree = seasonResult.tryScorers.slice(0, 3);
  const rankedLines = topThree.map((scorer, index) => {
    const rank = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd";
    const slot = findSlotByPlayerId(squad, scorer.playerId);
    const extras = formatPlayerLineExtras(slot);
    const pos =
      scorer.playedPosition && scorer.playedPosition !== scorer.position
        ? ` · ${POSITION_LABELS[scorer.position]} → ${POSITION_LABELS[scorer.playedPosition]}`
        : extras.positionNote
          ? ` · ${extras.positionNote}`
          : "";
    return `${rank} — ${scorer.name} — ${scorer.tries} Tries${pos}`;
  });

  return [
    {
      title: "Player of the Season",
      playerName: playerOfSeason.name,
      club: playerOfSeason.club,
      detail: `${playerOfSeason.tries} tries · Impact ${playerOfSeason.impactScore}`,
      positionNote: playerOfSeason.positionNote ?? undefined,
      ratingNote: playerOfSeason.ratingNote ?? undefined,
      narrative: getPotyNarrative(
        playerOfSeason,
        seasonResult,
        topTryScorerIds.has(playerOfSeason.playerId)
      ),
      variant: "positive",
    },
    {
      title: "Worst Player of the Season",
      playerName: superSamHallasMode
        ? "Nobody"
        : worstPlayer.name,
      club: superSamHallasMode ? "—" : worstPlayer.club,
      detail: superSamHallasMode
        ? "Impossible in Super Sam Hallas Mode"
        : `${worstPlayer.tries} tries · Impact ${worstPlayer.impactScore}`,
      positionNote: superSamHallasMode ? undefined : worstPlayer.positionNote ?? undefined,
      ratingNote: superSamHallasMode ? undefined : worstPlayer.ratingNote ?? undefined,
      narrative: superSamHallasMode
        ? "Nobody — Super Sam Hallas Mode."
        : getWorstNarrative(
            worstPlayer,
            seasonResult.wins,
            seasonResult.losses
          ),
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
