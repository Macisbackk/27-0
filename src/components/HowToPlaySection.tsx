import { GameBadge } from "@/components/ui/GameBadge";
import { GamePanel } from "@/components/ui/GamePanel";
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
    <GamePanel as="section" variant="elevated" className="overflow-hidden">
      <div className={`border-b border-white/5 ${SPACING.cardPadding} sm:px-6`}>
        <GameSectionTitle label="Guide" heading="How to play" />
        <p id="how-to-play-heading" className="sr-only">
          How to play
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
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-theme-tertiary/30 bg-theme-primary/10 text-[11px] font-bold text-theme-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className={`${TYPO.bodySm} text-gray-300`}>{step}</span>
            </li>
          ))}
        </ol>

        <div className="pitch-divider my-5" />

        <p className={TYPO.statLabel}>Modes</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map((mode) => (
            <li
              key={mode.title}
              className="rounded-xl border border-white/5 bg-black/20 px-3 py-3"
            >
              <GameBadge tone={mode.tone}>{mode.tag}</GameBadge>
              <p className="mt-2 font-display text-sm font-bold text-white">
                {mode.title}
              </p>
              <p className={`mt-1 ${TYPO.bodySm}`}>{mode.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </GamePanel>
  );
}
