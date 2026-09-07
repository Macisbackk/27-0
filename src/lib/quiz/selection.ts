import { createRng, shuffledCopy } from "./rng";
import type { QuizDifficulty, QuizQuestion, QuizTeamId } from "./types";
import { QUIZ_QUESTION_COUNT } from "./types";

export const QUESTION_DIFFICULTY_BANDS: QuizDifficulty[][] = [
  ["easy"],
  ["easy"],
  ["easy"],
  ["easy", "medium"],
  ["easy", "medium"],
  ["easy", "medium"],
  ["medium"],
  ["medium"],
  ["medium"],
  ["hard"],
  ["hard"],
  ["hard"],
  ["hard", "expert"],
  ["hard", "expert"],
  ["expert"],
];

export function filterTeamChallengeQuestions(
  questions: readonly QuizQuestion[],
  teamId: QuizTeamId
): QuizQuestion[] {
  return questions.filter((question) => question.teams.includes(teamId));
}

export function filterMillionaireQuestions(
  questions: readonly QuizQuestion[]
): QuizQuestion[] {
  return [...questions];
}

function takeFromPool(
  pool: QuizQuestion[],
  exclude: Set<string>,
  count: number,
  rng: () => number
): QuizQuestion[] {
  const available = pool.filter((question) => !exclude.has(question.id));
  const shuffled = shuffledCopy(available, rng);
  const picked: QuizQuestion[] = [];
  for (const question of shuffled) {
    if (picked.length >= count) break;
    picked.push(question);
    exclude.add(question.id);
  }
  return picked;
}

export function selectQuizQuestions(options: {
  questions: readonly QuizQuestion[];
  mode: "millionaire" | "team";
  teamId?: QuizTeamId | null;
  recentIds?: readonly string[];
  seed: string;
}): QuizQuestion[] {
  const rng = createRng(`${options.seed}:select`);
  const source =
    options.mode === "team" && options.teamId
      ? filterTeamChallengeQuestions(options.questions, options.teamId)
      : filterMillionaireQuestions(options.questions);

  if (source.length < QUIZ_QUESTION_COUNT) {
    throw new Error(
      options.mode === "team"
        ? `Not enough Team Challenge questions for ${options.teamId}`
        : "Not enough Super League Millionaire questions"
    );
  }

  const recent = new Set(options.recentIds ?? []);
  const used = new Set<string>();
  const selected: QuizQuestion[] = [];

  for (let index = 0; index < QUIZ_QUESTION_COUNT; index++) {
    const band = QUESTION_DIFFICULTY_BANDS[index] ?? ["medium"];
    const preferred = source.filter(
      (question) => band.includes(question.difficulty) && !recent.has(question.id)
    );
    const fallbackBand = source.filter((question) => band.includes(question.difficulty));
    const anyUnused = source.filter((question) => !used.has(question.id));

    const pick =
      takeFromPool(preferred, used, 1, rng)[0] ??
      takeFromPool(fallbackBand, used, 1, rng)[0] ??
      takeFromPool(anyUnused, used, 1, rng)[0];

    if (!pick) {
      throw new Error("Could not fill a 15-question quiz run");
    }
    selected.push(pick);
  }

  return selected;
}
