"use client";

import { useEffect, useState } from "react";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import { DIVISION_LABEL, formatMoney, isWindowOpen, ordinal, sortTable } from "@/lib/career";
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
import { ClubBadge, Stars, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";
import { CareerTutorial } from "./CareerTutorial";
import { PitchMark } from "@/components/ui/PitchHero";
import { BoardGlyph } from "@/components/icons/rugby-icons";
import { setManagerNav, type ManagerTab } from "@/lib/ui/manager-nav";

type Tab = ManagerTab;

function HubHeader() {
  const { state } = useCareer();
  const s = state!;
  const club = s.clubs[s.userClubId]!;
  const table = sortTable(s.tables[club.division]);
  const pos = table.findIndex((r) => r.clubId === club.id) + 1;
  const row = table[pos - 1];
  return (
    <header className="pitch-surface flex items-center gap-3 p-3 pr-4">
      <PitchMark size={120}>
        <BoardGlyph />
      </PitchMark>
      <ClubBadge club={club} size="lg" />
      <div className="relative min-w-0 flex-1">
        <p className="pitch-eyebrow !text-[13px] !leading-tight">
          {s.year} · {DIVISION_LABEL[club.division]}
          {row && row.p > 0 ? ` · ${ordinal(pos)} (${row.w}W ${row.l}L)` : ""}
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
      <div key={tab} className="fl-rise">
      {tab === "match" ? <MatchTab onOpenMarket={() => setMarketOpen(true)} /> : null}
      {tab === "team" ? <TeamTab /> : null}
      {tab === "table" ? <TableTab /> : null}
      {tab === "club" ? <ClubTab onOpenVault={() => setVault(true)} onOpenRecords={() => setRecords(true)} /> : null}
      </div>
      {sheets}
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
