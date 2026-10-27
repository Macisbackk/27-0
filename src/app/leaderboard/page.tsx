import type { Metadata } from "next";
import { LeaderboardGuestNotice } from "@/components/LeaderboardGuestNotice";
import { LeaderboardBoards } from "@/components/LeaderboardBoards";
import { PageShellBody } from "@/components/ui/PageShell";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { PitchHero } from "@/components/ui/PitchHero";
import { LadderGlyph } from "@/components/icons/rugby-icons";

export const metadata: Metadata = {
  title: "Leaderboard — 27-0",
  description: "Classic, Manager Mode and Daily rankings.",
};

export default async function LeaderboardPage() {
  return (
    <StandardPageShell desktopFit>
      <PageShellBody>
        <div className={PAGE.section}>
          <PitchHero
            eyebrow="Rankings"
            title="Leaderboard"
            description="Classic, Manager Mode and the Daily."
            icon={<LadderGlyph />}
          />
          <LeaderboardBoards />
          {/* Boards first; the guest log-in nudge sits under them. */}
          <LeaderboardGuestNotice />
        </div>
      </PageShellBody>
    </StandardPageShell>
  );
}
