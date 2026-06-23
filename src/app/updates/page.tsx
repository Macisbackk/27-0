import { MAJOR_UPDATES } from "../../../data/updates";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function UpdatesPage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div
        className={`relative mx-auto max-w-2xl ${SPACING.pageX} py-8 sm:py-12`}
      >
        <header className="mb-8 text-center">
          <p className={TYPO.sectionLabel}>Changelog</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Updates</h1>
          <p className={`mx-auto mt-3 max-w-md ${TYPO.body}`}>
            Major features shipped in 27-0, from first launch to the latest
            modes.
          </p>
        </header>

        <ol className="space-y-3">
          {MAJOR_UPDATES.map((title, index) => (
            <li
              key={title}
              className="flex min-w-0 items-start gap-3 rounded-xl border border-pitch-700/60 bg-pitch-950/70 px-4 py-3"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-green/40 bg-pitch-900 text-[11px] font-bold text-accent-green"
                aria-hidden
              >
                {index + 1}
              </span>
              <p className={`min-w-0 ${TYPO.cardTitle} text-white`}>{title}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
