"use client";

import { TYPO } from "@/lib/ui/typography";

export interface TryScorerChipEntry {
  playerId: string;
  name: string;
  tries: number;
  positionNote?: string | null;
}

interface TryScorerChipsProps {
  scorers: TryScorerChipEntry[];
  variant: "user" | "opponent";
}

const VARIANT_STYLES = {
  user: "border-accent-green/35 bg-accent-green/10 text-accent-green",
  opponent: "border-accent-red/30 bg-accent-red/10 text-red-300",
} as const;

export function TryScorerChips({ scorers, variant }: TryScorerChipsProps) {
  if (scorers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {scorers.map((scorer) => {
        const label =
          scorer.tries > 1 ? `${scorer.name} x${scorer.tries}` : scorer.name;

        return (
          <span
            key={scorer.playerId}
            title={scorer.positionNote ?? undefined}
            className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 font-display text-xs font-bold ${VARIANT_STYLES[variant]}`}
          >
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

export function TryScorersEmptyNote() {
  return <p className={TYPO.bodySm}>No scoring breakdown recorded.</p>;
}
