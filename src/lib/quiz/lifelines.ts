import { createRng, pickIndex, shuffledCopy } from "./rng";
import type {
  QuizCrowdResult,
  QuizDifficulty,
  QuizPhoneResult,
} from "./types";

const CROWD_CORRECT_WEIGHT: Record<QuizDifficulty, [number, number]> = {
  easy: [0.58, 0.86],
  medium: [0.42, 0.72],
  hard: [0.28, 0.56],
  expert: [0.16, 0.44],
};

const PHONE_CORRECT_CHANCE: Record<QuizDifficulty, number> = {
  easy: 0.82,
  medium: 0.62,
  hard: 0.4,
  expert: 0.24,
};

function lerp(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function remainingWrongIndexes(
  optionCount: number,
  correctIndex: number,
  hidden: readonly number[]
): number[] {
  const hiddenSet = new Set(hidden);
  return Array.from({ length: optionCount }, (_, index) => index).filter(
    (index) => index !== correctIndex && !hiddenSet.has(index)
  );
}

export function applyFiftyFifty(
  correctIndex: number,
  optionCount: number,
  seed: string
): number[] {
  const rng = createRng(`${seed}:5050`);
  const wrong = remainingWrongIndexes(optionCount, correctIndex, []);
  const shuffled = shuffledCopy(wrong, rng);
  return shuffled.slice(0, 2);
}

export function buildCrowdResult(
  correctIndex: number,
  optionCount: number,
  difficulty: QuizDifficulty,
  hidden: readonly number[],
  seed: string
): QuizCrowdResult {
  const rng = createRng(`${seed}:crowd`);
  const visible = Array.from({ length: optionCount }, (_, index) => index).filter(
    (index) => !hidden.includes(index)
  );
  const [min, max] = CROWD_CORRECT_WEIGHT[difficulty];
  let correctShare = lerp(rng, min, max);

  // Harder questions can swing the crowd away from the right answer.
  if (difficulty === "hard" && rng() < 0.28) {
    correctShare = lerp(rng, 0.18, 0.36);
  }
  if (difficulty === "expert" && rng() < 0.42) {
    correctShare = lerp(rng, 0.1, 0.32);
  }

  const percents: [number, number, number, number] = [0, 0, 0, 0];
  if (!visible.includes(correctIndex)) {
    const even = Math.floor(100 / Math.max(visible.length, 1));
    visible.forEach((index, i) => {
      percents[index] = i === visible.length - 1 ? 100 - even * (visible.length - 1) : even;
    });
    return { percents };
  }

  const remainingShare = 1 - correctShare;
  const others = visible.filter((index) => index !== correctIndex);
  const weights = others.map(() => 0.15 + rng());
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;

  const raw = visible.map((index) => {
    if (index === correctIndex) return correctShare;
    const otherIndex = others.indexOf(index);
    return remainingShare * ((weights[otherIndex] ?? 0) / weightTotal);
  });
  const rawTotal = raw.reduce((sum, value) => sum + value, 0) || 1;
  const rounded = raw.map((value) => Math.round((value / rawTotal) * 100));
  const drift = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const correctVisiblePos = visible.indexOf(correctIndex);
  if (correctVisiblePos >= 0) {
    rounded[correctVisiblePos] = (rounded[correctVisiblePos] ?? 0) + drift;
  }

  visible.forEach((index, i) => {
    percents[index] = Math.max(0, rounded[i] ?? 0);
  });
  return { percents };
}

export function buildPhoneResult(
  correctIndex: number,
  optionCount: number,
  difficulty: QuizDifficulty,
  hidden: readonly number[],
  seed: string
): QuizPhoneResult {
  const rng = createRng(`${seed}:phone`);
  const visible = Array.from({ length: optionCount }, (_, index) => index).filter(
    (index) => !hidden.includes(index)
  );
  const canBeCorrect = visible.includes(correctIndex) && rng() < PHONE_CORRECT_CHANCE[difficulty];
  const suggestionIndex = canBeCorrect
    ? correctIndex
    : visible[pickIndex(rng, visible.length)] ?? visible[0] ?? 0;

  const confidence: QuizPhoneResult["confidence"] =
    difficulty === "easy" ? "high" : difficulty === "medium" ? "medium" : "low";

  const quotes: Record<QuizPhoneResult["confidence"], string[]> = {
    high: [
      "I'd go with that one. Feels like the safe Super League answer.",
      "Pretty sure that's the one — I'd lock it in.",
    ],
    medium: [
      "I think that's right, but I wouldn't stake the house on it.",
      "That's the one I'd lean towards if I had to pick.",
    ],
    low: [
      "It's a guess from here. Could easily be one of the others.",
      "I'm not confident. That's just the name that jumped out.",
    ],
  };
  const pool = quotes[confidence];
  const quote = pool[pickIndex(rng, pool.length)] ?? pool[0] ?? "";

  return {
    suggestionIndex,
    confidence,
    quote,
  };
}
