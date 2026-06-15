import { formatUpdateDate, UPDATES } from "../../../data/updates";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function UpdatesPage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className={`relative mx-auto max-w-2xl ${SPACING.pageX} py-8 sm:py-12`}>
        <header className="mb-8 text-center">
          <p className={TYPO.sectionLabel}>Changelog</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Updates</h1>
          <p className={`mx-auto mt-3 max-w-md ${TYPO.body}`}>
            What&apos;s new in 27-0 — features, improvements, and fixes shipped
            with each release.
          </p>
        </header>

        <ol className="relative space-y-0">
          {UPDATES.map((entry, index) => (
            <li key={entry.version} className="relative pb-8 last:pb-0">
              {index < UPDATES.length - 1 && (
                <span
                  className="absolute left-[11px] top-6 bottom-0 w-px bg-pitch-700/70"
                  aria-hidden
                />
              )}
              <div className="flex gap-4">
                <span
                  className="relative z-10 mt-1.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-accent-green/50 bg-pitch-950"
                  aria-hidden
                >
                  <span className="h-2 w-2 rounded-full bg-accent-green" />
                </span>
                <article className={`min-w-0 flex-1 ${CARD.panel} ${SPACING.cardPadding}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className={`${TYPO.cardTitle} text-accent-gold`}>
                      Version {entry.version}
                    </h2>
                    <time
                      dateTime={entry.date}
                      className={`${TYPO.statLabel} shrink-0`}
                    >
                      {formatUpdateDate(entry.date)}
                    </time>
                  </div>
                  <p className={`mt-2 ${TYPO.body}`}>{entry.summary}</p>
                  <ul className={`mt-3 space-y-1.5 ${TYPO.bodySm} text-gray-300`}>
                    {entry.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-green/70"
                          aria-hidden
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
