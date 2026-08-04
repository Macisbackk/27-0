import { LeaderboardGuestNotice } from "@/components/LeaderboardGuestNotice";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { PageShellBody } from "@/components/ui/PageShell";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default async function LeaderboardPage() {
  return (
    <StandardPageShell desktopFit>
      <PageShellBody>
        <div className={PAGE.section}>
          <header>
            <p className={TYPO.sectionLabel}>Rankings</p>
            <h1 className={`mt-1 ${TYPO.pageTitle}`}>Leaderboard</h1>
            <p className={`mt-2 ${TYPO.bodySm}`}>
              Quick Mode and Manager Mode rankings — Super League records,
              league titles, Challenge Cup trophies, and career earnings, synced
              online across all players.
            </p>
          </header>
          <LeaderboardGuestNotice />
          <LeaderboardTable />
        </div>
      </PageShellBody>
    </StandardPageShell>
  );
}
