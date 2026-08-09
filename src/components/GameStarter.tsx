"use client";

import { useSearchParams } from "next/navigation";
import type { GameMode } from "@/lib/types";
import { isNormalEraMode } from "@/lib/play-links";
import { GameBoard } from "./GameBoard";
import {
  getDailyChallengeScenario,
  isDailyChallengeActive,
} from "@/lib/daily-challenge";

interface GameStarterProps {
  mode: GameMode;
  title: string;
  subtitle?: string;
  difficulty?: import("@/lib/types").GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  normalEraMode?: boolean;
}

export function GameStarter({
  mode,
  title,
  subtitle,
  difficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
  normalEraMode = false,
}: GameStarterProps) {
  const searchParams = useSearchParams();

  const dailyChallengeMode =
    mode === "CLASSIC" &&
    !joeMellorMode &&
    !superSamHallasMode &&
    isDailyChallengeActive({ daily: searchParams.get("daily") });

  // Daily locks Current/Era from today's scenario (URL era=1 is set by href).
  const dailyScenario = dailyChallengeMode
    ? getDailyChallengeScenario()
    : null;
  const isNormalEra = dailyScenario
    ? dailyScenario.eraMode
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
    />
  );
}
