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
import { ClubBadge, Stars } from "./bits";
import { CareerTutorial } from "./CareerTutorial";

type Tab = "match" | "team" | "table" | "club";

function HubHeader() {
  const { state } = useCareer();
  const s = state!;
  const club = s.clubs[s.userClubId]!;
  const table = sortTable(s.tables[club.division]);
  const pos = table.findIndex((r) => r.clubId === club.id) + 1;
  const row = table[pos - 1];
  return (
    <header className="flex items-center gap-3 rounded-card bg-pitch-900 p-3">
      <ClubBadge club={club} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl font-bold leading-tight text-white">{club.name}</p>
        <p className="text-xs text-gray-400">
          {s.year} · {DIVISION_LABEL[club.division]}
          {row && row.p > 0 ? ` · ${ordinal(pos)} (${row.w}W ${row.l}L)` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
          <Stars value={s.prestige} label={`Prestige ${s.prestige}`} /> <span className={s.budget < 0 ? "text-danger" : "text-gray-300"}>{formatMoney(s.budget)}</span>
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
  // A new career always opens on the Match tab.
  const seed = state?.seed;
  useEffect(() => setTab("match"), [seed]);

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-40 sm:pb-10">
      <HubHeader />
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
