import type { ReactNode } from "react";
type AwardVariant = "positive" | "negative" | "neutral";

const VARIANT_STYLES: Record<
  AwardVariant,
  { border: string; bg: string; title: string }
> = {
  positive: {
    border: "border-accent-green/30",
    bg: "bg-accent-green/5",
    title: "text-accent-green",
  },
  negative: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    title: "text-red-400",
  },
  neutral: {
    border: "border-pitch-600/40",
    bg: "bg-pitch-900/50",
    title: "text-accent-gold",
  },
};

interface RLAwardCardProps {
  title: string;
  variant?: AwardVariant;
  playerName?: string;
  club?: string;
  detail?: string;
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
  narrative,
  rankedLines,
  className = "",
  children,
}: RLAwardCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`rounded-lg border p-3 ${styles.border} ${styles.bg} ${className}`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${styles.title}`}
      >
        {title}
      </p>
      {children}
      {rankedLines ? (
        <ul className="mt-2 space-y-1.5">
          {rankedLines.map((line) => (
            <li
              key={line}
              className="font-display text-sm font-bold text-white"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {playerName && (
            <p className="mt-1 font-display text-sm font-bold text-white">
              {playerName}
            </p>
          )}
          {(club || detail) && (
            <p className="text-xs text-gray-500">
              {[club, detail].filter(Boolean).join(" · ")}
            </p>
          )}
          {narrative && (
            <p className="mt-2 text-xs italic text-gray-400">{narrative}</p>
          )}
        </>
      )}
    </div>
  );
}
