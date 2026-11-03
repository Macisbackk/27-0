/**
 * Manager Mode: the NRL (v1.65) and the World Club Challenge.
 *   - the NRL world: 17 clubs on the real 2026 squads, every club able to field a natural 17
 *   - an NRL career for every NRL club (start, the first weeks, a full season for a few)
 *   - the season: 27 rounds, 24 games and 3 byes each (2 points a bye), the top-eight finals
 *   - the World Club Challenge every pre-season, with last year's champions
 *   - trophies, awards (Dally M, Clive Churchill), records, the market and the salary cap
 *   - an old save gaining the NRL, and save sizes
 *   - calibration: scores, home wins, the ladder, the minor premiers and the WCC
 * Run: npx tsx scripts/test-nrl-career.ts
 */
import {
  NRL_BYES,
  NRL_BYE_POINTS,
  NRL_DATA,
  NRL_GAMES,
  NRL_ROUNDS,
  NRL_SALARY_CAP,
  TROPHY_LABEL,
  autoPickLineup,
  awardLabel,
  bankSeason,
  beginOffseason,
  buildMarket,
  buildWorld,
  buyPlayer,
  clubRating,
  clubsIn,
  closeDeadlineDay,
  createCareer,
  currentStage,
  emptyLegacy,
  expectedRanking,
  finishDepartures,
  finishTransfers,
  hallOfFame,
  honoursBoard,
  leagueOverPicture,
  markStageSeen,
  migrateCareer,
  nrlBracket,
  nrlHonours,
  playFriendlies,
  playMatchday,
  pendingEvent,
  resolveEvent,
  seasonProgress,
  seasonReviewData,
  skipIdleWeeks,
  slotPenalty,
  sortTable,
  squadOf,
  userFixture,
  wageBill,
  winnerOf,
  LINEUP_SLOTS,
  SQUAD_MAX,
  type CareerState,
  type Fixture,
} from "../src/lib/career";
import { isCareer } from "../src/lib/career/storage";

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`❌ ${msg}`);
  }
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const all = (s: CareerState) => s.calendar.flatMap((m) => m.fixtures);
const nrlIds = NRL_DATA.clubs.map((c) => c.id);

/** Play to the end of the season like a manager who sims everything (Deadline Day shut at once). */
function simSeason(s: CareerState): CareerState {
  for (let g = 0; s.phase === "season" && g < 90; g++) s = playMatchday(closeDeadlineDay(s));
  return s;
}
function nextSeason(s: CareerState): CareerState {
  return finishTransfers(finishDepartures(beginOffseason(s)));
}

/* ------------------------------------------------------------------ the world */
console.log("NRL world");
{
  const w = buildWorld("nrl-world");
  const nrl = w.choices.filter((c) => c.division === "nrl");
  check(nrl.length === 17, `17 NRL clubs to pick (${nrl.length})`);
  check(new Set(nrl.map((c) => c.short)).size === 17 && !w.choices.some((c) => c.division !== "nrl" && nrl.some((n) => n.short === c.short)), "NRL short names are unique (Knights KNI, not Newcastle Thunder's NEW)");
  check(nrl.every((c) => /^#[0-9a-f]{6}$/i.test(c.primary) && /^#[0-9a-f]{6}$/i.test(c.secondary)), "NRL clubs carry their colours");
  check(nrl.every((c) => c.prestige >= 3 && c.prestige <= 5), `NRL prestige 3–5 (${nrl.map((c) => c.prestige).join(",")})`);
  check(nrl.every((c) => c.realPlayers >= 20), `every NRL club is mostly real players (min ${Math.min(...nrl.map((c) => c.realPlayers))})`);
  const sl = w.choices.filter((c) => c.division === "super-league");
  check(avg(nrl.map((c) => c.rating)) > avg(sl.map((c) => c.rating)), `NRL XIIIs rate above Super League's on average (${avg(nrl.map((c) => c.rating)).toFixed(1)} v ${avg(sl.map((c) => c.rating)).toFixed(1)})`);
  let unnatural = 0;
  let farOut = 0;
  for (const id of nrlIds) {
    const club = w.clubs[id]!;
    const squad = club.squad.map((p) => w.players[p]!);
    check(squad.length >= 24 && squad.length <= SQUAD_MAX, `${club.short}: squad of ${squad.length}`);
    const xiii = autoPickLineup(squad);
    LINEUP_SLOTS.forEach((slot, i) => {
      const pen = slotPenalty(w.players[xiii[i]!]!, slot);
      if (pen >= 4) unnatural++;
      if (pen >= 8) farOut++;
    });
    check(squad.every((p) => p.rating >= 55 && p.rating <= 99 && p.age >= 17 && p.age <= 40), `${club.short}: ratings and ages in range`);
  }
  // Auto-pick may play a better man a step out of position (a centre on the wing); never far out of it.
  check(farOut === 0 && unnatural <= 4, `NRL XIIIs field natural (or near) positions (${unnatural} more than a step out, ${farOut} far out, across 17 clubs)`);
  const ids = Object.keys(w.players);
  check(new Set(ids).size === ids.length, "no duplicate player ids");
  const cleary = w.players["nrl-nathan-cleary"];
  check(!!cleary && cleary.pos === "SH" && cleary.rating >= 95 && w.clubs["nrl-penrith-panthers"]!.squad.includes(cleary.id), "Nathan Cleary: Penrith's halfback, rated 95+");
  check(Object.values(w.players).filter((p) => nrlIds.some((id) => w.clubs[id]!.squad.includes(p.id))).every((p) => !!p.nationality), "every NRL player has a nationality");
  const rec = hallOfFame(createCareer({ clubId: "nrl-brisbane-broncos", managerName: "T", seed: "hof" }), "nrl-brisbane-broncos");
  check(rec.length === 4 && rec.every((r) => r.record && r.record.value > 0 && !r.careerOnly), "NRL club records (since 1998) in the Hall of Fame");
  check(nrlHonours("nrl-brisbane-broncos").premierships.includes(2025) && nrlHonours("nrl-penrith-panthers").premierships.length >= 4, "real premierships from data/nrl/");
}

/* ------------------------------------------------------------------ every club starts */
console.log("\nEvery NRL club");
for (const id of nrlIds) {
  const s = createCareer({ clubId: id, managerName: "T", seed: `nrl-start-${id}` });
  const club = s.clubs[id]!;
  check(s.startDivision === "nrl" && club.division === "nrl", `${club.short}: an NRL career`);
  check(isCareer(s), `${club.short}: a valid save`);
  check(s.tables.nrl.length === 17 && s.tables["super-league"].length === 14 && s.tables.championship.length === 22, `${club.short}: NRL, Super League and Championship tables`);
  check(s.calendar.length === 35 && s.calendar[0]!.fixtures[0]?.kind === "wcc", `${club.short}: 35 weeks, the World Club Challenge first`);
  const wcc = s.calendar[0]!.fixtures[0]!;
  check(wcc.home === "hull-kr" && wcc.away === "nrl-brisbane-broncos", `${club.short}: 2026 WCC is Hull KR (hosts) v Brisbane Broncos`);
  check(!s.challenges.some((c) => c.kind === "cup-reach"), `${club.short}: no Challenge Cup challenge`);
  check(!!s.board && s.board.target >= 1 && s.board.target <= 17, `${club.short}: board target ${s.board?.target}`);
  check(s.budget >= 100_000, `${club.short}: budget ${s.budget}`);
  check(wageBill(squadOf(s, id)) <= NRL_SALARY_CAP, `${club.short}: starts under the salary cap (${wageBill(squadOf(s, id))})`);
  const labels = s.calendar.filter((m) => /^Round \d+$/.test(m.label));
  check(labels.length === NRL_ROUNDS, `${club.short}: the weeks read NRL Round 1–27 (${labels.length})`);
  check(!all(s).some((f) => f.kind === "cup" && (s.clubs[f.home]!.division === "nrl" || s.clubs[f.away]!.division === "nrl")), `${club.short}: no NRL club in the Challenge Cup`);
  // Pre-season → the WCC (theirs or someone else's) → Round 1.
  let t = playFriendlies(s, []);
  t = skipIdleWeeks(markStageSeen(t, "preseason"));
  if (id === "nrl-brisbane-broncos") {
    check(t.matchdayIndex === 0 && userFixture(t.calendar[0], id)?.kind === "wcc", "Brisbane: the WCC is theirs to play");
    t = skipIdleWeeks(playMatchday(t));
  }
  check(!!t.calendar[0]!.fixtures[0]!.result, `${club.short}: the WCC has been played before Round 1`);
  check(pendingEvent(t)?.kind === "world-club-challenge", `${club.short}: a WCC pop-up`);
  t = resolveEvent(t, pendingEvent(t)!.id);
  check(t.news.some((n) => n.includes("World Club Challenge")), `${club.short}: the WCC is in the news`);
  const f = userFixture(t.calendar[t.matchdayIndex], id);
  check(!!f && f.division === "nrl" && f.kind === "league", `${club.short}: lands on an NRL round (${t.calendar[t.matchdayIndex]?.label})`);
  check(/^Round \d+ of 27$/.test(seasonProgress(t).label), `${club.short}: progress "${seasonProgress(t).label}"`);
  t = playMatchday(t);
  check(t.tables.nrl.find((r) => r.clubId === id)!.p + (t.tables.nrl.find((r) => r.clubId === id)!.b ?? 0) >= 1, `${club.short}: played (or had a bye in) a round`);
}

/* ------------------------------------------------------------------ full seasons */
console.log("\nNRL seasons");
const scores: number[] = [];
let games = 0;
let homeWins = 0;
let draws = 0;
const leaderWins: number[] = [];
const bottomWins: number[] = [];
const minorRank: number[] = [];
const premierRank: number[] = [];
let wccNrlWins = 0;
let wccGames = 0;
const sizes: number[] = [];
for (const [i, clubId] of ["nrl-penrith-panthers", "nrl-wests-tigers", "nrl-dolphins", "nrl-melbourne-storm"].entries()) {
  let s = createCareer({ clubId, managerName: "T", seed: `nrl-season-${i}` });
  let legacy = emptyLegacy();
  let prev: { sl?: string; nrl?: string } = { sl: "hull-kr", nrl: "nrl-brisbane-broncos" };
  for (let season = 1; season <= 4; season++) {
    const label = `${s.clubs[clubId]!.short} ${s.year}`;
    // The WCC: last year's champions, hosts alternating (Super League champions in even years).
    const wcc = s.calendar[0]!.fixtures[0]!;
    const slSide = s.clubs[wcc.home]!.division === "super-league" ? wcc.home : wcc.away;
    const nrlSide = slSide === wcc.home ? wcc.away : wcc.home;
    check(wcc.kind === "wcc" && slSide === prev.sl && nrlSide === prev.nrl, `${label}: WCC is last year's champions (${slSide} v ${nrlSide})`);
    check((wcc.home === slSide) === (s.year % 2 === 0), `${label}: ${s.year % 2 === 0 ? "Super League" : "NRL"} champions host the WCC`);
    const ranking = expectedRanking(s, "nrl");
    s = simSeason(s);
    check(s.phase === "review", `${label}: season ends in review`);
    const fx = all(s);
    check(fx.every((f) => !!f.result), `${label}: every fixture played`);
    const nrlLeague = fx.filter((f) => f.division === "nrl" && f.kind === "league");
    check(nrlLeague.length === (17 * NRL_GAMES) / 2, `${label}: ${nrlLeague.length} NRL league games (204)`);
    const ladder = sortTable(s.tables.nrl);
    check(ladder.every((r) => r.p === NRL_GAMES && r.b === NRL_BYES), `${label}: every club 24 games, 3 byes`);
    check(ladder.every((r) => r.pts === 2 * r.w + r.d + NRL_BYE_POINTS * (r.b ?? 0)), `${label}: ladder points = 2 a win, 1 a draw, 2 a bye`);
    const byeWeeks = s.calendar.filter((m) => m.byes?.length);
    check(byeWeeks.length === NRL_ROUNDS && byeWeeks.every((m) => m.byes!.length === 1 || m.byes!.length === 3), `${label}: one or three byes every round`);
    check(byeWeeks.every((m) => m.byes!.every((id) => !m.fixtures.some((f) => f.division === "nrl" && (f.home === id || f.away === id)))), `${label}: a club on a bye has no game that round`);
    const meets = new Map<string, number>();
    for (const f of nrlLeague) meets.set([f.home, f.away].sort().join(), (meets.get([f.home, f.away].sort().join()) ?? 0) + 1);
    check(meets.size === 136 && [...meets.values()].every((n) => n === 1 || n === 2), `${label}: every pair meets once or twice`);
    // The finals.
    const finals = fx.filter((f) => f.kind === "nrl-final");
    const top8 = ladder.slice(0, 8).map((r) => r.clubId);
    const byLabel = (id: string) => fx.find((f) => f.id === `${s.year}-${id}`)!;
    const qf1 = byLabel("nrl-qf1"), qf2 = byLabel("nrl-qf2"), ef1 = byLabel("nrl-ef1"), ef2 = byLabel("nrl-ef2");
    check(finals.length === 8 && !!qf1 && !!qf2 && !!ef1 && !!ef2, `${label}: 8 finals (4 + 2 + 2)`);
    check(qf1.home === top8[0] && qf1.away === top8[3] && qf2.home === top8[1] && qf2.away === top8[2], `${label}: qualifying finals 1v4, 2v3`);
    check(ef1.home === top8[4] && ef1.away === top8[7] && ef2.home === top8[5] && ef2.away === top8[6], `${label}: elimination finals 5v8, 6v7`);
    const loser = (f: Fixture) => (winnerOf(f) === f.home ? f.away : f.home);
    const sf1 = byLabel("nrl-sf1"), sf2 = byLabel("nrl-sf2"), pf1 = byLabel("nrl-pf1"), pf2 = byLabel("nrl-pf2"), gf = fx.find((f) => f.kind === "nrl-gf")!;
    check(sf1.home === loser(qf1) && sf1.away === winnerOf(ef1) && sf2.home === loser(qf2) && sf2.away === winnerOf(ef2), `${label}: semis — qualifying-final losers host the elimination winners`);
    check(pf1.home === winnerOf(qf1) && pf1.away === winnerOf(sf2) && pf2.home === winnerOf(qf2) && pf2.away === winnerOf(sf1), `${label}: prelims — qualifying-final winners host the semi winners`);
    check(!!gf && [gf.home, gf.away].sort().join() === [winnerOf(pf1)!, winnerOf(pf2)!].sort().join(), `${label}: the Grand Final is the preliminary-final winners`);
    check([...finals, gf].every((f) => f.result!.homeScore !== f.result!.awayScore), `${label}: every final has a winner (golden point)`);
    check(![...finals, gf].some((f) => !top8.includes(f.home) || !top8.includes(f.away)), `${label}: only the top eight play finals`);
    check(fx.filter((f) => f.kind === "grand-final").length === 1 && fx.filter((f) => f.kind === "cup" && f.round === 5).length === 1, `${label}: Super League and the Cup still play out`);
    // Outcome, trophies and awards.
    const o = s.lastOutcome!;
    const pos = ladder.findIndex((r) => r.clubId === clubId) + 1;
    check(o.division === "nrl" && o.position === pos && o.played === NRL_GAMES, `${label}: outcome ${o.position} in the NRL`);
    check(o.trophies.includes("minor-premiership") === (pos === 1), `${label}: Minor Premiership iff 1st`);
    check(o.trophies.includes("nrl-premiership") === (winnerOf(gf) === clubId), `${label}: NRL Premiership iff they win the Grand Final`);
    check(o.trophies.includes("world-club-challenge") === (winnerOf(wcc) === clubId), `${label}: WCC trophy iff they won it`);
    check(!o.promoted && !o.relegated && s.clubs[clubId]!.division === "nrl" && clubsIn(s, "nrl").length === 17, `${label}: no promotion or relegation in the NRL`);
    const awards = o.awards ?? [];
    check(awards.some((a) => a.id === "man-of-steel" && a.division === "nrl" && awardLabel(a) === "Dally M Medal"), `${label}: the Dally M Medal`);
    const cc = awards.find((a) => a.id === "clive-churchill");
    check(!!cc && cc.playerId === gf.result!.motm && [gf.home, gf.away].includes(cc.clubId), `${label}: the Clive Churchill Medal is the Grand Final's player of the match`);
    check(!awards.some((a) => a.division === "super-league"), `${label}: no Super League awards for an NRL manager`);
    const data = seasonReviewData(o, s.clubs, s.userClubId);
    check(!!data.nrlBracket && data.nrlBracket.week1.length === 4 && data.nrlBracket.semis.length === 2 && data.nrlBracket.prelims.length === 2 && !!data.nrlBracket.final, `${label}: review has the NRL finals bracket`);
    check(!data.bracket && !!data.wcc, `${label}: review shows the WCC, not Super League's play-offs`);
    const honours = honoursBoard(o, s.clubs, s.userClubId).map((h) => h.id);
    check(honours[0] === "wcc" && honours[1] === "nrl-premiership" && honours[2] === "minor-premiership", `${label}: honours lead with the WCC, the premiership and the minor premiership (${honours.slice(0, 3)})`);
    check(s.champions?.some((c) => c.year === s.year && c.nrl === winnerOf(gf) && !!c.sl), `${label}: champions recorded for next year's WCC`);
    const before = legacy.trophies["world-club-challenge"] ?? 0;
    legacy = bankSeason(legacy, s, o).legacy;
    check((legacy.trophies["world-club-challenge"] ?? 0) === before + (o.trophies.includes("world-club-challenge") ? 1 : 0), `${label}: WCC trophy banked into the legacy`);
    for (const t of o.trophies) check(!!TROPHY_LABEL[t], `${label}: ${t} has a label`);
    // Calibration.
    for (const f of nrlLeague) {
      games++;
      scores.push(f.result!.homeScore, f.result!.awayScore);
      if (f.result!.homeScore > f.result!.awayScore) homeWins++;
      if (f.result!.homeScore === f.result!.awayScore) draws++;
    }
    leaderWins.push(ladder[0]!.w);
    bottomWins.push(ladder[ladder.length - 1]!.w);
    minorRank.push(ranking.indexOf(ladder[0]!.clubId) + 1);
    premierRank.push(ranking.indexOf(winnerOf(gf)!) + 1);
    wccGames++;
    if (s.clubs[winnerOf(fx.find((f) => f.kind === "wcc")!)!]!.division === "nrl") wccNrlWins++;
    sizes.push(JSON.stringify(s).length);
    prev = { sl: winnerOf(fx.find((f) => f.kind === "grand-final")!)!, nrl: winnerOf(gf)! };
    s = nextSeason(s);
    check(s.phase === "season" && s.clubs[clubId]!.division === "nrl", `${label}: next season starts in the NRL`);
    check(s.clubs[clubId]!.squad.length >= 20 && s.clubs[clubId]!.squad.length <= SQUAD_MAX, `${label}: squad size ok after the summer`);
    check(clubsIn(s, "nrl").every((id) => s.clubs[id]!.squad.length >= 20), `${label}: every NRL squad topped up`);
  }
}

/* ------------------------------------------------------------------ stages */
console.log("\nStages");
{
  let s = createCareer({ clubId: "nrl-sydney-roosters", managerName: "T", seed: "nrl-stages" });
  s = skipIdleWeeks(markStageSeen(playFriendlies(s, []), "preseason"));
  let leagueOver = false;
  let promotionShown = false;
  for (let g = 0; s.phase === "season" && g < 90; g++) {
    const st = currentStage(s);
    if (st === "league-over") {
      leagueOver = true;
      const pic = leagueOverPicture(s);
      check(pic.division === "nrl" && pic.verdict.length > 0, `league over: "${pic.verdict}"`);
      check(!!nrlBracket({ ...s.lastOutcome?.story, nrlTop: sortTable(s.tables.nrl).slice(0, 8).map((r) => r.clubId), nrlFinals: [] } as never), "the finals bracket can be drawn");
      s = skipIdleWeeks(markStageSeen(s, "league-over"));
      continue;
    }
    if (st === "promotion") promotionShown = true;
    if (st === "deadline") {
      s = skipIdleWeeks(closeDeadlineDay(s));
      continue;
    }
    s = skipIdleWeeks(playMatchday(s));
  }
  check(leagueOver, "an NRL manager gets the league-over stage before the finals");
  check(!promotionShown, "…but no promotion stage");
  check(s.phase === "review", "the season ends");
}

/* ------------------------------------------------------------------ market and cap */
console.log("\nMarket");
{
  let s = createCareer({ clubId: "nrl-penrith-panthers", managerName: "T", seed: "nrl-market" });
  const market = buildMarket(s, []);
  const from = market.filter((l) => l.fromClubId);
  const cross = from.filter((l) => s.clubs[l.fromClubId!]!.division !== "nrl");
  check(from.length > 0 && from.filter((l) => s.clubs[l.fromClubId!]!.division === "nrl").length >= from.length / 2, `NRL market is mostly NRL players (${from.length - cross.length} of ${from.length})`);
  check(cross.every((l) => s.clubs[l.fromClubId!]!.division === "super-league"), "cross-code listings come from Super League");
  const sl = createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "sl-market" });
  const slMarket = buildMarket(sl, []).filter((l) => l.fromClubId);
  check(slMarket.filter((l) => sl.clubs[l.fromClubId!]!.division === "nrl").length <= 4, "a Super League market lists at most a few NRL players");
  // The salary cap: fill the bill up to the cap, then a signing is refused.
  const listing = market.find((l) => l.fromClubId && s.budget >= l.price);
  if (listing) {
    const capped = structuredClone(s);
    capped.budget = 50_000_000;
    // Push the wage bill over the cap with a few star signings at once.
    const stars = Object.values(capped.players).filter((p) => p.rating >= 92 && !capped.clubs[capped.userClubId]!.squad.includes(p.id)).slice(0, 6);
    for (const p of stars) {
      for (const c of Object.values(capped.clubs)) c.squad = c.squad.filter((id) => id !== p.id);
      capped.clubs[capped.userClubId]!.squad.push(p.id);
    }
    const r = buyPlayer(capped, { ...listing, price: listing.price });
    check(wageBill(squadOf(capped, capped.userClubId)) > NRL_SALARY_CAP && r.error === "salary-cap", `over the salary cap: signing refused (${r.error})`);
    const ok = buyPlayer({ ...s, budget: 50_000_000 }, listing);
    check(!ok.error, `under the cap: signing goes through (${ok.error ?? "ok"})`);
  }
  // AI deals stay within each game.
  let t = simSeason(createCareer({ clubId: "nrl-canberra-raiders", managerName: "T", seed: "nrl-ai-deals" }));
  const deals = (t.transfers ?? []).filter((d) => d.from && d.to && !d.user);
  check(deals.every((d) => (t.clubs[d.from!]!.division === "nrl") === (t.clubs[d.to!]!.division === "nrl")), `AI clubs deal within their own game (${deals.length} deals)`);
  t = nextSeason(t);
  check(clubRating(t, "nrl-canberra-raiders") > 75, "NRL clubs stay strong over the summer");
}

/* ------------------------------------------------------------------ old saves */
console.log("\nOld saves");
{
  // A save from before the NRL: no NRL clubs, players, table, calendar weeks or WCC.
  const fresh = createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "nrl-migrate" });
  const old = structuredClone(fresh) as CareerState;
  const nrlPlayers = new Set(nrlIds.flatMap((id) => old.clubs[id]!.squad));
  for (const id of nrlIds) delete old.clubs[id];
  for (const id of nrlPlayers) delete old.players[id];
  old.freeAgents = old.freeAgents.filter((id) => !id.startsWith("fa0n"));
  for (const id of Object.keys(old.players)) if (id.startsWith("fa0n")) delete old.players[id];
  delete (old.tables as Partial<CareerState["tables"]>).nrl;
  old.calendar = old.calendar.slice(1).map((m, i) => ({ ...m, index: i, byes: undefined, nrlDraw: undefined, fixtures: m.fixtures.filter((f) => f.division !== "nrl") }));
  delete old.champions;
  check(isCareer(old), "an old save is still a valid save");
  let s = migrateCareer(old);
  check(clubsIn(s, "nrl").length === 17 && clubsIn(s, "nrl").every((id) => s.clubs[id]!.squad.length >= 24), "migration: the NRL's 17 clubs and squads arrive");
  check(Array.isArray(s.tables.nrl) && s.tables.nrl.length === 0, "migration: an empty NRL table until next season");
  check(migrateCareer(s) === s, "a migrated save isn't touched again");
  s = simSeason(s);
  check(s.phase === "review" && !all(s).some((f) => f.division === "nrl"), "migration: this season plays on as it was (no NRL games yet)");
  const slChamp = winnerOf(all(s).find((f) => f.kind === "grand-final")!)!;
  s = nextSeason(s);
  const wcc = s.calendar[0]!.fixtures[0]!;
  check(wcc.kind === "wcc" && [wcc.home, wcc.away].includes(slChamp) && [wcc.home, wcc.away].includes("nrl-sydney-roosters"), `next pre-season: WCC between ${slChamp} and the real 2026 premiers (Sydney Roosters)`);
  check(s.tables.nrl.length === 17 && all(s).filter((f) => f.division === "nrl" && f.kind === "league").length === 204, "next season: the NRL runs in the background");
  s = simSeason(s);
  check(sortTable(s.tables.nrl).every((r) => r.p === 24), "…and finishes");
}

/* ------------------------------------------------------------------ sizes */
console.log("\nSave size");
{
  const max = Math.max(...sizes);
  check(max < 850_000, `NRL career saves stay under 850 KB (largest ${(max / 1024).toFixed(0)} KB at season end)`);
  let s = createCareer({ clubId: "st-helens", managerName: "T", seed: "nrl-size-sl" });
  let biggest = 0;
  for (let i = 0; i < 6; i++) {
    s = simSeason(s);
    biggest = Math.max(biggest, JSON.stringify(s).length);
    s = nextSeason(s);
  }
  // v1.66: injuries spread games over more of each squad (more per-club stat lines), so ~2–3% bigger.
  check(biggest < 850_000, `Super League career with the NRL in the background: under 850 KB over 6 seasons (${(biggest / 1024).toFixed(0)} KB)`);
  console.log(`  Save size: NRL career ${(max / 1024).toFixed(0)} KB, Super League career ${(biggest / 1024).toFixed(0)} KB (largest season end)`);
}

console.log(
  `\nNRL calibration: avg score ${avg(scores).toFixed(1)}, home win ${((100 * homeWins) / games).toFixed(0)}%, draws ${((100 * draws) / games).toFixed(1)}%, ` +
    `ladder leader wins ${avg(leaderWins).toFixed(1)}/24, bottom wins ${avg(bottomWins).toFixed(1)}/24, ` +
    `minor premiers' pre-season rank ${avg(minorRank).toFixed(1)}, premiers' rank ${avg(premierRank).toFixed(1)}, WCC won by the NRL side ${wccNrlWins}/${wccGames}`
);
check(avg(scores) > 12 && avg(scores) < 30, "NRL: average team score in a realistic range");
check(homeWins / games > 0.48 && homeWins / games < 0.62, "NRL: home sides win a little more often");
check(avg(leaderWins) >= 16 && avg(leaderWins) <= 22, "NRL: ladder leaders win 16–22 of 24");
check(avg(bottomWins) >= 1.5 && avg(bottomWins) <= 9, "NRL: the wooden spooners win 2–9 of 24");
check(avg(minorRank) <= 4, "NRL: minor premiers are usually one of the strongest squads");

console.log(`\n${failed === 0 ? "ALL NRL CAREER TESTS PASSED" : "NRL CAREER TESTS FAILED"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
