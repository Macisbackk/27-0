"use client";

import { GameStarter } from "@/components/GameStarter";
import { getPlayPageTitle } from "@/lib/mode-labels";
import { isNormalEraMode } from "@/lib/play-links";
import type { GameDifficulty, GameMode } from "@/lib/types";

export interface PlaySearchParams {
  difficulty?: string;
  era?: string;
  joeMellor?: string;
  superSamHallas?: string;
}

interface PlayPageClientProps {
  params: PlaySearchParams;
}

export function PlayPageClient({ params }: PlayPageClientProps) {
  const wantsNormalEra = isNormalEraMode(params);
  const wantsSuperSamHallas = params.superSamHallas === "1";
  const wantsJoeMellor = params.joeMellor === "1" && !wantsSuperSamHallas;
  const difficulty: GameDifficulty = "NORMAL";

  const mode: GameMode = "CLASSIC";

  const title = wantsSuperSamHallas
    ? "Super Sam Hallas Mode"
    : wantsJoeMellor
      ? "Joe Mellor GOAT Mode"
      : getPlayPageTitle(mode, difficulty, wantsNormalEra);

  return (
    <GameStarter
      mode={mode}
      title={title}
      difficulty={difficulty}
      joeMellorMode={wantsJoeMellor}
      superSamHallasMode={wantsSuperSamHallas}
      normalEraMode={wantsNormalEra}
    />
  );
}
