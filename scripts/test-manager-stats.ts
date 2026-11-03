/**
 * Manager Mode stats: league-relevant news, match ratings, player stats, league leaders and the
 * club Hall of Fame (real records seeded, broken during a career).
 * Run: npx tsx scripts/test-manager-stats.ts   (CI: npm run test:career)
 */
import recordsData from "../data/club-records.json";
import {
  LEADER_MIN_APPS,
  RATING_MAX,
  RATING_MIN,
  RECORD_KINDS,
  avgRating,
  beginOffseason,
  checkRecords,
  closeDeadlineDay,
  createCareer,
  finishDepartures,
  finishTransfers,
  goalKicker,
  goalsFrom,
  hallOfFame,
  inferNewsTags,
  isDealRelevant,
  leagueLeaders,
  migrateCareer,
  pendingEvent,
  playMatchday,
  rateMatch,
  relevantDeals,
  relevantNews,
  seedRecords,
  sheetFor,
  simRestOfSeason,
  squadStats,
  tagNews,
  type CareerState,
  type Fixture,
  type TransferDeal,
} from "../src/lib/career";
import { simulateMatch } from "../src/lib/career/match";
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
const nextSeason = (s: CareerState): CareerState => finishTransfers(finishDepartures(beginOffseason(s)));
const playedFixtures = (s: CareerState): Fixture[] => s.calendar.flatMap((m) => m.fixtures).filter((f) => !!f.result);

/* ------------------------------------------------------------------ news */
console.log("League-relevant news");
{
  const sl = createCareer({ clubId: "leeds-rhinos", managerName: "T", seed: "news-sl" });
  const s: CareerState = structuredClone(sl);
  const champ = Object.values(s.clubs).find((c) => c.division === "championship")!;
  const rival = Object.values(s.clubs).find((c) => c.division === "super-league" && c.id !== s.userClubId)!;
  s.news = [`${champ.name} sign Joe Bloggs on a free.`, ...s.news];
  tagNews(s, s.news[0]!, [champ.id]);
  s.news = [`${rival.name} sign Fred Smith on a free.`, ...s.news];
  tagNews(s, s.news[0]!, [rival.id]);
  s.news = [`Sold Tom to ${champ.name} for £50k.`, ...s.news];
  tagNews(s, s.news[0]!, [champ.id, s.userClubId]);
  const shown = relevantNews(s);
  check(!shown.some((l) => l.startsWith(`${champ.name} sign`)), "Super League manager: Championship-only news is hidden");
  check(shown.some((l) => l.startsWith(`${rival.name} sign`)), "…Super League news shows");
  check(shown.some((l) => l.startsWith("Sold Tom")), "…and anything involving your club shows");
  check(shown.some((l) => l.includes("takes charge")), "…and your own (untagged) lines show");

  const mk = (from: string | null, to: string | null, extra: Partial<TransferDeal> = {}): TransferDeal => ({
    year: s.year, at: 0, playerId: `x-${from}-${to}`, playerName: "X", pos: "CE", rating: 70, from, to, fee: 0, ...extra,
  });
  const champDeal = mk(null, champ.id, { divisions: ["championship"] });
  const crossDeal = mk(rival.id, champ.id, { divisions: ["super-league", "championship"] });
  const myDeal = mk(champ.id, s.userClubId, { user: true, divisions: ["championship", "super-league"] });
  const oldDeal = mk(champ.id, null);
  check(!isDealRelevant(s, champDeal), "a Championship-only deal is hidden from a Super League manager");
  check(isDealRelevant(s, crossDeal) && isDealRelevant(s, myDeal), "deals touching Super League or your club show");
  check(!isDealRelevant(s, oldDeal), "an untagged (older) deal is judged by the clubs' divisions");
  check(relevantDeals(s, [champDeal, crossDeal, myDeal]).length === 2, "relevantDeals filters the round-up");

  // Championship manager: the mirror image.
  const ch = createCareer({ clubId: "featherstone-rovers", managerName: "T", seed: "news-ch" });
  const c: CareerState = structuredClone(ch);
  const slClub = Object.values(c.clubs).find((x) => x.division === "super-league")!;
  const chClub = Object.values(c.clubs).find((x) => x.division === "championship" && x.id !== c.userClubId)!;
  c.news = [`${slClub.name} win the Grand Final.`, `${chClub.name} sign A on a free.`, ...c.news];
  tagNews(c, c.news[0]!, [slClub.id]);
  tagNews(c, c.news[1]!, [chClub.id]);
  const cShown = relevantNews(c);
  check(!cShown.includes(`${slClub.name} win the Grand Final.`) && cShown.includes(`${chClub.name} sign A on a free.`), "Championship manager: Super League-only news hidden, Championship news shown");

  // Real deals made by the engine carry their divisions.
  let t = simAll(createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "news-deals" }));
  t = nextSeason(t);
  const deals = t.transfers ?? [];
  check(deals.length > 0 && deals.every((d) => Array.isArray(d.divisions)), `every new deal stores its divisions (${deals.length} deals)`);
  const stale = Object.keys(t.newsTags ?? {}).filter((k) => !t.news.includes(k)).length;
  check(stale <= 2, `news tags are pruned with the feed (${stale} stale)`);

  // Migration: an old save with no tags gets them inferred from the clubs named.
  const old: CareerState = structuredClone(sl);
  delete old.newsTags;
  old.news = [`${champ.name} sign Old Boy on a free.`, `Sold Tom to ${champ.name} for £50k.`, `Round 3: LEE beat ${champ.name} 30–10.`, ...old.news];
  old.transfers = [mk(null, champ.id)];
  const mig = migrateCareer(old);
  check(!!mig.newsTags && mig.newsTags[`${champ.name} sign Old Boy on a free.`]?.[0] === "championship", "migration: an untagged AI line gets the named club's division");
  check(!mig.newsTags![`Sold Tom to ${champ.name} for £50k.`] && !mig.newsTags![`Round 3: LEE beat ${champ.name} 30–10.`], "migration: lines about your club stay untagged");
  check(mig.transfers![0]!.divisions?.[0] === "championship", "migration: older deals get their divisions");
  check(migrateCareer(mig) === mig, "a migrated save isn't touched again");
  check(Object.keys(inferNewsTags(sl)).length === 0, "a new career's opening news needs no tags");
}

/* ------------------------------------------------------------------ ratings */
console.log("\nMatch ratings");
{
  const s = createCareer({ clubId: "st-helens", managerName: "T", seed: "ratings" });
  const md = s.calendar[s.matchdayIndex]!;
  const f = md.fixtures[0]!;
  const home = sheetFor(s, f.home);
  const away = sheetFor(s, f.away);
  const r = simulateMatch(rngFor("ratings-test"), home, away, s.players, { knockout: false });
  const a = rateMatch(s.seed, f.id, home, away, r, s.players);
  const b = rateMatch(s.seed, f.id, home, away, r, s.players);
  const ids = [...home.lineup, ...(home.bench ?? []), ...away.lineup, ...(away.bench ?? [])];
  check(Object.keys(a.ratings).length === 34 && ids.every((id) => a.ratings[id] != null), "all 34 players get a rating");
  check(Object.values(a.ratings).every((v) => v >= RATING_MIN && v <= RATING_MAX && Math.round(v * 10) === v * 10), "ratings are 3.0–10.0 with one decimal");
  check(JSON.stringify(a) === JSON.stringify(b), "ratings are deterministic for the same fixture");
  const top = Math.max(...Object.values(a.ratings));
  check(!!a.motm && a.ratings[a.motm] === top, "Player of the Match has the top rating");
  const g = goalsFrom(r.homeScore, r.homeTries.length);
  const kicker = goalKicker(home.lineup, s.players, r.homeSentOff ?? []);
  check(g === 0 || (!!kicker && a.goals[kicker] === g), `the home kicker gets the goals (${g})`);
  check(goalsFrom(22, 4) === 3 && goalsFrom(13, 2) === 2 && goalsFrom(0, 0) === 0, "goals = (score − 4×tries) ÷ 2, drop goal aside");

  // Played round by round: your latest game keeps its ratings, and PotM is always the top mark.
  {
    let w = createCareer({ clubId: "st-helens", managerName: "T", seed: "ratings-rounds" });
    let games = 0;
    let potmOk = true;
    let keptOk = true;
    let reds = 0;
    let redsOk = true;
    for (let i = 0; i < 12; i++) {
      w = playMatchday(closeDeadlineDay(w));
      const mine = playedFixtures(w).filter((x) => x.home === w.userClubId || x.away === w.userClubId);
      const last = mine[mine.length - 1];
      if (!last) continue;
      games++;
      const rt = last.result!.ratings;
      if (!rt || Object.keys(rt).length < 30 || mine.slice(0, -1).some((x) => x.result!.ratings)) keptOk = false;
      if (rt && rt[last.result!.motm!] !== Math.max(...Object.values(rt))) potmOk = false;
      for (const id of [...(last.result!.homeSentOff ?? []), ...(last.result!.awaySentOff ?? [])]) {
        reds++;
        if (!rt || rt[id]! > 4.5) redsOk = false;
      }
    }
    check(games >= 10 && keptOk, `your latest game keeps its ratings, older ones drop them (${games} games)`);
    check(potmOk, "every Player of the Match is the top-rated player");
    check(redsOk, `a red card costs his rating (${reds} seen)`);
  }

  // A whole season of every match in both divisions.
  const done = simAll(createCareer({ clubId: "st-helens", managerName: "T", seed: "ratings-season" }));
  const fixtures = playedFixtures(done);
  check(fixtures.filter((x) => x.home !== done.userClubId && x.away !== done.userClubId).every((x) => !x.result!.ratings), "other clubs' games don't keep ratings (saves stay small)");
  const everyone = Object.values(done.players).filter((p) => (p.rated ?? 0) >= 10);
  const avgs = everyone.map((p) => avgRating(p)!);
  const mean = avgs.reduce((t, x) => t + x, 0) / avgs.length;
  check(mean > 5.9 && mean < 6.9, `league-wide average rating ${mean.toFixed(2)} (6–7)`);
  const stars = everyone.filter((p) => p.rating >= 85).map((p) => avgRating(p)!);
  const fringe = everyone.filter((p) => p.rating <= 72).map((p) => avgRating(p)!);
  const m = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
  check(stars.length > 0 && m(stars) > m(fringe) + 0.2, `stars average higher (${m(stars).toFixed(2)} v ${m(fringe).toFixed(2)})`);
  check(Math.max(...avgs) < 8.6 && Math.min(...avgs) > 4.5, `season averages stay sensible (${Math.min(...avgs)}–${Math.max(...avgs)})`);

  /* ------------------------------------------------------------------ stats */
  console.log("\nPlayer stats");
  // v1.64: other clubs' games drop their try scorers once credited (saves stay small); yours keep them.
  const mineFx = fixtures.filter((x) => x.home === done.userClubId || x.away === done.userClubId);
  check(fixtures.filter((x) => !mineFx.includes(x)).every((x) => !x.result!.homeTries.length && !x.result!.awayTries.length), "other clubs' games don't keep try scorers");
  const totalTries = mineFx.reduce((t, x) => t + (x.home === done.userClubId ? x.result!.homeTries.length : x.result!.awayTries.length), 0);
  const credited = done.clubs[done.userClubId]!.squad.reduce((t, id) => t + (done.players[id]?.tries ?? 0), 0);
  check(credited <= totalTries && credited >= totalTries * 0.9, `season tries add up (${credited} of ${totalTries}; departed players aside)`);
  const rows = squadStats(done);
  check(rows.length === done.clubs[done.userClubId]!.squad.length, "squad stats list every player");
  check(rows.every((r2) => r2.points === r2.tries * 4 + r2.goals * 2), "points = 4 × tries + 2 × goals");
  check(rows.every((r2) => r2.clubApps >= r2.apps && r2.clubTries >= r2.tries), "club totals include this season");
  const kickers = rows.filter((r2) => r2.goals > 0);
  check(kickers.length >= 1 && kickers.length <= 6, `a few goal-kickers (${kickers.map((k) => `${k.name} ${k.goals}`).join(", ")})`);
  const next = simAll(nextSeason(done));
  const kept = squadStats(next).find((r2) => rows.some((o) => o.id === r2.id && o.apps > 5));
  const before = rows.find((o) => o.id === kept?.id);
  check(!!kept && !!before && kept.clubApps === before.clubApps + kept.apps, `club totals carry over a season (${kept?.name}: ${before?.clubApps} + ${kept?.apps})`);
  check(Object.values(next.players).every((p) => p.apps === 0 || (p.rated ?? 0) <= p.apps), "rated games never exceed appearances");

  /* ------------------------------------------------------------------ leaders */
  console.log("\nLeague leaders");
  const lead = leagueLeaders(done, "super-league");
  check(lead.tries.length === 10 && lead.ratings.length === 10, "top 10 try scorers and top 10 ratings");
  check(lead.tries.every((x, i) => i === 0 || lead.tries[i - 1]!.value >= x.value), "try scorers sorted");
  check(lead.ratings.every((x, i) => i === 0 || lead.ratings[i - 1]!.value >= x.value), "ratings sorted");
  check(lead.ratings.every((x) => x.apps >= LEADER_MIN_APPS), `ratings need ${LEADER_MIN_APPS}+ games`);
  check([...lead.tries, ...lead.ratings].every((x) => done.clubs[x.clubId]!.division === "super-league"), "only the chosen division");
  const slTop = Math.max(...Object.values(done.clubs).filter((c) => c.division === "super-league").flatMap((c) => c.squad.map((id) => done.players[id]!.tries)));
  check(lead.tries[0]!.value === slTop, `top try scorer has the most tries (${lead.tries[0]!.name} ${slTop})`);
  check(leagueLeaders(done, "championship").tries.every((x) => done.clubs[x.clubId]!.division === "championship"), "Championship leaders are Championship players");
}

/* ------------------------------------------------------------------ records */
console.log("\nClub records");
{
  const data = (recordsData as { clubs: Record<string, Record<string, unknown>> }).clubs;
  const s = createCareer({ clubId: "wigan-warriors", managerName: "T", seed: "records" });
  const ids = Object.keys(data);
  check(ids.every((id) => !!s.clubs[id]), `every club in data/club-records.json is in the game (${ids.length})`);
  check(ids.every((id) => Array.isArray(data[id]!.sources) && (data[id]!.sources as string[]).length > 0), "every club's records cite a source");
  check(Object.values(s.clubs).filter((c) => c.division === "super-league").filter((c) => Object.keys(seedRecords(c.id)).length > 0).length >= 12, "most Super League clubs start with real records");
  const wig = seedRecords("wigan-warriors");
  check(wig.tries?.name === "Billy Boston" && wig.tries.value === 478 && wig.apps?.name === "Jim Sullivan", "Wigan: Billy Boston 478 tries, Jim Sullivan most appearances");
  check(Object.values(seedRecords("st-helens")).every((r) => r!.value > 0), "records are positive numbers");
  const hof = hallOfFame(s, "wigan-warriors");
  check(hof.length === RECORD_KINDS.length && hof.every((h) => h.record && !h.careerOnly), "Wigan's Hall of Fame shows all four real records");
  const salford = hallOfFame(s, "salford-rlfc");
  check(salford.every((h) => h.careerOnly && !h.record), "a club with no reliable data starts with empty records");

  // Break one: give a Wigan winger Boston's tally minus one, then let him score.
  const t: CareerState = structuredClone(s);
  const wing = t.players[t.lineup[1]!]!;
  wing.clubTotals = { "wigan-warriors": { apps: 400, tries: 479, ratingSum: 2600 } };
  checkRecords(t, "wigan-warriors", [wing.id]);
  const rec = t.clubRecords?.["wigan-warriors"]?.tries;
  check(rec?.playerId === wing.id && rec.value === 479, "passing the record makes him the holder");
  const e = pendingEvent(t);
  check(e?.kind === "club-record" && e.title.includes("breaks the club try record") && e.playerId === wing.id, `a pop-up for your club ("${e?.title}")`);
  check(t.news[0]!.includes("breaks the club try record"), "…and a news line");
  wing.clubTotals["wigan-warriors"]!.tries = 482;
  const evBefore = (t.events ?? []).length;
  checkRecords(t, "wigan-warriors", [wing.id]);
  check(t.clubRecords!["wigan-warriors"]!.tries!.value === 482 && (t.events ?? []).length === evBefore, "the holder's tally just grows (no second pop-up)");
  check(hallOfFame(t, "wigan-warriors").find((h) => h.kind === "tries")!.record!.name === wing.name, "the Hall of Fame shows the new holder");

  // An AI club's record: set, but no pop-up for the user.
  const u: CareerState = structuredClone(s);
  const saint = u.players[u.clubs["st-helens"]!.squad[0]!]!;
  saint.clubTotals = { "st-helens": { apps: 600, ratingSum: 3900 } };
  checkRecords(u, "st-helens", [saint.id]);
  check(u.clubRecords?.["st-helens"]?.apps?.playerId === saint.id && !pendingEvent(u), "an AI club's record changes hands quietly");

  // No real figure: this career's best holds it, no fanfare.
  const v = simAll(createCareer({ clubId: "salford-rlfc", managerName: "T", seed: "records-empty" }));
  const sal = hallOfFame(v, "salford-rlfc");
  check(sal.find((h) => h.kind === "apps")!.record!.value > 0 && sal.every((h) => h.careerOnly), "an empty record fills with the career best");
  check(!(v.events ?? []).some((e2) => e2.kind === "club-record"), "…with no pop-up");
}

console.log(`\n${failed === 0 ? "ALL MANAGER STATS TESTS PASSED" : "MANAGER STATS TESTS FAILED"}: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
