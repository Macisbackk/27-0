import {
  getCurrentRatingCompactExplanation,
  getCurrentRatingExplanation,
} from "@/lib/players/rating-context";
import { TYPO } from "@/lib/ui/typography";

export function CurrentRatingExplanation({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`${
        compact
          ? `${TYPO.meta} text-center text-pitch-500 leading-snug`
          : `${TYPO.bodySm} text-center text-gray-300`
      } ${className}`.trim()}
      aria-label="How Current Mode player ratings work"
    >
      {compact ? null : (
        <span className="font-semibold text-theme-primary" aria-hidden>
          ℹ{" "}
        </span>
      )}
      {compact
        ? getCurrentRatingCompactExplanation()
        : getCurrentRatingExplanation()}
    </p>
  );
}
