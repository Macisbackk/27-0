/** Deterministic 32-bit PRNG for stable option shuffles and lifeline rolls. */
export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): () => number {
  return mulberry32(hashSeed(seed));
}

export function pickIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length);
}

export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    const current = items[i];
    const swap = items[j];
    if (current === undefined || swap === undefined) continue;
    items[i] = swap;
    items[j] = current;
  }
  return items;
}

export function shuffledCopy<T>(items: readonly T[], rng: () => number): T[] {
  return shuffleInPlace([...items], rng);
}

export function createRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `quiz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
