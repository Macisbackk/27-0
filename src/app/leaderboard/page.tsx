import { LeaderboardTable } from "@/components/LeaderboardTable";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string }>;
}) {
  const params = await searchParams;
  const difficulty =
    params.difficulty === "hard" ? ("HARD" as const) : ("NORMAL" as const);

  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold">Leaderboard</h1>
        <p className="mb-6 text-sm text-gray-500">
          Super League squad-value rankings and dedicated Challenge Cup records,
          updated online across all players.
        </p>
        <LeaderboardTable initialDifficulty={difficulty} />
      </div>
    </div>
  );
}
