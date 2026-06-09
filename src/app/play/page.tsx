import { GameStarter } from "@/components/GameStarter";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{
    difficulty?: string;
    cup?: string;
    joeMellor?: string;
  }>;
}) {
  const params = await searchParams;
  const wantsHard = params.difficulty === "hard";
  const wantsCup = params.cup === "1";
  const wantsJoeMellor = params.joeMellor === "1";

  const joeMellorMode = wantsJoeMellor;
  const difficulty = wantsHard ? ("HARD" as const) : ("NORMAL" as const);
  const mode = wantsCup ? ("CHALLENGE_CUP" as const) : ("CLASSIC" as const);

  const title = joeMellorMode
    ? "Joe Mellor Mode"
    : wantsCup
      ? "Challenge Cup"
      : "Super League Season";

  const subtitle = joeMellorMode
    ? "Joe Mellor Challenge — the GOAT is locked at Loose Forward. Build your dynasty around him."
    : wantsCup
      ? "Choose your club, draft club legends, and fight through a knockout tournament."
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
