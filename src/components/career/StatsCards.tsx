"use client";

import { useState } from "react";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  DIVISION_LABEL,
  nrlHonours,
  LEADER_MIN_APPS,
  RECORD_LABEL,
  hallOfFame,
  leagueLeaders,
  squadStats,
  type PlayerStatRow,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { Card, ClubBadge, Eyebrow } from "./bits";
import { ClubLink } from "./ClubSheet";

type SortKey = "apps" | "tries" | "goals" | "points" | "avg";
type Scope = "season" | "club";

const COLUMNS: Array<{ key: SortKey; label: string; title: string }> = [
  { key: "apps", label: "Ap", title: "Appearances" },
  { key: "tries", label: "T", title: "Tries" },
  { key: "goals", label: "G", title: "Goals" },
  { key: "points", label: "Pts", title: "Points" },
  { key: "avg", label: "Avg", title: "Average match rating" },
];

function value(r: PlayerStatRow, key: SortKey, scope: Scope): number | null {
  if (scope === "season") return key === "avg" ? r.avg : r[key];
  switch (key) {
    case "apps":
      return r.clubApps;
    case "tries":
      return r.clubTries;
    case "goals":
      return r.clubGoals;
    case "points":
      return r.clubPoints;
    case "avg":
      return r.clubAvg;
  }
}

/** Club tab: the squad's stats this season (or at the club), sortable by tapping a column. */
export function SquadStatsCard() {
  const { state } = useCareer();
  const s = state!;
  const [sort, setSort] = useState<SortKey>("points");
  const [scope, setScope] = useState<Scope>("season");
  const rows = squadStats(s)
    .map((r) => ({ r, v: value(r, sort, scope) ?? -1 }))
    .sort((a, b) => b.v - a.v || (value(b.r, "apps", scope) ?? 0) - (value(a.r, "apps", scope) ?? 0) || a.r.name.localeCompare(b.r.name))
    .map((x) => x.r);
  return (
    <Card className="px-2 sm:px-4">
      <div className="px-2 text-center sm:px-0 sm:text-left" data-testid="squad-stats">
        <Eyebrow>Player stats</Eyebrow>
      </div>
      <div className="mt-2 flex justify-center sm:justify-start">
        <GameSegmentedControl<Scope>
          compact
          options={[
            { id: "season", label: "This season" },
            { id: "club", label: "At the club" },
          ]}
          value={scope}
          onChange={setScope}
          ariaLabel="Stats for"
        />
      </div>
      <table className="mt-2 w-full table-fixed text-[13px]">
        <caption className="sr-only">Player stats, sorted by {COLUMNS.find((c) => c.key === sort)!.title}</caption>
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-1 pl-1 text-left font-semibold">Player</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className={`${c.key === "avg" || c.key === "points" ? "w-10" : "w-8"} py-1 text-right font-semibold`} aria-sort={sort === c.key ? "descending" : "none"}>
                <button
                  type="button"
                  title={c.title}
                  onClick={() => { playUiClick(); setSort(c.key); }}
                  className={`w-full text-right uppercase ${sort === c.key ? "text-theme-primary" : "hover:text-white"}`}
                >
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[color:var(--fl-line)]">
              <td className="truncate py-1.5 pl-1 text-left text-gray-200">
                <span className="mr-1 text-[10px] font-bold text-gray-500">{r.pos}</span>
                {r.name}
              </td>
              {COLUMNS.map((c) => {
                const v = value(r, c.key, scope);
                return (
                  <td key={c.key} className={`py-1.5 text-right tabular-nums ${sort === c.key ? "font-bold text-white" : "text-gray-300"}`}>
                    {v == null ? "–" : c.key === "avg" ? v.toFixed(1) : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-2 text-center text-[11px] text-gray-400 sm:text-left">Tap a column to sort. Avg = average match rating out of 10.</p>
    </Card>
  );
}

/** Top 10 try scorers and top 10 average match ratings in a division. */
export function LeagueLeadersCard() {
  const { state } = useCareer();
  const s = state!;
  const division = s.clubs[s.userClubId]!.division;
  const [list, setList] = useState<"tries" | "ratings">("tries");
  const lead = leagueLeaders(s, division);
  const rows = lead[list];
  return (
    <Card>
      <div className="text-center sm:text-left" data-testid="league-leaders">
        <Eyebrow>League stats · {DIVISION_LABEL[division]}</Eyebrow>
      </div>
      <div className="mt-2 flex justify-center sm:justify-start">
        <GameSegmentedControl<"tries" | "ratings">
          compact
          options={[
            { id: "tries", label: "Top try scorers" },
            { id: "ratings", label: "Top ratings", shortLabel: "Ratings" },
          ]}
          value={list}
          onChange={setList}
          ariaLabel="League stats"
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-center text-sm text-gray-400">
          {list === "tries" ? "No tries yet this season." : `Players need ${LEADER_MIN_APPS} games to qualify.`}
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-[color:var(--fl-line)]">
          {rows.map((r, i) => {
            const club = s.clubs[r.clubId]!;
            const me = r.clubId === s.userClubId;
            return (
              <li key={r.playerId} className={`flex items-center gap-2 py-1.5 text-[13px] ${me ? "bg-theme-primary/10" : ""}`}>
                <span className="w-5 shrink-0 text-right tabular-nums text-gray-500">{i + 1}</span>
                <ClubBadge club={club} size="sm" />
                <span className="min-w-0 flex-1 truncate text-left">
                  <span className={me ? "font-bold text-white" : "text-gray-200"}>{r.name}</span>
                  <span className="ml-1 text-[11px] text-gray-500">{r.apps} {r.apps === 1 ? "game" : "games"}</span>
                </span>
                <span className="shrink-0 font-display font-bold tabular-nums text-white">{list === "ratings" ? r.value.toFixed(1) : r.value}</span>
              </li>
            );
          })}
        </ol>
      )}
      {list === "ratings" && rows.length ? <p className="mt-2 text-center text-[11px] text-gray-400 sm:text-left">Min {LEADER_MIN_APPS} games.</p> : null}
    </Card>
  );
}

/** A club's records: the real all-time holders, and anyone in this career who passes them. */
export function HallOfFame({ clubId, compact = false }: { clubId: string; compact?: boolean }) {
  const { state } = useCareer();
  const s = state!;
  const rows = hallOfFame(s, clubId);
  return (
    <ul className={`divide-y divide-[color:var(--fl-line)] ${compact ? "mt-1.5" : "mt-2"}`} data-testid="hall-of-fame">
      {rows.map((h) => {
        const career = !!h.record?.playerId;
        return (
          <li key={h.kind} className="py-1.5 text-left">
            <div className="flex items-baseline gap-2">
              <span className="w-[88px] shrink-0 text-[11px] font-semibold uppercase text-gray-500">{RECORD_LABEL[h.kind]}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-white">
                {h.record ? h.record.name : "No record yet"}
                {career ? <span className="ml-1.5 rounded-full bg-accent-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-gold">{h.careerOnly ? "Career best" : `New · ${h.record!.year}`}</span> : null}
              </span>
              <span className="shrink-0 font-display font-bold tabular-nums text-white">{h.record ? h.record.value.toLocaleString("en-GB") : "–"}</span>
            </div>
            {h.chaser && h.record && h.chaser.playerId !== h.record.playerId ? (
              <p className="mt-0.5 pl-[96px] text-[11px] text-gray-400">
                Closest now: {h.chaser.name} {h.chaser.value.toLocaleString("en-GB")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Club tab card around the user's Hall of Fame. */
export function HallOfFameCard() {
  const { state } = useCareer();
  const s = state!;
  const club = s.clubs[s.userClubId]!;
  return (
    <Card>
      <div className="text-center sm:text-left">
        <Eyebrow>Hall of Fame · <ClubLink clubId={club.id}>{club.name}</ClubLink></Eyebrow>
      </div>
      <HallOfFame clubId={club.id} />
      {club.division === "nrl" ? <NrlHonoursLine clubId={club.id} /> : null}
      <p className="mt-2 text-center text-[11px] text-gray-400 sm:text-left">
        {club.division === "nrl" ? "Club records since 1998 (the NRL era)." : "All-time club records."} Pass one and he goes in the book.
      </p>
    </Card>
  );
}

/** An NRL club's real honours since 1998 (data/nrl/): premierships and minor premierships. */
function NrlHonoursLine({ clubId }: { clubId: string }) {
  const h = nrlHonours(clubId);
  const list = (ys: number[]) => (ys.length ? ys.join(", ") : "none");
  return (
    <p className="mt-2 text-center text-[12px] leading-snug text-gray-300 sm:text-left" data-testid="nrl-honours">
      <span className="font-semibold text-white">Premiers:</span> {list(h.premierships)}
      <br />
      <span className="font-semibold text-white">Minor premiers:</span> {list(h.minorPremierships)}
    </p>
  );
}
