export interface TryScorerLine {
  playerId: string;
  name: string;
  tries: number;
  positionNote?: string | null;
}

/** Group duplicate scorers into one line with x2, x3, etc. */
export function groupTryScorersForDisplay<
  T extends { playerId: string; name: string; tries: number; positionNote?: string | null }
>(scorers: T[]): TryScorerLine[] {
  const map = new Map<string, TryScorerLine>();

  for (const scorer of scorers) {
    const key = scorer.playerId || scorer.name;
    const existing = map.get(key);
    if (existing) {
      existing.tries += scorer.tries;
    } else {
      map.set(key, {
        playerId: scorer.playerId,
        name: scorer.name,
        tries: scorer.tries,
        positionNote: scorer.positionNote,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.tries - a.tries || a.name.localeCompare(b.name));
}
