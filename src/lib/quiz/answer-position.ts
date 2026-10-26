import type { QuizQuestion } from "./types";

/** FNV-1a, stable across runtimes; used to spread stored answer slots evenly. */
export function stableQuizHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Stored slot (0-3) for a question's correct answer. Players never see the stored
 * order (the engine shuffles per run), but a bank where the answer always sits in
 * slot A is easy to get wrong when editing and skews any unshuffled view.
 */
export function answerSlotFor(id: string): number {
  return stableQuizHash(`slot:${id}`) % 4;
}

/** Move the correct answer to its stable slot, keeping the distractors' order. */
export function placeCorrectAnswer<T extends Pick<QuizQuestion, "id" | "options" | "correctAnswer">>(
  question: T
): T {
  const distractors = question.options.filter(
    (option) => option !== question.correctAnswer
  );
  if (distractors.length !== 3) return question;
  const slot = answerSlotFor(question.id);
  const options = [...distractors];
  options.splice(slot, 0, question.correctAnswer);
  return {
    ...question,
    options: options as QuizQuestion["options"],
  };
}
