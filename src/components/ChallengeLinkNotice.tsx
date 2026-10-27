"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import { TYPO } from "@/lib/ui/typography";
import { challengeBannerText, type ChallengePayload } from "@/lib/challenge-link";
import { getDailyChallengeHref } from "@/lib/daily-challenge";
import { getWeeklyChallengeHref } from "@/lib/weekly-challenge";

/**
 * Shown instead of the board when a challenge link can't be played (yet): broken / edited links,
 * and links to today's Daily or this week's Weekly before the opener has used their own ranked
 * attempt (otherwise the link would be a free preview of the live spins).
 */
export function ChallengeLinkNotice({
  reason,
  challenge = null,
}: {
  reason: "invalid" | "future" | "live-unplayed";
  challenge?: ChallengePayload | null;
}) {
  const live = reason === "live-unplayed" && challenge;
  const weekly = challenge?.kind === "weekly";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-10 text-center">
      <p className={`${TYPO.eyebrow} text-accent-gold`}>Challenge</p>
      {live ? (
        <>
          <h1 className={TYPO.pageTitle}>{challengeBannerText(challenge)}</h1>
          <p className={TYPO.muted}>
            {challenge.name} played {weekly ? "this week's Weekly" : "today's Daily"}.
            <br />
            Play yours first, then open this link again.
          </p>
          <ActionButton variant="theme" href={weekly ? getWeeklyChallengeHref() : getDailyChallengeHref()}>
            Play {weekly ? "this week's Weekly" : "today's Daily"}
          </ActionButton>
        </>
      ) : (
        <>
          <h1 className={TYPO.pageTitle}>This challenge link doesn&apos;t work</h1>
          <p className={TYPO.muted}>It may be cut short. Ask your mate to resend it.</p>
          <ActionButton variant="theme" href="/play">
            Play Classic
          </ActionButton>
        </>
      )}
      <ActionButton variant="secondary" href="/">
        Home
      </ActionButton>
    </div>
  );
}
