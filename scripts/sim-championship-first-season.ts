/**
 * First-season Championship squad generation distribution audit.
 */
import { generateChampionshipSquads } from "../src/lib/manager/championship/championshipSquads";
import { CHAMPIONSHIP_CLUBS } from "../src/lib/clubs/championship-clubs";

const RUNS = Number(process.env.SIM_RUNS ?? 1000);

function main() {
  let at80Plus = 0;
  let at81Plus = 0;
  let at84Plus = 0;
  let totalPlayers = 0;
  const start17Avgs: number[] = [];
  const above80ByName: string[] = [];

  for (let i = 0; i < RUNS; i++) {
    const squads = generateChampionshipSquads(`seed-${i}`, 2026 + (i % 3));
    for (const club of CHAMPIONSHIP_CLUBS) {
      const players = Object.values(squads.players).filter(
        (p) => p.clubId === club.id
      );
      if (players.length === 0) continue;
      const sorted = [...players].sort((a, b) => b.peakRating - a.peakRating);
      const start17 = sorted.slice(0, 17);
      const avg =
        start17.reduce((s, p) => s + p.peakRating, 0) /
        Math.max(1, start17.length);
      start17Avgs.push(avg);

      for (const p of players) {
        totalPlayers++;
        if (p.peakRating >= 80) at80Plus++;
        if (p.peakRating >= 81) {
          at81Plus++;
          if (i === 0 && above80ByName.length < 40) {
            above80ByName.push(`${p.name} ${p.peakRating} (${club.name})`);
          }
        }
        if (p.peakRating >= 84) at84Plus++;
      }
    }
  }

  const mean =
    start17Avgs.reduce((a, b) => a + b, 0) / Math.max(1, start17Avgs.length);
  const maxAvg = Math.max(...start17Avgs);
  const above795 = start17Avgs.filter((a) => a >= 79.5).length;

  console.log(
    JSON.stringify(
      {
        runs: RUNS,
        totalPlayers,
        pct80Plus: ((at80Plus / totalPlayers) * 100).toFixed(2),
        pct81Plus: ((at81Plus / totalPlayers) * 100).toFixed(2),
        count84Plus: at84Plus,
        meanStart17Avg: mean.toFixed(2),
        maxStart17Avg: maxAvg.toFixed(2),
        start17AtOrAbove79_5: above795,
        sample81PlusFirstRun: above80ByName,
      },
      null,
      2
    )
  );

  if (at84Plus > 0 || maxAvg >= 79.5) process.exitCode = 1;
}

main();
