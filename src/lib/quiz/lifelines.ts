import { createRng, pickIndex, shuffledCopy } from "./rng";
import type {
  QuizCategory,
  QuizCrowdResult,
  QuizDifficulty,
  QuizPhoneResult,
} from "./types";

const CROWD_CORRECT_WEIGHT: Record<QuizDifficulty, [number, number]> = {
  easy: [0.58, 0.86],
  medium: [0.42, 0.72],
  hard: [0.28, 0.56],
  "very-hard": [0.2, 0.48],
  expert: [0.16, 0.44],
};

const PHONE_CORRECT_CHANCE: Record<QuizDifficulty, number> = {
  easy: 0.82,
  medium: 0.62,
  hard: 0.4,
  "very-hard": 0.3,
  expert: 0.24,
};

export type PhoneAnswerKind =
  | "score"
  | "year"
  | "number"
  | "player"
  | "club"
  | "stadium"
  | "coach"
  | "option";

function lerp(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function looksLikeScore(text: string): boolean {
  return /\d+\s*[-–:]\s*\d+/.test(text.trim());
}

function looksLikeYear(text: string): boolean {
  return /^(19|20)\d{2}$/.test(text.trim());
}

function looksLikeNumber(text: string): boolean {
  const trimmed = text.trim().replace(/,/g, "");
  if (/^\d+$/.test(trimmed)) return true;
  return /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/i.test(
    trimmed
  );
}

/** Infer what kind of answer the phone fan should talk about. */
export function inferPhoneAnswerKind(input: {
  stem: string;
  options: readonly string[];
  category: QuizCategory;
}): PhoneAnswerKind {
  const stem = input.stem.toLowerCase();
  const options = input.options;
  const scoreHits = options.filter(looksLikeScore).length;
  const yearHits = options.filter(looksLikeYear).length;
  const numberHits = options.filter(looksLikeNumber).length;

  if (
    scoreHits >= 2 ||
    /\b(final score|match score|winning score)\b/.test(stem) ||
    /\bwhat was the score\b/.test(stem) ||
    /\bscore (was|line)\b/.test(stem)
  ) {
    return "score";
  }
  if (
    yearHits >= 2 ||
    /\b(which year|what year|in what year|year did|season of)\b/.test(stem)
  ) {
    return "year";
  }
  if (
    numberHits >= 3 ||
    /\b(how many|what number|how often|how old)\b/.test(stem)
  ) {
    return "number";
  }
  if (
    input.category === "stadiums" ||
    /\b(stadium|ground|venue|home of)\b/.test(stem)
  ) {
    return "stadium";
  }
  if (
    input.category === "coaches" ||
    /\b(coach|manager|head coach)\b/.test(stem)
  ) {
    return "coach";
  }
  if (
    input.category === "clubs" ||
    /\b(which club|which team|which side)\b/.test(stem)
  ) {
    return "club";
  }
  if (
    input.category === "players" ||
    input.category === "captains" ||
    /\b(which player|who scored|who kicked|who captained|whose)\b/.test(stem)
  ) {
    return "player";
  }
  return "option";
}

function phoneQuotes(
  kind: PhoneAnswerKind
): Record<QuizPhoneResult["confidence"], string[]> {
  const label: Record<PhoneAnswerKind, { singular: string; plural: string }> = {
    score: { singular: "score", plural: "scores" },
    year: { singular: "year", plural: "years" },
    number: { singular: "figure", plural: "figures" },
    player: { singular: "name", plural: "names" },
    club: { singular: "club", plural: "clubs" },
    stadium: { singular: "ground", plural: "grounds" },
    coach: { singular: "coach", plural: "coaches" },
    option: { singular: "answer", plural: "answers" },
  };
  const { singular, plural } = label[kind];

  return {
    high: [
      `I'd go with that ${singular}. Feels like the safe Super League answer.`,
      `Pretty sure that's the ${singular} — I'd lock it in.`,
    ],
    medium: [
      `I think that ${singular} is right, but I wouldn't stake the house on it.`,
      `That's the ${singular} I'd lean towards if I had to pick.`,
    ],
    low: [
      `It's a guess from here. Could easily be one of the other ${plural}.`,
      `I'm not confident. That ${singular} just jumped out at me.`,
    ],
  };
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
  if ((difficulty === "very-hard" || difficulty === "expert") && rng() < 0.42) {
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
  seed: string,
  context?: {
    stem: string;
    options: readonly string[];
    category: QuizCategory;
  }
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

  const kind = context
    ? inferPhoneAnswerKind(context)
    : ("option" as PhoneAnswerKind);
  const quotes = phoneQuotes(kind);
  const pool = quotes[confidence];
  const quote = pool[pickIndex(rng, pool.length)] ?? pool[0] ?? "";

  return {
    suggestionIndex,
    confidence,
    quote,
  };
}
