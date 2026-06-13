"use client";

import { useEffect, useState } from "react";
import type { GameDifficulty, GameMode } from "@/lib/types";
import {
  setModeDifficulty,
  type PlayModeKey,
} from "@/lib/storage/preferences";
import { GameBoard } from "./GameBoard";
import { FantasyModeBoard } from "./FantasyModeBoard";
import { EraChallengeCupBoard } from "./EraChallengeCupBoard";

interface GameStarterProps {
  mode: GameMode;
  title: string;
  subtitle?: string;
  initialDifficulty?: GameDifficulty;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  eraChallengeCup?: boolean;
}

function resolvePlayModeKey(
  mode: GameMode,
  search: URLSearchParams
): PlayModeKey | null {
  if (mode === "CHALLENGE_CUP") return null;
  if (mode === "FANTASY") return null;
  if (mode === "DRAFT") return "draft";
  if (search.get("draft") === "1") return "draft";
  return "normal";
}

export function GameStarter({
  mode,
  title,
  subtitle,
  initialDifficulty = "NORMAL",
  joeMellorMode = false,
  superSamHallasMode = false,
  eraChallengeCup = false,
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

    const modeKey = resolvePlayModeKey(mode, params);
    if (modeKey && difficultyParam) {
      setModeDifficulty(modeKey, resolved);
    }

    setReady(true);
  }, [initialDifficulty, mode]);

  if (!ready) {
    return (
      <div className="matchday-arena flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading run…</p>
      </div>
    );
  }

  if (mode === "FANTASY") {
    return <FantasyModeBoard />;
  }

  if (mode === "CHALLENGE_CUP" && eraChallengeCup) {
    return <EraChallengeCupBoard />;
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
