/**
 * Fix historic (and related) achievement correctness:
 * - Seed missing Lance Todd winners present in the DB
 * - Propagate year-map entries onto year cards for matching seasons
 * - Propagate Lance Todd across basePlayerId clusters (+ known aliases)
 * - Sync superLeagueWinner / challengeCupWinner flags from year maps
 * - Repair known bad basePlayerId links
 *
 * Run: npx tsx scripts/fix-historic-achievements.ts
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(__dirname, "..", "data");

type Raw = {
  id: string;
  name: string;
  category?: string;
  basePlayerId?: string;
  year?: number;
  cardYear?: number;
  superLeagueWinner?: boolean;
  challengeCupWinner?: boolean;
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
  if (years.length === 0) return;
  map[id] = [...new Set([...(map[id] ?? []), ...years])].sort((a, b) => a - b);
}

/** Clusters that are the same person but different basePlayerId roots. */
const BASE_ALIASES: string[][] = [
  ["warrington-hist-richie-myler", "wakefield-hist-richard-myler"],
  ["leon-pryce", "st-helens-hist-leon-pryce"],
];

const EXTRA_LANCE_TODD = [
  "leon-pryce",
  "bradford-leg-robbie-hunter-paul",
  "wakefield-hist-richard-myler",
];

function main(): void {
  const historic = loadJson<Raw[]>("historic-players.json");
  const legends = loadJson<Raw[]>("legends.json");
  const current = loadJson<Raw[]>("current-squads.json");
  const all = [...historic, ...legends, ...current];
  const byId = new Map(all.map((p) => [p.id, p]));

  // Repair known bad bases
  let baseFixes = 0;
  for (const p of all) {
    if (p.id === "st-helens-hist-leon-pryce-2009" && p.basePlayerId !== "leon-pryce") {
      p.basePlayerId = "leon-pryce";
      baseFixes++;
    }
  }

  const dream = loadJson<Record<string, number[]>>("dream-team-years.json");
  const mos = loadJson<Record<string, number[]>>("man-of-steel-winners.json");
  const gb = loadJson<Record<string, number[]>>("golden-boot-years.json");
  const lls = loadJson<Record<string, number[]>>("league-leaders-years.json");
  const slc = loadJson<Record<string, number[]>>("super-league-champion-years.json");
  const cc = loadJson<Record<string, number[]>>("challenge-cup-years.json");
  let lanceTodd = loadJson<string[]>("lance-todd-winners.json");

  // Verified Dream Team repairs (name-collision / bad surname matches).
  // 2024 centre = Nene Macdonald (not Leeds historic Wayne Mcdonald).
  // 2025 props = Mike McMeeken + Herman Ese'ese (not Andy Ireland / Anthony England).
  const DREAM_REMOVE: Array<{ id: string; year: number }> = [
    { id: "leeds-hist-wayne-mcdonald", year: 2024 },
    { id: "hull-fc-hist-andy-ireland", year: 2025 },
    { id: "wakefield-hist-anthony-england", year: 2025 },
  ];
  const DREAM_ENSURE: Array<{ id: string; year: number }> = [
    { id: "st-helens-cur-nene-macdonald", year: 2024 },
    { id: "salford-hist-era-nene-macdonald", year: 2024 },
    { id: "wakefield-cur-mike-mcmeeken", year: 2025 },
    { id: "wakefield-hist-mike-mcmeeken-2025", year: 2025 },
    { id: "st-helens-cur-morgan-knowles", year: 2025 },
    { id: "st-helens-hist-morgan-knowles", year: 2025 },
    { id: "wigan-cur-jai-field", year: 2025 },
  ];
  let dreamRepairs = 0;
  for (const { id, year } of DREAM_REMOVE) {
    const years = dream[id];
    if (!years?.includes(year)) continue;
    dream[id] = years.filter((y) => y !== year);
    if (dream[id]!.length === 0) delete dream[id];
    dreamRepairs++;
  }
  for (const { id, year } of DREAM_ENSURE) {
    if (!byId.has(id)) continue;
    const before = (dream[id] ?? []).join(",");
    mergeYears(dream, id, [year]);
    if ((dream[id] ?? []).join(",") !== before) dreamRepairs++;
  }

  const ltSet = new Set(lanceTodd);
  for (const id of EXTRA_LANCE_TODD) {
    if (byId.has(id)) ltSet.add(id);
  }

  // Drop Lance Todd IDs that don't exist when a year-suffixed card does.
  let lanceToddOrphansCleared = 0;
  for (const id of [...ltSet]) {
    if (byId.has(id)) continue;
    const yearVariants = [...byId.keys()].filter(
      (pid) => pid.startsWith(`${id}-`) && /-\d{4}$/.test(pid)
    );
    if (yearVariants.length > 0) {
      ltSet.delete(id);
      for (const vid of yearVariants) ltSet.add(vid);
      lanceToddOrphansCleared++;
    }
  }

  // Seed year-card Lance Todd winners that exist in DB but were left unmatched.
  const honourReportPath = join(DATA, "honour-achievements-report.json");
  let lanceToddSeededFromReport = 0;
  if (existsSync(honourReportPath)) {
    const hr = loadJson<{ unmatchedLance?: string[] }>(
      "honour-achievements-report.json"
    );
    for (const name of hr.unmatchedLance ?? []) {
      const hits = all.filter(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      if (hits.length === 0) continue;
      for (const hit of hits) {
        if (!ltSet.has(hit.id)) {
          ltSet.add(hit.id);
          lanceToddSeededFromReport++;
        }
      }
    }
  }

  // Build base clusters
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p !== x) {
      const r = find(p);
      parent.set(x, r);
      return r;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const p of all) {
    parent.set(p.id, p.id);
  }
  for (const p of all) {
    if (p.basePlayerId && byId.has(p.basePlayerId)) {
      union(p.id, p.basePlayerId);
    }
  }
  for (const group of BASE_ALIASES) {
    const present = group.filter((id) => byId.has(id));
    for (let i = 1; i < present.length; i++) union(present[0], present[i]);
  }

  const clusters = new Map<string, string[]>();
  for (const p of all) {
    const root = find(p.id);
    const list = clusters.get(root) ?? [];
    list.push(p.id);
    clusters.set(root, list);
  }

  const yearMaps = { dream, mos, gb, lls, slc, cc };
  let propagatedYears = 0;
  for (const members of clusters.values()) {
    for (const [label, map] of Object.entries(yearMaps)) {
      const unionYears = [
        ...new Set(members.flatMap((id) => map[id] ?? [])),
      ].sort((a, b) => a - b);
      if (unionYears.length === 0) continue;

      for (const id of members) {
        const p = byId.get(id)!;
        const cardYear = p.year ?? p.cardYear;
        const pinned = /-\d{4}$/.test(id);
        if (pinned && typeof cardYear === "number") {
          if (unionYears.includes(cardYear)) {
            const before = (map[id] ?? []).join(",");
            mergeYears(map, id, [cardYear]);
            if ((map[id] ?? []).join(",") !== before) propagatedYears++;
          }
        } else {
          // Career / current / unpinned historic: keep full union
          const before = (map[id] ?? []).length;
          mergeYears(map, id, unionYears);
          if ((map[id] ?? []).length > before) propagatedYears++;
        }
      }
      void label;
    }

    // Lance Todd: any member ⇒ all members
    if (members.some((id) => ltSet.has(id))) {
      for (const id of members) ltSet.add(id);
    }
  }

  lanceTodd = [...ltSet].sort((a, b) => a.localeCompare(b));

  // Sync boolean flags from year maps (historic + legends primarily)
  let flagsSet = 0;
  let flagsCleared = 0;
  for (const p of [...historic, ...legends]) {
    const slYears = slc[p.id] ?? [];
    const ccYears = cc[p.id] ?? [];
    const wantSl = slYears.length > 0;
    const wantCc = ccYears.length > 0;
    if (Boolean(p.superLeagueWinner) !== wantSl) {
      if (wantSl) flagsSet++;
      else flagsCleared++;
      p.superLeagueWinner = wantSl || undefined;
      if (!wantSl) delete p.superLeagueWinner;
      else p.superLeagueWinner = true;
    }
    if (Boolean(p.challengeCupWinner) !== wantCc) {
      if (wantCc) flagsSet++;
      else flagsCleared++;
      if (!wantCc) delete p.challengeCupWinner;
      else p.challengeCupWinner = true;
    }
  }

  saveJson("dream-team-years.json", dream);
  saveJson("man-of-steel-winners.json", mos);
  saveJson("golden-boot-years.json", gb);
  saveJson("league-leaders-years.json", lls);
  saveJson("super-league-champion-years.json", slc);
  saveJson("challenge-cup-years.json", cc);
  saveJson("lance-todd-winners.json", lanceTodd);
  saveJson("historic-players.json", historic);
  saveJson("legends.json", legends);

  const report = {
    generatedAt: new Date().toISOString(),
    baseFixes,
    dreamRepairs,
    lanceToddOrphansCleared,
    lanceToddSeededFromReport,
    extraLanceToddSeeded: EXTRA_LANCE_TODD.filter((id) => byId.has(id)),
    lanceToddCount: lanceTodd.length,
    propagatedYearEntries: propagatedYears,
    flagsSet,
    flagsCleared,
  };
  saveJson("historic-achievements-fix-report.json", report);
  console.log(JSON.stringify(report, null, 2));
}

main();
