"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GameMode } from "@/lib/types";
import { isNormalEraMode } from "@/lib/play-links";
import { GameBoard } from "./GameBoard";

interface GameStarterProps {
  mode: GameMode;
  title: string;
  subtitle?: string;
  joeMellorMode?: boolean;
  superSamHallasMode?: boolean;
  normalEraMode?: boolean;
}

export function GameStarter({
  mode,
  title,
  subtitle,
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
    setReady(true);
  }, []);

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
      difficulty="NORMAL"
      joeMellorMode={joeMellorMode}
      superSamHallasMode={superSamHallasMode}
      normalEraMode={isNormalEra}
    />
  );
}
