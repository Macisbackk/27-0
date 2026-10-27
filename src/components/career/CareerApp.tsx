"use client";

import { useEffect, useState } from "react";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import { DIVISION_LABEL, boardGoal, currentStage, formatMoney, isWindowOpen, ordinal, seasonProgress, sortTable } from "@/lib/career";
import { DailyMissionToast } from "@/components/DailyMissionToast";
import { CareerProvider, useCareer } from "@/lib/career/context";
import { CareerErrorBoundary } from "./CareerErrorBoundary";
import { CareerStart } from "./CareerStart";
import { Departures } from "./Departures";
import { ClubTab } from "./ClubTab";
import { ClubSheetProvider } from "./ClubSheet";
import { LegendVaultSheet, RecordsSheet } from "./LegacySheets";
import { MatchTab } from "./MatchTab";
import { SeasonReview } from "./SeasonReview";
import { TableTab } from "./TableTab";
import { TeamTab } from "./TeamTab";
import { TransferWindow } from "./TransferWindow";
import { useDeadlineDriver } from "./TransferNews";
import { ClubBadge, ProgressBar, Stars, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";
import { CareerTutorial } from "./CareerTutorial";
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
function SeasonStrip({ onChallenges }: { onChallenges: () => void }) {
  const { state } = useCareer();
  const s = state!;
  const stage = currentStage(s);
  const progress = seasonProgress(s);
  const goal = boardGoal(s);
  const table = sortTable(s.tables[s.clubs[s.userClubId]!.division]);
  const row = table.find((r) => r.clubId === s.userClubId);
  const doneChallenges = s.challenges.filter((c) => c.done).length;
  const started = goal.played > 0;
  const gap = goal.position - goal.target;
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
      <div className="mt-2">
        <ProgressBar value={progress.done} max={progress.total} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] leading-snug text-gray-300">
          <span className="font-semibold text-white">Board:</span> {goal.label}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            !started ? "bg-white/10 text-[color:var(--fl-muted)]" : goal.onTrack ? "bg-success/15 text-success" : "bg-amber-300/15 text-amber-200"
          }`}
        >
          {!started ? "New season" : goal.onTrack ? "On track" : `${gap} ${gap === 1 ? "place" : "places"} off`}
        </span>
      </div>
      {s.challenges.length ? (
        <button
          type="button"
          onClick={onChallenges}
          className="mt-1.5 text-[12px] font-semibold text-theme-primary underline-offset-2 hover:underline"
        >
          Challenges: {doneChallenges} of {s.challenges.length} done ›
        </button>
      ) : null}
    </section>
  );
}

function CareerRouter() {
  const { ready, state } = useCareer();
  const [tab, setTab] = useState<Tab>("match");
  const [vault, setVault] = useState(false);
  const [records, setRecords] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  // Deadline Day's clock keeps running on the hub and in the market.
  useDeadlineDriver();
  // The window shut (clock hit 0:00) while the market was open: back to the hub, and don't
  // pop the market open again when the next window opens.
  const windowOpen = !!state && isWindowOpen(state);
  useEffect(() => {
    if (!windowOpen) setMarketOpen(false);
  }, [windowOpen]);
  // A new career always opens on the Match tab.
  const seed = state?.seed;
  useEffect(() => setTab("match"), [seed]);

  // On phones the bottom bar shows the hub's sections while the hub is on screen.
  const hubShowing =
    ready &&
    !!state &&
    state.phase !== "review" &&
    state.phase !== "departures" &&
    state.phase !== "transfers" &&
    !(marketOpen && isWindowOpen(state));
  useEffect(() => {
    if (!hubShowing) {
      setManagerNav(null);
      return;
    }
    setManagerNav({ tab, setTab });
  }, [hubShowing, tab]);
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
  if (state.phase === "review") return <ClubSheetProvider><SeasonReview /></ClubSheetProvider>;
  if (state.phase === "departures") return <ClubSheetProvider><Departures /></ClubSheetProvider>;
  if (state.phase === "transfers") return <TransferWindow />;
  if (marketOpen && isWindowOpen(state)) {
    return (
      <ClubSheetProvider>
        <TransferWindow midseason onClose={() => setMarketOpen(false)} />
      </ClubSheetProvider>
    );
  }

  return (
    <ClubSheetProvider>
    <div className={CAREER_PAGE_CLASS}>
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
      {tab === "match" ? <SeasonStrip onChallenges={() => setTab("club")} /> : null}
      {tab === "match" ? <MatchTab onOpenMarket={() => setMarketOpen(true)} /> : null}
      {tab === "team" ? <TeamTab /> : null}
      {tab === "table" ? <TableTab /> : null}
      {tab === "club" ? <ClubTab onOpenVault={() => setVault(true)} onOpenRecords={() => setRecords(true)} /> : null}
      </div>
      {sheets}
      <DailyMissionToast />
      <CareerTutorial onTab={setTab} />
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
