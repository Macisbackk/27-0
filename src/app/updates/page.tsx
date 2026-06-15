import { UPDATES } from "../../../data/updates";
import { UpdatesTimeline } from "@/components/UpdatesTimeline";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function UpdatesPage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className={`relative mx-auto max-w-2xl ${SPACING.pageX} py-8 sm:py-12`}>
        <header className="mb-8 text-center">
          <p className={TYPO.sectionLabel}>Patch Notes</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Updates</h1>
          <p className={`mx-auto mt-3 max-w-md ${TYPO.body}`}>
            The public development history of 27-0 — major features, modes,
            and improvements shipped with each release.
          </p>
        </header>

        <UpdatesTimeline entries={UPDATES} />
      </div>
    </div>
  );
}
