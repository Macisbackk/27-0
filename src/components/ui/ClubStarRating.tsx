"use client";

import type { ClubReputationLeague } from "../../../data/club-reputation";
import { getMaxStarsForLeague } from "../../../data/club-reputation";

interface ClubStarRatingProps {
  stars: number;
  /** Accessible name, e.g. "Club rating: 3 out of 5 stars" */
  label?: string;
  className?: string;
  size?: "sm" | "md";
  /**
   * Super League = gold 5★ ladder.
   * Championship = sky 3★ ladder (visually distinct, lower absolute prestige).
   */
  league?: ClubReputationLeague;
}

function StarIcon({
  filled,
  size,
  league,
}: {
  filled: boolean;
  size: "sm" | "md";
  league: ClubReputationLeague;
}) {
  const px = size === "sm" ? 12 : 14;
  const filledClass =
    league === "championship" ? "text-sky-300" : "text-accent-gold";
  const emptyClass =
    league === "championship" ? "text-sky-900" : "text-pitch-600";
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      aria-hidden
      className={filled ? filledClass : emptyClass}
    >
      <path
        fill="currentColor"
        d={
          filled
            ? "M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.77l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.5z"
            : "M12 4.2l2.05 4.16.3.6.67.1 4.58.67-3.31 3.23-.48.47.11.66.78 4.56-4.09-2.15-.59-.31-.59.31-4.09 2.15.78-4.56.11-.66-.48-.47-3.31-3.23 4.58-.67.67-.1.3-.6L12 4.2m0-1.7L9.1 8.38 2.61 9.32l4.7 4.58-1.11 6.47L12 17.77l5.8 3.05-1.11-6.47 4.7-4.58-6.49-.94L12 2.5z"
        }
      />
    </svg>
  );
}

/** Filled / unfilled star row for Manager club selection and club info. */
export function ClubStarRatingDisplay({
  stars,
  label,
  className = "",
  size = "sm",
  league = "super-league",
}: ClubStarRatingProps) {
  const maxStars = getMaxStarsForLeague(league);
  const clamped = Math.max(0, Math.min(maxStars, Math.round(stars)));
  const leagueLabel =
    league === "championship" ? "Championship" : "Super League";
  const aria =
    label ??
    `${leagueLabel} club rating: ${clamped} out of ${maxStars} stars`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={aria}
      title={aria}
    >
      {Array.from({ length: maxStars }, (_, i) => (
        <StarIcon
          key={i}
          filled={i < clamped}
          size={size}
          league={league}
        />
      ))}
    </span>
  );
}
