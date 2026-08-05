import {
  ERA_RATING_COMPACT_EXPLANATION,
  ERA_RATING_EXPLANATION,
} from "@/lib/players/rating-context";
import { TYPO } from "@/lib/ui/typography";

export function EraRatingExplanation({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`${compact ? TYPO.meta : TYPO.bodySm} text-center text-gray-300 ${className}`.trim()}
      aria-label="How Era Mode player ratings work"
    >
      <span className="font-semibold text-accent-gold" aria-hidden>
        ℹ
      </span>{" "}
      {compact ? ERA_RATING_COMPACT_EXPLANATION : ERA_RATING_EXPLANATION}
    </p>
  );
}
