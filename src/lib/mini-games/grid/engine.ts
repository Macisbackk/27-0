import { createRng, createRunId, pickIndex, shuffleInPlace } from "@/lib/quiz/rng";
import { resolvePlayerGuess } from "../players";
import { GRID_REWARD_PER_CELL } from "../reward-amounts";
import {
  bitsetAndCount,
  buildGridCatalogue,
  type GridCatalogue,
  type GridCriterionDef,
} from "./criteria";
import { getGridPlayerPool } from "./pool";
import { gridScore } from "./run-utils";
import {
  GRID_CELL_COUNT,
  GRID_MAX_GUESSES,
  GRID_MIN_ANSWERS,
  GRID_SIZE,
  type GridMode,
  type GridPlayer,
  type GridRun,
} from "./types";

export { gridScore, recordGridResult, createEmptyGridStats } from "./run-utils";
export { GRID_CELL_COUNT, GRID_MAX_GUESSES, GRID_MIN_ANSWERS, GRID_SIZE };

/* ------------------------------------------------------------ catalogue */

let catalogueCache: GridCatalogue | null = null;

export function getGridCatalogue(): GridCatalogue {
  if (!catalogueCache) catalogueCache = buildGridCatalogue(getGridPlayerPool());
  return catalogueCache;
}

/* ------------------------------------------------------------ generator */

/** First pass asks for a little more room than the hard minimum. */
const PREFERRED_MIN_ANSWERS = 5;
/** Cells with more answers than this are too easy ("Current" × "Prop"). */
const MAX_CELL_ANSWERS = 50;
/** A good grid has at least this many tight cells… */
const TOUGH_CELL_ANSWERS = 12;
const MIN_TOUGH_CELLS = 3;
const GENERATOR_ATTEMPTS = 600;

/** How many of the six headers are not clubs (weights). Clubs stay the backbone. */
const ATTRIBUTE_COUNT_WEIGHTS: [number, number][] = [
  [1, 3],
  [2, 5],
  [3, 2],
];

export type GridLayout = { rows: string[]; cols: string[] };

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const pairCountCache = new WeakMap<GridCatalogue, Map<string, number>>();

/** Number of players matching both criteria. */
export function gridPairCount(
  catalogue: GridCatalogue,
  a: string,
  b: string
): number {
  let cache = pairCountCache.get(catalogue);
  if (!cache) {
    cache = new Map();
    pairCountCache.set(catalogue, cache);
  }
  const key = pairKey(a, b);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const bitsA = catalogue.bits.get(a);
  const bitsB = catalogue.bits.get(b);
  const count = bitsA && bitsB ? bitsetAndCount(bitsA, bitsB) : 0;
  cache.set(key, count);
  return count;
}

/** Two headers may cross when they are different kinds, or both clubs. */
function canCross(a: GridCriterionDef, b: GridCriterionDef): boolean {
  if (a.id === b.id) return false;
  if (a.kind === "club" && b.kind === "club") return true;
  return a.kind !== b.kind;
}

function weightedPick(rng: () => number, weights: [number, number][]): number {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of weights) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return weights[weights.length - 1]?.[0] ?? 0;
}

function pickFrom<T>(rng: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[pickIndex(rng, items.length)];
}

const hubWeightCache = new WeakMap<GridCatalogue, Map<string, number>>();

/**
 * Clubs that share players with almost everyone (Bradford, Hull FC…) would
 * turn up every day; weight each header by 1 / how many headers it can cross.
 */
function hubWeight(catalogue: GridCatalogue, def: GridCriterionDef): number {
  let cache = hubWeightCache.get(catalogue);
  if (!cache) {
    cache = new Map();
    hubWeightCache.set(catalogue, cache);
  }
  const hit = cache.get(def.id);
  if (hit !== undefined) return hit;
  let links = 0;
  for (const other of catalogue.criteria) {
    if (!canCross(def, other)) continue;
    if (gridPairCount(catalogue, def.id, other.id) >= PREFERRED_MIN_ANSWERS) links += 1;
  }
  const weight = 1 / Math.max(1, links);
  cache.set(def.id, weight);
  return weight;
}

function pickWeighted(
  rng: () => number,
  catalogue: GridCatalogue,
  items: readonly GridCriterionDef[]
): GridCriterionDef | undefined {
  if (items.length === 0) return undefined;
  const weights = items.map((def) => hubWeight(catalogue, def));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

type Rules = { min: number; max: number; toughCells: number };

function layoutCounts(catalogue: GridCatalogue, layout: GridLayout): number[] {
  const counts: number[] = [];
  for (const row of layout.rows) {
    for (const col of layout.cols) counts.push(gridPairCount(catalogue, row, col));
  }
  return counts;
}

function tryLayout(
  catalogue: GridCatalogue,
  rng: () => number,
  rules: Rules,
  featured?: GridCriterionDef
): GridLayout | null {
  const clubs = catalogue.criteria.filter((def) => def.kind === "club");
  const attributes = catalogue.criteria.filter((def) => def.kind !== "club");

  const attributeCount = weightedPick(rng, ATTRIBUTE_COUNT_WEIGHTS);
  // Split attributes across the axes, keeping at least one club on each.
  let rowAttributes = 0;
  for (let i = 0; i < attributeCount; i++) if (rng() < 0.5) rowAttributes += 1;
  rowAttributes = Math.min(rowAttributes, GRID_SIZE - 1);
  const colAttributes = Math.min(attributeCount - rowAttributes, GRID_SIZE - 1);

  const used = new Set<string>();
  const usedKinds = new Set<string>();
  const rows: GridCriterionDef[] = [];

  const takeRow = (def: GridCriterionDef | undefined) => {
    if (!def) return false;
    rows.push(def);
    used.add(def.id);
    if (def.kind !== "club") usedKinds.add(def.kind);
    return true;
  };

  if (featured) takeRow(featured);
  for (let i = 0; i < rowAttributes; i++) {
    const options = attributes.filter(
      (def) => !used.has(def.id) && !usedKinds.has(def.kind)
    );
    if (!takeRow(pickFrom(rng, options))) return null;
  }
  while (rows.length < GRID_SIZE) {
    const options = clubs.filter((def) => !used.has(def.id));
    if (!takeRow(pickWeighted(rng, catalogue, options))) return null;
  }

  const fitsRows = (def: GridCriterionDef) =>
    rows.every((row) => {
      if (!canCross(row, def)) return false;
      const count = gridPairCount(catalogue, row.id, def.id);
      return count >= rules.min && count <= rules.max;
    });

  const cols: GridCriterionDef[] = [];
  const takeCol = (def: GridCriterionDef | undefined) => {
    if (!def) return false;
    cols.push(def);
    used.add(def.id);
    if (def.kind !== "club") usedKinds.add(def.kind);
    return true;
  };

  for (let i = 0; i < colAttributes; i++) {
    const options = attributes.filter(
      (def) => !used.has(def.id) && !usedKinds.has(def.kind) && fitsRows(def)
    );
    if (!takeCol(pickFrom(rng, options))) return null;
  }
  while (cols.length < GRID_SIZE) {
    const options = clubs.filter((def) => !used.has(def.id) && fitsRows(def));
    if (!takeCol(pickWeighted(rng, catalogue, options))) return null;
  }

  shuffleInPlace(rows, rng);
  shuffleInPlace(cols, rng);
  const layout: GridLayout =
    rng() < 0.5
      ? { rows: rows.map((d) => d.id), cols: cols.map((d) => d.id) }
      : { rows: cols.map((d) => d.id), cols: rows.map((d) => d.id) };

  const counts = layoutCounts(catalogue, layout);
  const tough = counts.filter((count) => count <= TOUGH_CELL_ANSWERS).length;
  if (tough < rules.toughCells) return null;
  return layout;
}

/**
 * Deterministic grid for a seed (the UK date key for the daily grid).
 * Every cell is guaranteed at least GRID_MIN_ANSWERS answers; later passes
 * relax the difficulty rules, never the minimum.
 */
export function generateGrid(
  seed: string,
  catalogue: GridCatalogue = getGridCatalogue()
): GridLayout {
  const rng = createRng(`grid:${seed}`);
  // Each grid is built around one "featured" club so the well-connected
  // clubs don't appear every day.
  const featured = pickFrom(
    rng,
    catalogue.criteria.filter((def) => def.kind === "club")
  );
  const passes: { rules: Rules; featured?: GridCriterionDef }[] = [
    { rules: { min: PREFERRED_MIN_ANSWERS, max: MAX_CELL_ANSWERS, toughCells: MIN_TOUGH_CELLS }, featured },
    { rules: { min: PREFERRED_MIN_ANSWERS, max: MAX_CELL_ANSWERS, toughCells: MIN_TOUGH_CELLS } },
    { rules: { min: GRID_MIN_ANSWERS, max: MAX_CELL_ANSWERS, toughCells: MIN_TOUGH_CELLS } },
    { rules: { min: GRID_MIN_ANSWERS, max: MAX_CELL_ANSWERS, toughCells: 0 } },
    { rules: { min: GRID_MIN_ANSWERS, max: Number.POSITIVE_INFINITY, toughCells: 0 } },
  ];
  for (const pass of passes) {
    for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt++) {
      const layout = tryLayout(catalogue, rng, pass.rules, pass.featured);
      if (layout) return layout;
    }
  }
  throw new Error(`Could not build a grid for seed ${seed}`);
}

/* ------------------------------------------------------------ runs */

export function createGridRun(
  options: { mode: GridMode; seed?: string; dateKey: string },
  catalogue: GridCatalogue = getGridCatalogue()
): GridRun {
  const seed =
    options.seed ?? (options.mode === "daily" ? options.dateKey : createRunId());
  const layout = generateGrid(seed, catalogue);
  return {
    id: options.mode === "daily" ? `daily:${options.dateKey}` : `practice:${seed}`,
    mode: options.mode,
    seed,
    dateKey: options.dateKey,
    rows: layout.rows,
    cols: layout.cols,
    cells: Array.from({ length: GRID_CELL_COUNT }, () => null),
    guessesUsed: 0,
    status: "playing",
    rewardClaimed: false,
  };
}

/** False when a saved run references headers the current database no longer offers. */
export function isGridRunValid(
  run: GridRun,
  catalogue: GridCatalogue = getGridCatalogue()
): boolean {
  return [...run.rows, ...run.cols].every((id) => catalogue.byId.has(id));
}

export function gridCellHeaders(
  run: Pick<GridRun, "rows" | "cols">,
  cellIndex: number,
  catalogue: GridCatalogue = getGridCatalogue()
): [GridCriterionDef, GridCriterionDef] | null {
  const row = catalogue.byId.get(run.rows[Math.floor(cellIndex / GRID_SIZE)] ?? "");
  const col = catalogue.byId.get(run.cols[cellIndex % GRID_SIZE] ?? "");
  return row && col ? [row, col] : null;
}

export function playerMatchesCell(
  player: GridPlayer,
  headers: readonly [GridCriterionDef, GridCriterionDef]
): boolean {
  return headers[0].test(player) && headers[1].test(player);
}

/** Every valid answer for a cell, best-known players first. */
export function gridCellAnswers(
  run: Pick<GridRun, "rows" | "cols">,
  cellIndex: number,
  catalogue: GridCatalogue = getGridCatalogue()
): GridPlayer[] {
  const headers = gridCellHeaders(run, cellIndex, catalogue);
  if (!headers) return [];
  return catalogue.players
    .filter((player) => playerMatchesCell(player, headers))
    .sort((a, b) => b.fame - a.fame || a.displayName.localeCompare(b.displayName));
}

export function remainingGridGuesses(run: GridRun): number {
  return Math.max(0, GRID_MAX_GUESSES - run.guessesUsed);
}

export type GridGuessResult = {
  run: GridRun;
  /** Set when the guess was refused without using a guess. */
  error?: string;
  correct?: boolean;
  player?: GridPlayer;
};

function settleStatus(run: GridRun): GridRun {
  const full = run.cells.every((cell) => cell !== null);
  if (full || run.guessesUsed >= GRID_MAX_GUESSES) {
    return { ...run, status: "finished" };
  }
  return run;
}

export function submitGridGuess(
  run: GridRun,
  cellIndex: number,
  query: string,
  catalogue: GridCatalogue = getGridCatalogue()
): GridGuessResult {
  if (run.status !== "playing") {
    return { run, error: "This grid is finished." };
  }
  if (cellIndex < 0 || cellIndex >= GRID_CELL_COUNT) {
    return { run, error: "Pick a square first." };
  }
  if (run.cells[cellIndex]) {
    return { run, error: "That square is already filled." };
  }
  const headers = gridCellHeaders(run, cellIndex, catalogue);
  if (!headers) {
    return { run, error: "Could not load this grid." };
  }
  const player = resolvePlayerGuess(query, catalogue.players);
  if (!player) {
    return { run, error: "No matching Super League player." };
  }
  if (run.cells.some((cell) => cell?.playerId === player.id)) {
    return { run, error: "You've already used that player." };
  }

  const correct = playerMatchesCell(player, headers);
  const cells = [...run.cells];
  if (correct) cells[cellIndex] = { playerId: player.id, name: player.displayName };
  const next = settleStatus({
    ...run,
    cells,
    guessesUsed: run.guessesUsed + 1,
  });
  return { run: next, correct, player };
}

/** Stop early and reveal answers. */
export function finishGridRun(run: GridRun): GridRun {
  return run.status === "finished" ? run : { ...run, status: "finished" };
}

/* ------------------------------------------------------------ rewards + share */

export function gridRewardAmount(run: Pick<GridRun, "cells">): number {
  return gridScore(run) * GRID_REWARD_PER_CELL;
}

/** Club Funds run id: one daily grid reward per UK day. */
export function gridRewardRunId(dateKey: string): string {
  return `grid_win:${dateKey}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatGridDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  const month = m ? MONTHS[m - 1] : undefined;
  if (!d || !month) return dateKey;
  return `${d} ${month}`;
}

export function buildGridShareText(run: GridRun): string {
  const score = gridScore(run);
  const title =
    run.mode === "daily"
      ? `27-0 Grid ${formatGridDate(run.dateKey)} — ${score}/${GRID_CELL_COUNT}`
      : `27-0 Grid (practice) — ${score}/${GRID_CELL_COUNT}`;
  const rows: string[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    let line = "";
    for (let c = 0; c < GRID_SIZE; c++) {
      line += run.cells[r * GRID_SIZE + c] ? "✅" : "⬜";
    }
    rows.push(line);
  }
  return [title, ...rows, "27-0.co.uk/mini-games/grid"].join("\n");
}
