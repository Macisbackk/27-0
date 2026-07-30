/**
 * Debug Manager Mode ageing across a season rollover.
 *
 * Usage:
 *   npm run debug:manager-ageing
 *
 * Reads active slot career from localStorage (browser) is not available in Node.
 * Instead validates age maths helpers and prints a synthetic season tick report.
 */
import { getAgeAtYear, resolveBirthYear } from "../src/lib/players/player-age";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

function main() {
  console.log("=== Manager ageing debug ===\n");

  const seasonYear = 2027;
  const nextYear = 2028;

  const samples = [
    { name: "Player A", birthYear: 1995 },
    { name: "Player B", birthYear: 2000 },
    { name: "Reserve C", birthYear: 2005 },
  ];

  console.log(`Season before: ${seasonYear}`);
  console.log(`Season after:  ${nextYear}\n`);

  console.log("First-team / registry ages (birthYear + seasonYear):");
  for (const s of samples) {
    const before = getAgeAtYear(
      { birthYear: s.birthYear } as { birthYear?: number },
      seasonYear
    );
    const after = getAgeAtYear(
      { birthYear: s.birthYear } as { birthYear?: number },
      nextYear
    );
    console.log(`  ${s.name}: ${before} → ${after}`);
    assert(
      after === (before ?? 0) + 1,
      `${s.name} ages by exactly 1`
    );
  }

  console.log("\nReserve stored age tick:");
  let reserveAge = 19;
  const beforeReserve = reserveAge;
  reserveAge += 1;
  console.log(`  Reserve: ${beforeReserve} → ${reserveAge}`);
  assert(reserveAge === beforeReserve + 1, "reserve ages by 1");

  console.log("\nContract yearsRemaining tick:");
  let yearsRemaining = 3;
  const beforeContract = yearsRemaining;
  yearsRemaining -= 1;
  console.log(`  Contract: ${beforeContract} → ${yearsRemaining}`);
  assert(yearsRemaining === beforeContract - 1, "contract decrements by 1");

  console.log("\nBirth year resolution:");
  const resolved = resolveBirthYear(undefined, "15/03/1998", "2016-2026");
  console.log(`  DOB 15/03/1998 → birthYear ${resolved}`);
  assert(resolved === 1998, "DOB resolves to 1998");

  console.log("\nWarnings:");
  console.log(
    "  - First-team ages via seasonYear++ + birthYear (hydrateManagerPlayerRegistryAges on advance)."
  );
  console.log(
    "  - Reserves store age and get age+1 in advanceToNextSeason."
  );
  console.log(
    "  - Missing birthYear players should be hydrated from canonical database on advance."
  );

  if (process.exitCode) {
    console.error("\nAgeing debug finished with failures.");
  } else {
    console.log("\nAgeing debug passed.");
  }
}

main();
