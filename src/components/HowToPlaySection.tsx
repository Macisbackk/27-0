import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    body: "Take charge of a Super League or Championship club. Build your squad, handle contracts and loans, develop reserves, manage the transfer market, and chase trophies across seasons.",
  },
  {
    title: "Quick Mode",
    body: "Draft a 17 from Current or Era player pools and try to build a side good enough to go 27-0 through the league and playoffs.",
  },
  {
    title: "Club Funds",
    body: "Earn rewards through seasons, achievements and trophies, then spend them in the Store on team UI themes.",
  },
  {
    title: "Coach Profile",
    body: "Track your records, achievements, trophies, stats and long-term progress across both modes.",
  },
  {
    title: "Store",
    body: "Unlock team UI themes with Club Funds. Themes change the interface look — not club or player colours.",
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
        <p
          id="how-to-play-heading"
          className={`mx-auto mt-2 max-w-md text-center ${TYPO.bodySm} text-pitch-400`}
        >
          Manager Mode is the main career. Quick Mode is the draft challenge —
          here&apos;s what each area does.
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
