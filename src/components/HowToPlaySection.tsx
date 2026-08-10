import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    body: "Run a club. Win trophies.",
  },
  {
    title: "Quick Mode",
    body: "Draft 17. Chase 27-0.",
  },
  {
    title: "Store & Profile",
    body: "Themes, boosts, records.",
  },
] as const;

export function HowToPlaySection() {
  return (
    <section className="mx-auto max-w-2xl border-t border-[var(--mobile-divider)] pt-[var(--mobile-section-gap)] text-center">
      <div className="flex flex-col items-center text-center">
        <GameSectionTitle
          label="Guide"
          heading="How to play"
          className="items-center text-center"
        />
        <p id="how-to-play-heading" className="sr-only">
          How to play
        </p>
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
