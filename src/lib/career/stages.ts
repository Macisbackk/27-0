/**
 * The season, one stage at a time.
 *
 * The Match tab shows exactly one thing to do: pick friendlies, then the pre-season results,
 * then each round in turn, Deadline Day on its own, the end-of-league picture, the play-offs
 * and Million Pound Game, who goes up and down, then the Grand Final. The stages with nothing
 * to play are "seen" once the user moves on, stored per year in `stagesSeen`.
 */
import { boardTargetForRank, boardTargetLabel } from "./board";
import { deadlineDecisionPending, windowBounds } from "./midseason";
import { preseasonOpen } from "./preseason";
import { expectedRanking, playMatchday, sortTable, userFixture, winnerOf } from "./season";
import type { CareerState, Division, Fixture, Matchday } from "./types";

export type StageKey = "preseason" | "league-over" | "promotion";

export type MatchStage =
  | "preseason"
  | "preseason-done"
  | "deadline"
  | "league-over"
  | "promotion"
  | "fixture";

export function stageSeen(state: CareerState, key: StageKey): boolean {
  return (state.stagesSeen ?? []).includes(`${state.year}:${key}`);
}

export function markStageSeen(state: CareerState, key: StageKey): CareerState {
  const tag = `${state.year}:${key}`;
  if ((state.stagesSeen ?? []).includes(tag)) return state;
  // Keep the list short: only this year and last year matter.
  const keep = (state.stagesSeen ?? []).filter((t) => Number(t.split(":")[0]) >= state.year - 1);
  return { ...state, stagesSeen: [...keep, tag], updatedAt: Date.now() };
}

function isPlayoffMatchday(md: Matchday | undefined): boolean {
  if (!md) return false;
  return md.pendingDraw === "playoff-semis" || md.fixtures.some((f) => f.kind === "semi" || f.kind === "mpg");
}

function isGrandFinalMatchday(md: Matchday | undefined): boolean {
  if (!md) return false;
  return md.pendingDraw === "grand-final" || md.fixtures.some((f) => f.kind === "grand-final");
}

export function currentStage(state: CareerState): MatchStage {
  if (state.phase !== "season") return "fixture";
  if (preseasonOpen(state)) return "preseason";
  const pre = state.preseason;
  if (
    state.matchdayIndex === 0 &&
    pre?.year === state.year &&
    pre.done &&
    pre.results.length > 0 &&
    !stageSeen(state, "preseason")
  ) {
    return "preseason-done";
  }
  if (deadlineDecisionPending(state)) return "deadline";
  const md = state.calendar[state.matchdayIndex];
  if (isPlayoffMatchday(md) && !stageSeen(state, "league-over")) return "league-over";
  if (isGrandFinalMatchday(md) && !stageSeen(state, "promotion")) return "promotion";
  return "fixture";
}

export interface LeagueOverPicture {
  division: Division;
  position: number;
  size: number;
  /** The user's next game (play-off semi or Million Pound Game), if any. */
  next?: Fixture;
  /** What the final position means, in one line. */
  verdict: string;
}

/** How the user's league finished, shown before the play-offs. */
export function leagueOverPicture(state: CareerState): LeagueOverPicture {
  const division = state.clubs[state.userClubId]!.division;
  const table = sortTable(state.tables[division]);
  const position = table.findIndex((r) => r.clubId === state.userClubId) + 1;
  const md = state.calendar[state.matchdayIndex];
  const next = userFixture(md, state.userClubId);
  let verdict: string;
  if (division === "championship") {
    verdict =
      position === 1
        ? "Champions. Promoted to Super League."
        : position === 2
          ? "Runners-up. Win the Million Pound Game to go up."
          : "Not enough to go up this time. Your season is over.";
  } else {
    verdict =
      position <= 4
        ? `Into the play-offs. A semi-final for a place at Old Trafford.`
        : position === table.length
          ? "Bottom of the table. Relegated to the Championship."
          : position === table.length - 1
            ? "Second-bottom. Win the Million Pound Game to stay up."
            : "Out of the top four. Safe, but the play-offs go on without you.";
  }
  return { division, position, size: table.length, next, verdict };
}

export interface PromotionPicture {
  up: string[];
  down: string[];
  /** The Million Pound Game, once played. */
  mpg?: Fixture;
}

/** Who goes up and who goes down (mirrors finishSeason). Shown before the Grand Final. */
export function promotionPicture(state: CareerState): PromotionPicture {
  const sl = sortTable(state.tables["super-league"]);
  const ch = sortTable(state.tables.championship);
  const up = new Set<string>(ch[0] ? [ch[0].clubId] : []);
  const down = new Set<string>(sl.length ? [sl[sl.length - 1]!.clubId] : []);
  const mpg = state.calendar
    .slice(0, state.matchdayIndex)
    .flatMap((m) => m.fixtures)
    .find((f) => f.kind === "mpg" && f.result);
  if (mpg && winnerOf(mpg) === mpg.away) {
    up.add(mpg.away);
    down.add(mpg.home);
  }
  return { up: [...up], down: [...down], mpg };
}

/* ------------------------------------------------------------- the season loop */

/** True when the hub has something for the manager: a game of theirs, a stage, or the season's end. */
function needsManager(state: CareerState): boolean {
  if (state.phase !== "season") return true;
  if (currentStage(state) !== "fixture") return true;
  const md = state.calendar[state.matchdayIndex];
  if (!md) return true;
  return !!userFixture(md, state.userClubId) || !!md.pendingDraw;
}

/**
 * Plays on through weeks with no game for the manager (knocked out of the cup, a Championship
 * club in a play-off week…), so a tap never lands on "No game this week". Stops at the next game,
 * stage or the end of the season. Same results as tapping Continue through each week.
 */
export function skipIdleWeeks(state: CareerState): CareerState {
  let s = state;
  let guard = 0;
  while (!needsManager(s) && guard++ < 60) {
    const next = playMatchday(s);
    if (next === s || next.matchdayIndex === s.matchdayIndex) break;
    s = next;
  }
  return s;
}

/** A sim stops here: a stage, a knockout tie of the manager's, or the end of the season. */
function isStop(state: CareerState): boolean {
  if (state.phase !== "season") return true;
  if (currentStage(state) !== "fixture") return true;
  const f = userFixture(state.calendar[state.matchdayIndex], state.userClubId);
  return !!f && f.kind !== "league";
}

/**
 * "Sim to the next decision": plays this week, then every week after it until Deadline Day, a cup
 * or play-off tie of yours, the end of the league, the promotion picture or the season's end.
 * Every week is the same quick sim as tapping Quick sim through them one by one.
 */
export function simToNextStop(state: CareerState): CareerState {
  if (state.phase !== "season" || currentStage(state) !== "fixture") return state;
  let s = playMatchday(state);
  let guard = 0;
  while (!isStop(s) && guard++ < 60) {
    const next = playMatchday(s);
    if (next === s || next.matchdayIndex === s.matchdayIndex) break;
    s = next;
  }
  return s;
}

/** Still in this year's Challenge Cup with a tie to come (round drawn later). */
function aliveInCup(state: CareerState): boolean {
  const mine = state.calendar
    .flatMap((m) => m.fixtures)
    .filter((f) => f.kind === "cup" && (f.home === state.userClubId || f.away === state.userClubId));
  const last = mine[mine.length - 1];
  if (!last) return false;
  if (!last.result) return true;
  return winnerOf(last) === state.userClubId && last.round < 5;
}

export interface NextStop {
  /** Games of yours that a sim to the stop would play (this week's included). */
  games: number;
  /** What it stops for: "Deadline Day", "Challenge Cup Round 1", "the end of the league". */
  label: string;
}

/**
 * Where "Sim to …" would stop, worked out from the calendar without playing anything. Null when
 * the next stop is this week's game or the end of the season is the only thing left.
 */
export function nextStop(state: CareerState): NextStop | null {
  if (state.phase !== "season" || currentStage(state) !== "fixture") return null;
  const deadline = windowBounds(state)?.deadline ?? -1;
  const deadlineDone = state.deadlineClosedYear === state.year;
  const alive = aliveInCup(state);
  let games = 0;
  for (let i = state.matchdayIndex; i < state.calendar.length; i++) {
    const md = state.calendar[i]!;
    if (i > state.matchdayIndex) {
      if (i === deadline && !deadlineDone) return { games, label: "Deadline Day" };
      if (isPlayoffMatchday(md)) return { games, label: "the end of the league" };
      if (isGrandFinalMatchday(md)) return { games, label: "the Grand Final" };
      const f = userFixture(md, state.userClubId);
      if (f && f.kind !== "league") return { games, label: md.label };
      if (alive && md.pendingDraw?.startsWith("cup-")) return { games, label: md.label };
    }
    if (userFixture(md, state.userClubId)) games++;
  }
  return games > 1 ? { games, label: "the end of the season" } : null;
}

/* ------------------------------------------------------------- goals and progress */

export interface BoardGoal {
  target: number;
  label: string;
  position: number;
  size: number;
  /** League games played so far. */
  played: number;
  /** On course to meet it (or met, once the league is over). */
  onTrack: boolean;
}

/** The board's target for this season and how you're doing against it. */
export function boardGoal(state: CareerState): BoardGoal {
  const division = state.clubs[state.userClubId]!.division;
  const table = sortTable(state.tables[division] ?? []);
  const size = table.length || 1;
  const idx = table.findIndex((r) => r.clubId === state.userClubId);
  const position = idx + 1 || size;
  const row = table[idx];
  let target = state.board?.year === state.year ? state.board.target : 0;
  if (!target) {
    // Saves from before the board set targets: work it out from the squads as they are now.
    const ranking = expectedRanking(state, division);
    target = boardTargetForRank(division, ranking.indexOf(state.userClubId) + 1, ranking.length);
  }
  return {
    target,
    label: boardTargetLabel(division, target, size),
    position,
    size,
    played: row?.p ?? 0,
    onTrack: position <= target,
  };
}

export interface SeasonProgress {
  /** "Round 12 of 27", "Challenge Cup Final", "Play-off semi-final"… */
  label: string;
  /** League rounds played and in total (for a progress bar). */
  done: number;
  total: number;
}

/** Where the season is, in one line. */
export function seasonProgress(state: CareerState): SeasonProgress {
  const rounds = state.calendar.filter((m) => m.label.startsWith("Round "));
  const total = rounds.length;
  const done = rounds.filter((m) => m.played).length;
  const md = state.calendar[state.matchdayIndex];
  let label: string;
  if (!md) label = "Season complete";
  else if (md.label.startsWith("Round ")) label = `${md.label} of ${total}`;
  else if (isPlayoffMatchday(md)) label = "Play-offs";
  else label = md.label;
  return { label, done, total };
}

/** The current run of results in all competitions: 3 wins in a row, 2 defeats in a row… */
export function userStreak(state: CareerState): { kind: "W" | "L" | "D"; length: number } | null {
  let kind: "W" | "L" | "D" | null = null;
  let length = 0;
  for (let i = state.matchdayIndex - 1; i >= 0; i--) {
    const f = userFixture(state.calendar[i], state.userClubId);
    if (!f?.result) continue;
    const isHome = f.home === state.userClubId;
    const us = isHome ? f.result.homeScore : f.result.awayScore;
    const them = isHome ? f.result.awayScore : f.result.homeScore;
    const k = us > them ? "W" : us < them ? "L" : "D";
    if (kind === null) kind = k;
    if (k !== kind) break;
    length++;
  }
  return kind ? { kind, length } : null;
}
