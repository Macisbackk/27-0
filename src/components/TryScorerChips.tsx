"use client";

import { TYPO } from "@/lib/ui/typography";
import { groupTryScorersForDisplay } from "@/lib/game/try-scorer-display";

export interface TryScorerChipEntry {
  playerId: string;
  name: string;
  tries: number;
  positionNote?: string | null;
}

interface TryScorerChipsProps {
  scorers: TryScorerChipEntry[];
  /** @deprecated Kept for call-site compatibility — styling is unified. */
  variant?: "user" | "opponent";
  compact?: boolean;
}

/** Try scorers as compact chips (expand) or denser text lines. */
export function TryScorerChips({ scorers, compact = false }: TryScorerChipsProps) {
  const grouped = groupTryScorersForDisplay(scorers);
  if (grouped.length === 0) return null;

  if (compact) {
    return (
      <ul className="flex flex-nowrap justify-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {grouped.map((scorer) => {
          const label =
            scorer.tries > 1
              ? `${scorer.name} ×${scorer.tries}`
              : scorer.name;

          return (
            <li
              key={scorer.playerId}
              className="match-score-chip shrink-0"
              title={scorer.positionNote ?? undefined}
            >
              {label}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={`space-y-1 ${TYPO.statValue}`}>
      {grouped.map((scorer) => {
        const label =
          scorer.tries > 1 ? `${scorer.name} ×${scorer.tries}` : scorer.name;

        return (
          <li
            key={scorer.playerId}
            className="break-words text-gray-200"
            title={scorer.positionNote ?? undefined}
          >
            {label}
          </li>
        );
      })}
    </ul>
  );
}

export function TryScorersEmptyNote() {
  return <p className={TYPO.bodySm}>No scoring breakdown recorded.</p>;
}
