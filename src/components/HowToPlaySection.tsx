import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const CORE_STEPS = [
  "Pick a position on the team sheet",
  "Spin for a club — add a year in Era modes",
  "Recruit your player and fill all 13 slots",
  "Simulate your run and chase the leaderboard",
] as const;

const MODES = [
  {
    title: "Normal Current",
    tag: "Current",
    body: "Spin 2026 Super League clubs and build a squad capable of going 27-0.",
    accent: "current" as const,
  },
  {
    title: "Normal Era",
    tag: "Era",
    body: "Spin historic team-years and draft from exact era player pools.",
    accent: "era" as const,
  },
  {
    title: "Challenge Cup Current",
    tag: "Cup",
    body: "Pick or randomise a 2026 club, set your XIII, and fight through the bracket.",
    accent: "cup" as const,
  },
  {
    title: "Era Challenge Cup",
    tag: "Era Cup",
    body: "Lead a historic team-year through the knockout draw.",
    accent: "era-cup" as const,
  },
] as const;

const ACCENT_STYLES = {
  current: {
    card: "border-mode-current/30 bg-mode-current/5",
    tag: "border-mode-current/40 bg-mode-current/10 text-mode-current",
    dot: "bg-mode-current",
  },
  era: {
    card: "border-accent-gold/30 bg-accent-gold/5",
    tag: "border-accent-gold/40 bg-accent-gold/10 text-accent-gold",
    dot: "bg-accent-gold",
  },
  cup: {
    card: "border-theme-tertiary/35 bg-theme-primary/5",
    tag: "border-theme-tertiary/45 bg-theme-primary/10 text-theme-primary",
    dot: "bg-theme-primary",
  },
  "era-cup": {
    card: "border-accent-gold/25 bg-accent-gold/[0.07]",
    tag: "border-accent-gold/35 bg-accent-gold/10 text-accent-gold",
    dot: "bg-accent-gold",
  },
} as const;

export function HowToPlaySection() {
  return (
    <section
      className={`matchday-panel overflow-hidden ${CARD.featured}`}
      aria-labelledby="how-to-play-heading"
    >
      <div
        className={`border-b border-pitch-600/45 bg-pitch-950/40 ${SPACING.cardPadding} sm:px-6`}
      >
        <p className={TYPO.sectionLabel}>Guide</p>
        <h3
          id="how-to-play-heading"
          className="mt-1 font-display text-lg font-black tracking-tight text-white sm:text-xl"
        >
          How To Play
        </h3>
        <p className={`mt-2 max-w-2xl ${TYPO.body}`}>
          Every mode uses the same recruitment loop — only the club spin and
          competition format change.
        </p>
      </div>

      <div className={`${SPACING.cardPadding} sm:px-6`}>
        <p className={TYPO.statLabel}>The loop</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {CORE_STEPS.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-3 rounded-lg border border-pitch-700/50 bg-pitch-950/45 px-3 py-2.5"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-theme-tertiary/40 bg-theme-primary/10 font-display text-[11px] font-black text-theme-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className={`min-w-0 pt-0.5 ${TYPO.body} text-gray-300`}>
                {step}
              </span>
            </li>
          ))}
        </ol>

        <p className={`mt-6 ${TYPO.statLabel}`}>Game modes</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => {
            const accent = ACCENT_STYLES[mode.accent];
            return (
              <li
                key={mode.title}
                className={`rounded-xl border p-4 transition ${accent.card}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${accent.dot}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-bold text-white">
                        {mode.title}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider ${accent.tag}`}
                      >
                        {mode.tag}
                      </span>
                    </div>
                    <p className={`mt-2 ${TYPO.bodySm} text-gray-400`}>
                      {mode.body}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
