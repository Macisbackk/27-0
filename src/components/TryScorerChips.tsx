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
}

/** Try scorers rendered like conversions/penalties — stacked stat lines in a scoring section. */
export function TryScorerChips({ scorers }: TryScorerChipsProps) {
  const grouped = groupTryScorersForDisplay(scorers);
  if (grouped.length === 0) return null;

  return (
    <div className="space-y-1">
      {grouped.map((scorer) => {
        const label =
          scorer.tries > 1 ? `${scorer.name} x${scorer.tries}` : scorer.name;

        return (
          <p
            key={scorer.playerId}
            className={TYPO.statValue}
            title={scorer.positionNote ?? undefined}
          >
            {label}
          </p>
        );
      })}
    </div>
  );
}

export function TryScorersEmptyNote() {
  return <p className={TYPO.bodySm}>No scoring breakdown recorded.</p>;
}
