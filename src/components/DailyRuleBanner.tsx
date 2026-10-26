import type { DailyChallengeScenario } from "@/lib/daily-challenge";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { DailyStreakStrip } from "./DailyStreakStrip";

interface DailyRuleBannerProps {
  scenario: Pick<DailyChallengeScenario, "ruleTitle" | "ruleSummary" | "eraMode">;
  /** "Daily rule" (default) or "Weekly rule" — the Weekly Challenge shares this banner. */
  label?: string;
  className?: string;
}

/** Today's Daily (or this week's Weekly) rule — shown above the season and play-off reviews. */
export function DailyRuleBanner({ scenario, label = "Daily rule", className = "" }: DailyRuleBannerProps) {
  return (
    <div
      className={`${CARD.base} border-accent-gold/40 bg-accent-gold/10 px-3 py-2 text-center ${className}`}
      role="note"
    >
      <p className={`${TYPO.eyebrow} text-accent-gold`}>
        {label}{scenario.eraMode ? " · Era" : ""} · {scenario.ruleTitle}
      </p>
      <p className={`mt-0.5 ${TYPO.bodySm} text-gray-200`}>{scenario.ruleSummary}</p>
      {label === "Daily rule" ? <DailyStreakStrip compact className="mt-2 text-left" /> : null}
    </div>
  );
}
