/**
 * Club objectives, board confidence and supporter mood (v1.66).
 *
 * - Objectives: two board asks on top of the league target (a cup run or a derby win, plus giving
 *   the kids games or finishing in the black). Set when the season starts, judged when it ends.
 * - Board confidence (0–100): moved by results and judged on the target and objectives at the end.
 *   Very low confidence brings a warning pop-up (no sacking).
 * - Supporter mood (0–100): moved by results, derbies, cup runs, big signings and selling favourites.
 * Both nudge the season's income a little (gates and the board's backing): about +12% at best, −18% at worst.
 */
import { rngFor, shuffle } from "./rng";
import { rivalsOf } from "./rivals";
import type { CareerState, ClubObjective, Fixture, SeasonDeal, TransferDeal } from "./types";

export const MOOD_START = 60;
/** Below this the board sends a warning (once a season). */
export const BOARD_WARNING = 25;
/** Below this the supporters let you know (once a season). */
export const FANS_WARNING = 20;
/** Age limit for the "play the kids" objective. */
export const YOUTH_AGE = 21;
const YOUTH_GAMES = 5;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export function fansOf(state: Pick<CareerState, "fans">): number {
  return Number.isFinite(state.fans) ? state.fans! : MOOD_START;
}
export function boardOf(state: Pick<CareerState, "boardConfidence">): number {
  return Number.isFinite(state.boardConfidence) ? state.boardConfidence! : MOOD_START;
}

/** Income multiplier from the supporters (gates, merchandise) and the board's backing. */
export function moodIncomeFactor(state: Pick<CareerState, "fans" | "boardConfidence">): number {
  return 1 + (fansOf(state) - MOOD_START) / 500 + (boardOf(state) - MOOD_START) / 1000;
}

export function moodWord(v: number): string {
  return v >= 80 ? "Delighted" : v >= 65 ? "Happy" : v >= 45 ? "Content" : v >= 30 ? "Uneasy" : v >= 15 ? "Angry" : "Furious";
}

/* -------------------------------------------------------------- objectives */

const CUP_LABEL = ["", "Round 1", "the Round of 16", "the quarter-finals", "the semi-finals", "the Final", "win the Cup"];

/** The season's objectives (in place, at season start). `expectedShare`: 1 = favourites … 0 = expected bottom. */
export function setObjectives(state: CareerState, expectedShare: number): void {
  const rng = rngFor(state.seed, state.year, "objectives");
  const club = state.clubs[state.userClubId]!;
  const list: ClubObjective[] = [];
  const id = (k: string) => `${state.year}-obj-${k}`;
  if (club.division !== "nrl") {
    const target = expectedShare >= 0.7 ? 4 : expectedShare >= 0.35 ? 3 : 2;
    list.push({ id: id("cup"), kind: "cup-run", title: target === 2 ? "Win a Challenge Cup tie" : `Reach the Challenge Cup ${CUP_LABEL[target]}`, target, progress: 0, done: false });
  } else if (rivalsOf(Object.keys(state.clubs), club.id).length) {
    list.push({ id: id("derby"), kind: "derbies", title: "Win a derby", target: 1, progress: 0, done: false });
  } else {
    list.push({ id: id("finals"), kind: "finals", title: "Win a finals game", target: 1, progress: 0, done: false });
  }
  const young = club.squad.filter((pid) => (state.players[pid]?.age ?? 99) <= YOUTH_AGE).length;
  const second = shuffle(rng, ["play-youth", "budget"] as const).find((k) => k !== "play-youth" || young >= 2) ?? "budget";
  if (second === "play-youth") {
    const target = Math.min(3, young);
    list.push({ id: id("youth"), kind: "play-youth", title: `Give ${target} players aged ${YOUTH_AGE} or under ${YOUTH_GAMES}+ games`, target, progress: 0, done: false });
  } else {
    list.push({ id: id("budget"), kind: "budget", title: "Finish the season in the black", target: 0, progress: 0, done: false });
  }
  state.objectives = { year: state.year, list };
}

/** This season's objectives with progress worked out from the save as it is now. */
export function currentObjectives(state: CareerState): ClubObjective[] {
  if (state.objectives?.year !== state.year) return [];
  const club = state.clubs[state.userClubId];
  return state.objectives.list.map((o) => {
    let progress = o.progress;
    switch (o.kind) {
      case "cup-run":
        progress = state.seasonTrack.cupRoundReached;
        break;
      case "derbies":
        progress = state.seasonTrack.derbies?.w ?? 0;
        break;
      case "play-youth":
        progress = (club?.squad ?? []).filter((pid) => {
          const p = state.players[pid];
          return p && p.age <= YOUTH_AGE && p.apps >= YOUTH_GAMES;
        }).length;
        break;
      case "budget":
        progress = state.budget;
        break;
      case "finals":
        break;
    }
    const done = o.done || (o.kind === "budget" ? false : progress >= o.target);
    return { ...o, progress, done };
  });
}

/** "2 / 3", "On track", "In the red"… */
export function objectiveStatus(o: ClubObjective, seasonOver = false): string {
  if (o.kind === "budget") return o.done ? "Done" : seasonOver ? "Missed" : o.progress >= 0 ? "On track" : "In the red";
  if (o.done) return "Done";
  if (o.target <= 1) return seasonOver ? "Missed" : "Not yet";
  return `${Math.min(o.progress, o.target)} / ${o.target}`;
}

/** A finals win for the "Win a finals game" objective (NRL clubs without a rival). */
export function noteFinalsWin(state: CareerState): void {
  const o = state.objectives?.year === state.year ? state.objectives.list.find((x) => x.kind === "finals") : undefined;
  if (o) o.progress++;
}

/* ------------------------------------------------------------- after a game */

/** Fans and board after one of the user's games (in place). */
export function moodAfterGame(state: CareerState, f: Fixture, us: number, them: number, derby: boolean): void {
  const won = us > them;
  const drew = us === them;
  const margin = us - them;
  let fans = fansOf(state);
  let board = boardOf(state);
  const knockout = f.kind !== "league";
  // Slowly back towards contentment, so one bad month isn't for ever.
  fans += (55 - fans) * 0.03;
  board += (55 - board) * 0.02;
  if (won) {
    fans += 2 + (margin >= 20 ? 1 : 0) + (derby ? 4 : 0) + (knockout ? 2 : 0);
    board += 1.5 + (knockout ? 1 : 0);
  } else if (drew) {
    fans += derby ? -1 : 0;
  } else {
    fans -= 2.5 + (margin <= -30 ? 1.5 : 0) + (derby ? 3 : 0) + (knockout ? 1 : 0);
    board -= 1.5 + (margin <= -30 ? 1 : 0);
  }
  state.fans = clamp(fans);
  state.boardConfidence = clamp(board);
  moodWarnings(state);
}

/** The board's warning and the fans' anger: a pop-up each, once a season. */
export function moodWarnings(state: CareerState): void {
  const events = (state.events ??= []);
  const push = (e: (typeof events)[number]) => {
    if (!events.some((x) => x.id === e.id)) events.push(e);
  };
  if (boardOf(state) < BOARD_WARNING) {
    push({
      id: `board-warning:${state.year}`,
      kind: "board-warning",
      year: state.year,
      clubId: state.userClubId,
      title: "The board are worried",
      text: `Board confidence is down to ${Math.round(boardOf(state))}. They want results, and the objectives met. Turn it around.`,
      options: [{ id: "ok", label: "I'll fix it" }],
    });
  }
  if (fansOf(state) < FANS_WARNING) {
    push({
      id: `fans:${state.year}`,
      kind: "fans",
      year: state.year,
      clubId: state.userClubId,
      title: "The fans are restless",
      text: `Supporter mood is ${Math.round(fansOf(state))}. Gates are falling. Wins, a derby or a big signing would win them back.`,
      options: [{ id: "ok", label: "OK" }],
    });
  }
}

/* --------------------------------------------------------------- transfers */

/** A favourite: long service, an academy lad, the captain or one of the best three. */
function isFavourite(state: CareerState, playerId: string): boolean {
  const p = state.players[playerId];
  if (!p) return false;
  if (p.academy || state.captainId === playerId) return true;
  if ((p.clubTotals?.[state.userClubId]?.apps ?? 0) >= 50) return true;
  const squad = (state.clubs[state.userClubId]?.squad ?? []).map((id) => state.players[id]?.rating ?? 0).sort((a, b) => b - a);
  return p.rating >= (squad[2] ?? 999);
}

function squadAverage(state: CareerState): number {
  const top = (state.clubs[state.userClubId]?.squad ?? []).map((id) => state.players[id]?.rating ?? 0).sort((a, b) => b - a).slice(0, 17);
  return top.length ? top.reduce((s, r) => s + r, 0) / top.length : 70;
}

/** A user deal: kept on this season's record, and the fans have their say (in place). */
export function noteUserDeal(state: CareerState, d: TransferDeal): void {
  const me = state.userClubId;
  if (d.to !== me && d.from !== me) return;
  const book = state.seasonDeals?.year === state.year ? state.seasonDeals : (state.seasonDeals = { year: state.year, ins: [], outs: [] });
  const into = d.to === me;
  const entry: SeasonDeal = { name: d.playerName, pos: d.pos, rating: d.rating, club: into ? d.from : d.to, fee: d.fee };
  (into ? book.ins : book.outs).push(entry);
  if (book.ins.length > 30) book.ins = book.ins.slice(-30);
  if (book.outs.length > 30) book.outs = book.outs.slice(-30);
  let fans = fansOf(state);
  if (into) {
    const avg = squadAverage(state);
    if (state.players[d.playerId]?.legend || d.rating >= avg + 3) fans += 4;
    else if (d.rating >= avg) fans += 1;
  } else if (isFavourite(state, d.playerId)) fans -= 6;
  else if (d.fee > 0) fans -= 0.5;
  state.fans = clamp(fans);
}

/* -------------------------------------------------------------- season end */

export interface SeasonVerdict {
  objectives: Array<{ title: string; done: boolean }>;
  board: number;
  fans: number;
}

/**
 * The season's verdict (in place): objectives settled, the board judges the league target and
 * the objectives, trophies please everyone.
 */
export function settleSeasonMood(state: CareerState, o: { position: number; target?: number; trophies: number; promoted: boolean; relegated: boolean }): SeasonVerdict {
  const objectives = currentObjectives(state).map((x) => (x.kind === "budget" ? { ...x, done: state.budget >= 0 } : x));
  if (state.objectives?.year === state.year) state.objectives.list = objectives;
  let board = boardOf(state);
  let fans = fansOf(state);
  if (o.target) {
    if (o.position <= o.target) board += 12 + Math.min(6, (o.target - o.position) * 2);
    else board -= Math.min(20, 5 + (o.position - o.target) * 3);
  }
  for (const x of objectives) board += x.done ? 5 : -4;
  board += o.trophies * 8;
  fans += o.trophies * 6;
  if (o.promoted) {
    board += 10;
    fans += 10;
  }
  if (o.relegated) {
    board -= 15;
    fans -= 12;
  }
  state.boardConfidence = clamp(board);
  state.fans = clamp(fans);
  moodWarnings(state);
  return { objectives: objectives.map((x) => ({ title: x.title, done: x.done })), board: state.boardConfidence, fans: state.fans };
}

/** A new season: last year's feelings carry over, a little softened (in place). */
export function newSeasonMood(state: CareerState): void {
  if (!Number.isFinite(state.fans) && !Number.isFinite(state.boardConfidence)) {
    state.fans = MOOD_START;
    state.boardConfidence = MOOD_START;
    return;
  }
  state.fans = clamp(55 + (fansOf(state) - 55) * 0.8);
  state.boardConfidence = clamp(55 + (boardOf(state) - 55) * 0.7);
}
