"use client";

import { redirect } from "next/navigation";
import { GameStarter } from "@/components/GameStarter";
import { getPlayPageTitle } from "@/lib/mode-labels";
import { isNormalEraMode } from "@/lib/play-links";
import type { GameMode } from "@/lib/types";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{
    difficulty?: string;
    cup?: string;
    era?: string;
    eraCup?: string;
    joeMellor?: string;
    superSamHallas?: string;
    draft?: string;
    fantasy?: string;
  }>;
}) {
  const params = await searchParams;

  if (
    params.cup === "1" ||
    params.eraCup === "1" ||
    params.fantasy === "1" ||
    params.draft === "1" ||
    params.difficulty === "hard"
  ) {
    redirect("/play");
  }

  const wantsNormalEra = isNormalEraMode(params);
  const wantsSuperSamHallas = params.superSamHallas === "1";
  const wantsJoeMellor = params.joeMellor === "1" && !wantsSuperSamHallas;

  const mode: GameMode = "CLASSIC";

  const title = wantsSuperSamHallas
    ? "Super Sam Hallas Mode"
    : wantsJoeMellor
      ? "Joe Mellor GOAT Mode"
      : getPlayPageTitle(mode, "NORMAL", wantsNormalEra);

  return (
    <GameStarter
      mode={mode}
      title={title}
      joeMellorMode={wantsJoeMellor}
      superSamHallasMode={wantsSuperSamHallas}
      normalEraMode={wantsNormalEra}
    />
  );
}
