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

/** Try scorers rendered like conversions/penalties — stacked stat lines in a scoring section. */
export function TryScorerChips({ scorers, compact = false }: TryScorerChipsProps) {
  const grouped = groupTryScorersForDisplay(scorers);
  if (grouped.length === 0) return null;

  const textClass = compact ? TYPO.bodySm : TYPO.statValue;

  return (
    <p className={`${textClass} flex flex-wrap gap-x-1 gap-y-0.5 text-gray-300`}>
      {grouped.map((scorer, index) => {
        const label =
          scorer.tries > 1 ? `${scorer.name} x${scorer.tries}` : scorer.name;

        return (
          <span
            key={scorer.playerId}
            className="inline-flex max-w-full items-center"
            title={scorer.positionNote ?? undefined}
          >
            {index > 0 && (
              <span className="mr-1 text-gray-600" aria-hidden>
                ·
              </span>
            )}
            <span className="break-words text-gray-200">{label}</span>
          </span>
        );
      })}
    </p>
  );
}

export function TryScorersEmptyNote() {
  return <p className={TYPO.bodySm}>No scoring breakdown recorded.</p>;
}
