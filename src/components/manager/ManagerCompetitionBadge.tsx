import type { CupRoundKey, ManagerCompetition } from "@/lib/manager/types";
import { CUP_ROUND_LABELS } from "@/lib/manager/types";
import {
  getManagerMatchOccasionPresentation,
  type ManagerMatchOccasionFixture,
} from "@/lib/manager/managerMatchOccasion";
import { managerPillClass } from "@/lib/manager/managerSurfaces";

interface ManagerCompetitionBadgeProps {
  competition: ManagerCompetition;
  cupRound?: CupRoundKey;
  playoffRound?: number;
  isNeutral?: boolean;
  venue?: string;
  className?: string;
  /** When true, show full cup round name for early ties. */
  detailed?: boolean;
}

export function ManagerCompetitionBadge({
  competition,
  cupRound,
  playoffRound,
  isNeutral,
  venue,
  className = "",
  detailed = false,
}: ManagerCompetitionBadgeProps) {
  const fixture: ManagerMatchOccasionFixture = {
    competition,
    cupRound,
    playoffRound,
    isNeutral,
    venue,
    round: 0,
  };
  const presentation = getManagerMatchOccasionPresentation(fixture);

  if (presentation.occasion === "league" && !detailed) {
    return null;
  }

  if (
    presentation.occasion === "challenge_cup" &&
    !detailed &&
    cupRound &&
    cupRound !== "final"
  ) {
    const roundLabel = CUP_ROUND_LABELS[cupRound] ?? "Challenge Cup";
    const short =
      cupRound === "round_one"
        ? "R1"
        : cupRound === "round_two"
          ? "R2"
          : cupRound === "last_sixteen"
            ? "L16"
            : cupRound === "quarter_final"
              ? "QF"
              : cupRound === "semi_final"
                ? "SF"
                : roundLabel;
    return (
      <span
        className={`${managerPillClass("gold")} ${className}`}
        title={roundLabel}
      >
        Challenge Cup
        <span className="ml-1.5 font-semibold normal-case tracking-normal text-accent-gold/90">
          · {short}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`${managerPillClass(presentation.badgeTone)} ${className}`}
      title={presentation.momentLine || undefined}
    >
      {detailed && presentation.occasion === "challenge_cup" && cupRound
        ? CUP_ROUND_LABELS[cupRound]
        : presentation.badgeLabel}
    </span>
  );
}
