import { simulateMatch, type TeamSheet } from "./match";
import { deadlineDecisionPending, onMatchdayReached } from "./midseason";
import { autoPickBench, autoPickLineup, fillLineupGaps, teamRating, formatMoney, wageBill } from "./players";
import { rngFor, shuffle } from "./rng";
import { CUP_ROUND_LABELS, buildCalendar } from "./schedule";
import { DIVISION_LABEL } from "./clubs";
import {
  NRL_BYE_POINTS,
  NRL_FINALISTS,
  NRL_FINALS_LABEL,
  NRL_GAMES,
  WCC_LABEL,
  isNrlFinalKind,
  recordChampions,
  wccFixture,
  wccParticipants,
} from "./nrl";
import { boardTargetForRank } from "./board";
import { academyIntake } from "./academy";
import { pushEvent, rollRandomEvent } from "./events";
import { MAN_OF_STEEL_LEGACY, awardLabel, computeSeasonAwards, userWonManOfSteel } from "./awards";
import { defaultCaptain, syncCaptain, userCaptain } from "./captain";
import { DERBY_LEGACY, DERBY_MORALE, derbyBonus, isDerby } from "./rivals";
import { isMagicWeekend } from "./schedule";
import { addNrlWorld } from "./nrl-world";
import { inferNewsTags, pruneNewsTags, tagNews, withDealDivisions } from "./news";
import { settleFixture } from "./stats";
import { buildSeasonStory, calendarIsFinishedSeason } from "./story";
import { LONG_INJURY, injuryName, isAvailable, rollInjuries } from "./injuries";
import { tacticsOf } from "./tactics";
import { moodAfterGame, moodIncomeFactor, moodWarnings, newSeasonMood, noteFinalsWin, setObjectives, settleSeasonMood } from "./club-mood";
import type {
  CareerState,
  ChallengeKind,
  Division,
  Fixture,
  FixtureKind,
  FixtureResult,
  Matchday,
  SeasonChallenge,
  SeasonDeal,
  SeasonOutcome,
  TableRow,
  TrophyId,
} from "./types";

export const DIVISIONS: Division[] = ["super-league", "championship", "nrl"];

/* ------------------------------------------------------------------ helpers */

export function clubsIn(state: CareerState, division: Division): string[] {
  return Object.values(state.clubs)
    .filter((c) => c.division === division)
    .map((c) => c.id);
}

export function userClub(state: CareerState) {
  return state.clubs[state.userClubId]!;
}

export function squadOf(state: CareerState, clubId: string) {
  return (state.clubs[clubId]?.squad ?? []).map((id) => state.players[id]!).filter(Boolean);
}

/** Players who can be picked: the squad minus anyone serving a ban or out injured. */
export function availableSquad(state: CareerState, clubId: string) {
  const squad = squadOf(state, clubId);
  const fit = squad.filter(isAvailable);
  if (fit.length >= 17) return fit;
  // Short of bodies: the men nearest to fitness play through it (never a banned man).
  const knocks = squad.filter((p) => !p.ban && p.injury).sort((a, b) => a.injury! - b.injury! || b.rating - a.rating);
  return [...fit, ...knocks.slice(0, 17 - fit.length)];
}

/**
 * Injuries after a match, for both clubs (like bans): anyone already out has now missed a game,
 * and anyone hurt in it misses the next `n`. The user hears about his own; long ones get a pop-up.
 */
function applyInjuries(state: CareerState, f: Fixture, home: TeamSheet, away: TeamSheet) {
  const r = f.result;
  if (!r) return;
  const rng = rngFor(state.seed, state.year, f.id, "injuries");
  const fresh: Record<string, number> = {
    ...rollInjuries(rng, matchday17(home), state.players, f.home === state.userClubId ? (r.knocks ?? []) : []),
    ...rollInjuries(rng, matchday17(away), state.players, f.away === state.userClubId ? (r.knocks ?? []) : []),
  };
  delete r.knocks;
  // Kept on the user's own games only (small saves).
  if (Object.keys(fresh).length && (f.home === state.userClubId || f.away === state.userClubId)) r.injuries = fresh;
  for (const clubId of [f.home, f.away]) {
    for (const id of state.clubs[clubId]?.squad ?? []) {
      const p = state.players[id];
      if (p?.injury) p.injury = p.injury > 1 ? p.injury - 1 : undefined;
    }
  }
  for (const [id, games] of Object.entries(fresh)) {
    const p = state.players[id];
    if (!p) continue;
    p.injury = Math.max(p.injury ?? 0, games);
    if (!state.clubs[state.userClubId]?.squad.includes(id)) continue;
    const what = injuryName(games, id.length + games + state.matchdayIndex);
    addNews(state, games >= LONG_INJURY ? `Blow: ${p.name} has ${what} and is out for ${games} games.` : `${p.name} picks up ${what}: out for ${games} game${games > 1 ? "s" : ""}.`);
    if (games >= LONG_INJURY) {
      pushEvent(state, {
        id: `injury:${state.year}:${state.matchdayIndex}:${id}`,
        kind: "injury",
        year: state.year,
        clubId: state.userClubId,
        playerId: id,
        name: p.name,
        rating: p.rating,
        title: `${p.name} is injured`,
        text: `${p.name} has ${what} and will miss the next ${games} games. The bench covers for now.`,
        options: [{ id: "ok", label: "OK" }],
      });
    }
  }
}

/**
 * Bans after a match. Each club that played: anyone banned before it has now served a game, and
 * anyone sent off in it misses the club's next game (a week with no game doesn't count).
 */
function applyBans(state: CareerState, f: Fixture) {
  if (!f.result) return;
  for (const [clubId, sentOff, oppId] of [
    [f.home, f.result.homeSentOff ?? [], f.away],
    [f.away, f.result.awaySentOff ?? [], f.home],
  ] as const) {
    for (const id of state.clubs[clubId]?.squad ?? []) {
      const p = state.players[id];
      if (p?.ban) p.ban = p.ban > 1 ? p.ban - 1 : undefined;
    }
    for (const id of sentOff) {
      const p = state.players[id];
      if (!p) continue;
      p.ban = 1;
      if (clubId === state.userClubId) addNews(state, `${p.name} sent off v ${state.clubs[oppId]?.name ?? "them"}. Banned for the next game.`);
    }
  }
}

/**
 * AI clubs' best XIII. Squads and ratings don't change mid-season, so cache per season+squad.
 * (Big win for "Sim season" on phones: ~36 picks per matchday otherwise.)
 */
const aiTeamCache = new Map<string, { lineup: string[]; bench: string[]; captain?: string }>();
function aiTeam(state: CareerState, clubId: string): { lineup: string[]; bench: string[]; captain?: string } {
  const squad = state.clubs[clubId]?.squad ?? [];
  const banned = squad.filter((id) => !isAvailable(state.players[id])).join(",");
  const key = `${state.seed}|${state.year}|${clubId}|${squad.join(",")}|${banned}`;
  const hit = aiTeamCache.get(key);
  if (hit) return hit;
  const players = availableSquad(state, clubId);
  const lineup = autoPickLineup(players);
  // Every AI club has a captain too: its best senior starter (the same small lift as yours).
  const team = { lineup, bench: autoPickBench(players, lineup), captain: defaultCaptain(lineup, state.players) };
  if (aiTeamCache.size > 400) aiTeamCache.clear();
  aiTeamCache.set(key, team);
  return team;
}
export function aiLineup(state: CareerState, clubId: string): string[] {
  return aiTeam(state, clubId).lineup;
}
/** AI clubs' interchange: the best four left, two of them middle forwards. */
export function aiBench(state: CareerState, clubId: string): string[] {
  return aiTeam(state, clubId).bench;
}

/** The user's bench, always valid (4 squad players outside the XIII where the squad allows). */
export function userBench(state: CareerState): string[] {
  return repairTeam(state, state.lineup, state.bench ?? []).bench;
}

/** Club strength = its XIII plus a small bench term (see teamRating). */
export function clubRating(state: CareerState, clubId: string): number {
  if (clubId === state.userClubId) return teamRating(state.lineup, userBench(state), state.players);
  const team = aiTeam(state, clubId);
  return teamRating(team.lineup, team.bench, state.players);
}

export function sortTable(rows: TableRow[]): TableRow[] {
  return [...rows].sort(
    (a, b) => b.pts - a.pts || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf || a.clubId.localeCompare(b.clubId)
  );
}

function emptyRow(clubId: string): TableRow {
  return { clubId, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0, form: [] };
}

function addNews(state: CareerState, line: string) {
  state.news = [line, ...state.news].slice(0, 30);
}

function isKnockout(kind: FixtureKind) {
  return kind !== "league";
}

export function winnerOf(f: Fixture): string | null {
  if (!f.result) return null;
  return f.result.homeScore > f.result.awayScore ? f.home : f.result.awayScore > f.result.homeScore ? f.away : null;
}

export function loserOf(f: Fixture): string | null {
  const w = winnerOf(f);
  return w ? (w === f.home ? f.away : f.home) : null;
}

/** Strongest-first ranking of a division by current XIII rating. */
export function expectedRanking(state: CareerState, division: Division): string[] {
  return clubsIn(state, division)
    .map((id) => ({ id, r: clubRating(state, id) }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.id);
}

/* --------------------------------------------------------------- season start */

const CHALLENGE_KINDS: ChallengeKind[] = [
  "win-games",
  "finish-top",
  "cup-reach",
  "beat-club",
  "big-win",
  "unbeaten-run",
  "academy-debuts",
  "points-scored",
];

/** Indexed by `seasonTrack.cupRoundReached` (R1 exit = 1, reached R16 = 2 … won the final = 6). */
const CUP_REACHED_LABEL = ["", "Round 1", "Round of 16", "quarter-finals", "semi-finals", "Final", "lift the Cup"];

function buildChallenges(state: CareerState): SeasonChallenge[] {
  const rng = rngFor(state.seed, state.year, "challenges");
  const club = userClub(state);
  const division = club.division;
  const ranking = expectedRanking(state, division);
  const expectedRank = ranking.indexOf(club.id) + 1;
  const size = ranking.length;
  const rounds = division === "nrl" ? NRL_GAMES : division === "super-league" ? 26 : 21;
  // 1 = favourites … 0 = expected to finish bottom.
  const share = 1 - (expectedRank - 1) / (size - 1);
  const tier: "strong" | "mid" | "weak" = share >= 0.7 ? "strong" : share >= 0.35 ? "mid" : "weak";
  const academyCount = club.squad.filter((id) => state.players[id]?.academy).length;

  // NRL clubs aren't in the Challenge Cup.
  const kinds = shuffle(rng, CHALLENGE_KINDS).filter((k) => (k !== "academy-debuts" || academyCount >= 2) && (k !== "cup-reach" || division !== "nrl"));
  return kinds.slice(0, 3).map((kind, i): SeasonChallenge => {
    const base = { id: `${state.year}-ch-${i}`, kind, progress: 0, done: false };
    switch (kind) {
      case "win-games": {
        const target = Math.min(rounds - 2, Math.max(3, Math.round(share * rounds * 0.8) + 2));
        return { ...base, title: `Win ${target} league games`, target, rewardCash: 60_000, rewardLegacy: 15 };
      }
      case "finish-top": {
        const target = Math.max(1, expectedRank - 2);
        return {
          ...base,
          title: target === 1 ? (division === "nrl" ? "Win the minor premiership" : `Finish top of the ${DIVISION_LABEL[division]}`) : `Finish in the top ${target}`,
          target,
          rewardCash: 100_000,
          rewardLegacy: 25,
        };
      }
      case "cup-reach": {
        const target = tier === "strong" ? 4 : tier === "mid" ? 3 : 2;
        return { ...base, title: `Reach the Challenge Cup ${CUP_REACHED_LABEL[target]}`, target, rewardCash: 50_000, rewardLegacy: 20 };
      }
      case "beat-club": {
        // A club a few places above you — a real scalp, not an impossible one.
        const rival = ranking[Math.max(0, expectedRank - 1 - 3)] === club.id ? ranking.find((id) => id !== club.id)! : ranking[Math.max(0, expectedRank - 1 - 3)]!;
        return { ...base, title: `Beat ${state.clubs[rival]!.name}`, target: 1, clubId: rival, rewardCash: 40_000, rewardLegacy: 15 };
      }
      case "big-win": {
        const target = tier === "strong" ? 30 : tier === "mid" ? 24 : 16;
        return { ...base, title: `Win a game by ${target}+ points`, target, rewardCash: 30_000, rewardLegacy: 10 };
      }
      case "unbeaten-run": {
        const target = tier === "strong" ? 7 : tier === "mid" ? 5 : 3;
        return { ...base, title: `Go ${target} league games unbeaten`, target, rewardCash: 50_000, rewardLegacy: 15 };
      }
      case "academy-debuts":
        return { ...base, title: "Give 2 academy players a game", target: 2, rewardCash: 35_000, rewardLegacy: 20 };
      case "points-scored": {
        const target = Math.round((rounds * (11 + share * 14)) / 25) * 25;
        return { ...base, title: `Score ${target} points in league games`, target, rewardCash: 45_000, rewardLegacy: 15 };
      }
    }
  });
}

/** Prestige → season income. */
export function seasonIncome(state: CareerState): number {
  const division = userClub(state).division;
  // The NRL is the richer league: its wage bills are higher, and so is what its boards pay (v1.65).
  const base =
    division === "nrl"
      ? NRL_INCOME_BASE + Math.round(state.prestige * NRL_INCOME_PER_STAR)
      : division === "super-league"
        ? 500_000 + Math.round(state.prestige * 200_000)
        : 150_000 + Math.round(state.prestige * 80_000);
  // Happy fans fill the ground and a confident board backs you (v1.66): a few per cent either way.
  const factor = moodIncomeFactor(state);
  return factor === 1 ? base : Math.round((base * factor) / 1000) * 1000;
}
export const NRL_INCOME_BASE = 600_000;
export const NRL_INCOME_PER_STAR = 350_000;

export function startSeason(state: CareerState): CareerState {
  const next: CareerState = structuredClone(state);
  const rng = rngFor(next.seed, next.year, "calendar");
  const divisions: Record<Division, string[]> = {
    "super-league": clubsIn(next, "super-league"),
    championship: clubsIn(next, "championship"),
    nrl: clubsIn(next, "nrl"),
  };

  // Challenge Cup: all 14 Super League clubs + the 18 strongest Championship clubs (always incl. the user).
  const champRanked = expectedRanking(next, "championship");
  const champEntrants = champRanked.slice(0, 18);
  if (!champEntrants.includes(next.userClubId) && next.clubs[next.userClubId]!.division === "championship") {
    champEntrants[champEntrants.length - 1] = next.userClubId;
  }
  // v1.65: last year's Super League and NRL champions open the season in the World Club Challenge.
  const wcc = divisions.nrl.length ? wccParticipants(next, next.year, (d) => expectedRanking(next, d)[0]) : null;
  next.calendar = buildCalendar(rng, next.year, divisions, [...divisions["super-league"], ...champEntrants], {
    wcc: wcc ? wccFixture(next.year, wcc.sl, wcc.nrl) : undefined,
    nrlRng: rngFor(next.seed, next.year, "nrl-calendar"),
    nrlLabels: next.clubs[next.userClubId]!.division === "nrl",
  });
  next.matchdayIndex = 0;
  next.tables = {
    "super-league": divisions["super-league"].map(emptyRow),
    championship: divisions.championship.map(emptyRow),
    nrl: divisions.nrl.map(emptyRow),
  };
  for (const p of Object.values(next.players)) {
    p.apps = 0;
    p.tries = 0;
    // Season goals and ratings: left out until he plays (keeps the save small).
    delete p.goals;
    delete p.rated;
    delete p.ratingSum;
    // Knocks heal over the summer.
    delete p.injury;
  }
  fixTeam(next);
  next.seasonTrack = {
    unbeatenRun: 0,
    bestUnbeatenRun: 0,
    biggestWinMargin: 0,
    academyDebutIds: [],
    pointsScored: 0,
    cupRoundReached: 0,
    derbies: { w: 0, d: 0, l: 0 },
    bonusLegacy: 0,
  };
  next.challenges = buildChallenges(next);
  {
    const division = userClub(next).division;
    const ranking = expectedRanking(next, division);
    next.board = { year: next.year, target: boardTargetForRank(division, ranking.indexOf(next.userClubId) + 1, ranking.length) };
    // The board's other asks this season (a cup run or a derby, the kids or the books).
    const rank = ranking.indexOf(next.userClubId);
    setObjectives(next, ranking.length > 1 ? 1 - rank / (ranking.length - 1) : 0.5);
  }
  next.phase = "season";
  next.lastOutcome = undefined;
  const income = seasonIncome(next);
  const wages = wageBill(squadOf(next, next.userClubId));
  next.budget += income - wages;
  next.lastWages = wages;
  next.lastIncome = income;
  // Last season's mood carries over, softened.
  newSeasonMood(next);
  // Pre-season: a new batch of kids joins the academy.
  academyIntake(next);
  pruneNewsTags(next);
  addNews(
    next,
    `${next.year} season begins in the ${DIVISION_LABEL[userClub(next).division]}. Board income ${formatMoney(income)}, wages ${formatMoney(wages)}.`
  );
  if (wcc) {
    const mine = wcc.sl === next.userClubId || wcc.nrl === next.userClubId;
    const line = mine
      ? `${WCC_LABEL}: you face ${next.clubs[wcc.sl === next.userClubId ? wcc.nrl : wcc.sl]!.name} before Round 1.`
      : `${WCC_LABEL}: ${next.clubs[wcc.sl]!.name} v ${next.clubs[wcc.nrl]!.name} opens the season.`;
    addNews(next, line);
  }
  next.updatedAt = Date.now();
  return next;
}

/**
 * Keep the user's matchday 17 valid. A starter who's gone (sold, released, retired) leaves a gap
 * in his shirt: the bench fills it first, then the bench is topped back up to four from the squad.
 * A line-up of the wrong shape (very old saves) is picked afresh.
 */
export function repairTeam(state: CareerState, lineup: readonly string[], bench: readonly string[]): { lineup: string[]; bench: string[] } {
  const squad = availableSquad(state, state.userClubId);
  const ids = new Set(squad.map((p) => p.id));
  let xiii: string[];
  if (lineup.length !== 13) xiii = autoPickLineup(squad);
  else {
    const seen = new Set<string>();
    xiii = lineup.map((id) => {
      if (!ids.has(id) || seen.has(id)) return "";
      seen.add(id);
      return id;
    });
    if (xiii.some((id) => !id)) xiii = fillLineupGaps(xiii, bench, squad);
  }
  return { lineup: xiii, bench: autoPickBench(squad, xiii, bench) };
}

/** Keep the user's XIII valid (players still at the club, no gaps). See repairTeam. */
export function repairLineup(state: CareerState, lineup: string[]): string[] {
  return repairTeam(state, lineup, state.bench ?? []).lineup;
}

/** Repair the user's XIII and bench in place (callers clone first). */
export function fixTeam(s: CareerState): void {
  const team = repairTeam(s, s.lineup ?? [], s.bench ?? []);
  s.lineup = team.lineup;
  s.bench = team.bench;
  syncCaptain(s);
}

/** A copy with the XIII and bench repaired (for saves, sales and deals that changed the squad). */
export function withTeamFixed(state: CareerState): CareerState {
  const s = { ...state, ...repairTeam(state, state.lineup ?? [], state.bench ?? []) };
  syncCaptain(s);
  return s;
}

/**
 * Put a player in a shirt: XIII slot 0–12 or bench spot 0–3. If he's already in the 17, the two
 * swap places (a starter tapped onto the bench goes to the bench, and the bench man starts).
 */
export function placeInTeam(state: CareerState, where: "xiii" | "bench", index: number, playerId: string): { lineup: string[]; bench: string[] } {
  const cur = repairTeam(state, state.lineup ?? [], state.bench ?? []);
  const lineup = [...cur.lineup];
  const bench = [...cur.bench];
  const target = where === "xiii" ? lineup : bench;
  if (index < 0 || index >= (where === "xiii" ? 13 : bench.length + (bench.length < 4 ? 1 : 0))) return cur;
  const outgoing = target[index] ?? "";
  const inXiii = lineup.indexOf(playerId);
  const onBench = bench.indexOf(playerId);
  if (inXiii >= 0) lineup[inXiii] = outgoing;
  else if (onBench >= 0) bench[onBench] = outgoing;
  target[index] = playerId;
  return repairTeam(state, lineup, bench.filter(Boolean));
}

/**
 * Bring a loaded save up to date: saves from before the interchange get a bench picked; saves
 * from before the academy get an empty list, and a captain (the best senior starter).
 * Awards, derby records and Magic Weekend need nothing: older seasons simply have none. News and
 * deals get division tags inferred from the clubs they name; player stats and club records start now.
 */
export function migrateCareer<T extends CareerState | null>(state: T): T {
  if (!state) return state;
  let s: CareerState = state;
  // The NRL (v1.65): older saves gain its 17 clubs and squads. It runs in the background from the
  // next season (with the World Club Challenge in that pre-season); this season's calendar is unchanged.
  if (!Object.values(s.clubs).some((c) => c.division === "nrl")) {
    const clubs = { ...s.clubs };
    const players = { ...s.players };
    addNrlWorld(clubs, players, s.seed, s.year);
    s = { ...s, clubs, players, tables: { ...s.tables, nrl: s.tables.nrl ?? [] } };
  }
  if (!Array.isArray(s.tables.nrl)) s = { ...s, tables: { ...s.tables, nrl: [] } };
  if (!Array.isArray(s.bench)) s = withTeamFixed({ ...s, bench: [] });
  // The three-part game plan (v1.66): older saves' single tactic carries over.
  if (!s.tactics || tacticsOf(s) !== s.tactics) s = { ...s, tactics: tacticsOf(s) };
  if (!Array.isArray(s.academy) || s.academy.some((id) => !s.players[id])) {
    s = { ...s, academy: (Array.isArray(s.academy) ? s.academy : []).filter((id) => !!s.players[id]) };
  }
  if (!s.captainId || !s.clubs[s.userClubId]?.squad.includes(s.captainId)) {
    s = { ...s, captainId: defaultCaptain(s.lineup ?? [], s.players) };
  }
  // League-relevant news (v1.56): tag older saves' news and deals with the divisions of the clubs named.
  if (!s.newsTags) s = { ...s, newsTags: inferNewsTags(s) };
  if ((s.transfers ?? []).some((d) => !d.divisions)) {
    const st = s;
    s = { ...s, transfers: (s.transfers ?? []).map((d) => withDealDivisions(st, d)) };
  }
  // Season story (v1.58): a season that ended before it was kept, whose calendar is still loaded
  // (the review, departures or the summer window), gets it now. Older history entries keep what they have.
  {
    const last = s.history[s.history.length - 1];
    if (last && !last.story && s.phase !== "season" && calendarIsFinishedSeason(s, last.year)) {
      const story = buildSeasonStory(s);
      s = {
        ...s,
        history: s.history.map((h, i) => (i === s.history.length - 1 ? { ...h, story } : h)),
        lastOutcome: s.lastOutcome && s.lastOutcome.year === last.year && !s.lastOutcome.story ? { ...s.lastOutcome, story } : s.lastOutcome,
      };
    }
  }
  return s as T;
}

/** Best XIII and the best bench to go with it. */
export function autoPickTeam(state: CareerState): { lineup: string[]; bench: string[] } {
  const squad = availableSquad(state, state.userClubId);
  const lineup = autoPickLineup(squad);
  return { lineup, bench: autoPickBench(squad, lineup) };
}

/* ------------------------------------------------------------------ draws */

function knockoutWinners(md: Matchday | undefined): string[] {
  // Cup ties only: the NRL's games share some cup weeks.
  return (md?.fixtures ?? []).filter((f) => f.kind === "cup").map(winnerOf).filter((x): x is string => !!x);
}

function drawPending(state: CareerState, md: Matchday) {
  if (md.pendingDraw) {
    // Super League's draws replace the week's fixtures: the NRL games sharing the week stay.
    const nrl = md.fixtures.filter((f) => f.division === "nrl");
    drawUk(state, md);
    md.fixtures = [...md.fixtures.filter((f) => f.division !== "nrl"), ...nrl];
  }
  if (md.nrlDraw) drawNrlFinals(state, md);
}

function drawUk(state: CareerState, md: Matchday) {
  if (!md.pendingDraw) return;
  const rng = rngFor(state.seed, state.year, "draw", md.index);
  const prevCup = [...state.calendar.slice(0, md.index)].reverse().find((m) => m.fixtures.some((f) => f.kind === "cup"));
  const mk = (kind: FixtureKind, round: number, label: string, home: string, away: string, i: number, division?: Division): Fixture => ({
    id: `${state.year}-${md.pendingDraw}-${i}`,
    kind,
    round,
    label,
    home,
    away,
    division,
  });

  switch (md.pendingDraw) {
    case "cup-r16":
    case "cup-qf":
    case "cup-sf":
    case "cup-final": {
      const round = { "cup-r16": 2, "cup-qf": 3, "cup-sf": 4, "cup-final": 5 }[md.pendingDraw];
      const teams = shuffle(rng, knockoutWinners(prevCup));
      md.fixtures = [];
      for (let i = 0; i + 1 < teams.length; i += 2) {
        md.fixtures.push(mk("cup", round, CUP_ROUND_LABELS[round - 1]!, teams[i]!, teams[i + 1]!, i / 2));
      }
      break;
    }
    case "playoff-elims": {
      // Top six: 3rd hosts 6th, 4th hosts 5th. 1st and 2nd have a week off (a bye to the semis).
      const sl = sortTable(state.tables["super-league"]);
      const ch = sortTable(state.tables.championship);
      md.fixtures = [
        mk("eliminator", 1, "Play-off eliminator", sl[2]!.clubId, sl[5]!.clubId, 0, "super-league"),
        mk("eliminator", 1, "Play-off eliminator", sl[3]!.clubId, sl[4]!.clubId, 1, "super-league"),
        // 13th in Super League hosts the Championship runners-up for a place in next year's Super League.
        mk("mpg", 1, "The Million Pound Game", sl[sl.length - 2]!.clubId, ch[1]!.clubId, 2),
      ];
      break;
    }
    case "playoff-semis": {
      const sl = sortTable(state.tables["super-league"]);
      const order = sl.map((r) => r.clubId);
      const elims = (state.calendar[md.index - 1]?.fixtures ?? []).filter((f) => f.kind === "eliminator");
      if (elims.length === 2) {
        // Re-seed: 1st hosts the lowest-placed eliminator winner, 2nd hosts the other.
        const winners = elims.map(winnerOf).sort((a, b) => order.indexOf(a!) - order.indexOf(b!));
        md.fixtures = [
          mk("semi", 1, "Play-off semi-final", order[0]!, winners[1]!, 0, "super-league"),
          mk("semi", 1, "Play-off semi-final", order[1]!, winners[0]!, 1, "super-league"),
        ];
        break;
      }
      // Seasons started before v1.52 have no eliminator week: the old top-four semis + MPG.
      const ch = sortTable(state.tables.championship);
      md.fixtures = [
        mk("semi", 1, "Play-off semi-final", sl[0]!.clubId, sl[3]!.clubId, 0, "super-league"),
        mk("semi", 1, "Play-off semi-final", sl[1]!.clubId, sl[2]!.clubId, 1, "super-league"),
        // 13th in Super League hosts the Championship runners-up for a place in next year's Super League.
        mk("mpg", 1, "The Million Pound Game", sl[sl.length - 2]!.clubId, ch[1]!.clubId, 2),
      ];
      break;
    }
    case "grand-final": {
      const semis = state.calendar[md.index - 1]!.fixtures.filter((f) => f.kind === "semi");
      const [a, b] = semis.map(winnerOf);
      // Higher league finisher is the nominal "home" side at Old Trafford.
      const sl = sortTable(state.tables["super-league"]).map((r) => r.clubId);
      const [home, away] = sl.indexOf(a!) < sl.indexOf(b!) ? [a!, b!] : [b!, a!];
      md.fixtures = [mk("grand-final", 1, "Super League Grand Final", home, away, 0, "super-league")];
      break;
    }
  }
  md.pendingDraw = undefined;
}

/**
 * NRL finals (top eight). Week 1: qualifying finals 1v4 and 2v3, elimination finals 5v8 and 6v7.
 * Week 2: the qualifying-final losers host the elimination-final winners (QF1 loser v EF1 winner).
 * Week 3: the qualifying-final winners host the semi-final winners (QF1 winner v SF2 winner).
 * Then the Grand Final, the higher ladder finisher the nominal home side.
 */
function drawNrlFinals(state: CareerState, md: Matchday) {
  const draw = md.nrlDraw;
  if (!draw) return;
  md.nrlDraw = undefined;
  const ladder = sortTable(state.tables.nrl ?? []).map((r) => r.clubId);
  if (ladder.length < NRL_FINALISTS) return;
  const finals = state.calendar.slice(0, md.index).flatMap((m) => m.fixtures).filter((f) => f.division === "nrl" && isNrlFinalKind(f.kind));
  const byId = (id: string) => finals.find((f) => f.id === `${state.year}-${id}`);
  const mk = (id: string, kind: FixtureKind, round: number, label: string, home: string, away: string): Fixture => ({
    id: `${state.year}-${id}`,
    kind,
    round,
    label,
    home,
    away,
    division: "nrl",
  });
  const w = (id: string) => {
    const f = byId(id);
    return f ? winnerOf(f) : null;
  };
  const l = (id: string) => {
    const f = byId(id);
    return f ? loserOf(f) : null;
  };
  const out: Fixture[] = [];
  if (draw === "nrl-w1") {
    const [a, b, c, d, e, f, g, h] = ladder;
    out.push(mk("nrl-qf1", "nrl-final", 1, NRL_FINALS_LABEL.qf, a!, d!));
    out.push(mk("nrl-qf2", "nrl-final", 1, NRL_FINALS_LABEL.qf, b!, c!));
    out.push(mk("nrl-ef1", "nrl-final", 1, NRL_FINALS_LABEL.ef, e!, h!));
    out.push(mk("nrl-ef2", "nrl-final", 1, NRL_FINALS_LABEL.ef, f!, g!));
  } else if (draw === "nrl-w2") {
    const pairs: Array<[string | null, string | null]> = [
      [l("nrl-qf1"), w("nrl-ef1")],
      [l("nrl-qf2"), w("nrl-ef2")],
    ];
    pairs.forEach(([home, away], i) => {
      if (home && away) out.push(mk(`nrl-sf${i + 1}`, "nrl-final", 2, NRL_FINALS_LABEL.sf, home, away));
    });
  } else if (draw === "nrl-w3") {
    const pairs: Array<[string | null, string | null]> = [
      [w("nrl-qf1"), w("nrl-sf2")],
      [w("nrl-qf2"), w("nrl-sf1")],
    ];
    pairs.forEach(([home, away], i) => {
      if (home && away) out.push(mk(`nrl-pf${i + 1}`, "nrl-final", 3, NRL_FINALS_LABEL.pf, home, away));
    });
  } else {
    const a = w("nrl-pf1");
    const b = w("nrl-pf2");
    if (a && b) {
      const [home, away] = ladder.indexOf(a) < ladder.indexOf(b) ? [a, b] : [b, a];
      out.push(mk("nrl-gf", "nrl-gf", 1, NRL_FINALS_LABEL.gf, home, away));
    }
  }
  md.fixtures.push(...out);
}

/** NRL byes this week: 2 ladder points each (in place). */
function applyByes(state: CareerState, md: Matchday) {
  const rows = state.tables.nrl;
  if (!md.byes?.length || !rows) return;
  for (const id of md.byes) {
    const row = rows.find((r) => r.clubId === id);
    if (!row) continue;
    row.pts += NRL_BYE_POINTS;
    row.b = (row.b ?? 0) + 1;
  }
  if (md.byes.includes(state.userClubId)) addNews(state, `Bye week: +${NRL_BYE_POINTS} ladder points.`);
}

/* --------------------------------------------------------------- play matchday */

export function sheetFor(state: CareerState, clubId: string): TeamSheet {
  if (clubId === state.userClubId) {
    const pre = state.preseason;
    // Pre-season friendlies: a little match sharpness for the opening three matchdays.
    const sharp = pre && pre.year === state.year && state.matchdayIndex < 3 ? pre.results.length * 0.5 : 0;
    // A derby win lifts the next game.
    const morale = state.seasonTrack?.moraleAt === state.matchdayIndex ? DERBY_MORALE : 0;
    return { clubId, lineup: state.lineup, bench: userBench(state), tactic: state.tactic, tactics: tacticsOf(state), boost: sharp + morale, captain: userCaptain(state) };
  }
  const team = aiTeam(state, clubId);
  return { clubId, lineup: team.lineup, bench: team.bench, tactic: "balanced", captain: team.captain };
}

function applyLeagueResult(state: CareerState, f: Fixture) {
  if (f.kind !== "league" || !f.division || !f.result) return;
  const rows = state.tables[f.division];
  const home = rows.find((r) => r.clubId === f.home)!;
  const away = rows.find((r) => r.clubId === f.away)!;
  const { homeScore: hs, awayScore: as } = f.result;
  home.p++; away.p++;
  home.pf += hs; home.pa += as;
  away.pf += as; away.pa += hs;
  if (hs > as) { home.w++; away.l++; home.pts += 2; home.form.push("W"); away.form.push("L"); }
  else if (as > hs) { away.w++; home.l++; away.pts += 2; away.form.push("W"); home.form.push("L"); }
  else { home.d++; away.d++; home.pts++; away.pts++; home.form.push("D"); away.form.push("D"); }
  home.form = home.form.slice(-5);
  away.form = away.form.slice(-5);
}

/** All 17 on the team sheet get an appearance (the bench always gets on in league). */
function matchday17(sheet: TeamSheet): string[] {
  return [...sheet.lineup, ...(sheet.bench ?? [])];
}

function trackUserResult(state: CareerState, f: Fixture, sheet: TeamSheet) {
  const r = f.result!;
  const isHome = f.home === state.userClubId;
  const us = isHome ? r.homeScore : r.awayScore;
  const them = isHome ? r.awayScore : r.homeScore;
  const opponent = isHome ? f.away : f.home;
  const t = state.seasonTrack;
  const won = us > them;
  const drew = us === them;

  if (f.kind === "league") {
    t.unbeatenRun = won || drew ? t.unbeatenRun + 1 : 0;
    t.bestUnbeatenRun = Math.max(t.bestUnbeatenRun, t.unbeatenRun);
    t.pointsScored += us;
  }
  if (won) t.biggestWinMargin = Math.max(t.biggestWinMargin, us - them);
  if (f.kind === "cup") {
    // Reaching the next round = round index (R1 win → reached R16 = 2 … final win → 6).
    t.cupRoundReached = Math.max(t.cupRoundReached, won ? f.round + 1 : f.round);
  }
  for (const id of matchday17(sheet)) {
    if (state.players[id]?.academy && !t.academyDebutIds.includes(id)) t.academyDebutIds.push(id);
  }

  // Derbies: a record for the season, and a win pays a bonus, a little Legacy and a lift next game.
  if (isDerby(state, f)) {
    const d = (t.derbies ??= { w: 0, d: 0, l: 0 });
    if (won) d.w++;
    else if (drew) d.d++;
    else d.l++;
    if (won) {
      const cash = derbyBonus(userClub(state).division);
      state.budget += cash;
      t.bonusLegacy = (t.bonusLegacy ?? 0) + DERBY_LEGACY;
      t.moraleAt = nextUserMatchday(state);
      addNews(state, `Derby win over ${state.clubs[opponent]?.name ?? "them"}! +${formatMoney(cash)}, +${DERBY_LEGACY} Legacy.`);
    }
  }
  // The supporters and the board have their say.
  moodAfterGame(state, f, us, them, isDerby(state, f));
  if (won && (f.kind === "nrl-final" || f.kind === "nrl-gf")) noteFinalsWin(state);
  // Young men getting games come on during the season too: a point at 10 and 20 appearances.
  for (const id of matchday17(sheet)) {
    const p = state.players[id];
    if (!p || p.age > 21 || (p.apps !== 10 && p.apps !== 20) || p.rating >= p.potential) continue;
    if (rngFor(state.seed, state.year, "grow", id, p.apps)() < 0.5) {
      p.rating += 1;
      p.grew = (p.grew ?? 0) + 1;
      addNews(state, `${p.name} is coming on with games: +1 rating (${p.rating}).`);
    }
  }
  if (isMagicWeekend(f) && won) {
    t.bonusLegacy = (t.bonusLegacy ?? 0) + MAGIC_WEEKEND_LEGACY;
    addNews(state, `${f.division === "nrl" ? "Magic Round" : "Magic Weekend"} win! +${MAGIC_WEEKEND_LEGACY} Legacy.`);
  }

  for (const c of state.challenges) {
    if (c.done) continue;
    switch (c.kind) {
      case "beat-club":
        if (won && opponent === c.clubId) c.progress = 1;
        break;
      case "big-win":
        c.progress = Math.max(c.progress, won ? us - them : 0);
        break;
      case "unbeaten-run":
        c.progress = Math.max(c.progress, t.bestUnbeatenRun);
        break;
      case "academy-debuts":
        c.progress = t.academyDebutIds.length;
        break;
      case "points-scored":
        c.progress = t.pointsScored;
        break;
      case "cup-reach":
        c.progress = t.cupRoundReached;
        break;
      case "win-games": {
        const row = state.tables[userClub(state).division].find((x) => x.clubId === state.userClubId);
        c.progress = row?.w ?? 0;
        break;
      }
    }
    if (c.kind !== "finish-top" && c.progress >= c.target) {
      c.done = true;
      state.budget += c.rewardCash;
      addNews(state, `Challenge complete: ${c.title} (+${formatMoney(c.rewardCash)}, +${c.rewardLegacy} Legacy).`);
    }
  }

  const oppName = state.clubs[opponent]?.name ?? opponent;
  const verdict = won ? "beat" : drew ? "drew with" : "lost to";
  addNews(state, `${f.label}: ${userClub(state).short} ${verdict} ${oppName} ${us}–${them}${r.goldenPoint ? " (golden point)" : ""}.`);
}

/** Legacy for winning your Magic Weekend game. */
export const MAGIC_WEEKEND_LEGACY = 10;

/** Index of the user's next matchday after this one (a knockout round still to be drawn counts). */
function nextUserMatchday(state: CareerState): number {
  for (let i = state.matchdayIndex + 1; i < state.calendar.length; i++) {
    const md = state.calendar[i]!;
    if (userFixture(md, state.userClubId) || md.pendingDraw) return i;
  }
  return state.matchdayIndex + 1;
}

/** The user's fixture on a matchday, if any. */
export function userFixture(md: Matchday | undefined, userClubId: string): Fixture | undefined {
  return md?.fixtures.find((f) => f.home === userClubId || f.away === userClubId);
}

/**
 * Play the current matchday (all competitions). Returns the new state.
 * If the season finishes, the state moves to the "review" phase with `lastOutcome` set.
 */
/** A result the user played out live; used instead of the instant sim for their fixture. */
export interface PlayedResult {
  fixtureId: string;
  result: FixtureResult;
}

export function playMatchday(state: CareerState, played?: PlayedResult): CareerState {
  if (state.phase !== "season") return state;
  const next: CareerState = structuredClone(state);
  playMatchdayInPlace(next, played);
  return next;
}

/** Plays one matchday by mutating `next` (callers clone first). */
function playMatchdayInPlace(next: CareerState, played?: PlayedResult): void {
  if (next.phase !== "season") return;
  // Deadline Day waits for the manager: nothing kicks off until they shut the window.
  if (deadlineDecisionPending(next)) return;
  // Kicking off Round 1 ends pre-season (friendlies skipped if none were picked).
  if (next.matchdayIndex === 0 && !(next.preseason?.year === next.year && next.preseason.done)) {
    next.preseason = { year: next.year, done: true, results: next.preseason?.year === next.year ? next.preseason.results : [] };
  }
  const md = next.calendar[next.matchdayIndex];
  if (!md) {
    finishSeason(next);
    return;
  }
  drawPending(next, md);
  for (const id of next.lineup) {
    const p = next.players[id];
    if (p?.ban) addNews(next, `${p.name} is banned for this game.`);
  }
  fixTeam(next);
  {
    // A banned (or dropped) captain: someone else leads the side this week.
    const cap = next.captainId ? next.players[next.captainId] : undefined;
    const lead = userCaptain(next);
    if (userFixture(md, next.userClubId) && cap?.ban && lead && lead !== cap.id) {
      addNews(next, `Captain ${cap.name} is banned. ${next.players[lead]!.name} leads the side.`);
    }
  }

  for (const f of md.fixtures) {
    const rng = rngFor(next.seed, next.year, f.id);
    const home = sheetFor(next, f.home);
    const away = sheetFor(next, f.away);
    f.result =
      played && played.fixtureId === f.id
        ? structuredClone(played.result)
        : simulateMatch(rng, home, away, next.players, { knockout: isKnockout(f.kind), neutral: isMagicWeekend(f) });
    recordLineups(next, f, home, away);
    applyLeagueResult(next, f);
    // Match ratings, stats (season, career, at the club), Player of the Match and club records.
    settleFixture(next, f, home, away);
    if (f.home === next.userClubId) trackUserResult(next, f, home);
    else if (f.away === next.userClubId) trackUserResult(next, f, away);
    applyBans(next, f);
    applyInjuries(next, f, home, away);
  }
  applyByes(next, md);
  // A man just sent off drops out of your 17 now (the bench covers), so the Team tab is right.
  fixTeam(next);

  // Headline results the user cares about even when not involved.
  for (const f of md.fixtures) {
    if (f.kind === "grand-final" || f.kind === "nrl-gf" || (f.kind === "cup" && f.round === 5)) {
      const w = winnerOf(f);
      if (w && w !== next.userClubId) {
        addNews(next, `${next.clubs[w]!.name} win the ${f.kind === "grand-final" ? "Grand Final" : f.kind === "nrl-gf" ? "NRL Grand Final" : "Challenge Cup"}.`);
        // The Grand Finals are their league's news; the Challenge Cup is everyone's.
        if (f.kind !== "cup") tagNews(next, next.news[0]!, [w]);
      }
    }
    if (f.kind === "wcc") wccPlayed(next, f);
  }

  // Now and then something happens off the field (a pop-up on the hub).
  rollRandomEvent(next, next.matchdayIndex);
  // A worried board or angry fans say so (once a season each).
  moodWarnings(next);

  md.played = true;
  next.matchdayIndex++;
  // Draw the next knockout round now so the hub can show the upcoming tie.
  const upcoming = next.calendar[next.matchdayIndex];
  if (upcoming?.pendingDraw || upcoming?.nrlDraw) drawPending(next, upcoming);
  pruneNewsTags(next);
  next.updatedAt = Date.now();
  if (next.matchdayIndex >= next.calendar.length) finishSeason(next);
  // Mid-season window: AI deals, Deadline Day and rival bids for the round now coming up.
  else onMatchdayReached(next);
}

/** Legacy for winning the World Club Challenge (on top of the trophy). */
export const WCC_LEGACY = 80;

/** The World Club Challenge has been played: the news and a pop-up for everyone. */
function wccPlayed(state: CareerState, f: Fixture) {
  const w = winnerOf(f);
  const r = f.result;
  if (!w || !r) return;
  const loser = w === f.home ? f.away : f.home;
  const ws = Math.max(r.homeScore, r.awayScore);
  const ls = Math.min(r.homeScore, r.awayScore);
  const mine = w === state.userClubId || loser === state.userClubId;
  const score = `${ws}–${ls}${r.goldenPoint ? " (golden point)" : ""}`;
  const line =
    w === state.userClubId
      ? `World champions! You beat ${state.clubs[loser]!.name} ${score} in the ${WCC_LABEL}.`
      : `${state.clubs[w]!.name} beat ${state.clubs[loser]!.name} ${score} in the ${WCC_LABEL}.`;
  addNews(state, line);
  pushEvent(state, {
    id: `wcc:${state.year}`,
    kind: "world-club-challenge",
    year: state.year,
    clubId: w,
    amount: w === state.userClubId ? WCC_PRIZE : undefined,
    title: w === state.userClubId ? "World champions!" : `${state.clubs[w]!.short} are world champions`,
    text: mine
      ? w === state.userClubId
        ? `You beat ${state.clubs[loser]!.name} ${score}. The ${WCC_LABEL} is yours.`
        : `${state.clubs[w]!.name} beat you ${score} in the ${WCC_LABEL}.`
      : `${state.clubs[w]!.name} beat ${state.clubs[loser]!.name} ${score} in the ${WCC_LABEL}.`,
    options: [{ id: "ok", label: w === state.userClubId ? "Get in" : "OK" }],
  });
  if (w === state.userClubId) state.budget += WCC_PRIZE;
}

/** Prize money for winning the World Club Challenge. */
export const WCC_PRIZE = 150_000;

/** Keep each club's latest team sheet so tapping a club name shows who actually played. */
function recordLineups(state: CareerState, f: Fixture, home: TeamSheet, away: TeamSheet) {
  if (!f.result) return;
  const at = state.matchdayIndex;
  // The other game's team sheets (the NRL for a Super League manager, and the other way) aren't
  // kept: their club sheets show the expected XIII instead (v1.65, saves stay small).
  const mine = state.clubs[state.userClubId]?.division === "nrl";
  if ((state.clubs[f.home]?.division === "nrl") !== mine && (state.clubs[f.away]?.division === "nrl") !== mine) return;
  const book = (state.lastLineups ??= {});
  book[f.home] = { fixtureId: f.id, label: f.label, opponentId: f.away, home: true, us: f.result.homeScore, them: f.result.awayScore, lineup: [...home.lineup], bench: [...(home.bench ?? [])], at };
  book[f.away] = { fixtureId: f.id, label: f.label, opponentId: f.home, home: false, us: f.result.awayScore, them: f.result.homeScore, lineup: [...away.lineup], bench: [...(away.bench ?? [])], at };
}

/** True when the matchday involves the user or is a showpiece worth stopping for. */
export function isBigMatchday(state: CareerState, md: Matchday | undefined): boolean {
  if (!md) return false;
  const f = userFixture(md, state.userClubId);
  if (!f) return false;
  return f.kind !== "league";
}

/** Sim forward until the next matchday that matters (cup tie, play-off, final) or season end. */
export function simToNextBigGame(state: CareerState): CareerState {
  if (state.phase !== "season") return state;
  const s: CareerState = structuredClone(state);
  playMatchdayInPlace(s);
  let guard = 0;
  while (s.phase === "season" && guard++ < 60) {
    if (isBigMatchday(s, s.calendar[s.matchdayIndex])) break;
    if (deadlineDecisionPending(s)) break;
    playMatchdayInPlace(s);
  }
  return s;
}

export function simRestOfSeason(state: CareerState): CareerState {
  if (state.phase !== "season") return state;
  const s: CareerState = structuredClone(state);
  let guard = 0;
  while (s.phase === "season" && guard++ < 60) {
    if (deadlineDecisionPending(s)) break;
    playMatchdayInPlace(s);
  }
  return s;
}

/* ---------------------------------------------------------------- season end */

const PRIZE: Record<Division, (position: number, size: number) => number> = {
  "super-league": (pos) => Math.max(200_000, 900_000 - (pos - 1) * 50_000),
  championship: (pos, size) => Math.max(80_000, Math.round(380_000 - ((pos - 1) * 300_000) / (size - 1))),
  nrl: (pos) => Math.max(400_000, 1_400_000 - (pos - 1) * 70_000),
};
/** Extra prize money for reaching each NRL finals week (1 = made the eight … 4 = the Grand Final). */
const NRL_FINALS_PRIZE = [0, 100_000, 160_000, 240_000, 360_000];
const CUP_PRIZE = [0, 10_000, 25_000, 50_000, 100_000, 160_000, 300_000];

export const LEGACY_FOR_TROPHY: Record<TrophyId, number> = {
  "grand-final": 100,
  "league-leaders": 60,
  "challenge-cup": 60,
  "championship-title": 50,
  promotion: 40,
  "million-pound-game": 40,
  "perfect-season": 200,
  "nrl-premiership": 100,
  "minor-premiership": 60,
  "world-club-challenge": WCC_LEGACY,
};

export const TROPHY_LABEL: Record<TrophyId, string> = {
  "grand-final": "Super League Grand Final",
  "league-leaders": "League Leaders' Shield",
  "challenge-cup": "Challenge Cup",
  "championship-title": "Championship title",
  promotion: "Promotion",
  "million-pound-game": "Million Pound Game",
  "perfect-season": "Perfect season",
  "nrl-premiership": "NRL Premiership",
  "minor-premiership": "Minor Premiership",
  "world-club-challenge": "World Club Challenge",
};

function finishSeason(state: CareerState): CareerState {
  const s = state;
  const club = userClub(s);
  const division = club.division;
  const table = sortTable(s.tables[division]);
  const position = table.findIndex((r) => r.clubId === club.id) + 1;
  const row = table[position - 1]!;
  const slTable = sortTable(s.tables["super-league"]);
  const chTable = sortTable(s.tables.championship);

  const trophies: TrophyId[] = [];
  const all = s.calendar.flatMap((m) => m.fixtures);
  const gf = all.find((f) => f.kind === "grand-final");
  const nrlGf = all.find((f) => f.kind === "nrl-gf");
  const wcc = all.find((f) => f.kind === "wcc");
  const cupFinal = all.find((f) => f.kind === "cup" && f.round === 5);
  const mpg = all.find((f) => f.kind === "mpg");

  if (wcc && winnerOf(wcc) === club.id) trophies.push("world-club-challenge");
  if (gf && winnerOf(gf) === club.id) trophies.push("grand-final");
  if (nrlGf && winnerOf(nrlGf) === club.id) trophies.push("nrl-premiership");
  if (division === "super-league" && position === 1) trophies.push("league-leaders");
  if (division === "nrl" && position === 1 && row.p > 0) trophies.push("minor-premiership");
  if (cupFinal && winnerOf(cupFinal) === club.id) trophies.push("challenge-cup");
  if (division === "championship" && position === 1) trophies.push("championship-title");
  // Next year's World Club Challenge: this year's champions.
  recordChampions(s, s.year, gf ? winnerOf(gf) ?? undefined : undefined, nrlGf ? winnerOf(nrlGf) ?? undefined : undefined);
  // How far the user got in the NRL finals (1 = made the eight … 4 = the Grand Final).
  const nrlWeeks = division === "nrl"
    ? Math.max(0, ...all.filter((f) => isNrlFinalKind(f.kind) && (f.home === club.id || f.away === club.id)).map((f) => (f.kind === "nrl-gf" ? 4 : f.round)))
    : 0;

  // Promotion / relegation: Championship champions up, Super League bottom down,
  // Million Pound Game decides one more place. (Not the NRL: nobody goes up or down.)
  const promoted = new Set<string>(chTable[0] ? [chTable[0].clubId] : []);
  const relegated = new Set<string>(slTable.length ? [slTable[slTable.length - 1]!.clubId] : []);
  if (mpg) {
    const w = winnerOf(mpg);
    if (w === mpg.away) {
      promoted.add(mpg.away);
      relegated.add(mpg.home);
    }
    if (w === club.id) trophies.push("million-pound-game");
  }
  const userPromoted = promoted.has(club.id);
  const userRelegated = relegated.has(club.id);
  if (userPromoted) trophies.push("promotion");
  if (row.p > 0 && row.w === row.p) trophies.push("perfect-season");

  // Awards, while every club is still in the division it played in.
  const awards = computeSeasonAwards(s);
  const mos = userWonManOfSteel(s, awards);

  for (const id of promoted) s.clubs[id]!.division = "super-league";
  for (const id of relegated) s.clubs[id]!.division = "championship";

  // Money
  let prize = PRIZE[division](position, table.length);
  prize += CUP_PRIZE[Math.min(6, s.seasonTrack.cupRoundReached)] ?? 0;
  prize += NRL_FINALS_PRIZE[nrlWeeks] ?? 0;
  if (trophies.includes("grand-final")) prize += 400_000;
  if (trophies.includes("nrl-premiership")) prize += 600_000;
  if (userPromoted) prize += 600_000;

  // Challenges settled at season end
  for (const c of s.challenges) {
    if (c.kind === "finish-top" && !c.done) {
      c.progress = position;
      if (position <= c.target) {
        c.done = true;
        s.budget += c.rewardCash;
      }
    }
  }
  const challengeLegacy = s.challenges.filter((c) => c.done).reduce((sum, c) => sum + c.rewardLegacy, 0);
  const legacyEarned =
    trophies.reduce((sum, t) => sum + LEGACY_FOR_TROPHY[t], 0) +
    challengeLegacy +
    (s.seasonTrack.bonusLegacy ?? 0) +
    (mos ? MAN_OF_STEEL_LEGACY : 0);

  // Prestige
  let delta = 0;
  if (trophies.includes("grand-final") || trophies.includes("nrl-premiership")) delta += 1;
  if (trophies.includes("league-leaders") || trophies.includes("challenge-cup") || trophies.includes("minor-premiership")) delta += 0.5;
  if (trophies.includes("world-club-challenge")) delta += 0.5;
  if (userPromoted) delta += 0.5;
  if (division === "super-league" && position <= 6 && !trophies.includes("grand-final")) delta += 0.5;
  if (division === "nrl" && position <= NRL_FINALISTS && !trophies.includes("nrl-premiership")) delta += 0.5;
  if (userRelegated) delta -= 1;
  else if (division === "super-league" && position >= table.length - 2) delta -= 0.5;
  else if (division === "nrl" && position >= table.length - 2) delta -= 0.5;
  s.prestige = Math.max(1, Math.min(5, s.prestige + Math.min(1.5, delta)));

  s.budget += prize;

  // The season's over: knocks heal over the summer.
  for (const p of Object.values(s.players)) if (p.injury) delete p.injury;
  const squad = squadOf(s, club.id).sort((a, b) => b.tries - a.tries);
  const top = squad[0];
  // The board's verdict and the fans' mood; the season's signings and sales for the history.
  const boardTarget = s.board?.year === s.year ? s.board.target : undefined;
  const verdict = settleSeasonMood(s, {
    position,
    target: boardTarget,
    trophies: trophies.filter((t) => t !== "promotion" && t !== "perfect-season").length,
    promoted: userPromoted,
    relegated: userRelegated,
  });
  const deals = seasonDealsFor(s, s.year);
  const outcome: SeasonOutcome = {
    year: s.year,
    division,
    position,
    played: row.p,
    won: row.w,
    drawn: row.d,
    lost: row.l,
    trophies,
    promoted: userPromoted,
    relegated: userRelegated,
    prizeMoney: prize,
    legacyEarned,
    challengesDone: s.challenges.filter((c) => c.done).length,
    topTryScorer: top && top.tries > 0 ? { name: top.name, tries: top.tries } : undefined,
    boardTarget,
    objectives: verdict.objectives.length ? verdict.objectives : undefined,
    confidence: verdict.board,
    fans: verdict.fans,
    ins: deals.ins,
    outs: deals.outs,
    awards,
    derbies: s.seasonTrack.derbies ? { ...s.seasonTrack.derbies } : undefined,
    // Who won what, the play-offs, the cup and every result of yours: kept for the history.
    story: buildSeasonStory(s),
  };
  if ((trophies.includes("grand-final") || trophies.includes("nrl-premiership")) && s.firstGrandFinalSeason == null) s.firstGrandFinalSeason = s.seasonNumber;
  s.lastOutcome = outcome;
  s.history = [...s.history, outcome];
  s.phase = "review";
  addNews(s, `${s.year} season over: ${ordinal(position)} in the ${DIVISION_LABEL[division]}.`);
  const topDiv = division === "nrl" ? "nrl" : "super-league";
  const steel = awards.find((a) => a.id === "man-of-steel" && a.division === topDiv);
  if (steel) {
    addNews(s, `${awardLabel(steel)}: ${steel.name} (${steel.clubName}).`);
    // The league's best player: that league's news (the user's own winner is untagged).
    if (steel.clubId !== s.userClubId) s.newsTags = { ...(s.newsTags ?? {}), [s.news[0]!]: [topDiv] };
  }
  if (mos) addNews(s, mos.division === "nrl" ? `${mos.name} wins the Dally M Medal! +${MAN_OF_STEEL_LEGACY} Legacy.` : `${mos.name} is Man of Steel! +${MAN_OF_STEEL_LEGACY} Legacy.`);
  return s;
}

/** The user's signings and sales in `year`: the running record, or (older saves) what the capped deals list still has. */
export function seasonDealsFor(s: CareerState, year: number): { ins: SeasonDeal[]; outs: SeasonDeal[] } {
  if (s.seasonDeals?.year === year) return { ins: [...s.seasonDeals.ins], outs: [...s.seasonDeals.outs] };
  const me = s.userClubId;
  const mine = (s.transfers ?? []).filter((d) => d.year === year && (d.from === me || d.to === me)).reverse();
  const entry = (d: (typeof mine)[number], other: string | null): SeasonDeal => ({ name: d.playerName, pos: d.pos, rating: d.rating, club: other, fee: d.fee });
  return { ins: mine.filter((d) => d.to === me).map((d) => entry(d, d.from)), outs: mine.filter((d) => d.from === me).map((d) => entry(d, d.to)) };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

