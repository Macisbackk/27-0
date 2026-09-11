/**
 * Build Super League Grand Final champion years (and refresh Current LLS
 * propagation) so showcase cards show champion year chips like League Leaders.
 *
 * Run: npx tsx scripts/build-super-league-champion-years.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { GRAND_FINALS } from "../data/quiz/facts";
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
  teamYearId?: string;
  superLeagueWinner?: boolean;
};

const QUIZ_CLUB: Record<string, string> = {
  wigan: "Wigan Warriors",
  "st-helens": "St Helens",
  bradford: "Bradford Bulls",
  leeds: "Leeds Rhinos",
  "hull-kr": "Hull KR",
  "hull-fc": "Hull FC",
  catalans: "Catalans Dragons",
  salford: "Salford Red Devils",
  warrington: "Warrington Wolves",
  castleford: "Castleford Tigers",
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
  return [...keys];
}

function clubOf(p: Raw): string {
  return String(p.displayClub ?? p.team ?? p.club ?? "");
}

function slugifyClub(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickBestId(
  name: string,
  year: number,
  club: string,
  players: Raw[]
): string | null {
  const keys = new Set(nameKeys(name));
  const candidates = players.filter((p) =>
    keys.has(trophyWinnerNameKey(p.name))
  );
  if (candidates.length === 0) return null;
  const teamYearId = `${slugifyClub(club)}-${year}`;
  const scored = candidates.map((p) => {
    let score = 0;
    if (p.teamYearId === teamYearId) score += 100;
    if (p.id.endsWith(`-${year}`)) score += 80;
    if (clubOf(p) === club && (p.year === year || p.cardYear === year)) score += 60;
    if (clubOf(p) === club) score += 20;
    if (p.superLeagueWinner) score += 10;
    return { id: p.id, score };
  });
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored[0]?.id ?? null;
}

function main(): void {
  const current = loadJson<Raw[]>("current-squads.json");
  const historic = loadJson<Raw[]>("historic-players.json");
  const legends = loadJson<Raw[]>("legends.json");
  const all = [...current, ...historic, ...legends];
  const byId = new Map(all.map((p) => [p.id, p]));
  const champ: Record<string, number[]> = {};

  const eraSquads = loadJson<
    Array<{ club: string; year: number; squad: Array<{ name: string }> }>
  >("era-starting-17s.json");

  const currentByName = new Map<string, Raw[]>();
  for (const p of current) {
    for (const key of nameKeys(p.name)) {
      const list = currentByName.get(key) ?? [];
      list.push(p);
      currentByName.set(key, list);
    }
  }

  for (const final of GRAND_FINALS) {
    const club = QUIZ_CLUB[final.winnerId];
    if (!club) continue;
    const year = final.year;
    const ids = new Set<string>();

    const teamYearId = `${slugifyClub(club)}-${year}`;
    for (const p of all) {
      if (clubOf(p) !== club) continue;
      if (p.teamYearId === teamYearId || p.id.endsWith(`-${year}`)) {
        ids.add(p.id);
      }
    }

    const era = eraSquads.find((e) => e.club === club && e.year === year);
    if (era) {
      for (const row of era.squad) {
        const id = pickBestId(row.name, year, club, all);
        if (id) ids.add(id);
        for (const key of nameKeys(row.name)) {
          for (const p of currentByName.get(key) ?? []) ids.add(p.id);
        }
      }
    }

    // Recent GF-winning Current squads still largely intact
    if (year >= 2023) {
      for (const p of current) {
        if (clubOf(p) !== club) continue;
        if (p.superLeagueWinner || year === 2025) ids.add(p.id);
      }
    }

    for (const id of ids) mergeYears(champ, id, [year]);
    console.log(`GF ${year} ${club}: ${ids.size}`);
  }

  // Propagate onto Current via name/base
  for (const [id, years] of Object.entries({ ...champ })) {
    const source = byId.get(id);
    if (!source) continue;
    const base = source.basePlayerId;
    if (base && current.some((p) => p.id === base)) mergeYears(champ, base, years);
    for (const key of nameKeys(source.name)) {
      for (const p of currentByName.get(key) ?? []) mergeYears(champ, p.id, years);
    }
  }

  const CAREER_START_YEAR: Record<string, number> = {
    "morgan knowles": 2017,
    "jack welsby": 2018,
    "curtis sironen": 2021,
    "jake wingfield": 2019,
    "matty lees": 2017,
  };

  for (const p of current) {
    const start = CAREER_START_YEAR[trophyWinnerNameKey(p.name)];
    if (start === undefined || !champ[p.id]) continue;
    const filtered = champ[p.id]!.filter((year) => year >= start);
    if (filtered.length === 0) delete champ[p.id];
    else champ[p.id] = filtered;
  }

  // Strip impossible 2014 from Knowles hist era card as well
  for (const id of Object.keys(champ)) {
    if (!id.includes("morgan-knowles")) continue;
    champ[id] = (champ[id] ?? []).filter((year) => year !== 2014);
    if (champ[id]!.length === 0) delete champ[id];
  }

  saveJson(
    "super-league-champion-years.json",
    Object.fromEntries(Object.entries(champ).sort(([a], [b]) => a.localeCompare(b)))
  );

  const curIds = new Set(current.map((p) => p.id));
  const curChamp = Object.entries(champ).filter(([id]) => curIds.has(id));
  console.log(`Current players with GF champion years: ${curChamp.length}`);
  for (const id of [
    "st-helens-cur-jack-welsby",
    "st-helens-cur-alex-walmsley",
    "st-helens-cur-morgan-knowles",
    "wigan-cur-bevan-french",
    "hull-kr-cur-mikey-lewis",
    "leeds-cur-ash-handley",
  ]) {
    console.log(`  ${id}: ${(champ[id] ?? []).join(",") || "—"}`);
  }
}

main();
