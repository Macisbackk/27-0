import type { ManagerCareer } from "./types";
import {
  getManagerClubConfig,
  MANAGER_EXPECTATION_LABELS,
  type ManagerClubExpectationTier,
} from "./club-config";
import { getUserLeaguePosition } from "./managerFixtures";
import { pushInboxMessage } from "./managerInbox";

export interface ManagerDifficultySimAdjustments {
  opponentRatingDelta: number;
  formDelta: number;
}

export interface ManagerDifficultyPressure {
  label: string;
  detail: string;
  tone: "gold" | "primary" | "amber" | "red" | "muted";
}

function expectationTier(career: ManagerCareer): ManagerClubExpectationTier {
  const config = getManagerClubConfig(career.club);
  return config.expectationTier;
}

/** Nudge simulation from club strength tier and current league standing. */
export function getManagerDifficultySimAdjustments(
  career: ManagerCareer
): ManagerDifficultySimAdjustments {
  const tier = expectationTier(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const week = Math.max(1, career.gameWeek);

  let opponentRatingDelta = 0;
  let formDelta = 0;

  if (tier === "survive" || tier === "avoid-bottom") {
    opponentRatingDelta += 1.2;
    formDelta -= 0.4;
  } else if (tier === "title" || tier === "playoffs") {
    opponentRatingDelta -= 0.8;
    formDelta += 0.3;
  }

  if (week >= 10) {
    if (tier === "title" && position > 2) {
      opponentRatingDelta += 0.6;
      formDelta -= 0.25;
    }
    if (tier === "survive" && position >= 10) {
      opponentRatingDelta += 1;
      formDelta -= 0.35;
    }
    if (tier === "playoffs" && position > 6) {
      opponentRatingDelta += 0.5;
      formDelta -= 0.2;
    }
  }

  if (career.boardConfidence < 35) {
    opponentRatingDelta += 0.4;
    formDelta -= 0.15;
  }

  if ((career.wagePressureWeeks ?? 0) >= 2) {
    formDelta -= 0.2;
  }

  return { opponentRatingDelta, formDelta };
}

/** Extra board confidence swing from expectation vs table position. */
export function getManagerDifficultyBoardDelta(
  career: ManagerCareer,
  position: number,
  won: boolean
): number {
  const tier = expectationTier(career);
  const week = Math.max(1, career.gameWeek);
  if (week < 6) return 0;

  let delta = 0;

  if (tier === "title") {
    if (position === 1 && won) delta += 1;
    if (position > 3 && !won) delta -= 2;
    if (position > 5 && won) delta -= 1;
  } else if (tier === "playoffs") {
    if (position <= 6 && won) delta += 1;
    if (position > 8 && !won) delta -= 2;
  } else if (tier === "survive" || tier === "avoid-bottom") {
    if (position <= 10 && won) delta += 2;
    if (position >= 12 && !won) delta -= 3;
    if (position >= 13 && !won) delta -= 2;
  } else {
    if (position <= 8 && won) delta += 1;
    if (position >= 11 && !won) delta -= 1;
  }

  return delta;
}

export function getManagerDifficultyPressure(
  career: ManagerCareer
): ManagerDifficultyPressure {
  const tier = expectationTier(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const target = MANAGER_EXPECTATION_LABELS[tier];
  const stars = career.difficulty ?? getManagerClubConfig(career.club).difficulty;

  if (career.boardConfidence < 30) {
    return {
      label: "Board ultimatum",
      detail: `Confidence at ${career.boardConfidence}% — results must improve quickly.`,
      tone: "red",
    };
  }

  if ((career.wagePressureWeeks ?? 0) >= 3) {
    return {
      label: "Financial pressure",
      detail: `${career.wagePressureWeeks} weeks over the wage budget — the board are watching.`,
      tone: "amber",
    };
  }

  if (tier === "title" && position > 3 && career.gameWeek >= 8) {
    return {
      label: "Title pressure",
      detail: `Target: ${target} · Currently ${position}th — every point counts.`,
      tone: "amber",
    };
  }

  if (
    (tier === "survive" || tier === "avoid-bottom") &&
    position >= 11 &&
    career.gameWeek >= 8
  ) {
    return {
      label: "Relegation scrap",
      detail: `${position}th place with a ${target.toLowerCase()} brief — pick up points.`,
      tone: "red",
    };
  }

  if (tier === "playoffs" && position > 6 && career.gameWeek >= 10) {
    return {
      label: "Play-off push",
      detail: `${position}th — need top-six form to meet the ${target.toLowerCase()} target.`,
      tone: "primary",
    };
  }

  return {
    label: `${stars}-star club`,
    detail: `Board target: ${target} · Table: ${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"}`,
    tone: position <= 4 ? "gold" : position >= 11 ? "amber" : "muted",
  };
}

export function maybeAddBoardUltimatumInbox(
  career: ManagerCareer
): ManagerCareer {
  if (career.boardConfidence >= 30) return career;
  const msgId = `board-ultimatum-s${career.seasonYear}-w${career.gameWeek}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "news",
    title: "Board ultimatum",
    body: `The board's confidence has dropped to ${career.boardConfidence}%. ${career.boardExpectation} is the minimum standard — improve results or face consequences.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: true,
  });
}
