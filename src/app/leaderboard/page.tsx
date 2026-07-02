import { LeaderboardGuestNotice } from "@/components/LeaderboardGuestNotice";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { PageShell } from "@/components/ui/PageShell";
import { PAGE } from "@/lib/ui/design-system";
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
    <PageShell withLights compact>
      <div className={PAGE.section}>
        <header>
          <p className={TYPO.sectionLabel}>Rankings</p>
          <h1 className={`mt-1 ${TYPO.pageTitle}`}>Leaderboard</h1>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Quick Mode and Manager Mode rankings — Super League records,
            Challenge Cup trophies, and career earnings, synced online across
            all players.
          </p>
        </header>
        <LeaderboardGuestNotice />
        <LeaderboardTable initialDifficulty={difficulty} />
      </div>
    </PageShell>
  );
}
