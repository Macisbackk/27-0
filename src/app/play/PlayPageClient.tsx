"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameStarter } from "@/components/GameStarter";
import { getPlayPageTitle } from "@/lib/mode-labels";
import { isNormalEraMode } from "@/lib/play-links";
import type { GameDifficulty, GameMode } from "@/lib/types";

export function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const difficultyParam = searchParams.get("difficulty");
  const cup = searchParams.get("cup");
  const era = searchParams.get("era");
  const eraCup = searchParams.get("eraCup");
  const joeMellor = searchParams.get("joeMellor");
  const superSamHallas = searchParams.get("superSamHallas");
  const draft = searchParams.get("draft");
  const fantasy = searchParams.get("fantasy");

  const wantsSuperSamHallas = superSamHallas === "1";
  const wantsJoeMellor = joeMellor === "1" && !wantsSuperSamHallas;
  const isHiddenMode = wantsJoeMellor || wantsSuperSamHallas;

  useEffect(() => {
    if (
      !isHiddenMode &&
      (cup === "1" ||
        eraCup === "1" ||
        fantasy === "1" ||
        draft === "1" ||
        difficultyParam === "hard")
    ) {
      router.replace("/play");
    }
  }, [
    isHiddenMode,
    cup,
    eraCup,
    fantasy,
    draft,
    difficultyParam,
    router,
  ]);

  const wantsNormalEra = isNormalEraMode({ era, cup });
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
