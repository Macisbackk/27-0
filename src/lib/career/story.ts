/**
 * The season's story: who won what, the play-off bracket, the Challenge Cup and every result of
 * the user's. Built from the calendar and tables (live during the season, final at the end), and
 * kept on each history entry (club ids and scores only) so past seasons can be told again.
 */
import { DIVISION_LABEL } from "./clubs";
import { CUP_ROUND_LABELS } from "./schedule";
import { awardLabel } from "./awards";
import { sortTable, winnerOf } from "./season";
import type { CareerState, Division, Fixture, Matchday, MiniResult, SeasonAward, SeasonOutcome, SeasonStory, TrophyId } from "./types";

type ClubNames = Record<string, { name: string; short: string } | undefined>;

export function toMini(f: Fixture): MiniResult {
  const m: MiniResult = { k: f.kind, r: f.round, h: f.home, a: f.away };
  if (f.result) {
    m.hs = f.result.homeScore;
    m.as = f.result.awayScore;
    if (f.result.goldenPoint) m.gp = 1;
  }
  return m;
}

export function miniPlayed(m: MiniResult): boolean {
  return m.hs != null && m.as != null;
}

export function miniWinner(m: MiniResult): string | null {
  if (!miniPlayed(m)) return null;
  return m.hs! > m.as! ? m.h : m.as! > m.hs! ? m.a : null;
}

export function miniLoser(m: MiniResult): string | null {
  const w = miniWinner(m);
  return w ? (w === m.h ? m.a : m.h) : null;
}

/** "Round 12", "Cup quarter-final", "Play-off semi-final", "Grand Final"… */
export function miniLabel(m: Pick<MiniResult, "k" | "r">, short = false): string {
  switch (m.k) {
    case "league":
      return short ? `R${m.r}` : `Round ${m.r}`;
    case "cup": {
      const full = CUP_ROUND_LABELS[m.r - 1] ?? "Challenge Cup";
      if (!short) return full;
      return ["Cup R1", "Cup R16", "Cup QF", "Cup SF", "Cup Final"][m.r - 1] ?? "Cup";
    }
    case "eliminator":
      return short ? "Elim" : "Play-off eliminator";
    case "semi":
      return short ? "Semi" : "Play-off semi-final";
    case "grand-final":
      return short ? "GF" : "Grand Final";
    case "mpg":
      return short ? "MPG" : "Million Pound Game";
    case "wcc":
      return short ? "WCC" : "World Club Challenge";
    case "nrl-final":
      return short ? ["QF/EF", "SF", "PF"][m.r - 1] ?? "Final" : ["Finals week 1", "Semi-final", "Preliminary final"][m.r - 1] ?? "Final";
    case "nrl-gf":
      return short ? "GF" : "NRL Grand Final";
  }
}

/** The user's side of a game: opponent, home or away, score and W/L/D (null until played). */
export function userSide(m: MiniResult, userClubId: string) {
  const home = m.h === userClubId;
  const played = miniPlayed(m);
  const us = played ? (home ? m.hs! : m.as!) : undefined;
  const them = played ? (home ? m.as! : m.hs!) : undefined;
  const outcome: "W" | "L" | "D" | null = !played ? null : us! > them! ? "W" : us! < them! ? "L" : "D";
  return { home, opponent: home ? m.a : m.h, us, them, outcome };
}

const PLAYOFF_KINDS = new Set(["eliminator", "semi", "grand-final"]);

/** True once every league round has been played (the play-off picture is then settled). */
export function leagueFinished(state: Pick<CareerState, "calendar">): boolean {
  const rounds = state.calendar.filter((m) => m.fixtures.some((f) => f.kind === "league") || m.label.startsWith("Round "));
  return rounds.length > 0 && rounds.every((m) => m.played);
}

/**
 * The season so far (or in full once it's over): the user's games, the play-offs, the cup's last
 * four and who goes up and down (mirrors finishSeason). Unplayed games have no score.
 */
export function buildSeasonStory(state: CareerState): SeasonStory {
  const all = state.calendar.flatMap((md) => md.fixtures);
  const user = state.userClubId;
  const sl = sortTable(state.tables["super-league"] ?? []).map((r) => r.clubId);
  const ch = sortTable(state.tables.championship ?? []).map((r) => r.clubId);
  const mpgF = all.find((f) => f.kind === "mpg");
  const promoted: string[] = [];
  const relegated: string[] = [];
  if (leagueFinished(state)) {
    if (ch[0]) promoted.push(ch[0]);
    if (sl.length) relegated.push(sl[sl.length - 1]!);
    if (mpgF && winnerOf(mpgF) === mpgF.away) {
      promoted.push(mpgF.away);
      relegated.push(mpgF.home);
    }
  }
  const nrl = sortTable(state.tables.nrl ?? []).map((r) => r.clubId);
  const nrlFinals = all.filter((f) => f.kind === "nrl-final" || f.kind === "nrl-gf").map(toMini);
  const wcc = all.find((f) => f.kind === "wcc");
  return {
    mine: all.filter((f) => f.home === user || f.away === user).map(toMini),
    playoffs: all.filter((f) => PLAYOFF_KINDS.has(f.kind)).map(toMini),
    mpg: mpgF ? toMini(mpgF) : undefined,
    cup: all.filter((f) => f.kind === "cup" && f.round >= 4).map(toMini),
    slTop: sl.slice(0, 6),
    chTop: ch.slice(0, 2),
    promoted,
    relegated,
    ...(nrl.length && all.some((f) => f.division === "nrl") ? { nrlTop: nrl.slice(0, 8), nrlFinals } : {}),
    ...(wcc ? { wcc: toMini(wcc) } : {}),
  };
}

/** The calendar in `state` is the season `year`'s and every game has been played. */
export function calendarIsFinishedSeason(state: CareerState, year: number): boolean {
  const first = state.calendar[0]?.fixtures[0];
  if (!first || !first.id.startsWith(`${year}-`)) return false;
  return state.calendar.every((m) => m.played || (!m.fixtures.length && !m.pendingDraw));
}

/* ------------------------------------------------------------------- honours */

export type HonourId =
  | "grand-final"
  | "league-leaders"
  | "challenge-cup"
  | "championship-title"
  | "mpg"
  | "promoted"
  | "relegated"
  | "nrl-premiership"
  | "minor-premiership"
  | "wcc";

export interface HonourLine {
  id: HonourId;
  title: string;
  /** The winner(s) / clubs it's about. */
  clubIds: string[];
  /** Short plain line: "Beat Wigan Warriors 24–12", "Top of Super League". */
  text: string;
  /** The user's club is one of them. */
  mine: boolean;
}

const nameOf = (clubs: ClubNames, id: string) => clubs[id]?.name ?? id;

/** "24–12" from the winner's side, with "(golden point)" when it went to extra time. */
function winnerScore(m: MiniResult): string {
  const w = miniWinner(m);
  const a = w === m.a ? m.as! : m.hs!;
  const b = w === m.a ? m.hs! : m.as!;
  return `${a}–${b}${m.gp ? " (golden point)" : ""}`;
}

/**
 * Who won what this season, in order: Grand Final, League Leaders' Shield, Challenge Cup,
 * Championship title, the Million Pound Game, then who went up and down. Seasons from before the
 * story was kept only know the user's own honours (from the trophies list).
 */
export function honoursBoard(o: Pick<SeasonOutcome, "story" | "trophies" | "promoted" | "relegated" | "division">, clubs: ClubNames, userClubId: string): HonourLine[] {
  const st = o.story;
  const lines: HonourLine[] = [];
  const push = (id: HonourId, title: string, clubIds: string[], text: string) =>
    lines.push({ id, title, clubIds, text, mine: clubIds.includes(userClubId) });
  if (!st) {
    const own: Array<[TrophyId, HonourId, string, string]> = [
      ["grand-final", "grand-final", "Super League Grand Final", "Champions"],
      ["league-leaders", "league-leaders", "League Leaders' Shield", "Top of Super League"],
      ["challenge-cup", "challenge-cup", "Challenge Cup", "Cup winners"],
      ["championship-title", "championship-title", "Championship title", "Top of the Championship"],
      ["million-pound-game", "mpg", "Million Pound Game", "Won the Million Pound Game"],
      ["world-club-challenge", "wcc", "World Club Challenge", "World champions"],
      ["nrl-premiership", "nrl-premiership", "NRL Premiership", "Premiers"],
      ["minor-premiership", "minor-premiership", "Minor Premiership", "Top of the NRL"],
    ];
    for (const [t, id, title, text] of own) if (o.trophies.includes(t)) push(id, title, [userClubId], text);
    if (o.promoted) push("promoted", "Promoted", [userClubId], "Up to Super League");
    if (o.relegated) push("relegated", "Relegated", [userClubId], "Down to the Championship");
    return lines;
  }
  // The World Club Challenge opened the season; an NRL manager's own league comes first after it.
  if (st.wcc && miniWinner(st.wcc)) push("wcc", "World Club Challenge", [miniWinner(st.wcc)!], `Beat ${nameOf(clubs, miniLoser(st.wcc)!)} ${winnerScore(st.wcc)}`);
  const nrlLines = () => {
    const ngf = st.nrlFinals?.find((m) => m.k === "nrl-gf");
    const ngfWinner = ngf ? miniWinner(ngf) : null;
    if (ngf && ngfWinner) push("nrl-premiership", "NRL Premiership", [ngfWinner], `Beat ${nameOf(clubs, miniLoser(ngf)!)} ${winnerScore(ngf)} in the Grand Final`);
    if (st.nrlTop?.[0]) push("minor-premiership", "Minor Premiership", [st.nrlTop[0]], "Top of the NRL ladder");
  };
  if (o.division === "nrl") nrlLines();
  const gf = st.playoffs.find((m) => m.k === "grand-final");
  const gfWinner = gf ? miniWinner(gf) : null;
  if (gf && gfWinner) push("grand-final", "Super League Grand Final", [gfWinner], `Beat ${nameOf(clubs, miniLoser(gf)!)} ${winnerScore(gf)}`);
  if (st.slTop[0]) push("league-leaders", "League Leaders' Shield", [st.slTop[0]], `Top of ${DIVISION_LABEL["super-league"]}`);
  const final = st.cup.find((m) => m.r === 5);
  const cupWinner = final ? miniWinner(final) : null;
  if (final && cupWinner) push("challenge-cup", "Challenge Cup", [cupWinner], `Beat ${nameOf(clubs, miniLoser(final)!)} ${winnerScore(final)} in the final`);
  if (st.chTop[0]) push("championship-title", "Championship title", [st.chTop[0]], `Top of the ${DIVISION_LABEL.championship}`);
  if (st.mpg && miniWinner(st.mpg)) {
    const w = miniWinner(st.mpg)!;
    const up = w === st.mpg.a;
    push(
      "mpg",
      "Million Pound Game",
      [w],
      `${nameOf(clubs, st.mpg.h)} ${st.mpg.hs}–${st.mpg.as} ${nameOf(clubs, st.mpg.a)}${st.mpg.gp ? " (golden point)" : ""}. ${nameOf(clubs, w)} ${up ? "go up" : "stay up"}.`
    );
  }
  if (st.promoted.length) push("promoted", "Promoted", st.promoted, `Up to ${DIVISION_LABEL["super-league"]}`);
  if (st.relegated.length) push("relegated", "Relegated", st.relegated, `Down to the ${DIVISION_LABEL.championship}`);
  if (o.division !== "nrl") nrlLines();
  return lines;
}

/* ------------------------------------------------------------------ NRL finals */

export interface NrlBracket {
  /** The top eight going in (ladder order). */
  top: string[];
  /** Week 1: qualifying finals (1v4, 2v3) then elimination finals (5v8, 6v7). */
  week1: MiniResult[];
  semis: MiniResult[];
  prelims: MiniResult[];
  final?: MiniResult;
}

/** The NRL finals from a story (null for seasons with no NRL). */
export function nrlBracket(st: SeasonStory): NrlBracket | null {
  if (!st.nrlTop?.length) return null;
  const f = st.nrlFinals ?? [];
  return {
    top: st.nrlTop,
    week1: f.filter((m) => m.k === "nrl-final" && m.r === 1),
    semis: f.filter((m) => m.k === "nrl-final" && m.r === 2),
    prelims: f.filter((m) => m.k === "nrl-final" && m.r === 3),
    final: f.find((m) => m.k === "nrl-gf"),
  };
}

/* ------------------------------------------------------------------ play-offs */

export interface PlayoffBracket {
  /** Top-six format (v1.52+): the top two sit out the eliminators. Older seasons: none. */
  byes: string[];
  eliminators: MiniResult[];
  semis: MiniResult[];
  final?: MiniResult;
  /** The top-six format (eliminators week), even before it's drawn. */
  topSix: boolean;
}

/** The play-off bracket from a story. Seasons with the old top-four semis have no eliminators or byes. */
export function playoffBracket(st: SeasonStory, calendar?: Matchday[]): PlayoffBracket {
  const eliminators = st.playoffs.filter((m) => m.k === "eliminator");
  const semis = st.playoffs.filter((m) => m.k === "semi");
  const final = st.playoffs.find((m) => m.k === "grand-final");
  const topSix = eliminators.length > 0 || !!calendar?.some((m) => m.pendingDraw === "playoff-elims");
  return { byes: topSix ? st.slTop.slice(0, 2) : [], eliminators, semis, final, topSix };
}

/* --------------------------------------------------------------- review data */

export interface ReviewData {
  honours: HonourLine[];
  awards: SeasonAward[];
  bracket: PlayoffBracket | null;
  /** The NRL finals (an NRL manager's season). */
  nrlBracket: NrlBracket | null;
  /** The World Club Challenge that opened the season. */
  wcc?: MiniResult;
  /** The user's Challenge Cup ties, in order. */
  cupRun: MiniResult[];
  cupFinal?: MiniResult;
  /** Every game of the user's this season. */
  results: MiniResult[];
  /** The season has its full story (false for seasons from older saves). */
  full: boolean;
}

/** Everything the season review (or a past season's summary) shows, from one outcome. */
export function seasonReviewData(o: SeasonOutcome, clubs: ClubNames, userClubId: string): ReviewData {
  const st = o.story;
  return {
    honours: honoursBoard(o, clubs, userClubId),
    awards: o.awards ?? [],
    bracket: o.division !== "nrl" && st && (st.playoffs.length || st.slTop.length) ? playoffBracket(st) : null,
    nrlBracket: o.division === "nrl" && st ? nrlBracket(st) : null,
    wcc: st?.wcc,
    cupRun: st ? st.mine.filter((m) => m.k === "cup") : [],
    cupFinal: st?.cup.find((m) => m.r === 5),
    results: st?.mine ?? [],
    full: !!st,
  };
}

/** Plain one-liners for awards (for summaries and tests). */
export function awardLines(awards: SeasonAward[]): string[] {
  return awards.map((a) => `${awardLabel(a)}: ${a.name}${a.id === "club-player" ? "" : ` (${a.clubName})`}`);
}

/* ----------------------------------------------------------- during the season */

export interface RoundResults {
  /** Calendar index. */
  index: number;
  label: string;
  /** League games in the user's division, or every tie of a knockout round. */
  games: MiniResult[];
}

/**
 * Played weeks with scores to show: each league round (the user's division), each cup round and
 * the play-off weeks, oldest first.
 */
export function playedRounds(state: CareerState, division: Division = state.clubs[state.userClubId]!.division): RoundResults[] {
  const out: RoundResults[] = [];
  for (const md of state.calendar) {
    if (!md.played) continue;
    // Knockouts of your own game only: an NRL manager sees the WCC and the NRL finals, not the Cup or Super League's play-offs.
    const nrl = division === "nrl";
    const games = md.fixtures
      .filter((f) => f.result && (f.kind === "league" ? f.division === division : nrl ? f.kind === "wcc" || f.kind === "nrl-final" || f.kind === "nrl-gf" : f.kind !== "nrl-final" && f.kind !== "nrl-gf"))
      .map(toMini);
    if (games.length) out.push({ index: md.index, label: md.label, games });
  }
  return out;
}

/** Challenge Cup rounds drawn so far (ties, with scores once played). */
export function cupRounds(state: CareerState): Array<{ round: number; label: string; ties: MiniResult[] }> {
  const rounds: Array<{ round: number; label: string; ties: MiniResult[] }> = [];
  for (const md of state.calendar) {
    const ties = md.fixtures.filter((f) => f.kind === "cup");
    if (!ties.length) continue;
    rounds.push({ round: ties[0]!.round, label: CUP_ROUND_LABELS[ties[0]!.round - 1] ?? md.label, ties: ties.map(toMini) });
  }
  return rounds;
}

/** The user's games still to come (drawn ones), plus knockout rounds not drawn yet that they're alive in. */
export function upcomingGames(state: CareerState): MiniResult[] {
  return state.calendar
    .slice(state.matchdayIndex)
    .flatMap((md) => md.fixtures.filter((f) => !f.result && (f.home === state.userClubId || f.away === state.userClubId)))
    .map(toMini);
}
