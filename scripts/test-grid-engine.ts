/**
 * Rugby League Grid engine tests.
 * Run: bun scripts/test-grid-engine.ts  (or npx tsx scripts/test-grid-engine.ts)
 */
import {
  buildGridShareText,
  createEmptyGridStats,
  createGridRun,
  finishGridRun,
  generateGrid,
  getGridCatalogue,
  gridCellAnswers,
  gridCellHeaders,
  gridPairCount,
  gridRewardAmount,
  gridRewardRunId,
  gridScore,
  recordGridResult,
  remainingGridGuesses,
  submitGridGuess,
  GRID_CELL_COUNT,
  GRID_MAX_GUESSES,
  GRID_MIN_ANSWERS,
  GRID_SIZE,
} from "../src/lib/mini-games/grid/engine";
import { buildGridCatalogue } from "../src/lib/mini-games/grid/criteria";
import { getGridPlayerPool } from "../src/lib/mini-games/grid/pool";
import { isGridRun, previousDateKey } from "../src/lib/mini-games/grid/run-utils";
import type { GridPlayer, GridRun } from "../src/lib/mini-games/grid/types";
import { GRID_REWARD_PER_CELL, WORDLE_WIN_REWARD } from "../src/lib/mini-games/reward-amounts";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function dateKeyFrom(start: Date, offsetDays: number): string {
  const d = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + offsetDays)
  );
  return d.toISOString().slice(0, 10);
}

const catalogue = getGridCatalogue();
const pool = getGridPlayerPool();

console.log("Grid player pool");
{
  assert(pool.length > 500, `pool has plenty of players (${pool.length})`);
  const ids = new Set(pool.map((p) => p.id));
  assert(ids.size === pool.length, "every grid player has a unique id");
  const charnley = pool.filter((p) => p.displayName === "Josh Charnley");
  assert(charnley.length === 1, "year cards for the same player merge into one entry");
  const clubs = new Set(charnley[0]?.clubIds ?? []);
  assert(
    clubs.has("wigan") && clubs.has("warrington") && clubs.has("leigh"),
    "Josh Charnley counts for Wigan, Warrington and Leigh"
  );
  const peacock = pool.find((p) => p.displayName === "Jamie Peacock");
  assert(
    Boolean(peacock?.clubIds.includes("bradford") && peacock.clubIds.includes("leeds")),
    "Jamie Peacock counts for Bradford and Leeds"
  );
  const clubCriteria = catalogue.criteria.filter((c) => c.kind === "club");
  assert(clubCriteria.length >= 10, `at least ten clubs can head a row (${clubCriteria.length})`);
  assert(
    !catalogue.byId.has("nation:england"),
    "English is too common to be a header"
  );
}

console.log("\nGenerator: 400 consecutive daily grids");
{
  const start = new Date(Date.UTC(2026, 9, 22));
  const DAYS = 400;
  let thinCells = 0;
  let minAnswers = Number.POSITIVE_INFINITY;
  let duplicateHeaders = 0;
  let sameKindCrossings = 0;
  let nonDeterministic = 0;
  let wrongShape = 0;
  let countMismatches = 0;
  const distinctGrids = new Set<string>();

  for (let i = 0; i < DAYS; i++) {
    const dateKey = dateKeyFrom(start, i);
    const layout = generateGrid(dateKey, catalogue);
    const again = generateGrid(dateKey, catalogue);
    if (JSON.stringify(layout) !== JSON.stringify(again)) nonDeterministic += 1;
    if (layout.rows.length !== GRID_SIZE || layout.cols.length !== GRID_SIZE) wrongShape += 1;

    const headers = [...layout.rows, ...layout.cols];
    if (new Set(headers).size !== headers.length) duplicateHeaders += 1;
    distinctGrids.add(headers.join(","));

    for (let cell = 0; cell < GRID_CELL_COUNT; cell++) {
      const pair = gridCellHeaders(layout, cell, catalogue);
      if (!pair) {
        thinCells += 1;
        continue;
      }
      if (pair[0].kind !== "club" && pair[0].kind === pair[1].kind) sameKindCrossings += 1;
      const answers = gridCellAnswers(layout, cell, catalogue);
      if (answers.length !== gridPairCount(catalogue, pair[0].id, pair[1].id)) {
        countMismatches += 1;
      }
      minAnswers = Math.min(minAnswers, answers.length);
      if (answers.length < GRID_MIN_ANSWERS) {
        thinCells += 1;
        console.error(`    ${dateKey} cell ${cell} (${pair[0].id} × ${pair[1].id}) has ${answers.length}`);
      }
    }
  }

  assert(wrongShape === 0, "every grid is 3 × 3");
  assert(nonDeterministic === 0, "the same date always gives the same grid");
  assert(thinCells === 0, `every cell has at least ${GRID_MIN_ANSWERS} answers (lowest: ${minAnswers})`);
  assert(duplicateHeaders === 0, "no grid repeats a header");
  assert(sameKindCrossings === 0, "no cell crosses two headers of the same non-club kind");
  assert(countMismatches === 0, "bitset pair counts match the answer lists");
  assert(distinctGrids.size >= DAYS * 0.95, `grids vary day to day (${distinctGrids.size}/${DAYS} distinct)`);
  assert(
    generateGrid("2026-10-22", catalogue).rows.join() !== generateGrid("2026-10-23", catalogue).rows.join() ||
      generateGrid("2026-10-22", catalogue).cols.join() !== generateGrid("2026-10-23", catalogue).cols.join(),
    "consecutive days give different grids"
  );

  // A rebuilt catalogue (fresh caches) produces the same grid: no hidden state.
  const rebuilt = buildGridCatalogue(getGridPlayerPool());
  assert(
    JSON.stringify(generateGrid("2027-01-01", rebuilt)) ===
      JSON.stringify(generateGrid("2027-01-01", catalogue)),
    "generation does not depend on cache state"
  );
}

console.log("\nAnswer checker");
{
  const run = createGridRun({ mode: "daily", dateKey: "2026-10-22" }, catalogue);
  assert(run.id === "daily:2026-10-22" && run.seed === "2026-10-22", "daily run is seeded from the date");
  assert(run.cells.length === GRID_CELL_COUNT && run.cells.every((c) => c === null), "new run is empty");
  assert(remainingGridGuesses(run) === GRID_MAX_GUESSES, "nine guesses to start");
  assert(isGridRun(JSON.parse(JSON.stringify(run))), "a run survives a JSON round trip");

  const answers0 = gridCellAnswers(run, 0, catalogue);
  const correct = answers0[0] as GridPlayer;
  const headers0 = gridCellHeaders(run, 0, catalogue);
  assert(Boolean(headers0 && headers0[0].test(correct) && headers0[1].test(correct)), "listed answers match both headers");

  // A player who fails cell 0.
  const wrong = pool.find((p) => headers0 && !(headers0[0].test(p) && headers0[1].test(p)));
  assert(Boolean(wrong), "found a player who does not fit cell 0");

  const unknown = submitGridGuess(run, 0, "Not A Real Player Name", catalogue);
  assert(Boolean(unknown.error) && unknown.run.guessesUsed === 0, "an unknown name is refused without using a guess");

  const miss = submitGridGuess(run, 0, wrong?.displayName ?? "", catalogue);
  assert(miss.correct === false && !miss.error, "a player who doesn't fit is rejected");
  assert(miss.run.guessesUsed === 1 && miss.run.cells[0] === null, "a wrong guess uses a guess and leaves the cell empty");

  const hit = submitGridGuess(miss.run, 0, correct.displayName, catalogue);
  assert(hit.correct === true, "a player who fits both headers is accepted");
  assert(hit.run.cells[0]?.playerId === correct.id, "the cell shows the player used");
  assert(hit.run.guessesUsed === 2, "a correct guess also uses a guess");

  const byLowerCase = submitGridGuess(run, 0, correct.displayName.toLowerCase(), catalogue);
  assert(byLowerCase.correct === true, "typed names are matched case-insensitively");

  const filled = submitGridGuess(hit.run, 0, correct.displayName, catalogue);
  assert(Boolean(filled.error) && filled.run.guessesUsed === 2, "a filled square can't be guessed again");

  // Re-using the same player in another cell he also fits is refused for free.
  const reuseCell = Array.from({ length: GRID_CELL_COUNT }, (_, i) => i).find(
    (i) => i !== 0 && gridCellAnswers(run, i, catalogue).some((p) => p.id === correct.id)
  );
  const reuseTarget = reuseCell ?? 1;
  const reused = submitGridGuess(hit.run, reuseTarget, correct.displayName, catalogue);
  assert(
    Boolean(reused.error) && reused.run.guessesUsed === hit.run.guessesUsed,
    "a player can only be used once per grid (no guess used)"
  );

  // Fill every cell with distinct valid answers → 9/9 and finished.
  let perfect: GridRun = createGridRun({ mode: "daily", dateKey: "2026-11-05" }, catalogue);
  const usedIds = new Set<string>();
  let allFilled = true;
  for (let cell = 0; cell < GRID_CELL_COUNT; cell++) {
    const pick = gridCellAnswers(perfect, cell, catalogue).find((p) => !usedIds.has(p.id));
    if (!pick) {
      allFilled = false;
      break;
    }
    usedIds.add(pick.id);
    perfect = submitGridGuess(perfect, cell, pick.displayName, catalogue).run;
  }
  assert(allFilled, "each cell has a distinct answer available");
  assert(perfect.status === "finished" && gridScore(perfect) === GRID_CELL_COUNT, "filling all nine squares finishes the grid 9/9");
  assert(gridRewardAmount(perfect) === GRID_CELL_COUNT * GRID_REWARD_PER_CELL, "a full grid pays nine times the per-square reward");
  assert(
    gridRewardAmount(perfect) >= WORDLE_WIN_REWARD && gridRewardAmount(perfect) <= WORDLE_WIN_REWARD * 1.5,
    "a full grid pays 1–1.5× a Wordle win"
  );
  assert(gridRewardRunId("2026-11-05") === "grid_win:2026-11-05", "reward run id is once per UK day");

  // Nine wrong guesses end the game.
  let losing: GridRun = createGridRun({ mode: "practice", seed: "lose", dateKey: "2026-10-22" }, catalogue);
  const losingHeaders = gridCellHeaders(losing, 4, catalogue);
  const misfits = pool.filter((p) => losingHeaders && !(losingHeaders[0].test(p) && losingHeaders[1].test(p)));
  for (let i = 0; i < GRID_MAX_GUESSES; i++) {
    losing = submitGridGuess(losing, 4, misfits[i]?.displayName ?? "", catalogue).run;
  }
  assert(losing.status === "finished" && gridScore(losing) === 0, "nine wrong guesses end the grid");
  const after = submitGridGuess(losing, 0, correct.displayName, catalogue);
  assert(Boolean(after.error), "no guesses once the grid is finished");
  assert(losing.id.startsWith("practice:") && losing.mode === "practice", "practice runs are marked as practice");

  const gaveUp = finishGridRun(createGridRun({ mode: "practice", seed: "give-up", dateKey: "2026-10-22" }, catalogue));
  assert(gaveUp.status === "finished", "finishing early ends the grid");

  const share = buildGridShareText(hit.run.status === "finished" ? hit.run : finishGridRun(hit.run));
  const shareLines = share.split("\n");
  assert(shareLines[0] === "27-0 Grid 22 Oct — 1/9", `share title reads "27-0 Grid 22 Oct — 1/9" (${shareLines[0]})`);
  assert(shareLines[1] === "✅⬜⬜" && shareLines[2] === "⬜⬜⬜", "share text has a 3 × 3 of squares");
}

console.log("\nStats");
{
  let stats = createEmptyGridStats();
  const day1: GridRun = { ...createGridRun({ mode: "daily", dateKey: "2026-10-22" }, catalogue), status: "finished" };
  stats = recordGridResult(stats, day1);
  assert(stats.played === 1 && stats.currentStreak === 1, "first daily grid starts a streak");
  assert(recordGridResult(stats, day1).played === 1, "the same day is not counted twice");
  const day2: GridRun = {
    ...createGridRun({ mode: "daily", dateKey: "2026-10-23" }, catalogue),
    status: "finished",
    cells: Array.from({ length: GRID_CELL_COUNT }, (_, i) => ({ playerId: `p${i}`, name: `P${i}` })),
  };
  stats = recordGridResult(stats, day2);
  assert(stats.currentStreak === 2 && stats.bestStreak === 2, "playing the next day continues the streak");
  assert(stats.perfect === 1 && stats.bestScore === 9, "a 9/9 grid counts as perfect");
  const day4: GridRun = { ...createGridRun({ mode: "daily", dateKey: "2026-10-25" }, catalogue), status: "finished" };
  stats = recordGridResult(stats, day4);
  assert(stats.currentStreak === 1 && stats.bestStreak === 2, "missing a day resets the streak");
  const practice: GridRun = { ...createGridRun({ mode: "practice", seed: "p", dateKey: "2026-10-26" }, catalogue), status: "finished" };
  assert(recordGridResult(stats, practice) === stats, "practice grids don't touch stats");
  assert(previousDateKey("2026-03-01") === "2026-02-28", "previous day handles month ends");
  assert(previousDateKey("2027-01-01") === "2026-12-31", "previous day handles year ends");
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
