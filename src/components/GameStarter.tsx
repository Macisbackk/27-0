"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameDifficulty, GameMode } from "@/lib/types";
import { getDifficulty, setDifficulty } from "@/lib/storage/preferences";
import { hasUsername } from "@/lib/storage/user";
import { GameBoard } from "./GameBoard";

interface GameStarterProps {
  mode: GameMode;
  title: string;
  subtitle?: string;
  initialDifficulty?: GameDifficulty;
  joeMellorMode?: boolean;
}

function resolveDifficulty(initialDifficulty: GameDifficulty): GameDifficulty {
  if (typeof window === "undefined") return initialDifficulty;

  const params = new URLSearchParams(window.location.search);
  if (params.get("difficulty") === "hard") return "HARD";
  if (params.get("difficulty") === "normal") return "NORMAL";
  if (initialDifficulty === "HARD") return "HARD";
  return getDifficulty();
}

export function GameStarter({
  mode,
  title,
  subtitle,
  initialDifficulty = "NORMAL",
  joeMellorMode = false,
}: GameStarterProps) {
  const router = useRouter();
  const [difficulty, setDifficultyState] =
    useState<GameDifficulty>(initialDifficulty);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!hasUsername()) {
      setBlocked(true);
      router.replace("/");
      return;
    }

    const resolved = resolveDifficulty(initialDifficulty);
    setDifficultyState(resolved);
    setDifficulty(resolved);
    setReady(true);
  }, [initialDifficulty, router]);

  if (blocked) {
    return (
      <div className="matchday-arena flex min-h-screen items-center justify-center px-4">
        <div className="matchday-panel max-w-md p-8 text-center">
          <p className="font-display text-sm font-bold uppercase tracking-wider text-accent-green">
            Coach Name Required
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Choose your coach name on the home page before starting a run.
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="matchday-arena flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading run...</p>
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
    />
  );
}
