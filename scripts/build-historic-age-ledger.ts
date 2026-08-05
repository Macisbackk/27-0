/**
 * Rebuild the historic age research ledger from canonical player data and the
 * existing RLP/Wikipedia-derived birth-year cache.
 *
 * Run: npx tsx scripts/build-historic-age-ledger.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type RawPlayer = {
  id: string;
  name: string;
  category: "historic" | "legend";
  year?: number;
  cardYear?: number;
  primeYear?: number;
  dateOfBirth?: string;
  birthYear?: number;
};

const root = join(__dirname, "..");
const dataPath = (name: string) => join(root, "data", name);
const historic = JSON.parse(
  readFileSync(dataPath("historic-players.json"), "utf8")
) as RawPlayer[];
const legends = JSON.parse(
  readFileSync(dataPath("legends.json"), "utf8")
) as RawPlayer[];
const birthYears = JSON.parse(
  readFileSync(dataPath("birth-years.json"), "utf8")
) as Record<string, number>;

function baseId(id: string): string {
  return id.replace(/-\d{4}$/, "");
}

function seasonYear(player: RawPlayer): number | undefined {
  const idYear = player.id.match(/-(\d{4})$/)?.[1];
  return (
    player.year ??
    player.cardYear ??
    (idYear ? Number.parseInt(idYear, 10) : undefined) ??
    player.primeYear
  );
}

const records = [...historic, ...legends]
  .filter(
    (player, index, players) =>
      players.findIndex((candidate) => candidate.id === player.id) === index
  )
  .map((player) => {
    const cachedBirthYear =
      player.birthYear ?? birthYears[player.id] ?? birthYears[baseId(player.id)];
    const year = seasonYear(player);
    if (cachedBirthYear === undefined) {
      return {
        playerId: player.id,
        name: player.name,
        category: player.category,
        status: "unresolved" as const,
        seasonYear: year ?? null,
        note: "No reliable DOB or birth year in existing research caches.",
      };
    }

    const conventionalAge =
      year === undefined ? undefined : year - cachedBirthYear;
    return {
      playerId: player.id,
      name: player.name,
      category: player.category,
      status: "filled" as const,
      seasonYear: year ?? null,
      dateOfBirth: player.dateOfBirth ?? null,
      birthYear: cachedBirthYear,
      ageSource: player.dateOfBirth
        ? ("verified" as const)
        : ("derived-from-birth-year" as const),
      seasonAge: conventionalAge ?? null,
      seasonAgeRange:
        conventionalAge === undefined
          ? null
          : player.dateOfBirth
            ? [conventionalAge, conventionalAge]
            : [Math.max(0, conventionalAge - 1), conventionalAge],
      source: player.dateOfBirth
        ? "canonical player dateOfBirth"
        : "data/birth-years.json (existing RLP/Wikipedia enrichment cache)",
    };
  })
  .sort(
    (a, b) =>
      a.status.localeCompare(b.status) ||
      a.name.localeCompare(b.name) ||
      a.playerId.localeCompare(b.playerId)
  );

const filled = records.filter((record) => record.status === "filled").length;
const unresolved = records.length - filled;
const ledger = {
  historicAgeDataVersion: 2,
  generatedAt: new Date().toISOString(),
  methodology: {
    sourceOrder:
      "Canonical DOB, canonical birth year, then existing RLP/Wikipedia enrichment cache.",
    seasonAgeConvention:
      "The displayed season age is season year minus birth year. Without a full DOB, seasonAgeRange documents the possible one-year birthday variance.",
    precision:
      "No exact date is inferred. Unresolved records remain unknown.",
  },
  summary: {
    totalRecords: records.length,
    filled,
    unresolved,
  },
  records,
};

writeFileSync(
  dataPath("historic-age-ledger.json"),
  `${JSON.stringify(ledger, null, 2)}\n`
);
console.log(`Historic age ledger: ${filled} filled, ${unresolved} unresolved.`);
