import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const GUIDE_ITEMS = [
  {
    title: "Classic",
    body: "Build a 17 from Current or Era squads, chase 27-0, then fight for the playoffs.",
  },
  ...(SHOW_DAILY_CHALLENGE_UI
    ? [
        {
          title: "Daily Challenge",
          body: "One forced opponent club each UK day — keep your streak alive.",
        },
      ]
    : []),
  {
    title: "Mini Games",
    body: "Quiz, Wordle, Hangman, and Higher or Lower for Club Funds.",
  },
  {
    title: "Club Funds",
    body: "Earn from seasons, playoffs, mini-games, and achievements — spend in the Store.",
  },
  {
    title: "Coach Profile",
    body: "Records, achievements, and long-term progress.",
  },
  {
    title: "Store",
    body: "Unlock UI themes and Classic boosts with Club Funds.",
  },
];

export function HowToPlaySection() {
  return (
    <section className="mx-auto max-w-2xl border-t border-[var(--mobile-divider)] pt-[var(--mobile-section-gap)] text-center">
      <div className="flex flex-col items-center text-center">
        <GameSectionTitle
          label="Guide"
          heading="How to play"
          className="items-center text-center"
        />
      </div>

      <ul className={`mt-3 ${SPACING.stackSm}`}>
        {GUIDE_ITEMS.map((item) => (
          <li
            key={item.title}
            className="min-w-0 border-b border-[var(--mobile-divider)] py-2.5 text-center last:border-b-0"
          >
            <p className={`text-center ${TYPO.cardTitle}`}>{item.title}</p>
            <p className={`mx-auto mt-1 max-w-md text-center ${TYPO.bodySm}`}>
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
