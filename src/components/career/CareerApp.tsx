"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import { DIVISION_LABEL, boardGoal, currentStage, deadlineDecisionPending, formatMoney, isWindowOpen, ordinal, seasonProgress, sortTable, stageSeen, windowStatus } from "@/lib/career";
import { DailyMissionToast } from "@/components/DailyMissionToast";
import { CareerProvider, useCareer } from "@/lib/career/context";
import { CareerErrorBoundary } from "./CareerErrorBoundary";
import { CareerStart } from "./CareerStart";
import { Departures } from "./Departures";
import { ClubTab } from "./ClubTab";
import { ClubSheetProvider } from "./ClubSheet";
import { LegendVaultSheet, RecordsSheet } from "./LegacySheets";
import { MatchTab } from "./MatchTab";
import { SeasonOver, SeasonReview } from "./SeasonReview";
import { TableTab } from "./TableTab";
import { TeamTab } from "./TeamTab";
import { TransferWindow } from "./TransferWindow";
import { useDeadlineDriver } from "./TransferNews";
import { ClubBadge, ProgressBar, Stars, CAREER_PAGE_CLASS, CAREER_PAGE_CLASS_NO_BAR, CareerBackLink, scrollUnderHeader } from "./bits";
import { CareerTutorial } from "./CareerTutorial";
import { EventPopup } from "./EventPopup";
import { PitchMark } from "@/components/ui/PitchHero";
import { BoardGlyph } from "@/components/icons/rugby-icons";
import { setManagerNav, type ManagerTab } from "@/lib/ui/manager-nav";

type Tab = ManagerTab;

function HubHeader() {
  const { state } = useCareer();
  const s = state!;
  const club = s.clubs[s.userClubId]!;
  return (
    <header className="pitch-surface flex items-center gap-3 p-3 pr-4">
      <PitchMark size={120}>
        <BoardGlyph />
      </PitchMark>
      <ClubBadge club={club} size="lg" />
      <div className="relative min-w-0 flex-1">
        <p className="pitch-eyebrow !text-[13px] !leading-tight">
          {s.year} · {DIVISION_LABEL[club.division]}
          {s.seasonNumber > 1 ? ` · Season ${s.seasonNumber}` : ""}
        </p>
        <p className="pitch-title !mt-0.5 truncate !text-[24px] !leading-tight sm:!text-[28px]">{club.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="pitch-pill">
            <Stars value={s.prestige} label={`Prestige ${s.prestige}`} />
          </span>
          <span className={`pitch-pill ${s.budget < 0 ? "!text-[#fca5a5]" : "!text-white"}`}>{formatMoney(s.budget)}</span>
        </p>
      </div>
    </header>
  );
}

/**
 * Where the season is and what the board wants, on every hub tab:
 * "Round 12 of 26 · 3rd" with a bar, then the board's target and whether you're on course.
 */
function SeasonStrip() {
  const { state } = useCareer();
  const s = state!;
  const stage = currentStage(s);
  const progress = seasonProgress(s);
  const goal = boardGoal(s);
  const table = sortTable(s.tables[s.clubs[s.userClubId]!.division]);
  const row = table.find((r) => r.clubId === s.userClubId);
  const started = goal.played > 0;
  const gap = goal.position - goal.target;
  const leagueDone = progress.total > 0 && progress.done === progress.total;
  return (
    <section aria-label="Season progress" className="rounded-card bg-pitch-900 px-4 py-3 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-bold text-white">{stage === "preseason" ? "Pre-season" : progress.label}</p>
        <p className="shrink-0 text-sm tabular-nums text-[color:var(--fl-muted)]">
          {started && row ? (
            <>
              <span className="font-bold text-white">{ordinal(goal.position)}</span> · {row.w}W {row.l}L{row.d ? ` ${row.d}D` : ""}
            </>
          ) : (
            `${goal.size} teams`
          )}
        </p>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={progress.done} max={progress.total} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] leading-snug text-gray-300">
          <span className="font-semibold text-white">Board:</span> {goal.label}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            !started ? "bg-white/10 text-[color:var(--fl-muted)]" : goal.onTrack ? "bg-success/15 text-success" : "bg-amber-300/15 text-amber-200"
          }`}
        >
          {!started ? "New season" : leagueDone ? (goal.onTrack ? "Target met" : "Missed") : goal.onTrack ? "On track" : `${gap} ${gap === 1 ? "place" : "places"} off`}
        </span>
      </div>
      {/* The transfer window has its own card lower down the Match tab (v1.54: no duplicate pill). */}
    </section>
  );
}

function CareerRouter() {
  const { ready, state } = useCareer();
  const [tab, setTabState] = useState<Tab>("match");
  const [vault, setVault] = useState(false);
  const [records, setRecords] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  // Deadline Day's clock keeps running on the hub, in the market and on the other tabs.
  useDeadlineDriver();
  const deadlineLive = !!state && deadlineDecisionPending(state);
  const marketShowing = marketOpen && !!state && isWindowOpen(state);
  // Switching section (bottom bar, the segmented control or the walkthrough) starts at the top.
  // From the pre-season market another section closes the market (it's one tap away on the Match
  // tab). On Deadline Day the market stays where it is: Match takes you back to it, and the clock
  // carries on (or stays paused) exactly as it was.
  const marketRef = useRef({ showing: marketShowing, deadline: deadlineLive });
  marketRef.current = { showing: marketShowing, deadline: deadlineLive };
  const setTab = useCallback((next: Tab) => {
    if (next !== "match" && marketRef.current.showing && !marketRef.current.deadline) setMarketOpen(false);
    setTabState(next);
    scrollUnderHeader(null);
  }, []);
  // The window shut (clock hit 0:00) while the market was open: back to the hub, and don't
  // pop the market open again when the next window opens.
  const windowOpen = !!state && isWindowOpen(state);
  useEffect(() => {
    if (!windowOpen) setMarketOpen(false);
  }, [windowOpen]);
  // A new career, and every new full-screen step (season over, departures, the summer window,
  // a new season), opens on the Match tab, where that step lives.
  const seed = state?.seed;
  const phase = state?.phase;
  useEffect(() => setTabState("match"), [seed, phase]);

  // Where the page lands after an action (v1.57). A new week or stage (Quick sim, Continue, a live
  // match finished, a stage passed, the window shut) puts the season strip under the header with
  // the new result right below it; a new screen (review, departures, the market and back) opens
  // at the top. Never left mid-page or under the sticky bar.
  const stage = state ? currentStage(state) : null;
  const spot = state
    ? `${state.seed}:${state.year}:${state.phase}${state.phase === "review" && stageSeen(state, "season-over") ? ":review" : ""}:${marketShowing ? "market" : "hub"}`
    : "none";
  const week = state ? `${state.matchdayIndex}:${stage}` : "none";
  const landed = useRef({ spot, week });
  useEffect(() => {
    const prev = landed.current;
    landed.current = { spot, week };
    if (prev.spot !== spot) {
      scrollUnderHeader(null);
      return;
    }
    if (prev.week !== week && tab === "match") {
      requestAnimationFrame(() => scrollUnderHeader(document.querySelector('section[aria-label="Season progress"]') ?? document.querySelector('section[aria-label="Deadline Day"]')));
    }
  }, [spot, week, tab]);

  // On phones the bottom bar shows the Manager sections on every Manager screen once a career is
  // running (v1.62: the market, the summer window, departures and the review too, not the site's
  // main bar). Match is wherever the season is: the hub, or the full-screen step it's on.
  const navShowing = ready && !!state;
  useEffect(() => {
    if (!navShowing) {
      setManagerNav(null);
      return;
    }
    setManagerNav({ tab, setTab });
  }, [navShowing, tab, setTab]);
  useEffect(() => () => setManagerNav(null), []);

  const sheets = (
    <>
      <LegendVaultSheet open={vault} onClose={() => setVault(false)} />
      <RecordsSheet open={records} onClose={() => setRecords(false)} />
    </>
  );

  if (!ready) {
    return <p className="py-16 text-center text-sm text-gray-400" role="status">Loading your career…</p>;
  }
  if (!state) {
    return (
      <>
        <CareerStart onOpenVault={() => setVault(true)} onOpenRecords={() => setRecords(true)} />
        {sheets}
      </>
    );
  }
  // The full-screen steps live on the Match tab; Team, Table and Club can still be looked at.
  const inFlow = state.phase !== "season" || marketShowing;
  if (tab === "match") {
    // Full time on the season first (the last game, the Grand Final), then the review.
    if (state.phase === "review") return <ClubSheetProvider>{stageSeen(state, "season-over") ? <SeasonReview /> : <SeasonOver />}</ClubSheetProvider>;
    if (state.phase === "departures") return <ClubSheetProvider><Departures /></ClubSheetProvider>;
    if (state.phase === "transfers") return <ClubSheetProvider><TransferWindow /></ClubSheetProvider>;
    if (marketShowing) {
      const kind = windowStatus(state).kind;
      return (
        <ClubSheetProvider>
          <TransferWindow mode={kind === "deadline" ? "deadline" : "preseason"} onClose={() => setMarketOpen(false)} />
        </ClubSheetProvider>
      );
    }
  }
  // Deadline Day on the Match tab: the day itself and nothing else (owner, v1.62).
  const deadlineFocus = tab === "match" && stage === "deadline";

  return (
    <ClubSheetProvider>
    <div className={tab === "match" && stage !== "preseason" && stage !== "deadline" ? CAREER_PAGE_CLASS : CAREER_PAGE_CLASS_NO_BAR}>
      <CareerBackLink />
      <HubHeader />
      {/* Phones use the bottom bar for these (BottomNav reads lib/ui/manager-nav). */}
      <div className="hidden sm:block">
      <GameSegmentedControl<Tab>
        options={[
          { id: "match", label: "Match" },
          { id: "team", label: "Team" },
          { id: "table", label: "Table" },
          { id: "club", label: "Club" },
        ]}
        value={tab}
        onChange={setTab}
        fullWidth
        ariaLabel="Manager sections"
      />
      </div>
      <div key={tab} className="fl-rise flex flex-col gap-4">
      {tab === "match" && !deadlineFocus ? <SeasonStrip /> : null}
      {tab === "match" ? <MatchTab onOpenMarket={() => setMarketOpen(true)} /> : null}
      {tab === "team" ? <TeamTab /> : null}
      {tab === "table" ? <TableTab /> : null}
      {tab === "club" ? <ClubTab onOpenVault={() => setVault(true)} onOpenRecords={() => setRecords(true)} /> : null}
      </div>
      {sheets}
      {inFlow ? null : (
        <>
          <DailyMissionToast />
          <CareerTutorial onTab={setTab} />
          {state.tutorialDone && !deadlineFocus ? <EventPopup /> : null}
        </>
      )}
    </div>
    </ClubSheetProvider>
  );
}

export function CareerApp() {
  return (
    <CareerProvider>
      <CareerErrorBoundary>
        <CareerRouter />
      </CareerErrorBoundary>
    </CareerProvider>
  );
}
