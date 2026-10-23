/**
 * The season, one stage at a time.
 *
 * The Match tab shows exactly one thing to do: pick friendlies, then the pre-season results,
 * then each round in turn, Deadline Day on its own, the end-of-league picture, the play-offs
 * and Million Pound Game, who goes up and down, then the Grand Final. The stages with nothing
 * to play are "seen" once the user moves on, stored per year in `stagesSeen`.
 */
import { deadlineDecisionPending } from "./midseason";
import { preseasonOpen } from "./preseason";
import { sortTable, userFixture, winnerOf } from "./season";
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
          ? "Runners-up. The Million Pound Game is next, for a place in Super League."
          : "Not enough to go up this time. Your season is over.";
  } else {
    verdict =
      position <= 4
        ? `Into the play-offs. A semi-final for a place at Old Trafford.`
        : position === table.length
          ? "Bottom of the table. Relegated to the Championship."
          : position === table.length - 1
            ? "Second-bottom. The Million Pound Game decides your Super League place."
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
