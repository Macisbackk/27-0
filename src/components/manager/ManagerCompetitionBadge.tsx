import type { CupRoundKey, ManagerCompetition } from "@/lib/manager/types";
import {
  getManagerCompetitionLabel,
  isChallengeCupFixture,
} from "@/lib/manager/managerFixtureDisplay";
import { managerPillClass } from "@/lib/manager/managerSurfaces";

interface ManagerCompetitionBadgeProps {
  competition: ManagerCompetition;
  cupRound?: CupRoundKey;
  className?: string;
  /** When true, show full round name (e.g. Challenge Cup Semi-Final). */
  detailed?: boolean;
}

export function ManagerCompetitionBadge({
  competition,
  cupRound,
  className = "",
  detailed = false,
}: ManagerCompetitionBadgeProps) {
  if (competition === "playoffs") {
    return (
      <span className={`${managerPillClass("primary")} ${className}`}>
        Play-Offs
      </span>
    );
  }

  if (competition === "friendly") {
    return (
      <span className={`${managerPillClass("sky")} ${className}`}>
        Friendly
      </span>
    );
  }

  if (!isChallengeCupFixture(competition)) return null;

  const label = detailed
    ? getManagerCompetitionLabel(competition, cupRound)
    : "Challenge Cup";

  return (
    <span
      className={`${managerPillClass("gold")} ${className}`}
      title={detailed ? undefined : getManagerCompetitionLabel(competition, cupRound)}
    >
      {label}
      {!detailed && cupRound ? (
        <span className="ml-1.5 font-semibold normal-case tracking-normal text-accent-gold/90">
          · {getManagerCompetitionLabel(competition, cupRound).replace(/^Challenge Cup /, "")}
        </span>
      ) : null}
    </span>
  );
}
