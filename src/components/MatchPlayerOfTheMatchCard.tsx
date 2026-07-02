"use client";

import type { ManOfTheMatch } from "@/lib/game/fantasy-match-summary";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubTeamLabel } from "./ClubTeamLabel";

interface MatchPlayerOfTheMatchCardProps {
  motm: ManOfTheMatch;
  userClub?: string;
  className?: string;
}

/** Featured player-of-the-match card for match review panels. */
export function MatchPlayerOfTheMatchCard({
  motm,
  userClub,
  className = "",
}: MatchPlayerOfTheMatchCardProps) {
  const isUserClub = !!userClub && motm.teamName === userClub;
  const tries = motm.tries ?? 0;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border-2 bg-gradient-to-br from-pitch-900/95 via-pitch-950/98 to-pitch-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
        isUserClub
          ? "border-accent-gold/55"
          : "border-pitch-600/55"
      } ${className}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          isUserClub ? "bg-accent-gold" : "bg-pitch-500"
        }`}
        aria-hidden
      />
      <div
        className={`flex items-stretch gap-3 pl-4 sm:gap-4 sm:pl-5 ${SPACING.cardPadding}`}
      >
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 sm:h-16 sm:w-16 ${
            isUserClub
              ? "border-accent-gold/50 bg-accent-gold/15 text-accent-gold shadow-[0_0_24px_rgba(251,191,36,0.15)]"
              : "border-pitch-600/60 bg-pitch-800/80 text-pitch-300"
          }`}
          aria-hidden
        >
          <span className="font-display text-lg leading-none sm:text-xl">★</span>
          {tries > 0 && (
            <span className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-wide">
              {tries}T
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <p
            className={`${TYPO.sectionLabel} ${
              isUserClub ? "text-accent-gold" : "text-pitch-400"
            }`}
          >
            Player of the Match
          </p>
          <h3 className="mt-1 font-display text-xl font-bold leading-tight text-white sm:text-2xl">
            {motm.playerName}
          </h3>
          <div className="mt-2">
            <ClubTeamLabel club={motm.teamName} compact />
          </div>
          {motm.performanceSummary && (
            <p
              className={`mt-2.5 inline-flex max-w-full rounded-lg border px-2.5 py-1 ${TYPO.bodySm} ${
                isUserClub
                  ? "border-accent-gold/35 bg-accent-gold/10 text-accent-gold"
                  : "border-pitch-600/50 bg-pitch-800/60 text-pitch-200"
              }`}
            >
              {motm.performanceSummary}
            </p>
          )}
        </div>

        {tries > 0 && (
          <div className="hidden shrink-0 flex-col items-end justify-center pr-1 text-right sm:flex">
            <span
              className={`font-display text-4xl font-black leading-none ${
                isUserClub ? "text-accent-gold" : "text-pitch-200"
              }`}
            >
              {tries}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-pitch-500">
              {tries === 1 ? "Try" : "Tries"}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
