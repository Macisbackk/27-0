import type { FixtureKicking } from "@/lib/game/season-simulation";
import { buildKickingSummaryLines } from "@/lib/game/kicking-summary";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface KickingSummarySectionProps {
  kicking: FixtureKicking | null | undefined;
}

export function KickingSummarySection({ kicking }: KickingSummarySectionProps) {
  const lines = buildKickingSummaryLines(kicking);
  if (lines.length === 0) return null;

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
      <p className={TYPO.sectionTitle}>Kicking Summary</p>
      <ul className={`mt-2 space-y-1.5 ${TYPO.bodySm}`}>
        {lines.map((line, i) => (
          <li key={`${line.name}-${line.label}-${i}`} className="break-words text-gray-300">
            <span className="font-semibold text-white">{line.name}</span>
            <span className="text-gray-500"> — </span>
            {line.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
