import type { Player, SquadSlot } from "./types";
import type { SeasonResult } from "./game/season-simulation";
import type { PlayerTryTotal } from "./game/season-tries";
import { getPlayerTryWeight } from "./game/try-weights";
import { isGoatPlayer, JOE_MELLOR_GOAT_ID } from "./players/goat";
import { isSuperSamHallasPlayer } from "./players/super-sam-hallas";
import { getEffectivePeakRating } from "./squad-analysis";
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
      club: player.club,
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
  "Failed to register a try all season and struggled to influence games.",
  "A barren campaign with zero tries — barely visible in attack.",
  "Never crossed the whitewash despite a full season of opportunities.",
  "Ghosted through the campaign without troubling the scoreboard.",
];

const HIGH_RATED_UNDERPERFORMER_NARRATIVES = [
  "Fell well short of expectations despite his reputation and price tag.",
  "A big-name signing who never justified the hype.",
  "Carried a premium rating but delivered bargain-basement returns.",
  "Expected to lead the line but consistently underwhelmed.",
];

const LOW_IMPACT_FORWARD_NARRATIVES = [
  "Struggled to make an impact and failed to meet positional expectations.",
  "Offered little in the tight exchanges and was often a passenger.",
  "Failed to impose himself in the forward battle all season.",
  "A quiet campaign with minimal contribution in the pack.",
];

const BACKLINE_UNDERPERFORMER_NARRATIVES = [
  "Rarely threatened out wide and failed to convert chances into tries.",
  "A blunt attacking weapon — defences never had to worry about him.",
  "Expected to finish moves but too often went missing in the wide channels.",
  "Starved of impact in the backline and offered little running threat.",
];

const BAD_TEAM_SEASON_NARRATIVES = [
  "Underwhelmed across the campaign with limited contribution to team success.",
  "Part of a struggling side but still failed to stand out when chances arose.",
  "Could not lift performances even as the team battled through a tough season.",
  "A forgettable season that mirrored the team's broader struggles.",
];

const POOR_SEASON_NARRATIVES = [
  "One of the weakest contributors in a difficult campaign.",
  "Consistently out of step with what the team needed from his position.",
  "A season to forget — rarely matched the standard expected at this level.",
  "Drifted through the year without ever finding his best form.",
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
        "Dominated throughout an unbeaten campaign and led the team to 27-0 glory.",
        "The standout in a perfect season — every week brought another decisive display.",
        "A campaign worthy of a club great — decisive, consistent and impossible to ignore.",
      ],
      `${perf.playerId}-perfect`
    );
  }

  if (perf.peakRating >= 90 && perf.tries >= 15) {
    return pickFromPool(
      [
        "A campaign worthy of a club great — decisive, consistent and impossible to ignore.",
        "Elite form all season — the kind of year legends are built on.",
        "Star quality every week and the numbers to prove it.",
      ],
      `${perf.playerId}-elite`
    );
  }

  if (isTopTryScorer && perf.tries >= 12) {
    return pickFromPool(
      [
        "Led the line with a try tally that separated this side from the rest.",
        "The team's sharpest finisher — tries arrived when the season needed them most.",
        "A constant threat with ball in hand and the player opposition sides struggled to contain.",
      ],
      `${perf.playerId}-tries`
    );
  }

  if (FORWARD_POSITIONS.includes(perf.playedPosition)) {
    return pickFromPool(
      [
        "Set the tone through the middle and gave the squad a platform every week.",
        "Relentless in the trenches — the engine room of a strong campaign.",
        "Led from the front with power, discipline and repeat efforts.",
      ],
      `${perf.playerId}-fwd`
    );
  }

  if (HALF_POSITIONS.includes(perf.playedPosition)) {
    return pickFromPool(
      [
        "Controlled the tempo, created chances and delivered when the season needed direction.",
        "Ran the team with composure — the hub of everything this side did well.",
        "Kicked, passed and organised the side through a standout campaign.",
      ],
      `${perf.playerId}-half`
    );
  }

  if (BACK_POSITIONS.includes(perf.playedPosition)) {
    return pickFromPool(
      [
        "A constant threat with ball in hand and the player opposition sides struggled to contain.",
        "Explosive in attack and reliable when the stakes were highest.",
        "Finished moves, broke the line and carried the team's attacking threat.",
      ],
      `${perf.playerId}-back`
    );
  }

  if (perf.tries >= 20) {
    return pickFromPool(
      [
        "A prolific attacking threat who consistently delivered when it mattered.",
        "Tries flowed all season — a finisher in irrepressible form.",
      ],
      `${perf.playerId}-prolific`
    );
  }

  if (seasonResult.wins >= 20) {
    return pickFromPool(
      [
        "Dominated throughout the campaign and drove the team deep into title contention.",
        "Match-winning contributions in a season that stayed in the hunt until the end.",
      ],
      `${perf.playerId}-wins`
    );
  }

  void seed;
  return pickFromPool(
    [
      "Stood above the rest with consistent match-winning contributions all season.",
      "The pick of the squad — reliable, influential and always in the conversation.",
      "Raised the standard week after week when others drifted.",
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
        ? "Nobody — impossible in Super Sam Hallas Mode. The opposition had a harder time."
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
