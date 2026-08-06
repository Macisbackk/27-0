/**
 * Validate regulation match events never exceed 80 without golden point,
 * and full_time appears exactly once.
 */
import { generateSimulatedMatchEvents } from "../src/lib/manager/matchEventGenerator";
import { REGULATION_MATCH_MINUTES } from "../src/lib/manager/matchEventGenerator";

const RUNS = Number(process.env.SIM_RUNS ?? 10_000);

function main() {
  let post80 = 0;
  let dupFt = 0;
  let invalidGp = 0;
  let ok = 0;

  for (let i = 0; i < RUNS; i++) {
    const events = generateSimulatedMatchEvents({
      seed: `ev-sim-${i}`,
      fixtureKey: `fx-${i}`,
      userClub: "Wigan Warriors",
      opponent: "St Helens",
      userScore: 12 + (i % 30),
      oppScore: 10 + (i % 28),
      userTries: 2 + (i % 4),
      oppTries: 1 + (i % 4),
      competition: i % 5 === 0 ? "challenge_cup" : "league",
      allowsDraw: i % 5 !== 0,
    });

    const fts = events.filter((e) => e.type === "full_time");
    if (fts.length !== 1) dupFt++;

    for (const e of events) {
      if (e.type === "full_time") continue;
      if (e.type === "golden_point" || e.period === "golden-point") {
        // Simulated generator should not invent GP for draw-allowed.
        if (i % 5 !== 0) invalidGp++;
        continue;
      }
      if (e.minute > REGULATION_MATCH_MINUTES) post80++;
      if (e.minute === REGULATION_MATCH_MINUTES && e.type !== "full_time") {
        post80++;
      }
    }
    ok++;
  }

  console.log(
    JSON.stringify(
      { runs: RUNS, ok, post80RegulationEvents: post80, duplicateFullTime: dupFt, invalidGoldenPoint: invalidGp },
      null,
      2
    )
  );
  if (post80 > 0 || dupFt > 0 || invalidGp > 0) process.exitCode = 1;
}

main();
