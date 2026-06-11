/**
 * Legend pool cleanup + player rating updates.
 * Run: npx tsx scripts/legend-cleanup-audit.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

type Raw = Record<string, unknown>;

/** Elite tier — reserved legend status only. */
const KEEP_LEGEND_IDS = new Set([
  "andrew-johns",
  "jason-robinson",
  "garry-schofield",
  "ellery-hanley",
  "kevin-sinfield",
  "wigan-hist-sam-tomkins",
  "andy-farrell",
  "paul-sculthorpe",
  "bradford-leg-robbie-hunter-paul",
  "sam-burgess",
  "martin-offiah",
  "rob-burrow",
  "jamie-peacock",
  "paul-newlove",
]);

const REMOVE_IDS = new Set([
  "wigan-leg-mike-mcilorum", // mistaken duplicate — replaced by wigan-hist-michael-mcilorum
  "richie-mathers", // duplicate of leeds-hist-richard-mathers
]);

const EXPLICIT_RATINGS: Record<string, number> = {
  "warrington-cur-marc-sneyd": 89,
  "wigan-hist-michael-mcilorum": 89,
  "jamie-jones-buchanan": 90,
  "luke-gale": 88,
  "wakefield-cur-mike-mcmeeken": 88,
  "leigh-cur-edwin-ipape": 88,
  "paul-deacon": 87,
  "rangi-chase": 89,
  "scott-durea": 90,
  "leeds-hist-richard-mathers": 89,
};

const HISTORIC_OVERRIDES: Record<string, Partial<Raw>> = {
  "wigan-hist-michael-mcilorum": {
    id: "wigan-hist-michael-mcilorum",
    name: "Michael McIlorum",
    position: "HOOKER",
    club: "Wigan Warriors",
    nationality: "England",
    era: "MODERN_ERA",
    yearsActive: "2006–2024",
    category: "historic",
    peakRating: 89,
    rating: 89,
    value: 1800000,
    appearances: 340,
    tries: 31,
    intlCaps: 24,
    clubLegend: true,
    challengeCupWinner: true,
    superLeagueWinner: true,
  },
  "jamie-jones-buchanan": {
    category: "historic",
    peakRating: 90,
    rating: 90,
    clubLegend: true,
    superLeagueWinner: true,
    challengeCupWinner: true,
  },
  "luke-gale": {
    category: "historic",
    peakRating: 88,
    rating: 88,
    clubLegend: true,
    manOfSteel: true,
  },
  "paul-deacon": {
    category: "historic",
    peakRating: 87,
    rating: 87,
    clubLegend: true,
    superLeagueWinner: true,
    challengeCupWinner: true,
  },
  "rangi-chase": {
    category: "historic",
    peakRating: 89,
    rating: 89,
    clubLegend: true,
    manOfSteel: true,
  },
  "scott-durea": {
    name: "Scott Dureau",
    category: "historic",
    peakRating: 90,
    rating: 90,
    clubLegend: true,
  },
  "leeds-hist-richard-mathers": {
    name: "Richie Mathers",
    peakRating: 89,
    rating: 89,
    clubLegend: true,
  },
};

function load<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
}

function save(path: string, data: unknown): void {
  writeFileSync(join(ROOT, path), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function toHistoric(legend: Raw): Raw {
  const historic = { ...legend };
  historic.category = "historic";
  if (historic.clubLegend !== false) {
    historic.clubLegend = true;
  }
  const id = legend.id as string;
  const explicit = EXPLICIT_RATINGS[id];
  if (explicit !== undefined) {
    historic.peakRating = explicit;
    historic.rating = explicit;
  } else if ((historic.peakRating as number) > 90) {
    historic.peakRating = 90;
    historic.rating = 90;
  }
  return historic;
}

function main() {
  const legends = load<Raw[]>("data/legends.json");
  const historic = load<Raw[]>("data/historic-players.json");
  const current = load<Raw[]>("data/current-squads.json");
  const overrides = load<Record<string, number>>("data/rating-overrides.json");
  const additions = load<{ historic?: Raw[]; current?: Raw[]; legend?: Raw[] }>(
    "data/player-additions.json"
  );

  const report = {
    legendsKept: [] as string[],
    legendsRemoved: [] as string[],
    convertedClubHero: [] as string[],
    convertedHistoric: [] as string[],
    duplicatesRemoved: [] as string[],
    ratingUpdates: [] as string[],
  };

  const historicIds = new Set(historic.map((p) => p.id as string));
  const kept: Raw[] = [];
  const toMove: Raw[] = [];

  for (const legend of legends) {
    const id = legend.id as string;
    const name = legend.name as string;

    if (REMOVE_IDS.has(id)) {
      report.duplicatesRemoved.push(`${name} (${id})`);
      if (id === "wigan-leg-mike-mcilorum") {
        const mcilorum = HISTORIC_OVERRIDES["wigan-hist-michael-mcilorum"];
        if (!historicIds.has("wigan-hist-michael-mcilorum")) {
          historic.push(mcilorum);
          historicIds.add("wigan-hist-michael-mcilorum");
          report.convertedHistoric.push(
            `Michael McIlorum (wigan-hist-michael-mcilorum) — historic 89`
          );
        }
      }
      if (id === "richie-mathers") {
        report.duplicatesRemoved.push(
          `Richie Mathers legend duplicate — using leeds-hist-richard-mathers`
        );
      }
      continue;
    }

    if (KEEP_LEGEND_IDS.has(id)) {
      kept.push(legend);
      report.legendsKept.push(`${name} (${id})`);
      continue;
    }

    report.legendsRemoved.push(`${name} (${id})`);
    const historicEntry = toHistoric(legend);
    const extra = HISTORIC_OVERRIDES[id];
    if (extra) Object.assign(historicEntry, extra);

    if (historicEntry.clubLegend) {
      report.convertedClubHero.push(`${historicEntry.name} (${id})`);
    }
    report.convertedHistoric.push(`${historicEntry.name} (${id})`);

    if (historicIds.has(id)) {
      const idx = historic.findIndex((p) => p.id === id);
      if (idx >= 0) historic[idx] = { ...historic[idx], ...historicEntry };
    } else {
      historic.push(historicEntry);
      historicIds.add(id);
    }
    toMove.push(historicEntry);
  }

  // Current squad rating updates
  for (const p of current) {
    const id = p.id as string;
    const rating = EXPLICIT_RATINGS[id];
    if (rating === undefined) continue;
    const old = p.peakRating as number;
    p.peakRating = rating;
    p.rating = rating;
    overrides[id] = rating;
    report.ratingUpdates.push(`${p.name}: ${old} → ${rating}`);
  }

  // Historic explicit updates (McIlorum merge, Richie Mathers)
  for (const p of historic) {
    const id = p.id as string;
    const extra = HISTORIC_OVERRIDES[id];
    if (extra) Object.assign(p, extra);
    const rating = EXPLICIT_RATINGS[id];
    if (rating !== undefined) {
      const old = (p.peakRating ?? p.rating) as number;
      p.peakRating = rating;
      p.rating = rating;
      overrides[id] = rating;
      if (!report.ratingUpdates.some((u) => u.startsWith(p.name as string))) {
        report.ratingUpdates.push(`${p.name}: ${old} → ${rating}`);
      }
    }
  }

  // Remove mistaken McIlorum from player-additions legend
  if (additions.legend) {
    additions.legend = additions.legend.filter(
      (p) => !REMOVE_IDS.has(p.id as string)
    );
  }

  // Sync additions historic entries for moved legends
  if (additions.historic) {
    for (const moved of toMove) {
      const idx = additions.historic.findIndex((p) => p.id === moved.id);
      if (idx >= 0) additions.historic[idx] = moved;
    }
  }

  save("data/legends.json", kept);
  save("data/historic-players.json", historic);
  save("data/current-squads.json", current);
  save("data/rating-overrides.json", overrides);
  save("data/player-additions.json", additions);
  save("data/legend-cleanup-report.json", {
    generatedAt: new Date().toISOString(),
    legendCountBefore: legends.length,
    legendCountAfter: kept.length,
    ...report,
  });

  console.log(`Legend cleanup complete`);
  console.log(`  Kept: ${kept.length}`);
  console.log(`  Removed: ${report.legendsRemoved.length}`);
  console.log(`  Report: data/legend-cleanup-report.json`);
}

main();
