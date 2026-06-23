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
    joeMellor?: string;
    superSamHallas?: string;
    draft?: string;
    fantasy?: string;
    eraCup?: string;
  }>;
}) {
  const params = await searchParams;

  if (params.eraCup === "1") {
    redirect("/play?cup=1&era=1");
  }

  // Block removed public modes — redirect to default Normal Current.
  if (
    params.fantasy === "1" ||
    params.draft === "1" ||
    params.difficulty === "hard"
  ) {
    redirect("/play");
  }

  const wantsCup = params.cup === "1";
  const wantsEraCup = wantsCup && params.era === "1";
  const wantsNormalEra = isNormalEraMode(params);
  const wantsSuperSamHallas = params.superSamHallas === "1";
  const wantsJoeMellor = params.joeMellor === "1" && !wantsSuperSamHallas;

  const superSamHallasMode = wantsSuperSamHallas;
  const joeMellorMode = wantsJoeMellor;

  let mode: GameMode = "CLASSIC";
  if (wantsCup) {
    mode = "CHALLENGE_CUP";
  }

  const title = superSamHallasMode
    ? "Super Sam Hallas Mode"
    : joeMellorMode
      ? "Joe Mellor GOAT Mode"
      : getPlayPageTitle(mode, "NORMAL", wantsNormalEra);

  const subtitle =
    mode === "CHALLENGE_CUP"
      ? wantsEraCup
        ? undefined
        : "Choose your club, draft club legends, and fight through a knockout tournament."
      : undefined;

  return (
    <GameStarter
      mode={mode}
      title={title}
      subtitle={subtitle}
      joeMellorMode={joeMellorMode}
      superSamHallasMode={superSamHallasMode}
      eraChallengeCup={wantsEraCup}
      normalEraMode={wantsNormalEra}
    />
  );
}
