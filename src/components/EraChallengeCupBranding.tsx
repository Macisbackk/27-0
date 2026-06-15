"use client";

import { ClubHeaderBar } from "./ClubBadge";
import { getClubColors } from "@/lib/clubs";
import { TYPO } from "@/lib/ui/typography";

interface EraChallengeCupBrandingProps {
  /** Era team display name, e.g. Bradford Bulls '03 */
  teamDisplayName?: string;
  /** Base club for colours */
  clubName?: string;
  year?: string | number;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

export function EraChallengeCupBranding({
  teamDisplayName,
  clubName,
  year,
  subtitle,
  compact = false,
  className = "",
}: EraChallengeCupBrandingProps) {
  const colors = clubName ? getClubColors(clubName) : null;

  return (
    <div
      className={`rounded-xl border border-accent-gold/40 bg-gradient-to-b from-accent-gold/12 via-pitch-950/60 to-pitch-950/90 px-3 py-3 text-center shadow-[0_0_24px_rgba(251,191,36,0.08)] sm:px-5 sm:py-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border-2 border-accent-gold/70 bg-accent-gold px-2.5 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.18em] text-pitch-950 sm:text-[10px]">
          Era Mode
        </span>
        {year !== undefined && year !== "" && (
          <span className="rounded-full border border-accent-gold/45 bg-accent-gold/15 px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-accent-gold sm:text-[10px]">
            {year}
          </span>
        )}
      </div>

      <h1
        className={`mt-2 font-display font-black uppercase tracking-tight text-accent-gold ${
          compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
        }`}
      >
        Era Challenge Cup
      </h1>

      {subtitle && (
        <p className={`mt-1 ${compact ? TYPO.bodySm : TYPO.body} text-gray-400`}>
          {subtitle}
        </p>
      )}

      {teamDisplayName && (
        <p
          className={`mt-2 font-display font-bold text-white ${
            compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"
          }`}
        >
          {teamDisplayName}
        </p>
      )}

      {clubName && colors && (
        <div className="mx-auto mt-3 max-w-xs">
          <ClubHeaderBar club={clubName} size="sm" thick />
        </div>
      )}
    </div>
  );
}
