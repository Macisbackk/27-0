"use client";

import { useSearchParams } from "next/navigation";
import type { GameMode } from "@/lib/types";
import { isNormalEraMode } from "@/lib/play-links";
import { GameBoard } from "./GameBoard";
import type { ChallengePayload } from "@/lib/challenge-link";
import {
  getDailyChallengeScenario,
  isDailyChallengeActive,
} from "@/lib/daily-challenge";
import {
  getWeeklyChallengeScenario,
  isWeeklyChallengeActive,
} from "@/lib/weekly-challenge";

interface GameStarterProps {
  mode: GameMode;
  title: string;
  subtitle?: string;
  difficulty?: import("@/lib/types").GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  normalEraMode?: boolean;
  /** "Challenge a mate" link: replaces any Daily / Weekly flag in the URL. */
  challenge?: ChallengePayload | null;
}

export function GameStarter({
  mode,
  title,
  subtitle,
  difficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
  normalEraMode = false,
  challenge = null,
}: GameStarterProps) {
  const searchParams = useSearchParams();

  const dailyChallengeMode =
    !challenge &&
    mode === "CLASSIC" &&
    !joeMellorMode &&
    !superSamHallasMode &&
    isDailyChallengeActive({ daily: searchParams.get("daily") });

  // Weekly Challenge (/play?weekly=1): same shape as the Daily; the Daily wins if both are set.
  const weeklyChallengeMode =
    !challenge &&
    mode === "CLASSIC" &&
    !joeMellorMode &&
    !superSamHallasMode &&
    !dailyChallengeMode &&
    isWeeklyChallengeActive({ weekly: searchParams.get("weekly") });

  // Daily / Weekly lock Current/Era from their scenario (URL era=1 is set by href).
  const dailyScenario = dailyChallengeMode
    ? getDailyChallengeScenario()
    : null;
  const weeklyScenario = weeklyChallengeMode ? getWeeklyChallengeScenario() : null;
  const isNormalEra = dailyScenario
    ? dailyScenario.eraMode
    : weeklyScenario
      ? weeklyScenario.eraMode
      : challenge
        ? normalEraMode
        : mode === "CLASSIC" &&
      (normalEraMode ||
        isNormalEraMode({
          era: searchParams.get("era"),
          cup: searchParams.get("cup"),
        }));

  return (
    <GameBoard
      mode={mode}
      title={title}
      subtitle={subtitle}
      difficulty={difficulty}
      joeMellorMode={joeMellorMode}
      superSamHallasMode={superSamHallasMode}
      normalEraMode={isNormalEra}
      dailyChallengeMode={dailyChallengeMode}
      weeklyChallengeMode={weeklyChallengeMode}
      challenge={challenge}
    />
  );
}
