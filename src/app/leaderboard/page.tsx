import { LeaderboardGuestNotice } from "@/components/LeaderboardGuestNotice";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

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
      <div className={`relative mx-auto max-w-4xl ${SPACING.pageX} py-8`}>
        <h1 className={TYPO.pageTitle}>Leaderboard</h1>
        <p className={`mb-4 ${TYPO.bodySm}`}>
          Super League squad-value rankings, Challenge Cup records, and total Club
          Funds winnings, updated online across all players.
        </p>
        <LeaderboardGuestNotice />
        <LeaderboardTable initialDifficulty={difficulty} />
      </div>
    </div>
  );
}
