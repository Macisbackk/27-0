import { simulateMatch, type TeamSheet } from "./match";
import { deadlineDecisionPending, onMatchdayReached } from "./midseason";
import { autoPickBench, autoPickLineup, fillLineupGaps, teamRating, formatMoney, wageBill } from "./players";
import { rngFor, shuffle } from "./rng";
import { CUP_ROUND_LABELS, buildCalendar } from "./schedule";
import { DIVISION_LABEL } from "./clubs";
import { boardTargetForRank } from "./board";
import type {
  CareerState,
  ChallengeKind,
  Division,
  Fixture,
  FixtureKind,
  FixtureResult,
  Matchday,
  SeasonChallenge,
  SeasonOutcome,
  TableRow,
  TrophyId,
} from "./types";

export const DIVISIONS: Division[] = ["super-league", "championship"];

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

/** Players who can be picked: the squad minus anyone serving a ban. */
export function availableSquad(state: CareerState, clubId: string) {
  return squadOf(state, clubId).filter((p) => !p.ban);
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
const aiTeamCache = new Map<string, { lineup: string[]; bench: string[] }>();
function aiTeam(state: CareerState, clubId: string): { lineup: string[]; bench: string[] } {
  const squad = state.clubs[clubId]?.squad ?? [];
  const banned = squad.filter((id) => state.players[id]?.ban).join(",");
  const key = `${state.seed}|${state.year}|${clubId}|${squad.join(",")}|${banned}`;
  const hit = aiTeamCache.get(key);
  if (hit) return hit;
  const players = availableSquad(state, clubId);
  const lineup = autoPickLineup(players);
  const team = { lineup, bench: autoPickBench(players, lineup) };
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
  const rounds = division === "super-league" ? 26 : 21;
  // 1 = favourites … 0 = expected to finish bottom.
  const share = 1 - (expectedRank - 1) / (size - 1);
  const tier: "strong" | "mid" | "weak" = share >= 0.7 ? "strong" : share >= 0.35 ? "mid" : "weak";
  const academyCount = club.squad.filter((id) => state.players[id]?.academy).length;

  const kinds = shuffle(rng, CHALLENGE_KINDS).filter((k) => k !== "academy-debuts" || academyCount >= 2);
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
          title: target === 1 ? `Finish top of the ${DIVISION_LABEL[division]}` : `Finish in the top ${target}`,
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
  return userClub(state).division === "super-league"
    ? 500_000 + Math.round(state.prestige * 200_000)
    : 150_000 + Math.round(state.prestige * 80_000);
}

export function startSeason(state: CareerState): CareerState {
  const next: CareerState = structuredClone(state);
  const rng = rngFor(next.seed, next.year, "calendar");
  const divisions: Record<Division, string[]> = {
    "super-league": clubsIn(next, "super-league"),
    championship: clubsIn(next, "championship"),
  };

  // Challenge Cup: all 14 Super League clubs + the 18 strongest Championship clubs (always incl. the user).
  const champRanked = expectedRanking(next, "championship");
  const champEntrants = champRanked.slice(0, 18);
  if (!champEntrants.includes(next.userClubId) && next.clubs[next.userClubId]!.division === "championship") {
    champEntrants[champEntrants.length - 1] = next.userClubId;
  }
  next.calendar = buildCalendar(rng, next.year, divisions, [...divisions["super-league"], ...champEntrants]);
  next.matchdayIndex = 0;
  next.tables = {
    "super-league": divisions["super-league"].map(emptyRow),
    championship: divisions.championship.map(emptyRow),
  };
  for (const p of Object.values(next.players)) {
    p.apps = 0;
    p.tries = 0;
  }
  fixTeam(next);
  next.seasonTrack = {
    unbeatenRun: 0,
    bestUnbeatenRun: 0,
    biggestWinMargin: 0,
    academyDebutIds: [],
    pointsScored: 0,
    cupRoundReached: 0,
  };
  next.challenges = buildChallenges(next);
  {
    const division = userClub(next).division;
    const ranking = expectedRanking(next, division);
    next.board = { year: next.year, target: boardTargetForRank(division, ranking.indexOf(next.userClubId) + 1, ranking.length) };
  }
  next.phase = "season";
  next.lastOutcome = undefined;
  const income = seasonIncome(next);
  const wages = wageBill(squadOf(next, next.userClubId));
  next.budget += income - wages;
  next.lastWages = wages;
  next.lastIncome = income;
  addNews(
    next,
    `${next.year} season begins in the ${DIVISION_LABEL[userClub(next).division]}. Board income ${formatMoney(income)}, wages ${formatMoney(wages)}.`
  );
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
}

/** A copy with the XIII and bench repaired (for saves, sales and deals that changed the squad). */
export function withTeamFixed(state: CareerState): CareerState {
  return { ...state, ...repairTeam(state, state.lineup ?? [], state.bench ?? []) };
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

/** Bring a loaded save up to date: saves from before the interchange get a bench picked. */
export function migrateCareer<T extends CareerState | null>(state: T): T {
  if (!state || Array.isArray(state.bench)) return state;
  return withTeamFixed({ ...state, bench: [] }) as T;
}

/** Best XIII and the best bench to go with it. */
export function autoPickTeam(state: CareerState): { lineup: string[]; bench: string[] } {
  const squad = availableSquad(state, state.userClubId);
  const lineup = autoPickLineup(squad);
  return { lineup, bench: autoPickBench(squad, lineup) };
}

/* ------------------------------------------------------------------ draws */

function knockoutWinners(md: Matchday | undefined): string[] {
  return (md?.fixtures ?? []).map(winnerOf).filter((x): x is string => !!x);
}

function drawPending(state: CareerState, md: Matchday) {
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

/* --------------------------------------------------------------- play matchday */

export function sheetFor(state: CareerState, clubId: string): TeamSheet {
  if (clubId === state.userClubId) {
    const pre = state.preseason;
    // Pre-season friendlies: a little match sharpness for the opening three matchdays.
    const boost = pre && pre.year === state.year && state.matchdayIndex < 3 ? pre.results.length * 0.5 : 0;
    return { clubId, lineup: state.lineup, bench: userBench(state), tactic: state.tactic, boost };
  }
  const team = aiTeam(state, clubId);
  return { clubId, lineup: team.lineup, bench: team.bench, tactic: "balanced" };
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

function creditPlayers(state: CareerState, sheet: TeamSheet, tries: string[]) {
  for (const id of matchday17(sheet)) {
    const p = state.players[id];
    if (!p) continue;
    p.apps++;
    p.careerApps++;
  }
  for (const id of tries) {
    const p = state.players[id];
    if (!p) continue;
    p.tries++;
    p.careerTries++;
  }
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

  for (const f of md.fixtures) {
    const rng = rngFor(next.seed, next.year, f.id);
    const home = sheetFor(next, f.home);
    const away = sheetFor(next, f.away);
    f.result =
      played && played.fixtureId === f.id
        ? structuredClone(played.result)
        : simulateMatch(rng, home, away, next.players, { knockout: isKnockout(f.kind) });
    recordLineups(next, f, home, away);
    applyLeagueResult(next, f);
    creditPlayers(next, home, f.result.homeTries);
    creditPlayers(next, away, f.result.awayTries);
    if (f.home === next.userClubId) trackUserResult(next, f, home);
    else if (f.away === next.userClubId) trackUserResult(next, f, away);
    applyBans(next, f);
  }
  // A man just sent off drops out of your 17 now (the bench covers), so the Team tab is right.
  fixTeam(next);

  // Headline results the user cares about even when not involved.
  for (const f of md.fixtures) {
    if (f.kind === "grand-final" || (f.kind === "cup" && f.round === 5)) {
      const w = winnerOf(f);
      if (w && w !== next.userClubId) addNews(next, `${next.clubs[w]!.name} win the ${f.kind === "grand-final" ? "Grand Final" : "Challenge Cup"}.`);
    }
  }

  md.played = true;
  next.matchdayIndex++;
  // Draw the next knockout round now so the hub can show the upcoming tie.
  const upcoming = next.calendar[next.matchdayIndex];
  if (upcoming?.pendingDraw) drawPending(next, upcoming);
  next.updatedAt = Date.now();
  if (next.matchdayIndex >= next.calendar.length) finishSeason(next);
  // Mid-season window: AI deals, Deadline Day and rival bids for the round now coming up.
  else onMatchdayReached(next);
}

/** Keep each club's latest team sheet so tapping a club name shows who actually played. */
function recordLineups(state: CareerState, f: Fixture, home: TeamSheet, away: TeamSheet) {
  if (!f.result) return;
  const at = state.matchdayIndex;
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
};
const CUP_PRIZE = [0, 10_000, 25_000, 50_000, 100_000, 160_000, 300_000];

export const LEGACY_FOR_TROPHY: Record<TrophyId, number> = {
  "grand-final": 100,
  "league-leaders": 60,
  "challenge-cup": 60,
  "championship-title": 50,
  promotion: 40,
  "million-pound-game": 40,
  "perfect-season": 200,
};

export const TROPHY_LABEL: Record<TrophyId, string> = {
  "grand-final": "Super League Grand Final",
  "league-leaders": "League Leaders' Shield",
  "challenge-cup": "Challenge Cup",
  "championship-title": "Championship title",
  promotion: "Promotion",
  "million-pound-game": "Million Pound Game",
  "perfect-season": "Perfect season",
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
  const cupFinal = all.find((f) => f.kind === "cup" && f.round === 5);
  const mpg = all.find((f) => f.kind === "mpg");

  if (gf && winnerOf(gf) === club.id) trophies.push("grand-final");
  if (division === "super-league" && position === 1) trophies.push("league-leaders");
  if (cupFinal && winnerOf(cupFinal) === club.id) trophies.push("challenge-cup");
  if (division === "championship" && position === 1) trophies.push("championship-title");

  // Promotion / relegation: Championship champions up, Super League bottom down,
  // Million Pound Game decides one more place.
  const promoted = new Set<string>([chTable[0]!.clubId]);
  const relegated = new Set<string>([slTable[slTable.length - 1]!.clubId]);
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

  for (const id of promoted) s.clubs[id]!.division = "super-league";
  for (const id of relegated) s.clubs[id]!.division = "championship";

  // Money
  let prize = PRIZE[division](position, table.length);
  prize += CUP_PRIZE[Math.min(6, s.seasonTrack.cupRoundReached)] ?? 0;
  if (trophies.includes("grand-final")) prize += 400_000;
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
  const legacyEarned = trophies.reduce((sum, t) => sum + LEGACY_FOR_TROPHY[t], 0) + challengeLegacy;

  // Prestige
  let delta = 0;
  if (trophies.includes("grand-final")) delta += 1;
  if (trophies.includes("league-leaders") || trophies.includes("challenge-cup")) delta += 0.5;
  if (userPromoted) delta += 0.5;
  if (division === "super-league" && position <= 6 && !trophies.includes("grand-final")) delta += 0.5;
  if (userRelegated) delta -= 1;
  else if (division === "super-league" && position >= table.length - 2) delta -= 0.5;
  s.prestige = Math.max(1, Math.min(5, s.prestige + Math.min(1.5, delta)));

  s.budget += prize;

  const squad = squadOf(s, club.id).sort((a, b) => b.tries - a.tries);
  const top = squad[0];
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
    boardTarget: s.board?.year === s.year ? s.board.target : undefined,
  };
  if (trophies.includes("grand-final") && s.firstGrandFinalSeason == null) s.firstGrandFinalSeason = s.seasonNumber;
  s.lastOutcome = outcome;
  s.history = [...s.history, outcome];
  s.phase = "review";
  addNews(s, `${s.year} season over: ${ordinal(position)} in the ${DIVISION_LABEL[division]}.`);
  return s;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

