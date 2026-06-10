import { formatValue } from "@/lib/players";
import { ClubNameLabel } from "@/components/ClubNameLabel";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { RL_INFO_BOX_CLASS } from "./rl-card";

interface RLClubRowProps {
  club: string;
  count: number;
  totalValue: number;
  expanded?: boolean;
  onClick?: () => void;
}

export function RLClubRow({
  club,
  count,
  totalValue,
  expanded,
  onClick,
}: RLClubRowProps) {
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`flex w-full min-h-[44px] items-center justify-between gap-3 px-3 py-2.5 text-left ${TYPO.body} ${RL_INFO_BOX_CLASS} ${
        interactive ? CARD.interactive : ""
      } ${expanded ? CARD.selected : ""}`}
    >
      <div className={`flex min-w-0 flex-1 items-center ${SPACING.buttonGap}`}>
        <ClubNameLabel
          club={club}
          variant="row"
          compact
          showAccent={false}
          surface="matchDetails"
          className="min-w-0 flex-1"
        />
        <span className={`shrink-0 ${TYPO.bodySm}`}>({count})</span>
        {interactive && (
          <span
            className={`shrink-0 ${TYPO.statLabel} transition ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▼
          </span>
        )}
      </div>
      <span className={`shrink-0 ${TYPO.statValue} font-display text-accent-gold`}>
        {formatValue(totalValue)}
      </span>
    </button>
  );
}
