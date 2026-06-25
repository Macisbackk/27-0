/**
 * Spread identical peak ratings across year cards for the same base player.
 * Peak career years sit near +1; early/late cards drift down to -3.
 *
 * Run: npx tsx scripts/apply-historic-card-rating-variance.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { PlayerCategory, Position } from "../src/lib/types";

type RawPlayer = {
  id: string;
  name: string;
  position: Position;
  category: PlayerCategory;
  peakRating: number;
  rating?: number;
  value: number;
  basePlayerId?: string;
  year?: number;
  cardYear?: number;
};

const DATA = join(process.cwd(), "data");
const MIN_CARDS = 4;
const MIN_SPREAD = 4; // at least 4 identical ratings before adjusting

function cardYear(p: RawPlayer): number {
  return p.cardYear ?? p.year ?? 0;
}

/** Offsets from -3 to +1 distributed across sorted year cards (peak near career middle). */
function buildOffsets(count: number): number[] {
  if (count <= 1) return [0];
  const peakIndex = Math.round((count - 1) * 0.55);
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    const dist = Math.abs(i - peakIndex);
    const maxDist = Math.max(peakIndex, count - 1 - peakIndex, 1);
    const normalized = dist / maxDist;
    offsets.push(Math.round(1 - normalized * 4));
  }
  return offsets;
}

function applyVarianceToFile(filename: string): number {
  const path = join(DATA, filename);
  const players = JSON.parse(readFileSync(path, "utf8")) as RawPlayer[];
  const byBase = new Map<string, RawPlayer[]>();

  for (const p of players) {
    const base = p.basePlayerId ?? p.id;
    const group = byBase.get(base) ?? [];
    group.push(p);
    byBase.set(base, group);
  }

  let adjusted = 0;

  for (const [, cards] of byBase) {
    if (cards.length < MIN_CARDS) continue;
    const ratings = new Set(cards.map((c) => c.peakRating));
    if (ratings.size > 1 || ratings.size === 0) continue;
    const rating = cards[0]!.peakRating;
    if (cards.length < MIN_SPREAD && rating < 88) continue;

    const sorted = [...cards].sort((a, b) => cardYear(a) - cardYear(b));
    const offsets = buildOffsets(sorted.length);

    sorted.forEach((card, index) => {
      const next = Math.max(75, Math.min(99, rating + offsets[index]!));
      if (next === card.peakRating) return;
      card.peakRating = next;
      card.rating = next;
      card.value = computePlayerValue(next, card.position, card.category);
      adjusted++;
    });
  }

  writeFileSync(path, `${JSON.stringify(players, null, 2)}\n`);
  return adjusted;
}

const historic = applyVarianceToFile("historic-players.json");
const legends = applyVarianceToFile("legends.json");
console.log(`Adjusted ${historic} historic cards and ${legends} legend cards.`);
