import type { CupRoundKey, ManagerCompetition } from "@/lib/manager/types";
import {
  getManagerCompetitionLabel,
  isChallengeCupFixture,
} from "@/lib/manager/managerFixtureDisplay";

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
      <span
        className={`inline-flex items-center rounded-full border border-theme-primary/40 bg-theme-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-theme-primary ${className}`}
      >
        Play-Offs
      </span>
    );
  }

  if (!isChallengeCupFixture(competition)) return null;

  const label = detailed
    ? getManagerCompetitionLabel(competition, cupRound)
    : "Challenge Cup";

  return (
    <span
      className={`inline-flex items-center rounded-full border border-accent-gold/50 bg-accent-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-gold ${className}`}
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
