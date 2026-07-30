import { GameBadge } from "@/components/ui/GameBadge";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    tag: "Career",
    tone: "theme" as const,
    body: "Take charge of a Super League club, manage your squad, contracts, transfers, reserves, fixtures and finances.",
  },
  {
    title: "Normal Mode",
    tag: "Draft",
    tone: "win" as const,
    body: "Build a dream 17 from Current or Era pools and try to go 27-0.",
  },
  {
    title: "Challenge Cup",
    tag: "Knockout",
    tone: "gold" as const,
    body: "Draft your team and chase a knockout trophy in Current or Era mode.",
  },
  {
    title: "Club Funds",
    tag: "Store",
    tone: "gold" as const,
    body: "Earn funds through seasons, trophies, achievements and rewards. Spend them in the Store on team UI themes.",
  },
  {
    title: "Coach Profile",
    tag: "Progress",
    tone: "muted" as const,
    body: "Track stats, achievements, trophies, records and progress.",
  },
] as const;

export function HowToPlaySection() {
  return (
    <GamePanel as="section" variant="elevated" className="overflow-hidden">
      <div className={`border-b border-white/5 text-center ${SPACING.cardPadding} sm:px-6`}>
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <GameSectionTitle label="Guide" heading="How to play" />
          <p id="how-to-play-heading" className="sr-only">
            How to play
          </p>
          <p className={`mt-2 ${TYPO.body}`}>
            Manager Mode is the main career. Quick modes let you draft a squad
            and chase trophies — here&apos;s what each area does.
          </p>
        </div>
      </div>

      <div className={`${SPACING.cardPadding} sm:px-6`}>
        <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_ITEMS.map((item) => (
            <li
              key={item.title}
              className="flex flex-col rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-center sm:text-left"
            >
              <div className="flex justify-center sm:justify-start">
                <GameBadge tone={item.tone}>{item.tag}</GameBadge>
              </div>
              <p className="mt-2 font-display text-sm font-bold text-white">
                {item.title}
              </p>
              <p className={`mt-1 flex-1 ${TYPO.bodySm}`}>{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </GamePanel>
  );
}
