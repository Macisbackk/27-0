import type { ManagerCareer } from "./types";
import { utf16ByteLength } from "./managerSaveChecksum";

export type SaveSizeCategory =
  | "championshipSquads"
  | "championshipCompetition"
  | "leagueClubRosters"
  | "leagueClubReserves"
  | "playerRegistry"
  | "fixtures"
  | "reserves"
  | "inboxMessages"
  | "latestNews"
  | "leagueTransfers"
  | "squadAndContracts"
  | "other";

export interface SaveSizeBreakdown {
  totalBytes: number;
  categories: Record<SaveSizeCategory, number>;
  largestCategory: SaveSizeCategory;
}

const CATEGORY_KEYS: Record<
  Exclude<SaveSizeCategory, "other" | "squadAndContracts">,
  (keyof ManagerCareer)[]
> = {
  championshipSquads: ["championshipSquads"],
  championshipCompetition: ["championshipCompetition"],
  leagueClubRosters: ["leagueClubRosters"],
  leagueClubReserves: ["leagueClubReserves"],
  playerRegistry: ["playerRegistry"],
  fixtures: ["fixtures", "roundMatches", "schedule", "lastMatchFixture"],
  reserves: ["reserves", "reserveContracts", "reserveResults", "youthProspects"],
  inboxMessages: ["inboxMessages"],
  latestNews: ["latestNews"],
  leagueTransfers: ["leagueTransfers"],
};

function jsonBytes(value: unknown): number {
  if (value === undefined) return 0;
  try {
    return utf16ByteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

/** Measure serialized career size by storage category (UTF-16 localStorage units). */
export function measureCareerSaveSize(
  career: ManagerCareer
): SaveSizeBreakdown {
  const categories: Record<SaveSizeCategory, number> = {
    championshipSquads: 0,
    championshipCompetition: 0,
    leagueClubRosters: 0,
    leagueClubReserves: 0,
    playerRegistry: 0,
    fixtures: 0,
    reserves: 0,
    inboxMessages: 0,
    latestNews: 0,
    leagueTransfers: 0,
    squadAndContracts: 0,
    other: 0,
  };

  const accounted = new Set<string>();

  for (const [category, keys] of Object.entries(CATEGORY_KEYS) as [
    Exclude<SaveSizeCategory, "other" | "squadAndContracts">,
    (keyof ManagerCareer)[],
  ][]) {
    let bytes = 0;
    for (const key of keys) {
      bytes += jsonBytes(career[key]);
      accounted.add(key);
    }
    categories[category] = bytes;
  }

  categories.squadAndContracts =
    jsonBytes(career.squad) +
    jsonBytes(career.contracts) +
    jsonBytes(career.matchdayXiii) +
    jsonBytes(career.matchdayInterchange);
  accounted.add("squad");
  accounted.add("contracts");
  accounted.add("matchdayXiii");
  accounted.add("matchdayInterchange");

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(career)) {
    if (accounted.has(key)) continue;
    rest[key] = value;
  }
  categories.other = jsonBytes(rest);

  const totalBytes = Object.values(categories).reduce((a, b) => a + b, 0);
  let largestCategory: SaveSizeCategory = "other";
  let largest = -1;
  for (const [key, bytes] of Object.entries(categories) as [
    SaveSizeCategory,
    number,
  ][]) {
    if (bytes > largest) {
      largest = bytes;
      largestCategory = key;
    }
  }

  return { totalBytes, categories, largestCategory };
}

export function formatSaveSizeBreakdown(breakdown: SaveSizeBreakdown): string {
  const lines = Object.entries(breakdown.categories)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([key, bytes]) =>
        `  ${key}: ${bytes.toLocaleString()} bytes (${(
          (bytes / Math.max(1, breakdown.totalBytes)) *
          100
        ).toFixed(1)}%)`
    );
  return [
    `Save size total: ${breakdown.totalBytes.toLocaleString()} bytes (UTF-16)`,
    `Largest category: ${breakdown.largestCategory}`,
    ...lines,
  ].join("\n");
}

let loggedHeavySave = false;

export function maybeLogSaveSizeDiagnostics(
  career: ManagerCareer,
  context: string
): SaveSizeBreakdown {
  const breakdown = measureCareerSaveSize(career);
  const softLimit = 1_500_000;
  if (!loggedHeavySave && breakdown.totalBytes >= softLimit) {
    loggedHeavySave = true;
    console.info(
      `[manager-save] ${context} — large save detected\n${formatSaveSizeBreakdown(breakdown)}`
    );
  }
  return breakdown;
}

export function resetSaveSizeDiagnosticLatch(): void {
  loggedHeavySave = false;
}
