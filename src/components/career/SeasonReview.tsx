"use client";

import { SHOW_SHARE_RESULT_UI } from "@/lib/feature-flags";

import { useEffect, useMemo, useRef, useState } from "react";
import { Confetti } from "@/components/Confetti";
import { GuestSaveNudge } from "@/components/EconomyExplainer";
import { ShareSeasonButton } from "@/components/ShareSeasonButton";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import { isLoggedIn } from "@/lib/auth-session";
import {
  DIVISION_LABEL,
  TROPHY_LABEL,
  boardTargetLabel,
  formatMoney,
  legendCatalog,
  miniWinner,
  ordinal,
  seasonIncome,
  seasonReviewData,
  squadOf,
  userFixture,
  wageBill,
  type CareerState,
  type Fixture,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playPerfectSeason, playPromotion, playSeasonComplete, playSeasonReviewMajor, playWarning } from "@/lib/sound";
import { Card, ClubBadge, Eyebrow, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";
import { ResultStrip } from "./MatchTab";
import { AwardsList, CupView, FinalTables, HonoursBoard, PlayoffBracketView, ResultsList, StoryCard, TieRow, recordLine } from "./SeasonStory";
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
  const data = useMemo(() => seasonReviewData(o, s.clubs, s.userClubId), [o, s.clubs, s.userClubId]);

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
          ? o.position <= 6
            ? "So close. Can you win the Grand Final?"
            : "Next: crack the top 6 and reach Old Trafford."
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
    <div className={CAREER_PAGE_CLASS} data-testid="season-review">
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

      {/* The season's story, in order (v1.58): who won what → awards → play-offs → cup → your
          results → final tables → the board, money and next season. */}
      <StoryCard title="Who won what" label="Honours board" testId="review-honours" className={o.trophies.length ? "border border-accent-gold/50" : ""}>
        {o.trophies.length ? (
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start" aria-label="Your trophies">
            {o.trophies.map((t) => (
              <li key={t} className="rounded-full bg-accent-gold/15 px-2.5 py-0.5 text-[13px] font-semibold text-accent-gold">🏆 {TROPHY_LABEL[t]}</li>
            ))}
          </ul>
        ) : null}
        <HonoursBoard lines={data.honours} clubs={s.clubs} userClubId={s.userClubId} />
      </StoryCard>

      {o.awards?.length ? (
        <Card>
          <section aria-label="Season awards" data-testid="season-awards">
            <Eyebrow>Season awards</Eyebrow>
            <AwardsList awards={o.awards} userClubId={s.userClubId} />
          </section>
        </Card>
      ) : null}

      {data.bracket ? (
        <StoryCard title="Play-offs" testId="review-playoffs">
          <PlayoffBracketView bracket={data.bracket} clubs={s.clubs} userClubId={s.userClubId} />
        </StoryCard>
      ) : null}

      {data.full ? (
        <StoryCard title="Challenge Cup" testId="review-cup">
          <CupView run={data.cupRun} final={data.cupFinal} clubs={s.clubs} userClubId={s.userClubId} />
        </StoryCard>
      ) : null}

      {data.results.length ? (
        <StoryCard title="Your results" testId="review-results">
          <details className="mt-1" open={data.results.length <= 8}>
            <summary className="cursor-pointer py-1 text-center text-sm font-semibold text-white sm:text-left">
              {data.results.length} games · {recordLine(data.results, s.userClubId)}
            </summary>
            <ResultsList results={data.results} clubs={s.clubs} userClubId={s.userClubId} />
          </details>
        </StoryCard>
      ) : null}

      {s.tables[o.division]?.length ? (
        <StoryCard title="Final tables" testId="review-tables">
          <div className="mt-2">
            <FinalTables state={s} story={o.story} initial={o.division} />
          </div>
        </StoryCard>
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

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-center text-sm sm:text-left">
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
          {o.derbies && o.derbies.w + o.derbies.d + o.derbies.l > 0 ? (
            <div data-testid="review-derbies">
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">Derbies</dt>
              <dd className="font-display text-xl font-bold text-white">
                {o.derbies.w}W {o.derbies.d ? `${o.derbies.d}D ` : ""}
                {o.derbies.l}L
              </dd>
            </div>
          ) : null}
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

      {SHOW_SHARE_RESULT_UI ? <ShareSeasonButton data={shareCardData} filename="27-0-manager-season.png" /> : null}

      {!loggedIn ? <GuestSaveNudge context="manager-season" /> : null}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton size="lg" disabled={!armed} onClick={goToOffseason}>Next: retirements and contracts</GameButton>
        </div>
      </div>
    </div>
  );
}

/** The user's last game of the season (the Grand Final, a play-off, Round 26…). */
function lastUserGame(state: CareerState): Fixture | undefined {
  for (let i = state.calendar.length - 1; i >= 0; i--) {
    const f = userFixture(state.calendar[i], state.userClubId);
    if (f?.result) return f;
  }
  return undefined;
}

/**
 * Full time on the season (v1.58): the last game and the Grand Final, clearly, before the review.
 * One tap on to the review.
 */
export function SeasonOver() {
  const { state, passStage } = useCareer();
  const armed = useArmed();
  const s = state!;
  const o = s.lastOutcome!;
  const last = lastUserGame(s);
  const gf = s.calendar.flatMap((m) => m.fixtures).find((f) => f.kind === "grand-final" && f.result);
  const cupFinal = s.calendar.flatMap((m) => m.fixtures).find((f) => f.kind === "cup" && f.round === 5 && f.result);
  const gfMini = gf ? { k: gf.kind, r: gf.round, h: gf.home, a: gf.away, hs: gf.result!.homeScore, as: gf.result!.awayScore, gp: gf.result!.goldenPoint ? (1 as const) : undefined } : null;
  const gfWinner = gfMini ? miniWinner(gfMini) : null;
  const inGf = !!gf && (gf.home === s.userClubId || gf.away === s.userClubId);
  const showGf = gfMini && !(inGf && last?.id === gf!.id);
  const title = o.trophies.includes("grand-final") ? "Champions!" : "Full time on the season";

  return (
    <div className={CAREER_PAGE_CLASS}>
      <CareerBackLink label="Home (progress saved)" />
      <section aria-label="Season over" className="flex flex-col gap-4">
        <div className="text-center">
          <p className="text-xs font-semibold text-theme-primary">{o.year} · season over</p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-300">
            {ordinal(o.position)} in the {DIVISION_LABEL[o.division]}
            {o.promoted ? " · promoted" : o.relegated ? " · relegated" : ""}
          </p>
        </div>
        {last ? <ResultStrip state={s} fixture={last} /> : null}
        {showGf && gfMini ? (
          <Card className="border border-accent-gold/40">
            <section aria-label="Grand Final result">
              <Eyebrow>Super League Grand Final</Eyebrow>
              <ul className="mt-2">
                <TieRow m={gfMini} clubs={s.clubs} userClubId={s.userClubId} />
              </ul>
              {gfWinner ? <p className="mt-2 text-center text-sm font-semibold text-accent-gold">{s.clubs[gfWinner]?.name} are Super League champions.</p> : null}
            </section>
          </Card>
        ) : null}
        {cupFinal && last?.id !== cupFinal.id ? (
          <p className="text-center text-[13px] text-gray-400">
            Challenge Cup: {s.clubs[cupFinal.result!.homeScore > cupFinal.result!.awayScore ? cupFinal.home : cupFinal.away]?.name} won the final.
          </p>
        ) : null}
      </section>
      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton size="lg" disabled={!armed} onClick={() => passStage("season-over")}>See the season review</GameButton>
        </div>
      </div>
    </div>
  );
}
