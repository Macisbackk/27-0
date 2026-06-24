import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const MODES = [
  {
    title: "Normal Current",
    body: "Pick a position, spin for a 2026 Super League club, choose your player, then build a team capable of going 27-0.",
  },
  {
    title: "Normal Era",
    body: "Pick a position, spin for a historic Super League team-year, and build a squad using exact era player pools.",
  },
  {
    title: "Challenge Cup Current",
    body: "Choose or randomise a 2026 team, set your squad, then fight through the cup bracket.",
  },
  {
    title: "Era Challenge Cup",
    body: "Choose a historic team-year, adjust your matchday squad, and see if that era side can win the cup.",
  },
] as const;

export function HowToPlaySection() {
  return (
    <div>
      <h3 className={TYPO.sectionTitle}>How To Play</h3>

      <ul className="mt-5 space-y-4">
        {MODES.map((mode) => (
          <li key={mode.title}>
            <p className={`font-display text-sm font-bold text-white sm:text-base`}>
              {mode.title}
            </p>
            <p className={`mt-1 ${TYPO.bodySm} text-gray-400`}>{mode.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
