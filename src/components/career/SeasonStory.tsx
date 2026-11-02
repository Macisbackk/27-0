"use client";

import { useState, type ReactNode } from "react";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  DIVISION_LABEL,
  MAN_OF_STEEL_LEGACY,
  TROPHY_LABEL,
  awardLabel,
  miniLabel,
  miniPlayed,
  miniWinner,
  ordinal,
  seasonReviewData,
  sortTable,
  userSide,
  type CareerClub,
  type CareerState,
  type Division,
  type HonourLine,
  type MiniResult,
  type PlayoffBracket,
  type SeasonAward,
  type SeasonOutcome,
  type SeasonStory,
} from "@/lib/career";
import { ClubBadge, Eyebrow } from "./bits";
import { ManagerSheet } from "./Sheet";

/**
 * The season's story, shared by the season review, the Table tab (results, fixtures, the cup and
 * the live play-offs) and past seasons in Club → Records: who won what, the play-off bracket, the
 * Challenge Cup and the user's results. Short plain text, centred on phones, compact at 320px.
 */

type Clubs = Record<string, CareerClub>;

const FALLBACK = { short: "???", name: "Unknown", primary: "#1f2937", secondary: "#ffffff" };
const clubOf = (clubs: Clubs, id: string) => clubs[id] ?? { ...FALLBACK, short: id.slice(0, 3).toUpperCase(), name: id };

/** A club's name: the 3-letter code on phones, the full name from `sm` up. */
export function ClubName({ club, className = "" }: { club: Pick<CareerClub, "short" | "name">; className?: string }) {
  return (
    <span className={`min-w-0 truncate ${className}`}>
      <span className="sm:hidden">{club.short}</span>
      <span className="hidden sm:inline">{club.name}</span>
    </span>
  );
}

/** One tie: home badge and name, the score (or "v"), away name and badge. Winner bold, your club tinted. */
export function TieRow({ m, clubs, userClubId, label }: { m: MiniResult; clubs: Clubs; userClubId: string; label?: string }) {
  const home = clubOf(clubs, m.h);
  const away = clubOf(clubs, m.a);
  const played = miniPlayed(m);
  const w = miniWinner(m);
  const mine = m.h === userClubId || m.a === userClubId;
  const tone = (id: string) => (!played ? "text-gray-200" : w === id ? "font-bold text-white" : w ? "text-gray-400" : "text-gray-200");
  return (
    <li className={`rounded-control px-1.5 py-1.5 ${mine ? "bg-theme-primary/10" : ""}`} data-mine={mine ? "true" : undefined}>
      {label ? <p className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p> : null}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[13px]">
        <span className="flex min-w-0 items-center justify-end gap-1.5">
          <ClubName club={home} className={`text-right ${tone(m.h)}`} />
          <ClubBadge club={home} size="sm" />
        </span>
        <span className={`min-w-[3.25rem] text-center font-display tabular-nums ${played ? "font-bold text-white" : "text-gray-500"}`}>
          {played ? `${m.hs}–${m.as}` : "v"}
          {m.gp ? <span className="block text-[9px] font-semibold uppercase tracking-wide text-gray-400">Golden pt</span> : null}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <ClubBadge club={away} size="sm" />
          <ClubName club={away} className={tone(m.a)} />
        </span>
      </div>
    </li>
  );
}

const OUTCOME_TONE = { W: "bg-success/15 text-success", L: "bg-danger/15 text-red-200", D: "bg-white/10 text-gray-200" } as const;

/** One of your games: round, W/L/D, opponent and score. */
export function ResultRow({ m, clubs, userClubId }: { m: MiniResult; clubs: Clubs; userClubId: string }) {
  const side = userSide(m, userClubId);
  const opp = clubOf(clubs, side.opponent);
  return (
    <li className="flex items-center gap-2 py-1.5 text-[13px]">
      <span className="w-14 shrink-0 text-[11px] text-gray-500">{miniLabel(m, true)}</span>
      <span className={`inline-flex w-6 shrink-0 justify-center rounded-full py-0.5 text-[11px] font-bold ${side.outcome ? OUTCOME_TONE[side.outcome] : "bg-white/5 text-gray-500"}`}>
        {side.outcome ?? "–"}
      </span>
      <ClubBadge club={opp} size="sm" />
      <span className="min-w-0 flex-1 truncate text-gray-200">
        {side.home ? "v" : "at"} {opp.name}
      </span>
      <span className="shrink-0 font-display font-bold tabular-nums text-white">
        {side.outcome ? `${side.us}–${side.them}` : ""}
        {m.gp ? <span className="ml-1 text-[10px] font-semibold text-gray-400">GP</span> : null}
      </span>
    </li>
  );
}

export function ResultsList({ results, clubs, userClubId, label = "Your results" }: { results: MiniResult[]; clubs: Clubs; userClubId: string; label?: string }) {
  return (
    <ul className="divide-y divide-pitch-800" aria-label={label} data-testid="results-list">
      {results.map((m, i) => (
        <ResultRow key={`${m.k}-${m.r}-${m.h}-${i}`} m={m} clubs={clubs} userClubId={userClubId} />
      ))}
    </ul>
  );
}

/** "21W 2D 4L" over a set of your games. */
export function recordLine(results: MiniResult[], userClubId: string): string {
  let w = 0, d = 0, l = 0;
  for (const m of results) {
    const o = userSide(m, userClubId).outcome;
    if (o === "W") w++;
    else if (o === "D") d++;
    else if (o === "L") l++;
  }
  return `${w}W${d ? ` ${d}D` : ""} ${l}L`;
}

/** Who won what: one centred block per honour, your club in gold. */
export function HonoursBoard({ lines, clubs, userClubId }: { lines: HonourLine[]; clubs: Clubs; userClubId: string }) {
  if (!lines.length) return <p className="mt-2 text-center text-sm text-gray-400 sm:text-left">No honours recorded for this season.</p>;
  return (
    <ul className="mt-2 divide-y divide-pitch-800" data-testid="honours-board">
      {lines.map((h) => (
        <li key={h.id} className="py-2 text-center sm:text-left" data-honour={h.id}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{h.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
            {h.clubIds.map((id) => {
              const club = clubOf(clubs, id);
              return (
                <span key={id} className="inline-flex min-w-0 items-center gap-1.5">
                  <ClubBadge club={club} size="sm" />
                  <span className={`truncate text-sm font-semibold ${id === userClubId ? "text-accent-gold" : "text-white"}`}>{club.name}</span>
                </span>
              );
            })}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-gray-400">{h.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** Season awards (Man of Steel, Young Player, top try scorers, your Player of the Season). */
export function AwardsList({ awards, userClubId }: { awards: SeasonAward[]; userClubId: string }) {
  return (
    <>
      <ul className="mt-2 divide-y divide-pitch-800">
        {awards.map((a) => {
          const ours = a.clubId === userClubId;
          return (
            <li key={`${a.id}-${a.division}`} className="py-2 text-center sm:flex sm:items-baseline sm:justify-between sm:gap-3 sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{awardLabel(a)}</p>
              <p className="text-sm">
                <span className={`font-semibold ${ours ? "text-accent-gold" : "text-white"}`}>{a.name}</span>
                <span className="text-gray-400"> · {a.id === "club-player" ? a.detail : `${a.clubName} · ${a.detail}`}</span>
              </p>
            </li>
          );
        })}
      </ul>
      {awards.some((a) => a.id === "man-of-steel" && a.division === "super-league" && a.clubId === userClubId) ? (
        <p className="mt-2 text-center text-sm text-accent-gold">Your Man of Steel: +{MAN_OF_STEEL_LEGACY} Legacy.</p>
      ) : null}
    </>
  );
}

function RoundHeading({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 first:mt-1">{children}</p>;
}

/** Eliminators (3v6, 4v5) → semi-finals (1st and 2nd at home) → Grand Final. Old top-four seasons: semis and final only. */
export function PlayoffBracketView({ bracket, clubs, userClubId }: { bracket: PlayoffBracket; clubs: Clubs; userClubId: string }) {
  const name = (id?: string) => (id ? clubOf(clubs, id).name : "?");
  const tbd = (text: string) => <p className="py-1.5 text-center text-[13px] text-gray-500">{text}</p>;
  return (
    <div data-testid="playoff-bracket">
      {bracket.topSix ? (
        <>
          <RoundHeading>Eliminators</RoundHeading>
          {bracket.eliminators.length ? (
            <ul className="mt-1 space-y-1">
              {bracket.eliminators.map((m, i) => (
                <TieRow key={i} m={m} clubs={clubs} userClubId={userClubId} />
              ))}
            </ul>
          ) : (
            tbd("3rd v 6th · 4th v 5th")
          )}
          {bracket.byes.length === 2 ? (
            <p className="mt-1 text-center text-[12px] leading-snug text-gray-400" data-testid="playoff-byes">
              Bye to the semis: <span className={bracket.byes[0] === userClubId ? "font-semibold text-accent-gold" : "text-gray-200"}>{name(bracket.byes[0])}</span> (1st) and{" "}
              <span className={bracket.byes[1] === userClubId ? "font-semibold text-accent-gold" : "text-gray-200"}>{name(bracket.byes[1])}</span> (2nd)
            </p>
          ) : null}
        </>
      ) : null}
      <RoundHeading>Semi-finals</RoundHeading>
      {bracket.semis.length ? (
        <ul className="mt-1 space-y-1">
          {bracket.semis.map((m, i) => (
            <TieRow key={i} m={m} clubs={clubs} userClubId={userClubId} />
          ))}
        </ul>
      ) : (
        tbd(bracket.topSix ? "1st and 2nd host the eliminator winners" : "1st v 4th · 2nd v 3rd")
      )}
      <RoundHeading>Grand Final</RoundHeading>
      {bracket.final ? (
        <ul className="mt-1">
          <TieRow m={bracket.final} clubs={clubs} userClubId={userClubId} />
        </ul>
      ) : (
        tbd("Old Trafford · to be decided")
      )}
      {bracket.final && miniWinner(bracket.final) ? (
        <p className="mt-1.5 text-center text-[13px] font-semibold text-accent-gold">{name(miniWinner(bracket.final)!)} are Super League champions.</p>
      ) : null}
    </div>
  );
}

/** Your Challenge Cup run, then the final (who won it, even if you went out early). */
export function CupView({ run, final, clubs, userClubId }: { run: MiniResult[]; final?: MiniResult; clubs: Clubs; userClubId: string }) {
  const winner = final ? miniWinner(final) : null;
  return (
    <div data-testid="cup-view">
      {run.length ? (
        <ResultsList results={run} clubs={clubs} userClubId={userClubId} label="Your Challenge Cup run" />
      ) : (
        <p className="mt-1 text-center text-[13px] text-gray-400 sm:text-left">Not in the Challenge Cup this season.</p>
      )}
      {final ? (
        <>
          <RoundHeading>Final</RoundHeading>
          <ul className="mt-1">
            <TieRow m={final} clubs={clubs} userClubId={userClubId} />
          </ul>
          {winner ? <p className="mt-1.5 text-center text-[13px] font-semibold text-accent-gold">{clubOf(clubs, winner).name} win the Challenge Cup.</p> : null}
        </>
      ) : null}
    </div>
  );
}

/** ‹ Round 12 › — steps through a list (round results, cup rounds). */
export function Stepper({ label, index, count, onChange, ariaLabel }: { label: string; index: number; count: number; onChange: (i: number) => void; ariaLabel: string }) {
  const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch-800 text-lg font-bold text-white disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label={ariaLabel}>
      <button type="button" className={btn} disabled={index <= 0} onClick={() => onChange(index - 1)} aria-label="Earlier">
        ‹
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white" aria-live="polite">{label}</p>
      <button type="button" className={btn} disabled={index >= count - 1} onClick={() => onChange(index + 1)} aria-label="Later">
        ›
      </button>
    </div>
  );
}

const DIVS: Division[] = ["super-league", "championship"];

/** The final league tables (both divisions behind a small switch), with who went up, down and won it. */
export function FinalTables({ state, story, initial }: { state: CareerState; story?: SeasonStory; initial: Division }) {
  const [division, setDivision] = useState<Division>(initial);
  const rows = sortTable(state.tables[division] ?? []);
  const tag = (id: string, i: number): { text: string; tone: string } | null => {
    if (story?.promoted.includes(id)) return { text: "Up", tone: "text-success" };
    if (story?.relegated.includes(id)) return { text: "Down", tone: "text-danger" };
    if (i === 0) return { text: division === "super-league" ? "Shield" : "Champs", tone: "text-accent-gold" };
    return null;
  };
  return (
    <div data-testid="final-tables">
      <GameSegmentedControl<Division>
        compact
        options={DIVS.map((d) => ({ id: d, label: DIVISION_LABEL[d] }))}
        value={division}
        onChange={setDivision}
        ariaLabel="Final table"
      />
      <table className="mt-2 w-full text-[13px]">
        <caption className="sr-only">{DIVISION_LABEL[division]} final table</caption>
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-gray-500">
            <th className="w-6 py-1 text-right font-semibold">#</th>
            <th className="py-1 pl-2 text-left font-semibold">Club</th>
            <th className="w-7 py-1 text-center font-semibold">W</th>
            <th className="w-7 py-1 text-center font-semibold">L</th>
            <th className="w-9 py-1 text-right font-semibold">PD</th>
            <th className="w-9 py-1 pr-1 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const club = clubOf(state.clubs, r.clubId);
            const me = r.clubId === state.userClubId;
            const t = tag(r.clubId, i);
            return (
              <tr key={r.clubId} className={me ? "bg-theme-primary/10" : ""}>
                <td className="py-1 text-right tabular-nums text-gray-400">{i + 1}</td>
                <td className="py-1 pl-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ClubBadge club={club} size="sm" />
                    <ClubName club={club} className={me ? "font-bold text-white" : "text-gray-200"} />
                    {t ? <span className={`shrink-0 text-[10px] font-bold uppercase ${t.tone}`}>{t.text}</span> : null}
                  </span>
                </td>
                <td className="py-1 text-center tabular-nums text-gray-300">{r.w}</td>
                <td className="py-1 text-center tabular-nums text-gray-300">{r.l}</td>
                <td className="py-1 text-right tabular-nums text-gray-300">{r.pf - r.pa > 0 ? "+" : ""}{r.pf - r.pa}</td>
                <td className="py-1 pr-1 text-right font-display font-bold tabular-nums text-white">{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A section of a season summary (review or past season): eyebrow and content in one card. */
export function StoryCard({ title, label, testId, children, className = "" }: { title: string; label?: string; testId?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={label ?? title} data-testid={testId} className={`rounded-card bg-pitch-900 p-4 text-left ${className}`}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </section>
  );
}

/** Your finish in one line: "Championship · 1st · 18W 1D 2L". */
export function finishLine(o: SeasonOutcome): string {
  return `${DIVISION_LABEL[o.division]} · ${ordinal(o.position)} · ${o.won}W${o.drawn ? ` ${o.drawn}D` : ""} ${o.lost}L`;
}

/** A past season, told again: your finish, who won what, awards, play-offs, the cup and your results. */
export function PastSeasonSheet({ state, outcome, onClose }: { state: CareerState; outcome: SeasonOutcome | null; onClose: () => void }) {
  const o = outcome;
  const data = o ? seasonReviewData(o, state.clubs, state.userClubId) : null;
  const trophies = o ? o.trophies.filter((t) => t !== "promotion") : [];
  return (
    <ManagerSheet list open={!!o} onClose={onClose} eyebrow={o ? `${o.year} season` : ""} title={o ? `${ordinal(o.position)} in the ${DIVISION_LABEL[o.division]}` : ""}>
      {o && data ? (
        <div className="flex flex-col gap-3" data-testid="past-season">
          <div className="text-center">
            <p className="text-sm text-gray-300">{finishLine(o)}</p>
            {o.promoted ? <p className="mt-0.5 text-[13px] font-semibold text-success">Promoted to Super League</p> : null}
            {o.relegated ? <p className="mt-0.5 text-[13px] font-semibold text-danger">Relegated to the Championship</p> : null}
            {trophies.length ? (
              <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                {trophies.map((t) => (
                  <li key={t} className="rounded-full bg-accent-gold/15 px-2 py-0.5 text-[11px] font-semibold text-accent-gold">🏆 {TROPHY_LABEL[t]}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <SubHeading>Who won what</SubHeading>
            <HonoursBoard lines={data.honours} clubs={state.clubs} userClubId={state.userClubId} />
          </div>
          {data.awards.length ? (
            <div>
              <SubHeading>Awards</SubHeading>
              <AwardsList awards={data.awards} userClubId={state.userClubId} />
            </div>
          ) : null}
          {data.bracket ? (
            <div>
              <SubHeading>Play-offs</SubHeading>
              <PlayoffBracketView bracket={data.bracket} clubs={state.clubs} userClubId={state.userClubId} />
            </div>
          ) : null}
          {data.full ? (
            <div>
              <SubHeading>Challenge Cup</SubHeading>
              <CupView run={data.cupRun} final={data.cupFinal} clubs={state.clubs} userClubId={state.userClubId} />
            </div>
          ) : null}
          {data.results.length ? (
            <details className="rounded-control bg-pitch-800/60 px-3 py-2">
              <summary className="cursor-pointer text-center text-sm font-semibold text-white">
                Your results · {recordLine(data.results, state.userClubId)}
              </summary>
              <ResultsList results={data.results} clubs={state.clubs} userClubId={state.userClubId} />
            </details>
          ) : null}
          {!data.full ? <p className="text-center text-[12px] text-gray-500">Full results, play-offs and cup weren&apos;t kept for this season.</p> : null}
        </div>
      ) : null}
    </ManagerSheet>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs font-semibold text-theme-primary sm:text-left">{children}</p>;
}
