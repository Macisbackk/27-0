/**
 * Manager Mode extras: season awards, youth academy, captains, Magic Weekend, rivals and derbies.
 * Run: npx tsx scripts/test-manager-extras.ts   (CI: npm run test:career)
 */
import {
  ACADEMY_LEAVE_AGE,
  ACADEMY_MAX,
  CAPTAIN_BOOST,
  DERBY_LEGACY,
  DERBY_MORALE,
  MAGIC_ROUND,
  MAGIC_WEEKEND_LEGACY,
  MAN_OF_STEEL_LEGACY,
  SQUAD_MAX,
  areRivals,
  beginOffseason,
  closeDeadlineDay,
  computeSeasonAwards,
  createCareer,
  defaultCaptain,
  derbyBonus,
  finishDepartures,
  finishTransfers,
  isDerby,
  isMagicWeekend,
  migrateCareer,
  playMatchday,
  potentialStars,
  promoteAcademy,
  releaseAcademy,
  rivalsOf,
  setCaptain,
  sheetFor,
  simRestOfSeason,
  squadOf,
  userCaptain,
  userFixture,
  withTeamFixed,
  type CareerState,
  type Fixture,
} from "../src/lib/career";
import { createLiveMatch, previewCall } from "../src/lib/career/live-match";
import { sheetStrength, simulateMatch, type TeamSheet } from "../src/lib/career/match";
import { rngFor } from "../src/lib/career/rng";

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`❌ ${msg}`);
  }
}

const simAll = (start: CareerState): CareerState => {
  let s = start;
  for (let g = 0; s.phase === "season" && g < 5; g++) s = simRestOfSeason(closeDeadlineDay(s));
  return s;
};
/** Play (instant sim) up to matchday `index`, shutting Deadline Day on the way. */
const playTo = (start: CareerState, index: number): CareerState => {
  let s = start;
  for (let g = 0; s.phase === "season" && s.matchdayIndex < index && g < 60; g++) s = playMatchday(closeDeadlineDay(s));
  return closeDeadlineDay(s);
};
const nextSeason = (s: CareerState): CareerState => finishTransfers(finishDepartures(beginOffseason(s)));
const allClubIds = (s: CareerState) => Object.keys(s.clubs);

/* ------------------------------------------------------------------ awards */
console.log("Season awards");
{
  const s = simAll(createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "awards-sl" }));
  const o = s.lastOutcome!;
  const awards = o.awards ?? [];
  const mos = awards.find((a) => a.id === "man-of-steel" && a.division === "super-league");
  const top = awards.find((a) => a.id === "top-try-scorer" && a.division === "super-league");
  const young = awards.find((a) => a.id === "young-player" && a.division === "super-league");
  const club = awards.find((a) => a.id === "club-player");
  check(!!mos && !!top && !!club, "Super League season has Man of Steel, top try scorer and Player of the Season");
  check(!awards.some((a) => a.division === "championship"), "a Super League manager gets no Championship awards");
  check(s.history[s.history.length - 1]!.awards?.length === awards.length, "awards are stored in the career history");
  const slPlayers = Object.values(s.clubs)
    .filter((c) => c.division === "super-league" || c.id === top?.clubId)
    .flatMap((c) => c.squad.map((id) => s.players[id]!));
  const maxTries = Math.max(...slPlayers.map((p) => p.tries));
  check(!!top && s.players[top.playerId]!.tries === maxTries, `top try scorer has the most tries (${maxTries})`);
  check(!young || s.players[young.playerId]!.age <= 21, "Young Player of the Year is 21 or under");
  check(!!mos && s.players[mos.playerId]!.apps >= 10, "Man of Steel played at least 10 games");
  check(!!club && s.clubs[s.userClubId]!.squad.includes(club.playerId), "Player of the Season is one of yours");
  check(s.news.some((n) => n.startsWith("Man of Steel:")), "Man of Steel makes the news");

  const ch = simAll(createCareer({ clubId: "salford-rlfc", managerName: "T", seed: "awards-ch" }));
  const chAwards = ch.lastOutcome!.awards ?? [];
  check(chAwards.some((a) => a.id === "man-of-steel" && a.division === "championship"), "a Championship manager also gets the Championship awards");
  check(chAwards.some((a) => a.id === "man-of-steel" && a.division === "super-league"), "…and still sees Super League's Man of Steel");

  // Your man wins Man of Steel: a small Legacy bonus and a news line.
  let m = createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "mos-user" });
  m = playTo(m, m.calendar.length - 1);
  const star = m.lineup[0]!;
  m = structuredClone(m);
  Object.assign(m.players[star]!, { rating: 99, tries: 80, apps: 30, age: 27 });
  const before = computeSeasonAwards(m).find((a) => a.id === "man-of-steel" && a.division === "super-league");
  check(before?.playerId === star, "computeSeasonAwards picks the standout player");
  const done = simAll(m);
  const legacyWithout = done.lastOutcome!.legacyEarned - MAN_OF_STEEL_LEGACY;
  check(done.lastOutcome!.awards!.some((a) => a.id === "man-of-steel" && a.playerId === star), "your player is Man of Steel");
  check(legacyWithout >= 0 && done.news.some((n) => n.includes("is Man of Steel! +15 Legacy")), `+${MAN_OF_STEEL_LEGACY} Legacy and a news line`);
}

/* ------------------------------------------------------------------ academy */
console.log("Youth academy");
{
  const s = createCareer({ clubId: "castleford-tigers", managerName: "T", seed: "academy" });
  const kids = (s.academy ?? []).map((id) => s.players[id]!);
  const inSquads = new Set(Object.values(s.clubs).flatMap((c) => c.squad));
  check(kids.length >= 3 && kids.length <= 4, `pre-season intake of 3–4 prospects (${kids.length})`);
  check(kids.every((p) => p.age >= 16 && p.age <= 18), "prospects are 16–18");
  check(kids.every((p) => p.rating >= 60 && p.rating <= 70), "prospects are rated 60–70");
  check(kids.every((p) => p.potential > p.rating && potentialStars(p.potential) >= 1), "hidden potential above their rating (shown as stars)");
  check(kids.every((p) => p.academy && !inSquads.has(p.id) && !s.freeAgents.includes(p.id)), "prospects sit in the academy, not a squad or free agency");
  check(s.news.some((n) => n.startsWith("Academy intake:")), "intake makes the news");

  // Promote: into the squad on a 3-year deal, wages for the rest of the season.
  const kid = kids[0]!;
  const r = promoteAcademy(s, kid.id);
  check(!r.error && r.state.clubs[s.userClubId]!.squad.includes(kid.id) && !r.state.academy!.includes(kid.id), "promote moves him into the squad");
  check(r.state.players[kid.id]!.contract === 3 && r.state.budget < s.budget, "on a 3-year deal, and his wages are paid");
  check(promoteAcademy(r.state, kid.id).error === "not-found", "can't promote him twice");
  const broke = promoteAcademy({ ...s, budget: 0 }, kid.id);
  check(broke.error === "budget", "can't promote without the budget for his wages");
  const full = structuredClone(s);
  const fillers = Object.values(full.clubs).find((c) => c.id !== s.userClubId)!.squad;
  const me = full.clubs[full.userClubId]!;
  for (const id of fillers) if (me.squad.length < SQUAD_MAX) me.squad.push(id);
  check(promoteAcademy(full, kid.id).error === "squad-full", `can't promote with a full squad (${SQUAD_MAX})`);
  check(promoteAcademy({ ...s, phase: "review" }, kid.id).error === "phase", "no promotions during the season review");

  // Release: gone for good.
  const rel = releaseAcademy(s, kids[1]!.id);
  check(!rel.academy!.includes(kids[1]!.id) && !rel.players[kids[1]!.id], "release removes him");

  // Next pre-season: another intake, the list stays capped, prospects aged a year.
  const s2 = nextSeason(simAll(s));
  const list2 = (s2.academy ?? []).map((id) => s2.players[id]!);
  check(list2.length > kids.length && list2.length <= ACADEMY_MAX, `second intake joins (${list2.length} on the list, max ${ACADEMY_MAX})`);
  check(kids.every((k) => !s2.players[k.id] || s2.players[k.id]!.age === k.age + 1), "last year's prospects are a year older");
  check(list2.every((p) => p.age < ACADEMY_LEAVE_AGE), `nobody ${ACADEMY_LEAVE_AGE}+ stays in the academy`);
  let s3 = s2;
  for (let i = 0; i < 4; i++) s3 = nextSeason(simAll(s3));
  check((s3.academy ?? []).every((id) => s3.players[id] && s3.players[id]!.age < ACADEMY_LEAVE_AGE), "over-age prospects leave each summer");
  check((s3.academy ?? []).length <= ACADEMY_MAX, "academy stays within its cap over many seasons");

  // Games make kids grow faster than kids left in the academy.
  let gain = 0;
  let gainIdle = 0;
  for (let i = 0; i < 40; i++) {
    const t = createCareer({ clubId: "castleford-tigers", managerName: "T", seed: `grow-${i}` });
    const a = t.academy![0]!;
    const b = t.academy![1]!;
    const played = simAll(promoteAcademy(t, a).state);
    played.players[a]!.apps = 20;
    // Same kid, same roll: with 20 games vs none.
    const idle = structuredClone(played);
    idle.players[a]!.apps = 0;
    const withGames = beginOffseason(played).players[a]?.rating ?? 0;
    const without = beginOffseason(idle).players[a]?.rating ?? 0;
    gain += withGames - played.players[a]!.rating;
    gainIdle += without - idle.players[a]!.rating;
    void b;
  }
  check(gain > gainIdle, `first-team games speed up development (${(gain / 40).toFixed(2)} vs ${(gainIdle / 40).toFixed(2)} a season)`);

  // Old saves get an empty academy.
  const old = structuredClone(s) as CareerState;
  delete old.academy;
  delete old.captainId;
  const mig = migrateCareer(old);
  check(Array.isArray(mig.academy) && mig.academy.length === 0, "an old save gets an empty academy");
  check(!!mig.captainId && mig.clubs[mig.userClubId]!.squad.includes(mig.captainId), "an old save gets a captain");
}

/* ------------------------------------------------------------------ captain */
console.log("Captain");
{
  const s = createCareer({ clubId: "st-helens", managerName: "T", seed: "captain" });
  const xiii = s.lineup.map((id) => s.players[id]!);
  const seniors = xiii.filter((p) => p.age >= 22);
  const best = Math.max(...seniors.map((p) => p.rating));
  check(!!s.captainId && s.lineup.includes(s.captainId) && s.players[s.captainId]!.rating === best, "default captain is the best senior starter");
  const sheet = sheetFor(s, s.userClubId);
  check(sheet.captain === s.captainId, "the team sheet names the captain");
  const withC = sheetStrength(sheet, s.players).rating;
  const withoutC = sheetStrength({ ...sheet, captain: undefined }, s.players).rating;
  check(Math.abs(withC - withoutC - CAPTAIN_BOOST) < 1e-9, `captain adds +${CAPTAIN_BOOST} to team strength`);
  const opp = Object.keys(s.clubs).find((id) => id !== s.userClubId)!;
  const aiSheet = sheetFor(s, opp);
  check(!!aiSheet.captain && aiSheet.captain === defaultCaptain(aiSheet.lineup, s.players), "AI clubs have a captain by the same rule");

  // Pick another man.
  const other = s.lineup.find((id) => id !== s.captainId)!;
  const picked = setCaptain(s, other);
  check(picked.captainId === other && userCaptain(picked) === other && picked.news[0]!.includes("named captain"), "user can pick the captain");
  check(setCaptain(s, "nobody").captainId === s.captainId, "only a squad player can be captain");

  // He leaves the club: replaced, and it's in the news.
  const left = structuredClone(picked);
  left.clubs[left.userClubId]!.squad = left.clubs[left.userClubId]!.squad.filter((id) => id !== other);
  const fixed = withTeamFixed(left);
  check(!!fixed.captainId && fixed.captainId !== other && fixed.clubs[fixed.userClubId]!.squad.includes(fixed.captainId), "captain who leaves is replaced");
  check(fixed.news[0]!.includes("is the new captain"), "…and it's in the news");

  // Banned: someone else leads, he keeps the armband.
  const banned = structuredClone(picked);
  banned.players[other]!.ban = 1;
  check(userCaptain(banned) !== other && banned.captainId === other, "a banned captain sits out; a stand-in leads");
  let b2 = playTo(banned, 0);
  const md = b2.calendar[b2.matchdayIndex];
  if (userFixture(md, b2.userClubId)) {
    b2 = playMatchday(b2);
    check(b2.news.some((n) => n.includes("is banned.") && n.includes("leads the side")), "a banned captain's stand-in makes the news");
    check(b2.captainId === other, "he gets the armband back after his ban");
  }

  // Live match: the captain is named in his moments.
  const home = sheetFor(s, s.userClubId);
  const live = createLiveMatch({ home, away: aiSheet, homeName: "A", awayName: "B", userSide: "home", knockout: false, players: s.players, rng: rngFor("cap-live") });
  const capName = s.players[home.captain!]!.name;
  const talk = previewCall(live, "team-talk", s.players);
  check(talk.prompt.includes(capName), `captain named in the team talk ("${talk.prompt}")`);
  const challenge = previewCall(live, "challenge", s.players);
  check(challenge.prompt.includes(`Captain ${capName}`), "captain named in the captain's challenge");
}

/* ------------------------------------------------------------- Magic Weekend */
console.log("Magic Weekend");
{
  const s = createCareer({ clubId: "hull-fc", managerName: "T", seed: "magic" });
  const round = s.calendar.find((m) => m.fixtures.some((f) => f.kind === "league" && f.round === MAGIC_ROUND))!;
  check(round.fixtures.filter((f) => f.kind === "league").every((f) => isMagicWeekend(f)), `every Round ${MAGIC_ROUND} league game is Magic Weekend`);
  check(s.calendar.flatMap((m) => m.fixtures).filter((f) => isMagicWeekend(f)).length === round.fixtures.filter((f) => f.kind === "league").length, "only that round");
  // Same team both sides: neutral is a coin flip, a home game isn't.
  const sheet = sheetFor(s, s.userClubId);
  const a: TeamSheet = { ...sheet, clubId: "a", boost: 0 };
  const b: TeamSheet = { ...sheet, clubId: "b", boost: 0 };
  let neutralHome = 0;
  let normalHome = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const n = simulateMatch(rngFor("mw", i), a, b, s.players, { knockout: true, neutral: true });
    const h = simulateMatch(rngFor("mw", i), a, b, s.players, { knockout: true });
    if (n.homeScore > n.awayScore) neutralHome++;
    if (h.homeScore > h.awayScore) normalHome++;
  }
  check(Math.abs(neutralHome / N - 0.5) < 0.025, `neutral venue: "home" side wins ${((100 * neutralHome) / N).toFixed(1)}% (no home advantage)`);
  check(normalHome / N > neutralHome / N + 0.03, `a normal home game still has an edge (${((100 * normalHome) / N).toFixed(1)}%)`);
  const live = createLiveMatch({ home: a, away: b, homeName: "A", awayName: "B", userSide: "home", knockout: false, neutral: true, players: s.players, rng: rngFor("mw-live") });
  check(Math.abs(live.base.homeTries - live.base.awayTries) < 1e-9, "live match at a neutral venue: equal try rates for equal teams");

  // Win your Magic Weekend game: Legacy bonus and news.
  let t = playTo(s, s.calendar.indexOf(round));
  const f = userFixture(t.calendar[t.matchdayIndex], t.userClubId);
  if (f) {
    const home = f.home === t.userClubId;
    const before = t.seasonTrack.bonusLegacy ?? 0;
    t = playMatchday(t, { fixtureId: f.id, result: { homeScore: home ? 14 : 12, awayScore: home ? 12 : 14, homeTries: [], awayTries: [] } });
    check((t.seasonTrack.bonusLegacy ?? 0) >= before + MAGIC_WEEKEND_LEGACY, `Magic Weekend win: +${MAGIC_WEEKEND_LEGACY} Legacy`);
    check(t.news.some((n) => n.startsWith("Magic Weekend win!")), "…and a news line");
    const end = simAll(t);
    check(end.lastOutcome!.legacyEarned >= MAGIC_WEEKEND_LEGACY, "the bonus is banked with the season's Legacy");
  } else check(false, "user has a Magic Weekend fixture");
}

/* ------------------------------------------------------------------ derbies */
console.log("Rivals and derbies");
{
  const s = createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "derby" });
  const ids = allClubIds(s);
  check(areRivals(ids, "wigan-warriors", "st-helens") && areRivals(ids, "st-helens", "wigan-warriors"), "Wigan v St Helens is a derby (both ways)");
  check(areRivals(ids, "hull-fc", "hull-kr") && areRivals(ids, "castleford-tigers", "wakefield-trinity") && areRivals(ids, "catalans-dragons", "toulouse-olympique"), "Hull, Castleford–Wakefield and the French derby");
  check(areRivals(ids, "batley-bulldogs", "dewsbury-rams") && areRivals(ids, "whitehaven-rlfc", "workington-town"), "Championship derbies too");
  check(!areRivals(ids, "leeds-rhinos", "catalans-dragons"), "Leeds v Catalans is not a derby");
  check(ids.every((id) => rivalsOf(ids, id).length >= 1), "every club has at least one rival (nearest club as a fallback)");
  check(rivalsOf(ids, "cornwall-rlfc").length === 1 && !rivalsOf(ids, "cornwall-rlfc").includes("cornwall-rlfc"), "a club without a real rival gets its nearest club");

  // Play to the first derby, win it narrowly: bonus cash, Legacy, a lift next game and the record.
  const idx = s.calendar.findIndex((m) => {
    const f = userFixture(m, s.userClubId);
    return !!f && isDerby(s, f) && f.kind === "league";
  });
  check(idx >= 0, "Wigan have a league derby in the calendar");
  let t = playTo(s, idx);
  const f = userFixture(t.calendar[t.matchdayIndex], t.userClubId) as Fixture;
  const home = f.home === t.userClubId;
  const budget = t.budget;
  const legacy = t.seasonTrack.bonusLegacy ?? 0;
  const derbiesBefore = t.seasonTrack.derbies ?? { w: 0, d: 0, l: 0 };
  t = playMatchday(t, { fixtureId: f.id, result: { homeScore: home ? 14 : 12, awayScore: home ? 12 : 14, homeTries: [], awayTries: [] } });
  check(t.budget - budget >= derbyBonus("super-league"), `derby win pays ${derbyBonus("super-league")}`);
  check((t.seasonTrack.bonusLegacy ?? 0) - legacy >= DERBY_LEGACY, `derby win: +${DERBY_LEGACY} Legacy`);
  check(t.seasonTrack.derbies!.w === derbiesBefore.w + 1, "derby record counts the win");
  check(t.news.some((n) => n.startsWith("Derby win over")), "derby win makes the news");
  const moraleAt = t.seasonTrack.moraleAt!;
  check(moraleAt > idx, "morale lift is for a later game");
  let u = playTo(t, moraleAt);
  if (u.matchdayIndex === moraleAt) {
    const lift = sheetFor(u, u.userClubId).boost ?? 0;
    check(lift >= DERBY_MORALE - 1e-9, `next game gets the +${DERBY_MORALE} lift`);
  }
  // A derby defeat: no bonus, record counts it.
  const idx2 = s.calendar.findIndex((m, i) => {
    const g = userFixture(m, s.userClubId);
    return i > moraleAt && !!g && isDerby(s, g) && g.kind === "league";
  });
  if (idx2 > 0) {
    u = playTo(u, idx2);
    const g = userFixture(u.calendar[u.matchdayIndex], u.userClubId)!;
    const h = g.home === u.userClubId;
    const before = u.seasonTrack.derbies!;
    const cash = u.budget;
    u = playMatchday(u, { fixtureId: g.id, result: { homeScore: h ? 10 : 30, awayScore: h ? 30 : 10, homeTries: [], awayTries: [] } });
    check(u.seasonTrack.derbies!.l === before.l + 1 && u.budget <= cash + 1, "derby defeat: counted, no bonus");
  }
  const end = simAll(u);
  const all = end.calendar.flatMap((m) => m.fixtures).filter((x) => (x.home === end.userClubId || x.away === end.userClubId) && x.result && isDerby(end, x));
  const d = end.lastOutcome!.derbies!;
  check(d.w + d.d + d.l === all.length, `season derby record covers every derby (${d.w}W ${d.d}D ${d.l}L of ${all.length})`);
  check(end.history[end.history.length - 1]!.derbies?.w === d.w, "derby record stored in the history");
  check(squadOf(end, end.userClubId).length > 0, "season finishes cleanly");
}

console.log(`\n${failed === 0 ? "ALL MANAGER EXTRAS TESTS PASSED" : "MANAGER EXTRAS TESTS FAILED"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
