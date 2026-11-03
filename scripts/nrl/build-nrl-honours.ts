/**
 * Build the NRL honours / context files in data/nrl/ from the committed caches in
 * scripts/nrl/cache/honours/*.txt (every cache file names its source URL).
 *
 *   bun scripts/nrl/build-nrl-honours.ts
 *
 * Writes (each record carries sourceUrl; names are resolved to nrl-players ids where unambiguous):
 *   nrl-grand-finals.json   premiers, runners-up, score, Clive Churchill Medal 1998-2026
 *   nrl-ladders.json        final regular-season ladder per season 1998-2026 (club ids, position)
 *   nrl-dally-m.json        Dally M Medal 1998-2026 (2003 not awarded) + positional winners / Team of the Year
 *   nrl-origin.json         State of Origin series 1998-2026, Wally Lewis Medal, Origin players (debut 1995+)
 *   nrl-golden-boot.json    IRL Golden Boot winners 1999-2025
 *   nrl-hall-of-fame.json   NRL Hall of Fame player inductees whose careers reached 1998+, and the Immortals
 *   nrl-test-players.json   Australia / New Zealand Test debutants 1995+, plus 2021 RLWC & 2025 Pacific squads (other nations)
 * Standalone: nothing in src/ reads these.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, readCache, firstUrl, readJson, makeResolver, clubIdFromName, toPosCode, type NrlPlayer } from "./lib";

const players: NrlPlayer[] = readJson("nrl-players.json").players;
const { resolve } = makeResolver(players);
const GEN = "2026-11-03";
const unresolved: string[] = [];
const pid = (name: string, year?: number, club?: string | null, window = 1) => {
  const p = resolve(name, { year, clubId: club ?? undefined, window });
  if (!p && year !== undefined && year >= 1998) unresolved.push(`${name} (${year})`);
  return p?.id ?? null;
};
const out = (file: string, obj: unknown) => fs.writeFileSync(path.join(DATA, file), JSON.stringify(obj, null, 1) + "\n");

// ---------------------------------------------------------------- grand finals
const gfC = readCache("honours/grand-finals.txt");
const gfSrc = firstUrl(gfC.header)!;
const season2026 = readJson("nrl-honours.json").season2026;
const grandFinals = gfC.rows.map(([y, prem, score, ru, ccm]) => {
  const year = +y!;
  const premiersId = clubIdFromName(prem!);
  return {
    season: year, premiers: prem!.replace("*", ""), premiersClubId: premiersId, score, runnersUp: ru, runnersUpClubId: clubIdFromName(ru!),
    stripped: prem!.includes("*") || undefined,
    cliveChurchillMedal: { name: ccm, playerId: pid(ccm!, year, premiersId) ?? pid(ccm!, year, clubIdFromName(ru!)) },
    sourceUrl: gfSrc,
  };
});
grandFinals.push({ season: 2026, premiers: season2026.premiers, premiersClubId: clubIdFromName(season2026.premiers), score: null as any, runnersUp: season2026.grandFinalOpponent, runnersUpClubId: clubIdFromName(season2026.grandFinalOpponent), stripped: undefined, cliveChurchillMedal: { name: null as any, playerId: null }, sourceUrl: season2026.sourceUrl });
out("nrl-grand-finals.json", { about: "NRL grand finals 1998-2026: premiers, runners-up, score, Clive Churchill Medal (man of the match). 2026 score/medal not on the source page at fetch time.", generatedAt: GEN, notes: ["Melbourne's 2007 and 2009 premierships were stripped (salary cap breaches): stripped=true."], grandFinals });

// ---------------------------------------------------------------- ladders
const ladC = readCache("honours/ladders.txt");
const ladders: Record<string, any> = {};
for (const [y, list] of ladC.rows) {
  const teams = list!.split(";").map((t) => t.trim());
  ladders[y!] = { teams: teams.length, sourceUrl: `https://en.wikipedia.org/wiki/${y}_NRL_season`, table: teams.map((t, i) => ({ position: i + 1, club: t, clubId: clubIdFromName(t) })) };
  for (const r of ladders[y!].table) if (!r.clubId) throw new Error(`ladder ${y}: unknown club ${r.club}`);
}
out("nrl-ladders.json", { about: "Final regular-season NRL ladders 1998-2026 (position 1 = minor premiers), as published on each season's Wikipedia article. Used for the club-finish adjustment in scripts/nrl/build-nrl-ratings.ts.", generatedAt: GEN, notes: ["Ladders are as published (after any points deductions, e.g. Canterbury 2002 last; Melbourne 2007/2008 minor premierships later stripped but kept here as on-field finish)."], seasons: ladders });

// ---------------------------------------------------------------- Dally M
const medal = readJson("nrl-honours.json").dallyMMedal;
const dmC = readCache("honours/dally-m-team.txt");
const ORDER = ["FB", "WG", "CE", "SO", "SH", "PR", "HK", "SR", "LF", "IC"];
const ladderClub = (y: number) => null as string | null; void ladderClub;
const teamOfYear = dmC.rows.map(([y, src, ...cells]) => {
  const year = +y!;
  const names = cells.join("|").split(";");
  const team: any[] = [];
  names.forEach((cell, i) => { for (const n of cell.split(",").map((s) => s.trim()).filter(Boolean)) team.push({ position: ORDER[i], name: n, playerId: pid(n, year) }); });
  return { season: year, sourceUrl: src, format: year >= 2020 ? "team-of-the-year (13)" : "positional winners", team };
});
const medalWinners = medal.winners.map((w: any) => ({ season: w.season, name: w.name, club: w.club, clubId: clubIdFromName(w.club), playerId: pid(w.name, w.season, clubIdFromName(w.club)), sourceUrl: medal.sourceUrl }));
medalWinners.push({ season: 2003, name: null, club: null, clubId: null, playerId: null, notAwarded: "industrial action (players' association boycott threat during a pay dispute)", sourceUrl: medal.sourceUrl });
medalWinners.sort((a: any, b: any) => a.season - b.season);
out("nrl-dally-m.json", { about: "Dally M Medal (NRL player of the year) 1998-2026 and the Dally M positional winners / Team of the Year 1998-2025.", generatedAt: GEN, notes: [dmC.header.join(" ")], medal: medalWinners, teamOfTheYear: teamOfYear });

// ---------------------------------------------------------------- Origin
const orC = readCache("honours/origin.txt");
const series = orC.rows.map(([y, w, games, wl]) => ({ season: +y!, winner: w === "DRAW" ? "Drawn (Queensland retained)" : w, games, wallyLewisMedal: { name: wl, playerId: pid(wl!, +y!), note: +y! <= 2003 ? "Queensland-only award until 2003" : undefined }, sourceUrl: firstUrl(orC.header) }));
const opC = readCache("honours/origin-players.txt");
const NSW_SRC = "https://en.wikipedia.org/wiki/List_of_New_South_Wales_State_of_Origin_players";
const QLD_SRC = "https://en.wikipedia.org/wiki/List_of_Queensland_State_of_Origin_players";
const originPlayers = opC.rows.map(([n, side, y]) => ({ name: n, side, debut: +y!, playerId: pid(n!, +y!, null, 2), sourceUrl: side === "NSW" ? NSW_SRC : QLD_SRC }));
out("nrl-origin.json", { about: "State of Origin series 1998-2026 with the Wally Lewis Medal, and Origin players who debuted 1995+ (from the NSW and QLD player lists).", generatedAt: GEN, series, players: originPlayers });

// ---------------------------------------------------------------- Golden Boot
const gbC = readCache("honours/golden-boot.txt");
out("nrl-golden-boot.json", { about: "IRL Golden Boot (world player of the year) 1999-2025. Not awarded 1998, 2020, 2021. playerId is set for NRL players.", generatedAt: GEN, winners: gbC.rows.map(([y, n, nat, club]) => ({ season: +y!, name: n, nation: nat, club, playerId: clubIdFromName(club!) ? pid(n!, +y!, clubIdFromName(club!)) : null, sourceUrl: firstUrl(gbC.header) })) });

// ---------------------------------------------------------------- Hall of Fame / Immortals
const hofC = readCache("honours/hall-of-fame.txt");
const hof = hofC.rows.filter((r) => r[0] !== "IMMORTAL").map(([n, y, span]) => {
  const last = +(span!.split(/[–-]/)[1] ?? 0);
  const p = resolve(n!, { year: Math.min(last, 2026), window: 3 });
  return { name: n, inducted: +y!, career: span, playerId: p?.id ?? null, sourceUrl: firstUrl(hofC.header) };
});
const immortals = hofC.rows.filter((r) => r[0] === "IMMORTAL").map(([, n, y]) => ({ name: n, named: +y!, playerId: resolve(n!, { year: 2000, window: 2 })?.id ?? null, sourceUrl: firstUrl(hofC.header) }));
out("nrl-hall-of-fame.json", { about: "NRL (Australian Rugby League) Hall of Fame player inductees whose careers reached the NRL era (1998+), and the Rugby League Immortals.", generatedAt: GEN, hallOfFame: hof, immortals });

// ---------------------------------------------------------------- Test players
const aus = readCache("honours/test-players-aus.txt");
const nz = readCache("honours/test-players-nz.txt");
const intl = readCache("honours/intl-squads.txt");
const AUS_SRC = "https://en.wikipedia.org/wiki/List_of_Australia_national_rugby_league_team_players";
const NZ_SRC = "https://en.wikipedia.org/wiki/List_of_New_Zealand_national_rugby_league_team_players";
const testPlayers: any[] = [];
const elite = new Set<string>([...originPlayers.map((o) => o.playerId), ...teamOfYear.flatMap((t) => t.team.map((x: any) => x.playerId))].filter(Boolean) as string[]);
// Australia list gives surnames only: resolve within the debut season; two debutants with the same surname that year take the two busiest namesakes
const ausByYear = new Map<string, number>();
for (const [s, y] of aus.rows) ausByYear.set(`${s}|${y}`, (ausByYear.get(`${s}|${y}`) ?? 0) + 1);
const ausDone = new Set<string>();
for (const [s, y] of aus.rows) {
  const k = `${s}|${y}`;
  if (ausDone.has(k)) continue;
  ausDone.add(k);
  const n = ausByYear.get(k)!;
  const year = Math.max(+y!, 1998); // pre-1998 debutants: matched on their 1998 season (the database starts in 1998)
  if (n === 1) {
    const p = resolve(s!, { year, surnameOnly: true, prefer: elite });
    testPlayers.push({ nation: "Australia", name: p?.name ?? s, listedAs: s, debut: +y!, playerId: p?.id ?? null, sourceUrl: AUS_SRC });
  } else {
    // e.g. Johns 1995 (Andrew & Matthew), Morris 2009 (Brett & Josh): the n busiest players with that surname that season
    const { bySurname } = makeResolver(players);
    const cands = (bySurname.get(s!.toLowerCase().replace(/[^a-z]/g, "")) ?? []).filter((p) => p.seasons.some((x) => Math.abs(x.season - year) <= 1));
    const apps = (p: NrlPlayer) => p.seasons.filter((x) => Math.abs(x.season - year) <= 1).reduce((a, x) => a + x.apps, 0);
    const top = cands.sort((a, b) => apps(b) - apps(a)).slice(0, n);
    const el = cands.filter((p) => elite.has(p.id));
    const pick = cands.length === n ? top : el.length === n ? el : [];
    const ok = pick.length === n;
    top.splice(0, top.length, ...pick);
    for (let i = 0; i < n; i++) testPlayers.push({ nation: "Australia", name: ok ? top[i]!.name : s, listedAs: s, debut: +y!, playerId: ok ? top[i]!.id : null, sourceUrl: AUS_SRC });
  }
}
for (const [n, y] of nz.rows) testPlayers.push({ nation: "New Zealand", name: n, debut: +y!, playerId: pid(n!, +y!, null, 2), sourceUrl: NZ_SRC });
const intlSrc: Record<string, string> = { rlwc2021: "https://en.wikipedia.org/wiki/2021_Men%27s_Rugby_League_World_Cup_squads", pac2025: "https://en.wikipedia.org/wiki/2025_Rugby_League_Pacific_Championships_squads" };
const squads = intl.rows.map(([nation, n, y, src]) => ({ nation, name: n, year: +y!, event: src === "rlwc2021" ? "2021 Rugby League World Cup (2022)" : "2025 Pacific Championships", playerId: pid(n!, +y!, null, 2), sourceUrl: intlSrc[src!] }));
out("nrl-test-players.json", { about: "International (Test) representatives: Australia and New Zealand Test debutants 1995+ and the NRL players in the 2021 RLWC / 2025 Pacific Championships squads (all nations). Used for nationality / representative nation on cards and as a rating anchor.", generatedAt: GEN, notes: ["The Australia list gives surnames only; a surname is matched to the player with that surname who played that season (null when ambiguous)."], testDebuts: testPlayers, tournamentSquads: squads });

const resolvedRate = (arr: any[]) => `${arr.filter((x) => x.playerId).length}/${arr.length}`;
console.log(`grand finals ${grandFinals.length}; ladders ${Object.keys(ladders).length}; Dally M medal ${resolvedRate(medalWinners.filter((m: any) => m.name))}; TOTY ${resolvedRate(teamOfYear.flatMap((t) => t.team))}; Origin players ${resolvedRate(originPlayers)}; tests ${resolvedRate(testPlayers)}; squads ${resolvedRate(squads)}; HoF ${resolvedRate(hof)}`);
if (process.env.VERBOSE) console.log("unresolved:", unresolved.join(", "));
