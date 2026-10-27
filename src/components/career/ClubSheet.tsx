"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";
import {
  DIVISION_LABEL,
  LINEUP_SLOTS,
  aiLineup,
  formatMoney,
  newArrivals,
  ordinal,
  seasonDeals,
  sortTable,
  type CareerState,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { ClubBadge, RatingPill } from "./bits";

/** Open any club's team sheet from anywhere in Manager Mode. */
const ClubSheetContext = createContext<(clubId: string) => void>(() => {});
export const useOpenClub = () => useContext(ClubSheetContext);

/** A club name you can tap to see who they actually played last time out. */
export function ClubLink({ clubId, children, className = "" }: { clubId: string; children: ReactNode; className?: string }) {
  const open = useOpenClub();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        playUiClick();
        open(clubId);
      }}
      className={`min-w-0 text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50 rounded ${className}`}
    >
      {children}
    </button>
  );
}

export function ClubSheetProvider({ children }: { children: ReactNode }) {
  const [clubId, setClubId] = useState<string | null>(null);
  const open = useCallback((id: string) => setClubId(id), []);
  return (
    <ClubSheetContext.Provider value={open}>
      {children}
      <ClubSheet clubId={clubId} onClose={() => setClubId(null)} />
    </ClubSheetContext.Provider>
  );
}

function tablePosition(s: CareerState, clubId: string): string {
  const club = s.clubs[clubId];
  if (!club) return "";
  const rows = sortTable(s.tables[club.division]);
  const i = rows.findIndex((r) => r.clubId === clubId);
  const row = rows[i];
  return row && row.p > 0 ? `${ordinal(i + 1)} · ${row.w}W ${row.l}L` : "";
}

function ClubSheet({ clubId, onClose }: { clubId: string | null; onClose: () => void }) {
  const { state } = useCareer();
  const s = state;
  const club = s && clubId ? s.clubs[clubId] : null;

  const view = useMemo(() => {
    if (!s || !club) return null;
    const last = s.lastLineups?.[club.id];
    const lineup = last?.lineup ?? (club.id === s.userClubId ? s.lineup : aiLineup(s, club.id));
    const arrivals = newArrivals(s, club.id);
    const deals = seasonDeals(s).filter((d) => d.to === club.id || d.from === club.id);
    return { last, lineup, arrivals, deals };
  }, [s, club]);

  if (!s || !club || !view) return <MobileBottomSheet open={false} onClose={onClose} title="">{null}</MobileBottomSheet>;
  const { last, lineup, arrivals, deals } = view;
  const opponent = last ? s.clubs[last.opponentId] : null;
  const result = last ? (last.us > last.them ? "W" : last.us < last.them ? "L" : "D") : null;
  const stillHere = new Set(club.squad);

  return (
    <MobileBottomSheet
      open={!!clubId}
      onClose={onClose}
      title={club.name}
      pitchHeader
      headerExtra={<span className="mt-1.5 block"><ClubBadge club={club} size="sm" /></span>}
    >
      <p className="text-sm text-[color:var(--fl-muted)]">
        {DIVISION_LABEL[club.division]}
        {tablePosition(s, club.id) ? ` · ${tablePosition(s, club.id)}` : ""} · {club.squad.length} players
      </p>

      <section aria-label="Team sheet" className="mt-3 rounded-tile bg-pitch-950 p-3">
        <p className="text-[13px] font-semibold text-white">
          {last && opponent ? (
            <>
              Last game: {last.label} · <span className={result === "W" ? "text-success" : result === "L" ? "text-danger" : "text-white"}>{result} {last.us}–{last.them}</span>{" "}
              {last.home ? "v" : "at"} {opponent.name}
            </>
          ) : (
            "No game yet this season · expected XIII"
          )}
        </p>
        <ol className="mt-2 divide-y divide-[color:var(--fl-line)]">
          {LINEUP_SLOTS.map((slot, i) => {
            const p = s.players[lineup[i] ?? ""];
            const isNew = p ? arrivals.has(p.id) : false;
            const gone = p ? !stillHere.has(p.id) : false;
            return (
              <li key={`${slot}-${i}`} className="flex items-center gap-2.5 py-1.5 text-left">
                <span className="w-5 text-right text-xs font-semibold tabular-nums text-[color:var(--fl-muted)]">{i + 1}</span>
                <span className="w-7 text-[11px] font-bold text-[color:var(--fl-muted)]">{slot}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {p?.name ?? "—"}
                  {isNew ? <span className="ml-1.5 rounded-full bg-theme-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-theme-primary">New</span> : null}
                  {gone ? <span className="ml-1.5 rounded-full bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--fl-muted)]">Since left</span> : null}
                </span>
                {p ? <RatingPill rating={p.rating} /> : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Transfers this season" className="mt-3">
        <p className="text-[13px] font-semibold text-white">Transfers this season</p>
        {deals.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--fl-muted)]">No deals yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {deals.map((d) => {
              const incoming = d.to === club.id;
              const other = incoming ? d.from : d.to;
              return (
                <li key={`${d.playerId}-${d.at}`} className="flex items-center gap-2 text-sm">
                  <span className={`w-9 text-[11px] font-bold ${incoming ? "text-success" : "text-danger"}`}>{incoming ? "IN" : "OUT"}</span>
                  <span className="min-w-0 flex-1 truncate text-white">
                    {d.playerName} <span className="text-[color:var(--fl-muted)]">({d.pos}, {d.rating})</span>
                  </span>
                  <span className="shrink-0 text-xs text-[color:var(--fl-muted)]">
                    {other ? `${incoming ? "from" : "to"} ${s.clubs[other]?.short ?? "?"}` : incoming ? "free agent" : "released"} · {d.fee > 0 ? formatMoney(d.fee) : "free"}
                    {d.deadlineDay ? " · Deadline Day" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </MobileBottomSheet>
  );
}
