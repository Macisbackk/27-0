"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Confetti } from "@/components/Confetti";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { ShareSeasonButton } from "@/components/ShareSeasonButton";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import { isLoggedIn } from "@/lib/auth-session";
import { DIVISION_LABEL, TROPHY_LABEL, boardTargetLabel, formatMoney, legendCatalog, ordinal, seasonIncome, squadOf, wageBill } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playPerfectSeason, playPromotion, playSeasonComplete, playSeasonReviewMajor, playWarning } from "@/lib/sound";
import { Card, ClubBadge, Eyebrow, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";
import { CupGlyph } from "@/components/icons/rugby-icons";
import { PitchHero } from "@/components/ui/PitchHero";

export function SeasonReview() {
  const { state, legacy, recordBreaks, goToOffseason } = useCareer();
  const armed = useArmed();
  const s = state!;
  const o = s.lastOutcome!;
  const club = s.clubs[s.userClubId]!;
  const played = useRef(false);
  // Read the auth cache after mount so server and client markup match.
  const [loggedIn, setLoggedIn] = useState(true);
  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  const celebrate = o.trophies.length > 0 || o.promoted;

  const shareCardData = useMemo(
    () => ({
      title: `${club.name} ${o.year}`,
      subtitle: "Manager Mode",
      recordLine: `${o.won}–${o.lost}`,
      detailLines: [
        `${DIVISION_LABEL[o.division]} · ${ordinal(o.position)}`,
        o.trophies.length ? o.trophies.map((t) => TROPHY_LABEL[t]).join(" · ") : undefined,
        o.promoted ? "Promoted" : o.relegated ? "Relegated" : undefined,
      ].filter((line): line is string => Boolean(line)),
    }),
    [club.name, o]
  );

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (o.trophies.includes("perfect-season")) playPerfectSeason();
    else if (o.trophies.includes("grand-final") || o.trophies.includes("challenge-cup")) playSeasonReviewMajor();
    else if (o.promoted) playPromotion();
    else if (o.relegated) playWarning();
    else playSeasonComplete();
  }, [o]);

  // The board's verdict and a reason to play next season.
  const boardMet = o.boardTarget ? o.position <= o.boardTarget : false;
  const boardSize = s.tables[o.division]?.length || 12;
  const nextBudget = s.budget + seasonIncome(s) - wageBill(squadOf(s, s.userClubId));
  const hook = o.trophies.includes("grand-final")
    ? "Champions. Can you defend the title?"
    : o.promoted
      ? "Super League awaits. Can you stay up?"
      : o.relegated
        ? "Bounce straight back: win the Championship."
        : club.division === "super-league"
          ? o.position <= 4
            ? "So close. Can you win the Grand Final?"
            : "Next: crack the top 4 and reach Old Trafford."
          : o.position <= 2
            ? "One step away. Go up next year."
            : "Next: push for promotion.";
  const affordableLegend = legendCatalog()
    .filter((l) => !legacy.unlockedLegends.includes(l.id) && l.unlockCost <= legacy.legacyPoints)
    .sort((a, b) => b.peak - a.peak)[0]?.name;

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
    <div className={CAREER_PAGE_CLASS}>
      <CareerBackLink label="Home (progress saved)" />
      {celebrate ? <Confetti /> : null}
      <PitchHero
        size="feature"
        icon={<CupGlyph />}
        eyebrow={<>{o.year} season review</>}
        badge={o.relegated ? "Relegated" : o.trophies.length ? `${o.trophies.length} ${o.trophies.length === 1 ? "trophy" : "trophies"}` : undefined}
        title={headline}
        description={
          <>
            {ordinal(o.position)} · {o.won}W {o.drawn}D {o.lost}L
            {o.topTryScorer ? ` · Top try scorer ${o.topTryScorer.name} (${o.topTryScorer.tries})` : ""}
          </>
        }
        aside={<ClubBadge club={club} size="lg" />}
      />

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
        {o.promoted ? <p className="mt-3 text-sm text-success">Up to Super League. Promotion bonus included.</p> : null}
        {o.relegated ? <p className="mt-3 text-sm text-danger">Down to the Championship. Win it to bounce back.</p> : null}
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

      <Card className="border-theme-primary/40">
        <Eyebrow>Next season · {o.year + 1}</Eyebrow>
        {o.boardTarget ? (
          <p className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 text-gray-300">
              <span className="font-semibold text-white">Board:</span> {boardTargetLabel(o.division, o.boardTarget, boardSize)}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${boardMet ? "bg-success/15 text-success" : "bg-amber-300/15 text-amber-200"}`}>
              {boardMet ? "Target met" : "Missed"}
            </span>
          </p>
        ) : null}
        <p className="mt-2 font-display text-xl font-bold leading-tight text-white">{hook}</p>
        <p className="mt-1 text-sm text-gray-300">
          {DIVISION_LABEL[club.division]} · budget about {formatMoney(Math.max(0, nextBudget))}
        </p>
        {affordableLegend ? (
          <p className="mt-2 text-sm text-accent-gold">You have the Legacy points to unlock {affordableLegend} in the Legend Vault.</p>
        ) : null}
      </Card>

      <ShareSeasonButton data={shareCardData} filename="27-0-manager-season.png" />

      {!loggedIn ? <GuestSaveNudge context="manager-season" /> : null}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton size="lg" disabled={!armed} onClick={goToOffseason}>Next: retirements and contracts</GameButton>
        </div>
      </div>
    </div>
  );
}
