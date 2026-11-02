"use client";

import { useMemo, useState } from "react";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  DIVISION_LABEL,
  MAGIC_ROUND,
  buildSeasonStory,
  cupRounds,
  leagueFinished,
  miniWinner,
  playedRounds,
  playoffBracket,
  sortTable,
  userFixture,
  winnerOf,
  type CareerState,
  type Division,
} from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { Card, ClubBadge, Eyebrow, FixtureTags, FormDots } from "./bits";
import { ClubLink } from "./ClubSheet";
import { CupView, PlayoffBracketView, ResultsList, Stepper, TieRow, recordLine } from "./SeasonStory";

/** The Table tab in four short views (v1.58): the table, your results (and any round's scores), your fixtures, the cup. */
type TableView = "table" | "results" | "fixtures" | "cup";
const TABLE_VIEWS: Array<{ id: TableView; label: string }> = [
  // "League", not "Table": the hub's own tab is called Table.
  { id: "table", label: "League" },
  { id: "results", label: "Results" },
  { id: "fixtures", label: "Fixtures" },
  { id: "cup", label: "Cup" },
];
/** Remembered while the hub is open. */
let lastTableView: TableView = "table";

/** The live play-off bracket, once the league is over (Match tab and the Table view). */
export function PlayoffsCard({ state }: { state: CareerState }) {
  const story = useMemo(() => buildSeasonStory(state), [state]);
  if (state.phase !== "season" || !leagueFinished(state)) return null;
  const bracket = playoffBracket(story, state.calendar);
  return (
    <Card>
      <section aria-label="Play-offs" data-testid="live-playoffs">
        <Eyebrow>Super League play-offs</Eyebrow>
        <PlayoffBracketView bracket={bracket} clubs={state.clubs} userClubId={state.userClubId} />
      </section>
    </Card>
  );
}

/** Your results this season (newest first), then every score of any played round. */
function ResultsView({ state }: { state: CareerState }) {
  const s = state;
  const story = useMemo(() => buildSeasonStory(s), [s]);
  const results = story.mine.filter((m) => m.hs != null).reverse();
  const rounds = useMemo(() => playedRounds(s), [s]);
  const [pick, setPick] = useState<number | null>(null);
  const i = pick == null || pick >= rounds.length ? rounds.length - 1 : pick;
  const round = rounds[i];
  return (
    <>
      <Card>
        <section aria-label="Your results" data-testid="table-results">
          <Eyebrow>Your results{results.length ? ` · ${recordLine(results, s.userClubId)}` : ""}</Eyebrow>
          {results.length ? (
            <ResultsList results={results} clubs={s.clubs} userClubId={s.userClubId} />
          ) : (
            <p className="mt-2 text-center text-sm text-gray-400 sm:text-left">No games played yet.</p>
          )}
        </section>
      </Card>
      {round ? (
        <Card>
          <section aria-label="Round results" data-testid="round-results">
            <Eyebrow>Round results</Eyebrow>
            <div className="mt-2">
              <Stepper label={round.label} index={i} count={rounds.length} onChange={setPick} ariaLabel="Pick a round" />
            </div>
            <ul className="mt-2 space-y-1">
              {round.games.map((m, k) => (
                <TieRow key={k} m={m} clubs={s.clubs} userClubId={s.userClubId} />
              ))}
            </ul>
          </section>
        </Card>
      ) : null}
    </>
  );
}

/** The Challenge Cup: where you are, your run, then every tie of any round drawn so far. */
function CupTab({ state, cupLine }: { state: CareerState; cupLine: string }) {
  const s = state;
  const rounds = useMemo(() => cupRounds(s), [s]);
  const story = useMemo(() => buildSeasonStory(s), [s]);
  const run = story.mine.filter((m) => m.k === "cup");
  const final = story.cup.find((m) => m.r === 5);
  const [pick, setPick] = useState<number | null>(null);
  const i = pick == null || pick >= rounds.length ? rounds.length - 1 : pick;
  const round = rounds[i];
  return (
    <>
      <Card>
        <section aria-label="Challenge Cup" data-testid="table-cup">
          <Eyebrow>Challenge Cup</Eyebrow>
          <p className="mt-1 text-center text-sm text-gray-300 sm:text-left">{cupLine}</p>
          {run.length || (final && miniWinner(final)) ? (
            <div className="mt-2">
              <CupView run={run} final={final && miniWinner(final) ? final : undefined} clubs={s.clubs} userClubId={s.userClubId} />
            </div>
          ) : null}
        </section>
      </Card>
      {round ? (
        <Card>
          <section aria-label="Cup draw" data-testid="cup-draw">
            <Eyebrow>The draw</Eyebrow>
            <div className="mt-2">
              <Stepper label={round.label.replace("Challenge Cup ", "")} index={i} count={rounds.length} onChange={setPick} ariaLabel="Pick a cup round" />
            </div>
            <ul className="mt-2 space-y-1">
              {round.ties.map((m, k) => (
                <TieRow key={k} m={m} clubs={s.clubs} userClubId={s.userClubId} />
              ))}
            </ul>
          </section>
        </Card>
      ) : null}
    </>
  );
}

function zone(division: Division, pos: number, size: number): { tone: string; label: string } | null {
  if (division === "super-league") {
    if (pos <= 2) return { tone: "border-l-theme-primary", label: "Play-offs · bye" };
    if (pos <= 6) return { tone: "border-l-theme-primary", label: "Play-offs" };
    if (pos === size - 1) return { tone: "border-l-accent-gold", label: "Million Pound Game" };
    if (pos === size) return { tone: "border-l-danger", label: "Relegation" };
    return null;
  }
  if (pos === 1) return { tone: "border-l-theme-primary", label: "Promotion" };
  if (pos === 2) return { tone: "border-l-accent-gold", label: "Million Pound Game" };
  return null;
}

export function TableTab() {
  const { state } = useCareer();
  const s = state!;
  const mine = s.clubs[s.userClubId]!.division;
  const [division, setDivision] = useState<Division>(mine);
  const [view, setViewState] = useState<TableView>(lastTableView);
  const setView = (v: TableView) => {
    lastTableView = v;
    setViewState(v);
  };
  const rows = sortTable(s.tables[division]);

  // Cup status line
  const cupFixtures = s.calendar.flatMap((m) => m.fixtures).filter((f) => f.kind === "cup" && (f.home === s.userClubId || f.away === s.userClubId));
  const lastCup = cupFixtures[cupFixtures.length - 1];
  let cupLine = "Challenge Cup Round 1 comes after Round 4.";
  if (lastCup?.result) {
    const won = winnerOf(lastCup) === s.userClubId;
    cupLine = won
      ? lastCup.round === 5
        ? "Challenge Cup winners! 🏆"
        : `Through the ${lastCup.label.replace("Challenge Cup ", "")}.`
      : `Knocked out in the ${lastCup.label.replace("Challenge Cup ", "")}.`;
  } else if (lastCup) {
    cupLine = `Next: ${lastCup.label}.`;
  } else if (s.matchdayIndex > 5) {
    cupLine = "Not in this year's Challenge Cup.";
  }

  // Your next few games, with Magic Weekend and derbies marked.
  const upcoming = s.calendar
    .slice(s.matchdayIndex)
    .map((md) => userFixture(md, s.userClubId))
    .filter((f): f is NonNullable<typeof f> => !!f && !f.result);
  // Knockout rounds still to be drawn while you're alive in them.
  const cupAlive = !lastCup || (!lastCup.result ? true : winnerOf(lastCup) === s.userClubId && lastCup.round < 5);
  const toDraw = s.calendar
    .slice(s.matchdayIndex)
    .filter((md) => md.pendingDraw && (md.pendingDraw.startsWith("cup-") ? cupAlive && !!lastCup : false))
    .map((md) => md.label);

  return (
    <div className="flex flex-col gap-4">
      <GameSegmentedControl<TableView> options={TABLE_VIEWS} value={view} onChange={setView} fullWidth ariaLabel="Table sections" />
      {view === "results" ? <ResultsView state={s} /> : null}
      {view === "cup" ? <CupTab state={s} cupLine={cupLine} /> : null}
      {view === "table" ? (
      <>
      <PlayoffsCard state={s} />
      <GameSegmentedControl<Division>
        options={[
          { id: "super-league", label: DIVISION_LABEL["super-league"] },
          { id: "championship", label: DIVISION_LABEL.championship },
        ]}
        value={division}
        onChange={setDivision}
        ariaLabel="League table"
      />
      <Card className="px-2 sm:px-4">
        <table className="w-full text-sm">
          <caption className="sr-only">{DIVISION_LABEL[division]} table</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-500">
              <th className="w-7 py-1 text-right font-semibold">#</th>
              <th className="py-1 pl-2 text-left font-semibold">Club</th>
              <th className="w-7 py-1 text-center font-semibold">P</th>
              <th className="w-7 py-1 text-center font-semibold">W</th>
              <th className="w-7 py-1 text-center font-semibold">L</th>
              <th className="w-10 py-1 text-right font-semibold">PD</th>
              <th className="w-10 py-1 pr-2 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const club = s.clubs[r.clubId]!;
              const me = r.clubId === s.userClubId;
              const z = zone(division, i + 1, rows.length);
              return (
                <tr
                  key={r.clubId}
                  className={`border-l-2 ${z ? z.tone : "border-l-transparent"} ${me ? "bg-theme-primary/10" : ""}`}
                  title={z?.label}
                >
                  <td className="py-1.5 text-right tabular-nums text-gray-400">{i + 1}</td>
                  <td className="py-1.5 pl-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <ClubBadge club={club} size="sm" />
                      <ClubLink clubId={club.id} className={`truncate ${me ? "font-bold text-white" : "text-gray-200"}`}>
                        <span className="sm:hidden">{club.short}</span>
                        <span className="hidden sm:inline">{club.name}</span>
                      </ClubLink>
                      <span className="hidden sm:inline-flex"><FormDots form={r.form} /></span>
                    </span>
                  </td>
                  <td className="py-1.5 text-center tabular-nums text-gray-300">{r.p}</td>
                  <td className="py-1.5 text-center tabular-nums text-gray-300">{r.w}</td>
                  <td className="py-1.5 text-center tabular-nums text-gray-300">{r.l}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-300">{r.pf - r.pa > 0 ? "+" : ""}{r.pf - r.pa}</td>
                  <td className="py-1.5 pr-2 text-right font-display font-bold tabular-nums text-white">{r.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 px-2 text-[11px] text-gray-400">Tap a club to see their last team sheet and transfers.</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] text-gray-400">
          {division === "super-league" ? (
            <>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-theme-primary" />Play-offs</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent-gold" />Million Pound Game</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-danger" />Relegated</span>
            </>
          ) : (
            <>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-theme-primary" />Promoted</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent-gold" />Million Pound Game</span>
            </>
          )}
        </p>
      </Card>
      </>
      ) : null}
      {view === "fixtures" ? (
      <>
      {upcoming.length ? (
        <Card>
          <Eyebrow>Your next games</Eyebrow>
          <ul className="mt-2 divide-y divide-pitch-800" aria-label="Your next games">
            {upcoming.map((f) => {
              const home = f.home === s.userClubId;
              const opp = s.clubs[home ? f.away : f.home]!;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
                  <span className="w-16 shrink-0 text-[11px] text-gray-500">{f.kind === "league" ? `Round ${f.round}` : f.label.replace("Challenge Cup ", "Cup ")}</span>
                  <ClubBadge club={opp} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-gray-200">
                    {home ? "v" : "at"} {opp.name}
                  </span>
                  <FixtureTags state={s} fixture={f} />
                </li>
              );
            })}
          </ul>
          {toDraw.length ? <p className="mt-2 text-center text-[12px] text-gray-400 sm:text-left">Still to be drawn: {toDraw.join(", ").replace(/Challenge Cup /g, "Cup ")}.</p> : null}
          <p className="mt-2 text-center text-[11px] text-gray-400 sm:text-left">Round {MAGIC_ROUND} is Magic Weekend: neutral venue for every game.</p>
        </Card>
      ) : (
        <Card>
          <Eyebrow>Your next games</Eyebrow>
          <p className="mt-2 text-center text-sm text-gray-400 sm:text-left">
            {toDraw.length ? `Next: ${toDraw[0]!.replace("Challenge Cup ", "Cup ")} (draw to come).` : "No more games for you this season."}
          </p>
        </Card>
      )}
      <Card>
        <Eyebrow>Challenge Cup</Eyebrow>
        <p className="mt-1 text-center text-sm text-gray-300 sm:text-left">{cupLine}</p>
      </Card>
      </>
      ) : null}
    </div>
  );
}
