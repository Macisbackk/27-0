import {
  applyFiftyFifty,
  buildCrowdResult,
  buildPhoneResult,
} from "./lifelines";
import { getEndPayout, type QuizEndReason } from "./prizes";
import { createRng, createRunId } from "./rng";
import { selectQuizQuestions, selectReplacementQuestion } from "./selection";
import type {
  QuizMode,
  QuizPhase,
  QuizQuestion,
  QuizRun,
  QuizRunQuestion,
  QuizTeamId,
} from "./types";
import { QUIZ_QUESTION_COUNT, QUIZ_SCHEMA_VERSION } from "./types";

const ACTIVE_PHASES: QuizPhase[] = [
  "question_active",
  "answer_locked",
  "answer_revealed",
];

const TERMINAL_PHASES: QuizPhase[] = [
  "quiz_complete",
  "quiz_failed",
  "quiz_walked_away",
];

export function isActiveQuizPhase(phase: QuizPhase): boolean {
  return ACTIVE_PHASES.includes(phase);
}

export function isTerminalQuizPhase(phase: QuizPhase): boolean {
  return TERMINAL_PHASES.includes(phase);
}

export function getQuestionById(
  bank: readonly QuizQuestion[],
  id: string
): QuizQuestion | undefined {
  return bank.find((question) => question.id === id);
}

export function countCorrectAnswers(run: QuizRun): number {
  return run.questions.filter((question) => question.correct === true).length;
}

export function answeredCount(run: QuizRun): number {
  return run.questions.filter((question) => question.correct !== null).length;
}

function nowIso(): string {
  return new Date().toISOString();
}

function touch(run: QuizRun): QuizRun {
  return { ...run, updatedAt: nowIso() };
}

function shuffleOptions(question: QuizQuestion, seed: string): QuizRunQuestion {
  const rng = createRng(`${seed}:${question.id}:opts`);
  const order = [0, 1, 2, 3] as [number, number, number, number];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const current = order[i];
    const swap = order[j];
    if (current === undefined || swap === undefined) continue;
    order[i] = swap;
    order[j] = current;
  }
  return {
    questionId: question.id,
    optionOrder: order,
    hiddenOptionIndexes: [],
    selectedDisplayIndex: null,
    correct: null,
    crowd: null,
    phone: null,
  };
}

function buildBalancedQuestionSlots(
  questions: readonly QuizQuestion[],
  seed: string
): QuizRunQuestion[] {
  const rng = createRng(`${seed}:answer-pattern`);
  const positionCycle = [0, 1, 2, 3];
  for (let i = positionCycle.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positionCycle[i], positionCycle[j]] = [positionCycle[j]!, positionCycle[i]!];
  }

  return questions.map((question, index) => {
    const slot = shuffleOptions(question, seed);
    const canonicalCorrect = question.options.findIndex(
      (option) => option === question.correctAnswer
    );
    const currentPosition = slot.optionOrder.indexOf(canonicalCorrect);
    const targetPosition = positionCycle[index % positionCycle.length] ?? 0;
    if (currentPosition !== targetPosition) {
      [
        slot.optionOrder[currentPosition],
        slot.optionOrder[targetPosition],
      ] = [
        slot.optionOrder[targetPosition]!,
        slot.optionOrder[currentPosition]!,
      ];
    }
    return slot;
  });
}

export function getDisplayedOptions(
  question: QuizQuestion,
  slot: QuizRunQuestion
): [string, string, string, string] {
  return slot.optionOrder.map((index) => question.options[index] ?? "") as [
    string,
    string,
    string,
    string,
  ];
}

export function getCorrectDisplayIndex(
  question: QuizQuestion,
  slot: QuizRunQuestion
): number {
  const canonical = question.options.findIndex(
    (option) => option === question.correctAnswer
  );
  return slot.optionOrder.findIndex((index) => index === canonical);
}

export function createQuizRun(options: {
  bank: readonly QuizQuestion[];
  mode: QuizMode;
  teamId?: QuizTeamId | null;
  recentIds?: readonly string[];
  recentTopicIds?: readonly string[];
}): QuizRun {
  const id = createRunId();
  const selected = selectQuizQuestions({
    questions: options.bank,
    mode: options.mode,
    teamId: options.teamId,
    recentIds: options.recentIds,
    recentTopicIds: options.recentTopicIds,
    seed: id,
  });

  return {
    schemaVersion: QUIZ_SCHEMA_VERSION,
    id,
    mode: options.mode,
    teamId: options.mode === "team" ? options.teamId ?? null : null,
    phase: "question_active",
    questionIndex: 0,
    questions: buildBalancedQuestionSlots(selected, id),
    lifelines: {
      fiftyFifty: false,
      crowd: false,
      phone: false,
      change: false,
    },
    rewardClaimed: false,
    rewardAmount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function lockAnswer(run: QuizRun, displayIndex: number): QuizRun {
  if (run.phase !== "question_active") return run;
  const slot = run.questions[run.questionIndex];
  if (!slot || slot.selectedDisplayIndex !== null) return run;
  if (displayIndex < 0 || displayIndex > 3) return run;
  if (slot.hiddenOptionIndexes.includes(displayIndex)) return run;

  const questions = run.questions.map((question, index) =>
    index === run.questionIndex
      ? { ...question, selectedDisplayIndex: displayIndex }
      : question
  );
  return touch({ ...run, phase: "answer_locked", questions });
}

export function revealAnswer(
  run: QuizRun,
  bank: readonly QuizQuestion[]
): QuizRun {
  if (run.phase !== "answer_locked") return run;
  const slot = run.questions[run.questionIndex];
  if (!slot || slot.selectedDisplayIndex === null) return run;
  const question = getQuestionById(bank, slot.questionId);
  if (!question) return run;

  const correctIndex = getCorrectDisplayIndex(question, slot);
  const correct = slot.selectedDisplayIndex === correctIndex;
  const questions = run.questions.map((entry, index) =>
    index === run.questionIndex ? { ...entry, correct } : entry
  );

  return touch({ ...run, phase: "answer_revealed", questions });
}

export function continueAfterReveal(run: QuizRun): QuizRun {
  if (run.phase !== "answer_revealed") return run;
  const slot = run.questions[run.questionIndex];
  if (!slot) return run;

  if (slot.correct === false) {
    return finalizeRun(run, "failed");
  }

  if (run.questionIndex >= QUIZ_QUESTION_COUNT - 1) {
    return finalizeRun(run, "complete");
  }

  return touch({
    ...run,
    phase: "question_active",
    questionIndex: run.questionIndex + 1,
  });
}

export function walkAway(run: QuizRun): QuizRun {
  if (run.phase !== "question_active" && run.phase !== "answer_revealed") {
    return run;
  }
  if (run.phase === "answer_revealed") {
    const slot = run.questions[run.questionIndex];
    if (slot?.correct === false) return run;
    if (slot?.correct === true && run.questionIndex >= QUIZ_QUESTION_COUNT - 1) {
      return finalizeRun(run, "complete");
    }
  }
  return finalizeRun(run, "walked_away");
}

export function finalizeRun(run: QuizRun, reason: QuizEndReason): QuizRun {
  if (isTerminalQuizPhase(run.phase) && run.rewardAmount >= 0 && run.rewardClaimed) {
    return run;
  }
  const correct = countCorrectAnswers(run);
  const phase: QuizPhase =
    reason === "complete"
      ? "quiz_complete"
      : reason === "walked_away"
        ? "quiz_walked_away"
        : "quiz_failed";
  return touch({
    ...run,
    phase,
    rewardAmount: getEndPayout(reason, correct),
  });
}

export function useFiftyFifty(
  run: QuizRun,
  bank: readonly QuizQuestion[]
): QuizRun {
  if (run.phase !== "question_active" || run.lifelines.fiftyFifty) return run;
  const slot = run.questions[run.questionIndex];
  if (!slot) return run;
  const question = getQuestionById(bank, slot.questionId);
  if (!question) return run;
  const correctIndex = getCorrectDisplayIndex(question, slot);
  const hidden = applyFiftyFifty(
    correctIndex,
    4,
    `${run.id}:${slot.questionId}`
  );
  const questions = run.questions.map((entry, index) =>
    index === run.questionIndex
      ? { ...entry, hiddenOptionIndexes: hidden, crowd: null, phone: null }
      : entry
  );
  return touch({
    ...run,
    lifelines: { ...run.lifelines, fiftyFifty: true },
    questions,
  });
}

export function useCrowd(run: QuizRun, bank: readonly QuizQuestion[]): QuizRun {
  if (run.phase !== "question_active" || run.lifelines.crowd) return run;
  const slot = run.questions[run.questionIndex];
  if (!slot) return run;
  const question = getQuestionById(bank, slot.questionId);
  if (!question) return run;
  const correctIndex = getCorrectDisplayIndex(question, slot);
  const crowd = buildCrowdResult(
    correctIndex,
    4,
    question.difficulty,
    slot.hiddenOptionIndexes,
    `${run.id}:${slot.questionId}`
  );
  const questions = run.questions.map((entry, index) =>
    index === run.questionIndex ? { ...entry, crowd } : entry
  );
  return touch({
    ...run,
    lifelines: { ...run.lifelines, crowd: true },
    questions,
  });
}

export function usePhone(run: QuizRun, bank: readonly QuizQuestion[]): QuizRun {
  if (run.phase !== "question_active" || run.lifelines.phone) return run;
  const slot = run.questions[run.questionIndex];
  if (!slot) return run;
  const question = getQuestionById(bank, slot.questionId);
  if (!question) return run;
  const correctIndex = getCorrectDisplayIndex(question, slot);
  const phone = buildPhoneResult(
    correctIndex,
    4,
    question.difficulty,
    slot.hiddenOptionIndexes,
    `${run.id}:${slot.questionId}`,
    {
      stem: question.question,
      options: question.options,
      category: question.category,
    }
  );
  const questions = run.questions.map((entry, index) =>
    index === run.questionIndex ? { ...entry, phone } : entry
  );
  return touch({
    ...run,
    lifelines: { ...run.lifelines, phone: true },
    questions,
  });
}

export function useChangeQuestion(
  run: QuizRun,
  bank: readonly QuizQuestion[],
  recentIds: readonly string[] = [],
  recentTopicIds: readonly string[] = []
): QuizRun {
  if (run.phase !== "question_active" || run.lifelines.change) return run;
  const usedIds = new Set(run.questions.map((question) => question.questionId));
  const current = run.questions[run.questionIndex];
  if (!current) return run;
  const currentQuestion = getQuestionById(bank, current.questionId);
  if (!currentQuestion) return run;

  const usedTopics = new Set(
    run.questions
      .map((slot) => getQuestionById(bank, slot.questionId)?.topicId)
      .filter((topicId): topicId is string => Boolean(topicId))
  );
  usedTopics.add(currentQuestion.topicId);

  const previous = run.questions
    .slice(0, run.questionIndex)
    .map((slot) => getQuestionById(bank, slot.questionId))
    .filter((question): question is QuizQuestion => Boolean(question));

  const replacement = selectReplacementQuestion({
    questions: bank,
    mode: run.mode,
    teamId: run.teamId,
    excludeIds: usedIds,
    excludeTopics: usedTopics,
    recentIds,
    recentTopicIds,
    preferredDifficulty: currentQuestion.difficulty,
    previous,
    seed: `${run.id}:change:${run.questionIndex}`,
  });

  if (!replacement) return run;

  const questions = run.questions.map((entry, index) =>
    index === run.questionIndex ? shuffleOptions(replacement, run.id) : entry
  );
  return touch({
    ...run,
    lifelines: { ...run.lifelines, change: true },
    questions,
  });
}

export function markRewardClaimed(run: QuizRun, amount: number): QuizRun {
  return touch({
    ...run,
    rewardClaimed: true,
    rewardAmount: amount,
  });
}
