import type { ReactNode } from "react";
type AwardVariant = "positive" | "negative" | "neutral";

/** Floodlights tile: raised group, no border; colour lives in the title only. */
const VARIANT_STYLES: Record<
  AwardVariant,
  { bg: string; title: string; rating: string }
> = {
  positive: {
    bg: "bg-pitch-800",
    title: "text-theme-primary",
    rating: "text-theme-primary",
  },
  negative: {
    bg: "bg-pitch-800",
    title: "text-red-400",
    rating: "text-red-400",
  },
  neutral: {
    bg: "bg-pitch-800",
    title: "text-accent-gold",
    rating: "text-theme-primary",
  },
};

interface RLAwardCardProps {
  title: string;
  variant?: AwardVariant;
  playerName?: string;
  club?: string;
  detail?: string;
  positionNote?: string;
  ratingNote?: string;
  narrative?: string;
  rankedLines?: string[];
  className?: string;
  children?: ReactNode;
}

export function RLAwardCard({
  title,
  variant = "neutral",
  playerName,
  club,
  detail,
  positionNote,
  ratingNote,
  narrative,
  rankedLines,
  className = "",
  children,
}: RLAwardCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`rounded-[16px] p-3.5 ${styles.bg} ${className}`}
    >
      <p
        className={`text-[13px] font-semibold leading-snug ${styles.title}`}
      >
        {title}
      </p>
      {children}
      {rankedLines ? (
        <ul className="mt-2 space-y-1.5">
          {rankedLines.map((line) => (
            <li
              key={line}
              className="text-[15px] font-bold text-white"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {playerName && (
            <p className="mt-1 text-[15px] font-bold leading-snug text-white">
              {playerName}
            </p>
          )}
          {positionNote && (
            <p className="mt-1 text-xs text-amber-300/90">{positionNote}</p>
          )}
          {ratingNote && (
            <p
              className={`mt-0.5 text-xs font-bold ${styles.rating}`}
            >
              {ratingNote}
            </p>
          )}
          {(club || detail) && (
            <p className="text-xs text-[color:var(--fl-muted)]">
              {[club, detail].filter(Boolean).join(" · ")}
            </p>
          )}
          {narrative && (
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--fl-muted)]">
              {narrative}
            </p>
          )}
        </>
      )}
    </div>
  );
}
