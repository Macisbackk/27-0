/**
 * Build Golden Boot honour data from Wikipedia only.
 *
 * Run: npx tsx scripts/apply-golden-boot-achievements.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  fetchGoldenBootWinnersByYear,
  matchGoldenBootPlayerId,
} from "./lib/sources/wikipedia-golden-boot";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");

/** Same-name players who are not the IRL Golden Boot winner. */
const BLOCKED_PLAYER_IDS = new Set([
  "leeds-cur-cameron-smith",
]);

type RawPlayer = { id: string; name: string };

function loadAllPlayers(): RawPlayer[] {
  const players: RawPlayer[] = [];
  for (const file of ["historic-players.json", "legends.json"]) {
    const list = JSON.parse(
      readFileSync(join(DATA, file), "utf8")
    ) as RawPlayer[];
    players.push(...list);
  }
  const squads = JSON.parse(
    readFileSync(join(DATA, "current-squads.json"), "utf8")
  ) as RawPlayer[] | Record<string, RawPlayer[]>;
  if (Array.isArray(squads)) {
    players.push(...squads);
  } else {
    for (const list of Object.values(squads)) {
      players.push(...list);
    }
  }
  return players;
}

async function main() {
  console.log("Fetching IRL Golden Boot winners from Wikipedia…");
  const winnersByYear = await fetchGoldenBootWinnersByYear();
  console.log(`  ${winnersByYear.size} seasons parsed`);

  const allPlayers = loadAllPlayers();
  const goldenBootYears: Record<string, number[]> = {};
  const unmatched: string[] = [];

  for (const [year, names] of [...winnersByYear.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    for (const name of names) {
      const id = matchGoldenBootPlayerId(name, allPlayers);
      if (!id || BLOCKED_PLAYER_IDS.has(id)) {
        unmatched.push(`${name} (${year})`);
        continue;
      }
      const years = goldenBootYears[id] ?? [];
      if (!years.includes(year)) years.push(year);
      goldenBootYears[id] = years.sort((a, b) => a - b);
    }
  }

  writeFileSync(
    join(DATA, "golden-boot-years.json"),
    `${JSON.stringify(goldenBootYears, null, 2)}\n`,
    "utf8"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    sources: [
      "https://en.wikipedia.org/wiki/IRL_Golden_Boot_Award",
    ],
    goldenBootPlayers: Object.keys(goldenBootYears).length,
    goldenBootAwards: Object.values(goldenBootYears).reduce(
      (s, y) => s + y.length,
      0
    ),
    matched: Object.entries(goldenBootYears).map(([id, years]) => ({
      id,
      years,
    })),
    unmatched: [...new Set(unmatched)].sort(),
  };

  writeFileSync(
    join(DATA, "golden-boot-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log(`\nGolden Boot players matched: ${report.goldenBootPlayers}`);
  console.log(`Unmatched winners: ${report.unmatched.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
