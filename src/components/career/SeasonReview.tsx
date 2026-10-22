"use client";

import { useEffect, useRef } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { DIVISION_LABEL, TROPHY_LABEL, formatMoney, ordinal } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playPerfectSeason, playPromotion, playSeasonComplete, playSeasonReviewMajor, playWarning } from "@/lib/sound";
import { Card, ClubBadge, Eyebrow } from "./bits";

export function SeasonReview() {
  const { state, legacy, recordBreaks, goToOffseason } = useCareer();
  const s = state!;
  const o = s.lastOutcome!;
  const club = s.clubs[s.userClubId]!;
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (o.trophies.includes("perfect-season")) playPerfectSeason();
    else if (o.trophies.includes("grand-final") || o.trophies.includes("challenge-cup")) playSeasonReviewMajor();
    else if (o.promoted) playPromotion();
    else if (o.relegated) playWarning();
    else playSeasonComplete();
  }, [o]);

  const headline = o.trophies.includes("grand-final")
    ? "Super League Champions!"
    : o.trophies.includes("perfect-season")
      ? "The perfect season."
      : o.promoted
        ? "Promoted!"
        : o.relegated
          ? "Relegated."
          : `${ordinal(o.position)} in the ${DIVISION_LABEL[o.division]}`;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-28">
      <header className="flex flex-col items-center text-center">
        <ClubBadge club={club} size="lg" />
        <p className="mt-3 font-display text-[10px] font-bold uppercase tracking-[0.25em] text-theme-primary">{o.year} season review</p>
        <h1 className={`mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl ${o.relegated ? "text-danger" : o.trophies.length ? "text-accent-gold" : "text-white"}`}>
          {headline}
        </h1>
        <p className="mt-1 text-sm text-gray-300">
          {ordinal(o.position)} · {o.won}W {o.drawn}D {o.lost}L
          {o.topTryScorer ? ` · Top try scorer ${o.topTryScorer.name} (${o.topTryScorer.tries})` : ""}
        </p>
      </header>

      {o.trophies.length ? (
        <Card className="border-accent-gold/50">
          <Eyebrow>Honours</Eyebrow>
          <ul className="mt-2 flex flex-wrap gap-2">
            {o.trophies.map((t) => (
              <li key={t} className="rounded-full bg-accent-gold/15 px-3 py-1 text-sm font-semibold text-accent-gold">🏆 {TROPHY_LABEL[t]}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Prize money</dt>
            <dd className="font-display text-xl font-bold text-white">{formatMoney(o.prizeMoney)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Challenges</dt>
            <dd className="font-display text-xl font-bold text-white">{o.challengesDone} / {s.challenges.length}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Legacy earned</dt>
            <dd className="font-display text-xl font-bold text-accent-gold">+{o.legacyEarned}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Legacy to spend</dt>
            <dd className="font-display text-xl font-bold text-accent-gold">{legacy.legacyPoints}</dd>
          </div>
        </dl>
        {o.promoted ? <p className="mt-3 text-sm text-success">Next season: Super League. Promotion bonus included above.</p> : null}
        {o.relegated ? <p className="mt-3 text-sm text-danger">Next season: Championship. Win it to come straight back up.</p> : null}
      </Card>

      {recordBreaks && (recordBreaks.bestSeason || recordBreaks.biggestWin || recordBreaks.fastestGlory || recordBreaks.perfect) ? (
        <Card className="border-theme-primary/50">
          <Eyebrow>New personal records</Eyebrow>
          <ul className="mt-2 space-y-1 text-sm text-white">
            {recordBreaks.fastestGlory ? <li>⚡ Championship to Grand Final in {recordBreaks.fastestGlory} seasons</li> : null}
            {recordBreaks.perfect ? <li>💯 A perfect season</li> : null}
            {recordBreaks.bestSeason ? <li>📈 Best Super League season: {o.won} wins</li> : null}
            {recordBreaks.biggestWin && legacy.biggestWin ? <li>💥 Biggest win: {legacy.biggestWin.score} v {legacy.biggestWin.opponent}</li> : null}
          </ul>
        </Card>
      ) : null}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton size="lg" onClick={goToOffseason}>Go to transfers</GameButton>
        </div>
      </div>
    </div>
  );
}
