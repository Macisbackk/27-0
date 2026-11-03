/**
 * Side-effect import for /play (must be its first import): tells players/index.ts to skip the
 * one-shot registry build at load, so PlayPageClient can build it in slices with
 * loadPlayersInSlices() and hydration stays short on phones. Server rendering is unaffected.
 */
if (typeof window !== "undefined") {
  (globalThis as Record<string, unknown>).__27_0_deferPlayerRegistry = true;
}

export {};
