import { LeaderboardGuestNotice } from "@/components/LeaderboardGuestNotice";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { CareerLeaderboard } from "@/components/career/CareerLeaderboard";
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
              Classic, Daily Challenge, Mini Games and Manager Mode.
            </p>
          </header>
          <LeaderboardGuestNotice />
          <LeaderboardTable />
          <CareerLeaderboard />
        </div>
      </PageShellBody>
    </StandardPageShell>
  );
}
