"use client";

import { ChangelogAccordion } from "@/components/ChangelogAccordion";
import { PageShell } from "@/components/ui/PageShell";
import { GAME_UPDATES } from "../../../data/updates";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function UpdatesPage() {
  return (
    <PageShell withLights compact>
      <div className={`mx-auto max-w-2xl ${PAGE.section}`}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Changelog</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">
            Updates
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            What&apos;s new in 27-0 — latest changes first.
          </p>
        </header>

        <ChangelogAccordion entries={GAME_UPDATES} />
      </div>
    </PageShell>
  );
}
