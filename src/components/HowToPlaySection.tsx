import { GameBadge } from "@/components/ui/GameBadge";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    tag: "Career",
    tone: "theme" as const,
    body: "Take charge of a Super League club. Build your squad, handle contracts, develop reserves, manage transfers and chase trophies across multiple seasons.",
  },
  {
    title: "Normal Mode",
    tag: "Draft",
    tone: "win" as const,
    body: "Draft a 17 from Current or Era pools and try to build a side good enough to go 27-0.",
  },
  {
    title: "Club Funds",
    tag: "Earn",
    tone: "gold" as const,
    body: "Earn rewards through seasons, achievements and trophies, then unlock team UI themes in the Store.",
  },
  {
    title: "Coach Profile",
    tag: "Progress",
    tone: "muted" as const,
    body: "Track your records, achievements, trophies, stats and long-term progress.",
  },
  {
    title: "Store",
    tag: "Themes",
    tone: "theme" as const,
    body: "Unlock team UI themes without changing club or player colours.",
  },
] as const;

export function HowToPlaySection() {
  return (
    <GamePanel as="section" variant="elevated" className="overflow-hidden">
      <div
        className={`border-b border-white/5 text-center ${SPACING.cardPadding} sm:px-6`}
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <GameSectionTitle label="Guide" heading="How to play" />
          <p id="how-to-play-heading" className="sr-only">
            How to play
          </p>
          <p className="mt-2 text-base leading-relaxed text-gray-300">
            Manager Mode is the main career. Normal Mode is the quick draft —
            here&apos;s what each area does.
          </p>
        </div>
      </div>

      <div className={`${SPACING.cardPadding} sm:px-6`}>
        <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_ITEMS.map((item) => (
            <li
              key={item.title}
              className="flex flex-col rounded-xl border border-white/5 bg-black/20 px-4 py-3.5 text-left"
            >
              <div className="flex">
                <GameBadge tone={item.tone}>{item.tag}</GameBadge>
              </div>
              <p className="mt-2 font-display text-[0.98rem] font-bold text-white">
                {item.title}
              </p>
              <p className="mt-1.5 flex-1 text-[0.9rem] leading-relaxed text-gray-300">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </GamePanel>
  );
}
