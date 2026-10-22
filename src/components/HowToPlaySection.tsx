import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    body: "Pick a real Super League or Championship club, play each round in a tap, chase the Grand Final and unlock legends.",
  },
  {
    title: "Classic",
    body: "Spin and sign a 13 from Current or Era squads, chase 27-0, then fight for the play-offs.",
  },
  ...(SHOW_DAILY_CHALLENGE_UI
    ? [
        {
          title: "Daily Challenge",
          body: "Every opponent is the same club. One counted attempt per UK day. Top the table and win the Grand Final to extend your streak.",
        },
      ]
    : []),
  {
    title: "Puzzles",
    body: "Super League Millionaire and Rugby League Wordle. Play daily for Club Funds.",
  },
  {
    title: "Club Funds",
    body: "Earn them from seasons, play-offs, puzzles and achievements. Spend them on themes in the Store.",
  },
];

export function HowToPlaySection() {
  return (
    <section id="how-to-play" className="mx-auto max-w-2xl scroll-mt-16 border-t border-[var(--mobile-divider)] pt-[var(--mobile-section-gap)] text-center">
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
