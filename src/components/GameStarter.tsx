"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GameMode } from "@/lib/types";
import { isNormalEraMode } from "@/lib/play-links";
import { ensurePlayersLoaded } from "@/lib/players";
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
  const [ready, setReady] = useState(false);

  const isNormalEra =
    mode === "CLASSIC" &&
    (normalEraMode ||
      isNormalEraMode({
        era: searchParams.get("era"),
        cup: searchParams.get("cup"),
      }));

  useEffect(() => {
    void ensurePlayersLoaded().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="matchday-arena flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md animate-pulse space-y-3 motion-reduce:animate-none">
          <div className="mx-auto h-6 w-40 rounded-lg bg-pitch-800/80" />
          <div className="h-20 rounded-xl bg-pitch-800/60" />
          <div className="h-40 rounded-xl bg-pitch-800/50" />
        </div>
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
      normalEraMode={isNormalEra}
    />
  );
}
