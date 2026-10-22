import type { DailyChallengeScenario } from "@/lib/daily-challenge";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface DailyRuleBannerProps {
  scenario: Pick<DailyChallengeScenario, "ruleTitle" | "ruleSummary" | "eraMode">;
  className?: string;
}

/** Today's Daily rule — shown above the Daily season and play-off reviews. */
export function DailyRuleBanner({ scenario, className = "" }: DailyRuleBannerProps) {
  return (
    <div
      className={`${CARD.base} border-accent-gold/40 bg-accent-gold/10 px-3 py-2 text-center ${className}`}
      role="note"
    >
      <p className={`${TYPO.eyebrow} text-accent-gold`}>
        Daily rule{scenario.eraMode ? " · Era" : ""} · {scenario.ruleTitle}
      </p>
      <p className={`mt-0.5 ${TYPO.bodySm} text-gray-200`}>{scenario.ruleSummary}</p>
    </div>
  );
}
