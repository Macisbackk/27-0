/**
 * Build Lance Todd Trophy and Dream Team honour data from Wikipedia only.
 *
 * Run: npx tsx scripts/apply-honour-achievements.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  fetchDreamTeamByYear,
  fetchLanceToddWinnerNames,
  matchPlayerIdByName,
} from "./lib/sources/wikipedia-honours";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");

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
  console.log("Fetching Lance Todd Trophy winners from Wikipedia…");
  const lanceNames = await fetchLanceToddWinnerNames();
  console.log(`  ${lanceNames.length} unique winners on Wikipedia`);

  console.log("Fetching Super League Dream Team from Wikipedia…");
  const dreamByYear = await fetchDreamTeamByYear();
  console.log(`  ${dreamByYear.size} seasons parsed`);

  const allPlayers = loadAllPlayers();
  const lanceToddWinners: string[] = [];
  const dreamTeamYears: Record<string, number[]> = {};
  const unmatchedLance: string[] = [];
  const unmatchedDream: string[] = [];

  for (const name of lanceNames) {
    const id = matchPlayerIdByName(name, allPlayers);
    if (id && !lanceToddWinners.includes(id)) {
      lanceToddWinners.push(id);
    } else if (!id) {
      unmatchedLance.push(name);
    }
  }

  for (const [year, names] of [...dreamByYear.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    for (const name of names) {
      const id = matchPlayerIdByName(name, allPlayers);
      if (!id) {
        unmatchedDream.push(`${name} (${year})`);
        continue;
      }
      const years = dreamTeamYears[id] ?? [];
      if (!years.includes(year)) years.push(year);
      dreamTeamYears[id] = years.sort((a, b) => a - b);
    }
  }

  lanceToddWinners.sort();

  writeFileSync(
    join(DATA, "lance-todd-winners.json"),
    `${JSON.stringify(lanceToddWinners, null, 2)}\n`,
    "utf8"
  );
  writeFileSync(
    join(DATA, "dream-team-years.json"),
    `${JSON.stringify(dreamTeamYears, null, 2)}\n`,
    "utf8"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    sources: ["Wikipedia"],
    lanceToddMatched: lanceToddWinners.length,
    dreamTeamPlayers: Object.keys(dreamTeamYears).length,
    dreamTeamSelections: Object.values(dreamTeamYears).reduce(
      (s, y) => s + y.length,
      0
    ),
    unmatchedLance,
    unmatchedDream: [...new Set(unmatchedDream)].sort(),
  };

  writeFileSync(
    join(DATA, "honour-achievements-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log(`\nLance Todd matched: ${lanceToddWinners.length}`);
  console.log(`Dream Team players: ${Object.keys(dreamTeamYears).length}`);
  console.log(`Unmatched Lance Todd: ${unmatchedLance.length}`);
  console.log(`Unmatched Dream Team: ${report.unmatchedDream.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
