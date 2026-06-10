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
    joeMellor?: string;
    draft?: string;
  }>;
}) {
  const params = await searchParams;
  const wantsHard = params.difficulty === "hard";
  const wantsCup = params.cup === "1";
  const wantsJoeMellor = params.joeMellor === "1";
  const wantsDraft = params.draft === "1";

  const joeMellorMode = wantsJoeMellor;
  const difficulty: GameDifficulty = wantsHard ? "HARD" : "NORMAL";

  let mode: GameMode = "CLASSIC";
  if (wantsCup) {
    mode = "CHALLENGE_CUP";
  } else if (wantsDraft && !joeMellorMode) {
    mode = "DRAFT";
  }

  const title = joeMellorMode ? "Joe Mellor Mode" : getPlayPageTitle(mode, difficulty);

  const subtitle =
    mode === "CHALLENGE_CUP"
      ? "Choose your club, draft club legends, and fight through a knockout tournament."
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
    />
  );
}
