/**
 * Tighten League Leaders years on Current cards:
 * - Fix false positives (e.g. Knowles 2014)
 * - Alias first-name variants (Mike/Michael) when matching era squads
 * - Ensure alumni still on Current show LLS years from prior clubs
 *
 * Run: npx tsx scripts/propagate-league-leaders-to-current.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { trophyWinnerNameKey } from "./lib/sources/wikipedia-trophies";

const DATA = join(__dirname, "..", "data");

type Raw = {
  id: string;
  name: string;
  category?: string;
  basePlayerId?: string;
  club?: string;
  displayClub?: string;
  team?: string;
  year?: number;
  cardYear?: number;
};

const LLS_SEASONS: { year: number; club: string }[] = [
  { year: 2006, club: "St Helens" },
  { year: 2007, club: "St Helens" },
  { year: 2008, club: "St Helens" },
  { year: 2014, club: "St Helens" },
  { year: 2017, club: "Castleford Tigers" },
  { year: 2019, club: "St Helens" },
  { year: 2021, club: "Catalans Dragons" },
  { year: 2022, club: "St Helens" },
  { year: 2023, club: "Wigan Warriors" },
  { year: 2024, club: "Wigan Warriors" },
  { year: 2025, club: "Hull KR" },
  { year: 2026, club: "Wigan Warriors" },
];

/** Career windows used to drop impossible LLS years on Current cards. */
const CAREER_START_YEAR: Record<string, number> = {
  "morgan knowles": 2017,
  "jack welsby": 2018,
  "curtis sironen": 2021,
  "jake wingfield": 2019,
  "matty lees": 2017,
  "george delaney": 2022,
  "harry robertson": 2024,
  "george whitby": 2024,
};

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

function saveJson(name: string, data: unknown): void {
  writeFileSync(join(DATA, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function mergeYears(
  map: Record<string, number[]>,
  id: string,
  years: number[]
): void {
  map[id] = [...new Set([...(map[id] ?? []), ...years])].sort((a, b) => a - b);
}

function nameKeys(name: string): string[] {
  const key = trophyWinnerNameKey(name);
  const keys = new Set<string>([key]);
  if (key.startsWith("mike ")) keys.add(`michael ${key.slice(5)}`);
  if (key.startsWith("michael ")) keys.add(`mike ${key.slice(8)}`);
  if (key.startsWith("matt ")) keys.add(`matthew ${key.slice(5)}`);
  if (key.startsWith("matthew ")) keys.add(`matt ${key.slice(8)}`);
  return [...keys];
}

function clubOf(p: Raw): string {
  return String(p.displayClub ?? p.team ?? p.club ?? "");
}

function main(): void {
  const current = loadJson<Raw[]>("current-squads.json");
  const historic = loadJson<Raw[]>("historic-players.json");
  const legends = loadJson<Raw[]>("legends.json");
  const all = [...current, ...historic, ...legends];
  const byId = new Map(all.map((p) => [p.id, p]));
  const ll = loadJson<Record<string, number[]>>("league-leaders-years.json");

  const currentByName = new Map<string, Raw[]>();
  for (const p of current) {
    for (const key of nameKeys(p.name)) {
      const list = currentByName.get(key) ?? [];
      list.push(p);
      currentByName.set(key, list);
    }
  }

  // Propagate from any existing LLS-keyed card onto related Current IDs
  for (const [id, years] of Object.entries(ll)) {
    const source = byId.get(id);
    if (!source) continue;
    const targets = new Set<string>();
    const base = source.basePlayerId;
    if (base && current.some((p) => p.id === base)) targets.add(base);
    for (const p of current) {
      if (p.basePlayerId === id || (base && p.basePlayerId === base)) {
        targets.add(p.id);
      }
    }
    for (const key of nameKeys(source.name)) {
      for (const p of currentByName.get(key) ?? []) targets.add(p.id);
    }
    for (const target of targets) {
      if (target !== id) mergeYears(ll, target, years);
    }
  }

  // Era squad name → Current
  const eraSquads = loadJson<
    Array<{ club: string; year: number; squad: Array<{ name: string }> }>
  >("era-starting-17s.json");

  for (const { year, club } of LLS_SEASONS) {
    const era = eraSquads.find((e) => e.club === club && e.year === year);
    if (!era) continue;
    for (const row of era.squad) {
      for (const key of nameKeys(row.name)) {
        for (const p of currentByName.get(key) ?? []) {
          mergeYears(ll, p.id, [year]);
        }
      }
    }
  }

  // Full Current club for the two most recent LLS-winning seasons still in squads
  for (const p of current) {
    if (clubOf(p) === "Wigan Warriors") mergeYears(ll, p.id, [2026]);
    if (clubOf(p) === "Hull KR") mergeYears(ll, p.id, [2025]);
  }

  // Drop impossible years before a player's known Super League career start
  for (const p of current) {
    const start = CAREER_START_YEAR[trophyWinnerNameKey(p.name)];
    if (start === undefined || !ll[p.id]) continue;
    const filtered = ll[p.id]!.filter((year) => year >= start);
    if (filtered.length === 0) delete ll[p.id];
    else ll[p.id] = filtered;
  }

  // Knowles hist era card was year-pinned 2014 incorrectly for LLS — strip
  for (const id of Object.keys(ll)) {
    if (!id.includes("morgan-knowles")) continue;
    ll[id] = (ll[id] ?? []).filter((year) => year !== 2014);
    if (ll[id]!.length === 0) delete ll[id];
  }

  saveJson(
    "league-leaders-years.json",
    Object.fromEntries(Object.entries(ll).sort(([a], [b]) => a.localeCompare(b)))
  );

  const curIds = new Set(current.map((p) => p.id));
  const curLl = Object.entries(ll).filter(([id]) => curIds.has(id));
  const byClub = new Map<string, number>();
  for (const [id] of curLl) {
    const club = clubOf(byId.get(id)!);
    byClub.set(club, (byClub.get(club) ?? 0) + 1);
  }

  console.log(`Current players with League Leaders years: ${curLl.length}`);
  for (const [club, count] of [...byClub.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(`  ${club}: ${count}`);
  }

  for (const id of [
    "st-helens-cur-morgan-knowles",
    "st-helens-cur-jack-welsby",
    "st-helens-cur-alex-walmsley",
    "hull-fc-cur-zak-hardaker",
    "wakefield-cur-mike-mcmeeken",
    "york-cur-paul-mcshane",
    "hull-kr-cur-arthur-mourgue",
    "catalans-cur-benjamin-garcia",
  ]) {
    console.log(`  ${id}: ${(ll[id] ?? []).join(",") || "—"}`);
  }
}

main();
