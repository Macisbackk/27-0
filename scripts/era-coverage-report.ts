/**
 * Super League coverage report, 1996–2026: for every club that really played in Super League
 * each season (data/era-rating-anchors.json leagueTables, from the Wikipedia season pages, plus
 * Toronto 2020 and the 14 clubs of 2026), check what the game has.
 *
 *   spin   — the club-season is an Era Classic spin pool (2026: a Classic Current pool)
 *   side   — an era starting-17 side builds for it (Era Challenge Cup / One-per-club)
 *   own    — recruitable cards pinned to that exact club + season
 *   13/17  — those own-season cards cover a full 13 by position (and 17 cards with a full 13)
 *   spinOwn— how many of the spin pool's players use a card from that exact season
 *   notable— Man of Steel / Dream Team / Lance Todd / Harry Sunderland winners that season
 *            for that club, and whether each has a card for that exact club-season
 *
 * Run: bun scripts/era-coverage-report.ts [--json out.json]
 */
import fs from "node:fs";
import path from "node:path";
import { getAllDatabasePlayers } from "../src/lib/players";
import { getAllEraTeams } from "../src/lib/players/era-teams";
import {
  getCurrentModeTeamYearPools,
  getEraModeTeamYearPools,
  isEraOnlyGeneratedPlayer,
} from "../src/lib/game/player-pool-eligibility";
import { isPlayableTeamYearRoster } from "../src/lib/players/team-year-roster-playable";
import { isSuperLeagueEligiblePlayer } from "../src/lib/players/super-league-eligibility";
import { expandNameLookupKeys } from "../src/lib/players/player-name-resolve";
import type { Player } from "../src/lib/types";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");
const A = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "era-rating-anchors.json"), "utf8")) as {
  manOfSteel: Record<string, [string, string]>;
  dreamTeam: Record<string, [string, string][]>;
  lanceTodd: Record<string, [string, string][]>;
  harrySunderland: Record<string, [string, string][]>;
  leagueTables: Record<string, string[]>;
};

/** Anchor (Wikipedia) club name → the game's club name. */
export const GAME_CLUB: Record<string, string> = {
  Halifax: "Halifax Panthers",
  Oldham: "Oldham RLFC",
  "Paris Saint-Germain": "Paris Saint-Germain RL",
  "Celtic Crusaders": "Crusaders RL",
  Crusaders: "Crusaders RL",
};
const gameClub = (c: string) => GAME_CLUB[c] ?? c;

const CLUBS_2026 = [
  "Bradford Bulls", "Castleford Tigers", "Catalans Dragons", "Huddersfield Giants", "Hull FC", "Hull KR",
  "Leeds Rhinos", "Leigh Leopards", "St Helens", "Toulouse Olympique", "Wakefield Trinity",
  "Warrington Wolves", "Wigan Warriors", "York Knights",
];

export function superLeagueSeasons(): Array<{ club: string; year: number }> {
  const out: Array<{ club: string; year: number }> = [];
  for (let y = 1996; y <= 2025; y++) {
    const table = [...(A.leagueTables[String(y)] ?? [])];
    // Toronto Wolfpack played 6 rounds of 2020 before withdrawing (results expunged).
    if (y === 2020) table.push("Toronto Wolfpack");
    for (const c of table) out.push({ club: gameClub(c), year: y });
  }
  for (const c of CLUBS_2026) out.push({ club: c, year: 2026 });
  return out;
}

const norm = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const NAME_ALIAS: Record<string, string> = {
  andrewfarrell: "andyfarrell", garyconnolly: "garryconnolly", robbiepaul: "robbiehunterpaul",
  tommymakinson: "thomasmakinson", matthewdaylight: "mattdaylight", nenemcdonald: "nenemacdonald",
};
const nk = (s: string) => NAME_ALIAS[norm(s)] ?? norm(s);

const cardYear = (p: Player) => p.year ?? p.cardYear;
const clubOf = (p: Player) => [p.club, p.displayClub, p.team];

export type CoverageRow = {
  club: string;
  year: number;
  spin: boolean;
  side: boolean;
  own: number;
  eraOnly: number;
  full13: boolean;
  full17: boolean;
  spinOwn: number | null;
  notables: Array<{ name: string; award: string; card: boolean }>;
};

export function buildCoverage(): CoverageRow[] {
  const players = getAllDatabasePlayers().filter((p) => p.availableInGame !== false);
  const byClubYear = new Map<string, Player[]>();
  for (const p of players) {
    const y = cardYear(p);
    if (y === undefined) continue;
    if (p.category === "current" && y !== 2026) continue;
    for (const c of new Set(clubOf(p).filter(Boolean) as string[])) {
      const k = `${c}|${y}`;
      byClubYear.set(k, [...(byClubYear.get(k) ?? []), p]);
    }
  }
  const pools = new Map<string, readonly string[]>();
  for (const pool of getEraModeTeamYearPools()) pools.set(`${pool.team}|${pool.year}`, pool.playerIds);
  for (const pool of getCurrentModeTeamYearPools()) pools.set(`${pool.team}|${pool.year}`, pool.playerIds);
  const sides = new Set(getAllEraTeams().map((t) => `${t.clubName}|${t.year}`));
  const byId = new Map(players.map((p) => [p.id, p]));

  const notablesFor = new Map<string, Array<{ name: string; award: string }>>();
  const addN = (club: string, y: string, name: string, award: string) => {
    const k = `${gameClub(club)}|${y}`;
    notablesFor.set(k, [...(notablesFor.get(k) ?? []), { name, award }]);
  };
  for (const [y, [n, c]] of Object.entries(A.manOfSteel)) addN(c, y, n, "Man of Steel");
  for (const [y, t] of Object.entries(A.dreamTeam)) for (const [n, c] of t) addN(c, y, n, "Dream Team");
  for (const [y, t] of Object.entries(A.lanceTodd)) for (const [n, c] of t) addN(c, y, n, "Lance Todd");
  for (const [y, t] of Object.entries(A.harrySunderland)) for (const [n, c] of t) addN(c, y, n, "Harry Sunderland");

  return superLeagueSeasons().map(({ club, year }) => {
    const k = `${club}|${year}`;
    const cards = byClubYear.get(k) ?? [];
    const own = cards.filter((p) => !isEraOnlyGeneratedPlayer(p) && isSuperLeagueEligiblePlayer(p));
    const eraOnly = cards.filter((p) => isEraOnlyGeneratedPlayer(p));
    const ids = own.map((p) => p.id);
    const full13 = isPlayableTeamYearRoster(club, String(year), ids, (id) => byId.get(id));
    const pool = pools.get(k);
    const spinOwn = pool ? pool.filter((id) => cardYear(byId.get(id) ?? ({} as Player)) === year).length : null;
    const names = new Set(cards.flatMap((p) => [nk(p.name), ...expandNameLookupKeys(p.name)]));
    const notables = (notablesFor.get(k) ?? []).map((n) => ({
      ...n,
      card: names.has(nk(n.name)) || expandNameLookupKeys(n.name).some((key) => names.has(key)),
    }));
    return {
      club,
      year,
      spin: !!pool,
      side: sides.has(k),
      own: own.length,
      eraOnly: eraOnly.length,
      full13,
      full17: full13 && own.length >= 17,
      spinOwn,
      notables,
    };
  });
}

if (import.meta.main) {
  const rows = buildCoverage();
  const out = process.argv.indexOf("--json");
  if (out > 0) fs.writeFileSync(process.argv[out + 1]!, JSON.stringify(rows, null, 1));
  const n = rows.length;
  const c = (f: (r: CoverageRow) => boolean) => rows.filter(f).length;
  console.log(`club-seasons ${n} | spinnable ${c((r) => r.spin)} | era side ${c((r) => r.side)} | any own card ${c((r) => r.own > 0)} | own >=13 ${c((r) => r.own >= 13)} | full 13 ${c((r) => r.full13)} | full 17 ${c((r) => r.full17)}`);
  const nots = rows.flatMap((r) => r.notables.map((x) => ({ ...x, club: r.club, year: r.year })));
  console.log(`notables ${nots.length}, with exact card ${nots.filter((x) => x.card).length}`);
  for (const a of ["Man of Steel", "Dream Team", "Lance Todd", "Harry Sunderland"]) {
    const s = nots.filter((x) => x.award === a);
    console.log(`  ${a}: ${s.filter((x) => x.card).length}/${s.length}; missing: ${s.filter((x) => !x.card).map((x) => `${x.name} ${x.club} ${x.year}`).join("; ")}`);
  }
  if (process.argv.includes("--rows")) {
    for (const r of rows) console.log(`${r.year} ${r.club.padEnd(24)} spin=${r.spin ? "Y" : "-"} side=${r.side ? "Y" : "-"} own=${String(r.own).padStart(2)} eraOnly=${r.eraOnly} 13=${r.full13 ? "Y" : "-"} 17=${r.full17 ? "Y" : "-"} spinOwn=${r.spinOwn ?? "-"}`);
  }
}
