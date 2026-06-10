"use client";

import { useEffect, useState } from "react";
import type { GameDifficulty, GameMode } from "@/lib/types";
import { setHardModeEnabled } from "@/lib/storage/preferences";
import { GameBoard } from "./GameBoard";

interface GameStarterProps {
  mode: GameMode;
  title: string;
  subtitle?: string;
  initialDifficulty?: GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
}

export function GameStarter({
  mode,
  title,
  subtitle,
  initialDifficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
}: GameStarterProps) {
  const [difficulty, setDifficultyState] =
    useState<GameDifficulty>(initialDifficulty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let resolved: GameDifficulty = initialDifficulty;
    const difficultyParam = params.get("difficulty");

    if (difficultyParam === "hard") resolved = "HARD";
    else if (difficultyParam === "normal") resolved = "NORMAL";

    setDifficultyState(resolved);

    if (difficultyParam === "hard") {
      setHardModeEnabled(true);
    } else if (difficultyParam === "normal") {
      setHardModeEnabled(false);
    }

    setReady(true);
  }, [initialDifficulty]);

  if (!ready) {
    return (
      <div className="matchday-arena flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading run…</p>
      </div>
    );
  }

  return (
    <GameBoard
      mode={mode}
      title={title}
      subtitle={subtitle}
      difficulty={difficulty}
      joeMellorMode={joeMellorMode}
      superSamHallasMode={superSamHallasMode}
    />
  );
}
