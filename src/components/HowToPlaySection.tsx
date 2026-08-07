import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    body: "Run a Super League club across seasons — squad, contracts, transfers and trophies.",
  },
  {
    title: "Quick Mode",
    body: "Draft a 17 from Current or Era pools and chase a 27-0 season.",
  },
  {
    title: "Store & Profile",
    body: "Unlock themes with Club Funds. Track records on your Coach Profile.",
  },
] as const;

export function HowToPlaySection() {
  return (
    <section className="mx-auto max-w-2xl border-t border-[var(--mobile-divider)] pt-[var(--mobile-section-gap)]">
      <div className="text-left sm:text-center">
        <GameSectionTitle
          label="Guide"
          heading="How to play"
          className="sm:items-center sm:text-center"
        />
        <p id="how-to-play-heading" className="sr-only">
          How to play
        </p>
      </div>

      <ul className={`mt-3 ${SPACING.stackSm}`}>
        {GUIDE_ITEMS.map((item) => (
          <li
            key={item.title}
            className="min-w-0 border-b border-[var(--mobile-divider)] py-2.5 text-left last:border-b-0 sm:text-center"
          >
            <p className={TYPO.cardTitle}>{item.title}</p>
            <p className={`mt-1 ${TYPO.bodySm} sm:mx-auto sm:max-w-md`}>
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
