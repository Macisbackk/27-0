import {
  createChallengeCupBracket,
  finalizeBracketDisplay,
} from "../src/lib/game/challenge-cup-bracket";

let errors = 0;

for (let i = 0; i < 100; i++) {
  const seed = `bracket-test-${i}`;
  const state = createChallengeCupBracket(seed, "Salford Red Devils");
  const result = finalizeBracketDisplay(state);

  for (const match of result.matches) {
    if (match.status === "complete") {
      if (
        !match.winner ||
        (match.winner !== match.homeTeam && match.winner !== match.awayTeam)
      ) {
        console.error(`[${seed}] invalid winner on ${match.id}`);
        errors++;
      }
      if (match.loser === match.winner) {
        console.error(`[${seed}] loser equals winner on ${match.id}`);
        errors++;
      }
    }

    if (!match.feederIds?.length) continue;

    for (const feederId of match.feederIds) {
      const feeder = result.matches.find((m) => m.id === feederId);
      if (feeder?.status !== "complete" || !feeder.loser) continue;
      if (
        match.homeTeam === feeder.loser ||
        match.awayTeam === feeder.loser
      ) {
        console.error(
          `[${seed}] loser ${feeder.loser} from ${feederId} in ${match.id}`
        );
        errors++;
      }
    }
  }

  const final = result.matches.find((m) => m.id === "4-0");
  if (
    final?.status === "complete" &&
    final.winner !== final.homeTeam &&
    final.winner !== final.awayTeam
  ) {
    console.error(`[${seed}] invalid final winner`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`${errors} bracket validation error(s)`);
  process.exit(1);
}

console.log("All 100 AI bracket simulations passed");
