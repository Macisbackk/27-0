/**
 * Manager Mode extras: season awards, youth academy, captains, Magic Weekend, rivals and derbies.
 * Run: npx tsx scripts/test-manager-extras.ts   (CI: npm run test:career)
 */
import {
  EVENTS_PER_SEASON,
  LINEUP_SLOTS,
  aiLegendSigning,
  buildMarket,
  buyPlayer,
  legendAsPlayer,
  legendCatalog,
  legendAtClub,
  pendingEvent,
  pushEvent,
  resolveEvent,
  rollRandomEvent,
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
  buildSeasonStory,
  cupRounds,
  honoursBoard,
  markStageSeen,
  miniWinner,
  playedRounds,
  playoffBracket,
  seasonReviewData,
  sortTable,
  stageSeen,
  upcomingGames,
  winnerOf,
  type CareerState,
  type Fixture,
  type SeasonStory,
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

/* ------------------------------------------------------------- season story */
console.log("Season story: honours, play-offs, cup, results, history");
{
  const s = simAll(createCareer({ clubId: "st-helens", managerName: "T", seed: "story-sl" }));
  const o = s.lastOutcome!;
  const st = o.story!;
  const all = s.calendar.flatMap((m) => m.fixtures);
  const mineCal = all.filter((f) => f.home === s.userClubId || f.away === s.userClubId);
  check(!!st, "the season's story is kept on the outcome");
  check(!!s.history[s.history.length - 1]!.story, "…and on the history entry");
  check(st.mine.length === mineCal.length && st.mine.every((m) => m.hs != null && m.as != null), `every game of yours with its score (${st.mine.length})`);
  check(st.mine.every((m, i) => m.h === mineCal[i]!.home && m.hs === mineCal[i]!.result!.homeScore), "results in calendar order, scores as played");
  const gf = all.find((f) => f.kind === "grand-final")!;
  const cupFinal = all.find((f) => f.kind === "cup" && f.round === 5)!;
  const mpg = all.find((f) => f.kind === "mpg")!;
  const sl = sortTable(s.tables["super-league"]).map((r) => r.clubId);
  const ch = sortTable(s.tables.championship).map((r) => r.clubId);

  const lines = honoursBoard(o, s.clubs, s.userClubId);
  const by = (id: string) => lines.find((l) => l.id === id);
  check(lines.map((l) => l.id).join(",") === "grand-final,league-leaders,challenge-cup,championship-title,mpg,promoted,relegated", `honours board in order (${lines.map((l) => l.id).join(", ")})`);
  check(by("grand-final")?.clubIds[0] === winnerOf(gf) && /^Beat .+ \d+–\d+/.test(by("grand-final")!.text), `Grand Final winner and score: ${by("grand-final")?.text}`);
  check(by("league-leaders")?.clubIds[0] === sl[0], "League Leaders' Shield: top of Super League");
  check(by("challenge-cup")?.clubIds[0] === winnerOf(cupFinal) && by("challenge-cup")!.text.includes("in the final"), `Challenge Cup winner and final score: ${by("challenge-cup")?.text}`);
  check(by("championship-title")?.clubIds[0] === ch[0], "Championship title: top of the Championship");
  check(by("mpg")?.clubIds[0] === winnerOf(mpg) && /\d+–\d+/.test(by("mpg")!.text), `Million Pound Game: ${by("mpg")?.text}`);
  const up = by("promoted")!.clubIds;
  const down = by("relegated")!.clubIds;
  check(up.includes(ch[0]!) && down.includes(sl[sl.length - 1]!) && up.length === down.length && up.length <= 2, "promoted and relegated clubs (both divisions)");
  check(up.every((id) => s.clubs[id]!.division === "super-league") && down.every((id) => s.clubs[id]!.division === "championship"), "…match where the clubs went");
  check(lines.filter((l) => l.mine).every((l) => l.clubIds.includes(s.userClubId)), "your honours are marked as yours");

  const b = playoffBracket(st);
  check(b.topSix && b.eliminators.length === 2 && b.semis.length === 2 && !!b.final, "bracket: two eliminators, two semis and the Grand Final");
  check(b.byes.join() === sl.slice(0, 2).join(), "1st and 2nd have the bye");
  check(b.semis.every((m) => b.byes.includes(m.h)) && b.semis.every((m) => b.eliminators.some((e) => miniWinner(e) === m.a)), "1st and 2nd host the eliminator winners");
  check(b.final!.h !== b.final!.a && b.semis.every((m) => [b.final!.h, b.final!.a].includes(miniWinner(m)!)), "semi winners meet in the Grand Final");
  const elimPairs = b.eliminators.map((m) => [sl.indexOf(m.h) + 1, sl.indexOf(m.a) + 1].join("v")).sort().join(",");
  check(elimPairs === "3v6,4v5", `eliminators are 3v6 and 4v5 (${elimPairs})`);

  const data = seasonReviewData(o, s.clubs, s.userClubId);
  check(data.full && data.honours.length === 7 && data.awards.some((a) => a.id === "man-of-steel") && !!data.bracket, "review data: every winner, awards and the bracket");
  check(data.results.length === st.mine.length && data.cupRun.every((m) => m.k === "cup") && data.cupFinal?.r === 5, "review data: your results, your cup run and the final");
  check(st.cup.length === 3 && st.cup.filter((m) => m.r === 4).length === 2, "cup: the semi-finals and the final kept");
  const bytes = JSON.stringify(st).length;
  check(bytes < 4000, `story stays small (${bytes} bytes)`);

  // An old save sitting on the review screen: the story is rebuilt from the calendar on load.
  const old = structuredClone(s);
  delete old.lastOutcome!.story;
  delete old.history[old.history.length - 1]!.story;
  const mig = migrateCareer(old);
  check(JSON.stringify(mig.lastOutcome!.story) === JSON.stringify(st) && JSON.stringify(mig.history.at(-1)!.story) === JSON.stringify(st), "old save on the review: story rebuilt on load");
  // …or in the summer (departures / transfers): the calendar is still last season's.
  const summer = structuredClone(beginOffseason(s));
  delete summer.history[summer.history.length - 1]!.story;
  check(JSON.stringify(migrateCareer(summer).history.at(-1)!.story) === JSON.stringify(st), "old save in the summer: story rebuilt on load");
  // A new season: last year's calendar is gone, so an old entry keeps what it has.
  const next = nextSeason(s);
  const bare = structuredClone(next);
  delete bare.history[bare.history.length - 1]!.story;
  const kept = migrateCareer(bare);
  check(!kept.history.at(-1)!.story, "old history entries without the story stay as they are");
  const oldData = seasonReviewData(kept.history.at(-1)!, kept.clubs, kept.userClubId);
  check(!oldData.full && !oldData.bracket && oldData.results.length === 0, "old entries: no bracket or results, no crash");
  const own = honoursBoard(kept.history.at(-1)!, kept.clubs, kept.userClubId);
  check(own.every((l) => l.clubIds[0] === kept.userClubId) && own.length === o.trophies.filter((t) => t !== "promotion" && t !== "perfect-season").length + (o.promoted ? 1 : 0) + (o.relegated ? 1 : 0), "old entries: your own honours from the trophies");
  check(JSON.stringify(next.history.at(-1)!.story) === JSON.stringify(st), "the story survives into the next season");

  // Seasons from before the top-six play-offs: top-four semis, no eliminators, no byes.
  const fourStory: SeasonStory = { ...st, playoffs: st.playoffs.filter((m) => m.k !== "eliminator") };
  const four = playoffBracket(fourStory);
  check(!four.topSix && four.byes.length === 0 && four.semis.length === 2 && !!four.final, "old top-four play-offs still render (semis and final)");

  // The season-over screen is a stage of its own, seen once.
  check(!stageSeen(s, "season-over") && stageSeen(markStageSeen(s, "season-over"), "season-over"), "season over: shown once before the review");

  // During the season: round results, the cup draw and your fixtures.
  const mid = playTo(createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "story-mid" }), 12);
  const rounds = playedRounds(mid);
  check(rounds.length > 0 && rounds.every((r) => r.games.every((m) => m.hs != null)), `round results: ${rounds.length} played weeks, every game scored`);
  const leagueRound = rounds.find((r) => r.label.startsWith("Round "))!;
  check(leagueRound.games.length === 7 && leagueRound.games.every((m) => m.k === "league" && mid.clubs[m.h]!.division === "super-league"), "a league round shows every game in your division");
  const cup = cupRounds(mid);
  check(cup.length >= 2 && cup[0]!.ties.length === 16 && cup[1]!.ties.length === 8, `cup draw: Round 1 (16 ties) and the Round of 16 (8 ties)`);
  const live = buildSeasonStory(mid);
  check(live.mine.filter((m) => m.hs != null).length + upcomingGames(mid).length === live.mine.length, "your results + your fixtures = every game of yours drawn so far");
  check(live.promoted.length === 0 && live.relegated.length === 0, "nobody goes up or down mid-season");
  // Play-off weeks: the live bracket fills in as the games are played.
  const playoffs = playTo(mid, mid.calendar.findIndex((m) => m.label.startsWith("Play-off semi")));
  const lb = playoffBracket(buildSeasonStory(playoffs), playoffs.calendar);
  check(lb.topSix && lb.eliminators.every((m) => m.hs != null) && lb.semis.length === 2 && lb.semis.every((m) => m.hs == null) && !lb.final, "live bracket: eliminators played, semis drawn, final to come");
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

/* ------------------------------------------------------------------ legends */
console.log("Legends");
{
  const base = createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "legends" });
  const cards = legendCatalog();
  let equal = 0;
  let starts = 0;
  for (const card of cards) {
    const s = { ...base, budget: 50_000_000 };
    const listing = buildMarket(s, [card.id]).find((l) => l.playerId === `legend-${card.id}`);
    if (!listing) continue;
    const r = buyPlayer(s, listing);
    const p = r.state.players[`legend-${card.id}`];
    if (!r.error && p && p.rating === legendAsPlayer(card).rating) equal++;
    const slot = r.state.lineup.indexOf(`legend-${card.id}`);
    if (slot >= 0 && LINEUP_SLOTS[slot] === card.pos) starts++;
  }
  check(equal === cards.length, `every legend plays at the vault's rating once signed (${equal}/${cards.length})`);
  check(starts === cards.length, `every legend goes straight into the XIII in his position (${starts}/${cards.length})`);

  // Sign one, play on: a point a summer, retires after 2–3 seasons with a pop-up, then off the market.
  const card = cards.find((c) => c.tier === "legend")!;
  const id = `legend-${card.id}`;
  let s = buyPlayer({ ...base, budget: 50_000_000 }, buildMarket({ ...base, budget: 50_000_000 }, [card.id]).find((l) => l.playerId === id)!).state;
  const signed = s.players[id]!;
  const seasons = signed.retireAfter! - signed.signedYear! + 1;
  check(seasons === 2 || seasons === 3, `legend signed for ${seasons} seasons (2–3)`);
  const ratings: number[] = [signed.rating];
  let guard = 0;
  while (s.players[id] && guard++ < 5) {
    s = simAll(s);
    s = beginOffseason(s);
    if (s.players[id]) ratings.push(s.players[id]!.rating);
    else break;
    s = finishTransfers(finishDepartures(s));
  }
  check(!s.players[id] && (s.retiredLegends ?? []).includes(id), `he retires after his last season (played ${ratings.length})`);
  check(ratings.length === seasons, "…exactly when his deal said");
  check(ratings.every((r, i) => i === 0 || r === ratings[i - 1]! - 1), `a point a summer, no collapse (${ratings.join(" → ")})`);
  const retiredPop = (s.events ?? []).find((e) => e.kind === "legend-retired" && e.playerId === id);
  check(!!retiredPop && retiredPop.text.includes("What a servant"), "retirement pop-up: \"What a servant.\"");
  check((s.departures?.retired ?? []).some((r) => r.name === card.name), "listed with the summer's retirements");
  const after = s.phase === "departures" ? finishTransfers(finishDepartures(s)) : s;
  check(!buildMarket({ ...after, budget: 1e8 }, [card.id]).some((l) => l.playerId === id), "a retired legend never returns to the market");

  // AI clubs: only Super League, only the club he's known for, about one summer in three.
  let signings = 0;
  let rivalSignings = 0;
  let hotSignings = 0;
  let bad = 0;
  let onMarket = 0;
  let pops = 0;
  const N = 300;
  const rivals = new Set(rivalsOf(allClubIds(base), base.userClubId));
  for (let i = 0; i < N; i++) {
    const t = structuredClone(base);
    t.year = 3000 + i;
    t.history = [];
    const p = aiLegendSigning(t);
    if (p) {
      signings++;
      const at = legendAtClub(t, p.id)!;
      const card2 = cards.find((c) => `legend-${c.id}` === p.id)!;
      if (t.clubs[at]!.division !== "super-league" || t.clubs[at]!.name !== card2.club || at === t.userClubId) bad++;
      if (rivals.has(at)) rivalSignings++;
      if (p.rating !== legendAsPlayer(card2).rating) bad++;
      if (buildMarket({ ...t, budget: 1e8 }, [card2.id]).some((l) => l.playerId === p.id)) onMarket++;
      if (pendingEvent(t)?.kind === "legend-signing" && pendingEvent(t)!.title.includes(p.name)) pops++;
    }
    const hot = structuredClone(base);
    hot.year = 3000 + i;
    hot.history = [{ ...(hot.history[0] ?? {}), year: hot.year - 1, division: "super-league", position: 1, played: 26, won: 22, drawn: 0, lost: 4, trophies: ["grand-final"], promoted: false, relegated: false, prizeMoney: 0, legacyEarned: 0, challengesDone: 0 }];
    if (aiLegendSigning(hot)) hotSignings++;
  }
  check(signings / N > 0.2 && signings / N < 0.4, `AI legend signing in ${((100 * signings) / N).toFixed(0)}% of summers (about 1 in 3, at most one)`);
  check(hotSignings > signings, `more likely when you're winning (${((100 * hotSignings) / N).toFixed(0)}%)`);
  check(bad === 0, "only Super League clubs, only the club he's known for, at the vault rating");
  check(rivalSignings > 0, `your rivals land some of them (${rivalSignings}/${signings})`);
  check(onMarket === 0, "a legend at an AI club is off your market");
  check(pops === signings, "each AI legend signing queues a pop-up");
  const champOnly = structuredClone(base);
  for (const c of Object.values(champOnly.clubs)) if (c.id !== champOnly.userClubId) c.division = "championship";
  let champ = 0;
  for (let i = 0; i < 50; i++) if (aiLegendSigning({ ...structuredClone(champOnly), year: 4000 + i })) champ++;
  check(champ === 0, "no legend signs for a club outside Super League");
}

/* ------------------------------------------------------------------ pop-ups */
console.log("Pop-ups and random events");
{
  const s = structuredClone(createCareer({ clubId: "hull-kr", managerName: "T", seed: "events" }));
  pushEvent(s, { id: "a", kind: "sponsor", year: s.year, title: "A", text: "a", options: [{ id: "ok", label: "OK" }] });
  pushEvent(s, { id: "a", kind: "sponsor", year: s.year, title: "A", text: "a", options: [{ id: "ok", label: "OK" }] });
  pushEvent(s, { id: "b", kind: "sponsor", year: s.year, title: "B", text: "b", options: [{ id: "ok", label: "OK" }] });
  check((s.events ?? []).length === 2 && pendingEvent(s)?.id === "a", "queued one at a time, same pop-up never twice");
  const r1 = resolveEvent(s, "a");
  check(pendingEvent(r1)?.id === "b", "answering one brings up the next");
  const reloaded = JSON.parse(JSON.stringify(resolveEvent(r1, "b"))) as CareerState;
  check(!pendingEvent(reloaded) && (reloaded.events ?? []).every((e) => e.seen), "seen pop-ups stay seen after a reload");
  check(resolveEvent(reloaded, "a") === reloaded, "answering a seen pop-up does nothing");

  // Random events: rare, bounded, each with a clear effect.
  const t0 = playTo(s, 1);
  const idx = t0.calendar.findIndex((m, i) => i >= t0.matchdayIndex && userFixture(m, t0.userClubId)?.kind === "league" && userFixture(m, t0.userClubId)!.round >= 3);
  const at = playTo(t0, idx);
  const seen = new Map<string, number>();
  let fired = 0;
  const badEvents: string[] = [];
  const N = 1500;
  for (let i = 0; i < N; i++) {
    const t = structuredClone(at);
    t.year = 5000 + i;
    t.events = [];
    const budget = t.budget;
    const e = rollRandomEvent(t, t.matchdayIndex);
    if (!e) continue;
    fired++;
    seen.set(e.kind, (seen.get(e.kind) ?? 0) + 1);
    if (e.kind === "sponsor" && !(t.budget - budget === e.amount && e.amount! >= 25_000 && e.amount! <= 80_000)) badEvents.push(`sponsor ${e.amount}`);
    if (e.kind === "transfer-request" && seen.get(e.kind) === 1) {
      const before = t.players[e.playerId!]!.rating;
      const kept = resolveEvent(t, e.id, "refuse");
      check(kept.players[e.playerId!]!.rating === before - 1 && kept.clubs[kept.userClubId]!.squad.includes(e.playerId!), "transfer request refused: he stays, −1 rating");
      const sold = resolveEvent(t, e.id, "sell");
      check(sold.clubs[e.clubId!]!.squad.includes(e.playerId!) && sold.budget >= t.budget + e.amount!, "transfer request accepted: sold for the fee");
    }
    if (e.kind === "record-bid" && seen.get(e.kind) === 1) {
      const no = resolveEvent(t, e.id, "reject");
      check(no.clubs[no.userClubId]!.squad.includes(e.playerId!) && no.budget === t.budget, "record bid rejected: nothing changes");
      const yes = resolveEvent(t, e.id, "accept");
      check(yes.clubs[e.clubId!]!.squad.includes(e.playerId!) && yes.budget - t.budget >= e.amount! && e.amount! < 5_000_000, `record bid accepted: +${e.amount}`);
    }
    if (e.kind === "wonderkid" && seen.get(e.kind) === 1) {
      const kid = t.players[e.playerId!]!;
      check((t.academy ?? []).includes(kid.id) && kid.potential >= 91 && kid.potential <= 94 && kid.rating <= 72, "wonderkid: an academy kid with 91+ potential");
    }
    if (e.kind === "takeover" && seen.get(e.kind) === 1) {
      check(t.clubs[e.clubId!]!.squad.length === at.clubs[e.clubId!]!.squad.length + 1 && rivalsOf(allClubIds(t), t.userClubId).includes(e.clubId!), "takeover: your rival signs one player");
    }
    if (e.options.length < 1 || e.options.length > 2) badEvents.push(`${e.kind} buttons`);
  }
  check(badEvents.length === 0, `sponsor cash £25k–£80k and 1–2 buttons on every event (${badEvents.slice(0, 3).join(", ")})`);
  check(fired / N > 0.04 && fired / N < 0.1, `random events after ${((100 * fired) / N).toFixed(1)}% of league games`);
  check(seen.size === 5, `all five kinds turn up (${[...seen.entries()].map(([k, n]) => `${k} ${n}`).join(", ")})`);
  const season = simAll(createCareer({ clubId: "st-helens", managerName: "T", seed: "events-season" }));
  const randoms = (season.events ?? []).filter((e) => e.year === season.year && !e.kind.startsWith("legend") && e.kind !== "club-record");
  check(randoms.length <= EVENTS_PER_SEASON, `at most ${EVENTS_PER_SEASON} random events a season (${randoms.length})`);
}

console.log(`\n${failed === 0 ? "ALL MANAGER EXTRAS TESTS PASSED" : "MANAGER EXTRAS TESTS FAILED"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
