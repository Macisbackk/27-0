import { redirect } from "next/navigation";
import { GameStarter } from "@/components/GameStarter";
import {
  DRAFT_MODE_INTRO,
  getPlayPageTitle,
} from "@/lib/mode-labels";
import type { GameDifficulty, GameMode } from "@/lib/types";

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

  const wantsHard = params.difficulty === "hard";
  const wantsCup = params.cup === "1";
  const wantsEraCup = wantsCup && params.era === "1";
  const wantsFantasy = params.fantasy === "1";
  const wantsSuperSamHallas = params.superSamHallas === "1";
  const wantsJoeMellor = params.joeMellor === "1" && !wantsSuperSamHallas;
  const wantsDraft = params.draft === "1";

  const superSamHallasMode = wantsSuperSamHallas;
  const joeMellorMode = wantsJoeMellor;
  const difficulty: GameDifficulty = wantsHard ? "HARD" : "NORMAL";

  let mode: GameMode = "CLASSIC";
  if (wantsCup) {
    mode = "CHALLENGE_CUP";
  } else if (wantsFantasy && !joeMellorMode && !superSamHallasMode) {
    mode = "FANTASY";
  } else if (wantsDraft && !joeMellorMode && !superSamHallasMode) {
    mode = "DRAFT";
  }

  const title = superSamHallasMode
    ? "Super Sam Hallas Mode"
    : joeMellorMode
      ? "Joe Mellor Mode"
      : getPlayPageTitle(mode, difficulty);

  const subtitle =
    mode === "CHALLENGE_CUP"
      ? wantsEraCup
        ? undefined
        : "Choose your club, draft club legends, and fight through a knockout tournament."
      : mode === "FANTASY"
        ? undefined
        : mode === "DRAFT"
          ? DRAFT_MODE_INTRO
          : undefined;

  return (
    <GameStarter
      mode={mode}
      title={title}
      subtitle={subtitle}
      initialDifficulty={difficulty}
      joeMellorMode={joeMellorMode}
      superSamHallasMode={superSamHallasMode}
      eraChallengeCup={wantsEraCup}
    />
  );
}
