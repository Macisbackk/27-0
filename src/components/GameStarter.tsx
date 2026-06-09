"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { GameDifficulty, GameMode } from "@/lib/types";
import { getDifficulty, setDifficulty } from "@/lib/storage/preferences";
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
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [difficulty, setDifficultyState] =
    useState<GameDifficulty>(initialDifficulty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn) {
      router.replace("/");
      return;
    }

    const resolved = resolveDifficulty(initialDifficulty);
    setDifficultyState(resolved);
    setDifficulty(resolved);
    setReady(true);
  }, [initialDifficulty, router, isLoggedIn, authLoading]);

  if (authLoading || !ready) {
    return (
      <div className="matchday-arena flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">
          {authLoading ? "Loading account…" : "Loading run…"}
        </p>
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
