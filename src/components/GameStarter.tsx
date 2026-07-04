"use client";

import { useSearchParams } from "next/navigation";
import type { GameMode } from "@/lib/types";
import { isNormalEraMode } from "@/lib/play-links";
import { GameBoard } from "./GameBoard";

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

  const isNormalEra =
    mode === "CLASSIC" &&
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
    />
  );
}
