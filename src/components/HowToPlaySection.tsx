import { GameBadge } from "@/components/ui/GameBadge";
import { ProgrammePanel } from "@/components/ui/ProgrammePanel";
import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const CORE_STEPS = [
  "Pick a position on the team sheet",
  "Spin for a club — add a year in Era modes",
  "Recruit your player and fill all 13 slots",
  "Simulate your run and chase the leaderboard",
] as const;

const MODES = [
  {
    title: "Manager Mode",
    tag: "Career",
    body: "Take charge of a Super League club — contracts, tactics, transfers, and full-season management.",
    tone: "theme" as const,
  },
  {
    title: "Normal Current",
    tag: "Current",
    body: "Spin 2026 Super League clubs and build a squad capable of going 27-0.",
    tone: "win" as const,
  },
  {
    title: "Normal Era",
    tag: "Era",
    body: "Spin historic team-years and draft from exact era player pools.",
    tone: "gold" as const,
  },
] as const;

export function HowToPlaySection() {
  return (
    <ProgrammePanel as="section" variant="elevated" className="overflow-hidden">
      <div
        className={`border-b border-theme-tertiary/25 bg-[#070c14] ${SPACING.cardPadding} sm:px-6`}
      >
        <GameSectionTitle label="Matchday programme" heading="How To Play" />
        <p id="how-to-play-heading" className="sr-only">
          How To Play
        </p>
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
              className="game-table-row game-table-row--slip flex items-start gap-3"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-theme-tertiary/40 bg-theme-primary/10 font-display text-[11px] font-black text-theme-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className={`${TYPO.bodySm} text-pitch-200`}>{step}</span>
            </li>
          ))}
        </ol>

        <div className="pitch-divider my-5" />

        <p className={TYPO.statLabel}>Modes</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map((mode) => (
            <li key={mode.title} className="match-ticket">
              <GameBadge tone={mode.tone}>{mode.tag}</GameBadge>
              <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide text-white">
                {mode.title}
              </p>
              <p className={`mt-1 ${TYPO.bodySm}`}>{mode.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </ProgrammePanel>
  );
}
