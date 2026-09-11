/**
 * Build Challenge Cup winner years so showcase cards show expandable year
 * chips like League Leaders / Super League Champion.
 *
 * Run: npx tsx scripts/build-challenge-cup-years.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { CHALLENGE_CUPS } from "../data/quiz/facts";
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
  challengeCupWinner?: boolean;
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
  leigh: "Leigh Leopards",
  huddersfield: "Huddersfield Giants",
  london: "London Broncos",
  sheffield: "Sheffield Eagles",
};

const CAREER_START_YEAR: Record<string, number> = {
  "morgan knowles": 2017,
  "jack welsby": 2018,
  "curtis sironen": 2021,
  "jake wingfield": 2019,
  "matty lees": 2017,
  "jack farrimond": 2026,
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
    if (p.challengeCupWinner) score += 10;
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
  const cups: Record<string, number[]> = {};

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

  for (const final of CHALLENGE_CUPS) {
    const club = QUIZ_CLUB[String(final.winnerId)];
    if (!club) {
      console.log(`skip ${final.year} — no club map for ${final.winnerId}`);
      continue;
    }
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

    // Current squad still at the club for the latest cup-winning seasons
    if (
      (year === 2026 && club === "Wigan Warriors") ||
      (year === 2025 && club === "Hull KR")
    ) {
      for (const p of current) {
        if (clubOf(p) === club) ids.add(p.id);
      }
    }

    for (const id of ids) mergeYears(cups, id, [year]);
    console.log(`CC ${year} ${club}: ${ids.size}`);
  }

  for (const [id, years] of Object.entries({ ...cups })) {
    const source = byId.get(id);
    if (!source) continue;
    const base = source.basePlayerId;
    if (base && current.some((p) => p.id === base)) mergeYears(cups, base, years);
    for (const key of nameKeys(source.name)) {
      for (const p of currentByName.get(key) ?? []) mergeYears(cups, p.id, years);
    }
  }

  for (const p of current) {
    const start = CAREER_START_YEAR[trophyWinnerNameKey(p.name)];
    if (start === undefined || !cups[p.id]) continue;
    const filtered = cups[p.id]!.filter((year) => year >= start);
    if (filtered.length === 0) delete cups[p.id];
    else cups[p.id] = filtered;
  }

  saveJson(
    "challenge-cup-years.json",
    Object.fromEntries(Object.entries(cups).sort(([a], [b]) => a.localeCompare(b)))
  );

  const curIds = new Set(current.map((p) => p.id));
  const curCups = Object.entries(cups).filter(([id]) => curIds.has(id));
  console.log(`Current players with Challenge Cup years: ${curCups.length}`);
  for (const id of [
    "wigan-cur-bevan-french",
    "wigan-cur-jack-farrimond",
    "hull-kr-cur-mikey-lewis",
    "st-helens-cur-jonny-lomax",
    "leigh-cur-john-asiata",
    "catalans-cur-benjamin-garcia",
  ]) {
    console.log(`  ${id}: ${(cups[id] ?? []).join(",") || "—"}`);
  }
}

main();
