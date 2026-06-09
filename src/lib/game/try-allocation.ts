/** Distribute integer tries across weighted players for one match. */
export function allocateMatchTries(
  matchTries: number,
  weights: number[],
  rng: () => number
): number[] {
  const allocated = new Array(weights.length).fill(0);
  if (matchTries <= 0 || weights.length === 0) return allocated;

  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return allocated;

  const rawShares = weights.map((w) => (w / weightSum) * matchTries);
  const floors = rawShares.map((share) => Math.floor(share));
  let remainder = matchTries - floors.reduce((sum, t) => sum + t, 0);

  for (let i = 0; i < floors.length; i++) {
    allocated[i] = floors[i];
  }

  const fractional = rawShares
    .map((share, i) => ({ i, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac || rng() - 0.5);

  for (const { i } of fractional) {
    if (remainder <= 0) break;
    allocated[i]++;
    remainder--;
  }

  return allocated;
}
