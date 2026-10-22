import type { Metadata } from "next";
import { LeaderboardGuestNotice } from "@/components/LeaderboardGuestNotice";
import { LeaderboardBoards } from "@/components/LeaderboardBoards";
import { PageShellBody } from "@/components/ui/PageShell";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export const metadata: Metadata = {
  title: "Leaderboard — 27-0",
  description: "Classic, Daily Challenge and Manager Mode rankings.",
};

export default async function LeaderboardPage() {
  return (
    <StandardPageShell desktopFit>
      <PageShellBody>
        <div className={PAGE.section}>
          <header>
            <p className={TYPO.sectionLabel}>Rankings</p>
            <h1 className={`mt-1 ${TYPO.pageTitle}`}>Leaderboard</h1>
            <p className={`mt-2 ${TYPO.bodySm}`}>
              Classic, Daily Challenge and Manager Mode.
            </p>
          </header>
          <LeaderboardGuestNotice />
          <LeaderboardBoards />
        </div>
      </PageShellBody>
    </StandardPageShell>
  );
}
