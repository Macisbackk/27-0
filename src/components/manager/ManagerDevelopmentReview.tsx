"use client";

import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  impactLabel,
  impactTone,
  IMPACT_TONE_CLASS,
} from "@/lib/manager/managerPlayerImpact";
import { playUiClick } from "@/lib/sound";
import {
  ManagerDeltaBadge,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";

interface ManagerDevelopmentReviewProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerDevelopmentReview({
  career,
  onContinue,
}: ManagerDevelopmentReviewProps) {
  const changes = career.lastSeasonDevelopmentReview ?? [];
  const improved = changes.filter((c) => c.delta > 0);
  const declined = changes.filter((c) => c.delta < 0);
  const steady = changes.filter((c) => c.delta === 0);

  function impactBadge(c: (typeof changes)[number]) {
    if (c.seasonImpact == null) return null;
    const tone = impactTone(c.seasonImpact);
    return (
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${IMPACT_TONE_CLASS[tone]}`}
      >
        Impact {c.seasonImpact} · {impactLabel(c.seasonImpact)}
      </span>
    );
  }

  function changeLabel(
    c: (typeof changes)[number],
    tone: "improved" | "declined" | "steady" = "steady"
  ) {
    const afterClass =
      tone === "improved"
        ? "text-theme-primary font-semibold"
        : tone === "declined"
          ? "text-red-300 font-semibold"
          : "font-semibold text-white";

    if (c.promotedFromReserve) {
      return (
        <span className="text-pitch-500">
          Season start {c.before} →{" "}
          <span className={afterClass}>{c.after}</span>
          <span className="text-pitch-400"> · from reserves</span>
        </span>
      );
    }
    return (
      <span className="text-pitch-500">
        {c.before} → <span className={afterClass}>{c.after}</span>
      </span>
    );
  }

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <ManagerSectionCard variant="featured">
        <p className={`${TYPO.sectionLabel} text-center`}>Potential Review</p>
        <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>
          {career.club} · {career.seasonYear}
        </h1>
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
          How your squad developed over the season.
        </p>
      </ManagerSectionCard>

      {changes.length === 0 ? (
        <ManagerSectionCard>
          <p className={TYPO.bodySm}>
            No major rating changes this season — most players held steady.
          </p>
        </ManagerSectionCard>
      ) : (
        <>
          {improved.length > 0 && (
            <ManagerSectionCard title="Improved" accent="primary">
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {improved.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm} flex flex-wrap items-center gap-2`}>
                    <span className="font-semibold text-white">{c.playerName}</span>
                    {changeLabel(c, "improved")}
                    <ManagerDeltaBadge delta={c.delta} />
                    {impactBadge(c)}
                    <span className="text-pitch-500">· POT {c.potential}</span>
                  </li>
                ))}
              </ul>
            </ManagerSectionCard>
          )}
          {declined.length > 0 && (
            <ManagerSectionCard title="Declined" accent="red">
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {declined.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm} flex flex-wrap items-center gap-2`}>
                    <span className="font-semibold text-white">{c.playerName}</span>
                    {changeLabel(c, "declined")}
                    <ManagerDeltaBadge delta={c.delta} />
                    {impactBadge(c)}
                    <span className="text-pitch-500">· POT {c.potential}</span>
                  </li>
                ))}
              </ul>
            </ManagerSectionCard>
          )}
          {steady.length > 0 && (
            <ManagerSectionCard title="Unchanged">
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {steady.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm} flex flex-wrap items-center gap-2`}>
                    <span className="font-semibold text-white">{c.playerName}</span>
                    {changeLabel(c, "steady")}
                    {impactBadge(c)}
                    <span className="text-pitch-500">· POT {c.potential}</span>
                  </li>
                ))}
              </ul>
            </ManagerSectionCard>
          )}
        </>
      )}

      <GameButton
        variant="theme"
        onClick={() => {
          playUiClick();
          onContinue();
        }}
      >
        Continue to Rewards
      </GameButton>
    </div>
  );
}
