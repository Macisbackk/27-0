/**
 * Quiz Mode engine and prize tests.
 * Run: npx tsx scripts/test-quiz-engine.ts
 */
import {
  continueAfterReveal,
  countCorrectAnswers,
  createQuizRun,
  getCorrectDisplayIndex,
  lockAnswer,
  revealAnswer,
  useChangeQuestion,
  useCrowd,
  useFiftyFifty,
  usePhone,
  walkAway,
} from "../src/lib/quiz/engine";
import {
  getCurrentPrize,
  getEndPayout,
  getGuaranteedPrize,
  getWalkAwayPayout,
  getWrongAnswerPayout,
} from "../src/lib/quiz/prizes";
import { isEligibleMiniGameQuizTeamId } from "../src/lib/mini-games/eligibility";
import {
  buildPhoneResult,
  inferPhoneAnswerKind,
} from "../src/lib/quiz/lifelines";
import {
  filterTeamChallengeQuestions,
  isObviousTeamChallengeAnswer,
  selectQuizQuestions,
} from "../src/lib/quiz/selection";
import { quizRewardRunId } from "../src/lib/quiz/rewards";
import { validateQuestionBank } from "../src/lib/quiz/validate";
import { getQuizQuestionBank } from "../src/lib/quiz/bank";
import { QUIZ_CLUBS } from "../src/lib/quiz/clubs";
import type { QuizQuestion } from "../src/lib/quiz/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${message}`);
  } else {
    failed += 1;
    console.error(`  \u2717 ${message}`);
  }
}

function makeQuestion(
  id: string,
  difficulty: QuizQuestion["difficulty"],
  teams: QuizQuestion["teams"] = [],
  category: QuizQuestion["category"] = "general"
): QuizQuestion {
  return {
    id,
    topicId: `topic:${id}`,
    question: `Question ${id}?`,
    options: ["Alpha", "Bravo", "Charlie", "Delta"],
    correctAnswer: "Alpha",
    difficulty,
    category,
    teams,
    sourceType: "curated",
  };
}

const bank: QuizQuestion[] = [];
const diffs = ["easy", "medium", "hard", "very-hard", "expert"] as const;
const cats = ["history", "players", "clubs", "stadiums", "grand-finals"] as const;
for (let i = 0; i < 100; i++) {
  bank.push(
    makeQuestion(
      `gen-${i}`,
      diffs[i % diffs.length]!,
      i % 5 === 0 ? ["leeds"] : [],
      cats[i % cats.length]
    )
  );
}
for (let i = 0; i < 50; i++) {
  bank.push(
    makeQuestion(
      `leeds-${i}`,
      diffs[i % diffs.length]!,
      ["leeds"],
      cats[i % cats.length]
    )
  );
}

console.log("Quiz validation");
{
  const issues = validateQuestionBank(bank);
  assert(issues.length === 0, "sample bank validates");
  const broken = { ...bank[0]!, options: ["A", "A", "B", "C"] as QuizQuestion["options"] };
  assert(validateQuestionBank([broken]).length > 0, "duplicate options fail validation");
}

console.log("\nQuestion selection");
{
  const selected = selectQuizQuestions({
    questions: bank,
    mode: "millionaire",
    seed: "run-a",
  });
  assert(selected.length === 15, "selects 15 questions");
  assert(new Set(selected.map((q) => q.id)).size === 15, "no duplicate questions in a run");
  assert(
    ["hard", "very-hard", "expert"].includes(selected[14]?.difficulty ?? ""),
    "Q15 (win question) is hard-tier"
  );
  assert(
    new Set(selected.map((q) => q.topicId)).size === 15,
    "run has 15 unique topics"
  );

  const orderSeeds = ["order-a", "order-b", "order-c", "order-d"];
  const firstIds = orderSeeds.map(
    (seed) =>
      selectQuizQuestions({ questions: bank, mode: "millionaire", seed })[0]?.id
  );
  assert(
    new Set(firstIds).size > 1,
    "leading question order varies across seeds"
  );

  const team = filterTeamChallengeQuestions(bank, "leeds");
  assert(team.every((q) => q.teams.includes("leeds")), "team filter keeps only Leeds questions");
  const teamRun = selectQuizQuestions({
    questions: bank,
    mode: "team",
    teamId: "leeds",
    seed: "run-b",
  });
  assert(
    teamRun.every((q) => q.teams.includes("leeds")),
    "Team Challenge run is Leeds-only"
  );

  const realBank = getQuizQuestionBank();
  const recordIds = [
    "cur-sl-try-record",
    "cur-sl-apps-record",
    "cur-leeds-points-record",
    "cur-hull-fc-apps-record",
  ];
  assert(
    recordIds.every((id) => realBank.some((question) => question.id === id)),
    "player-record questions are in the bank"
  );
  const obvious = {
    ...realBank[0]!,
    question: "Which club won the Challenge Cup in 2016?",
    correctAnswer: "Hull FC",
    options: ["Hull FC", "Wigan Warriors", "Leeds Rhinos", "St Helens"] as QuizQuestion["options"],
  };
  assert(
    isObviousTeamChallengeAnswer(obvious, "hull-fc"),
    "themed club-name answers are filtered from Team Challenge"
  );
  const stadiumGiveaway = {
    ...realBank[0]!,
    question: "Which club is based at Headingley?",
    correctAnswer: "Leeds Rhinos",
    options: ["Leeds Rhinos", "Bradford Bulls", "Wakefield Trinity", "Castleford Tigers"] as QuizQuestion["options"],
  };
  assert(
    isObviousTeamChallengeAnswer(stadiumGiveaway, "leeds"),
    "home-stadium occupant questions are filtered from Team Challenge"
  );
  const genericDerby = realBank.find((question) =>
    /which two clubs contest the super league derby between leeds and bradford/i.test(
      question.question
    )
  );
  assert(!genericDerby, "generic Leeds-Bradford derby question is removed");
  const rhinosBulls = realBank.find((question) => question.id === "cur-rhinos-bulls");
  assert(
    Boolean(rhinosBulls && rhinosBulls.correctAnswer === "2004 and 2005"),
    "Leeds-Bradford question is a specific Grand Final fact"
  );
  for (const { id: teamId } of QUIZ_CLUBS) {
    if (!isEligibleMiniGameQuizTeamId(teamId)) {
      assert(true, `${teamId} is not a current Super League Team Challenge club`);
      continue;
    }
    const realTeamRun = selectQuizQuestions({
      questions: realBank,
      mode: "team",
      teamId,
      seed: `coverage-${teamId}`,
    });
    assert(
      realTeamRun.length === 15 &&
        realTeamRun.every((q) => q.teams.includes(teamId)) &&
        new Set(realTeamRun.map((q) => q.topicId)).size === 15,
      `real Team Challenge run is ${teamId}-only with unique topics`
    );
  }

  let uniqueTopicRuns = 0;
  for (let i = 0; i < 8; i++) {
    const run = selectQuizQuestions({
      questions: realBank,
      mode: "millionaire",
      seed: `diversity-${i}`,
      recentIds: selected.map((q) => q.id),
      recentTopicIds: selected.map((q) => q.topicId),
    });
    if (new Set(run.map((q) => q.topicId)).size === 15) uniqueTopicRuns += 1;
  }
  assert(uniqueTopicRuns === 8, "repeated millionaire runs keep unique topics");
}

console.log("\nPrize ladder");
{
  assert(getCurrentPrize(0) === 0, "no prize before a correct answer");
  assert(getCurrentPrize(1) === 100, "Q1 prize is 100");
  assert(getCurrentPrize(5) === 1_000, "Q5 prize is 1000");
  assert(getCurrentPrize(10) === 32_000, "Q10 prize is 32000");
  assert(getCurrentPrize(15) === 1_000_000, "Q15 prize is 1m");
  assert(getGuaranteedPrize(4) === 0, "no safe haven before Q5");
  assert(getGuaranteedPrize(5) === 1_000, "Q5 is a safe haven");
  assert(getGuaranteedPrize(10) === 32_000, "Q10 is a safe haven");
  assert(getWrongAnswerPayout(7) === 1_000, "wrong answer after Q5 drops to 1000");
  assert(getWalkAwayPayout(7) === 4_000, "walk away takes current prize, not next");
  assert(getEndPayout("complete", 15) === 1_000_000, "completion pays 1m");
  assert(getEndPayout("walked_away", 9) === 16_000, "walk away after Q9 is 16000");
  assert(getEndPayout("failed", 9) === 1_000, "fail after Q9 is guaranteed 1000");
}

console.log("\nPhone lifeline wording");
{
  assert(
    inferPhoneAnswerKind({
      stem: "What was the final score?",
      options: ["24-6", "18-12", "10-8", "30-0"],
      category: "famous-matches",
    }) === "score",
    "score options infer score kind"
  );
  assert(
    inferPhoneAnswerKind({
      stem: "In which year did Wigan win?",
      options: ["1998", "2002", "2010", "2018"],
      category: "history",
    }) === "year",
    "year options infer year kind"
  );
  const scorePhone = buildPhoneResult(0, 4, "hard", [], "phone-score-test", {
    stem: "What was the final score?",
    options: ["24-6", "18-12", "10-8", "30-0"],
    category: "famous-matches",
  });
  assert(/\bscore/i.test(scorePhone.quote), "score questions talk about a score");
  assert(!/\bname\b/i.test(scorePhone.quote), "score questions never say name");
  const playerPhone = buildPhoneResult(0, 4, "easy", [], "phone-player-test", {
    stem: "Which player scored the try?",
    options: ["Rob Burrow", "Kevin Sinfield", "Sean Long", "Paul Wellens"],
    category: "players",
  });
  assert(/\bname\b/i.test(playerPhone.quote), "player questions can mention a name");
}

console.log("\nRun state and lifelines");
{
  let run = createQuizRun({ bank, mode: "millionaire" });
  assert(run.phase === "question_active", "new run starts on a question");
  assert(run.questions.length === 15, "run stores 15 slots");
  assert(run.id.length > 8, "run has a unique id");
  assert(quizRewardRunId(run.id) === `quiz_reward:${run.id}`, "reward id is namespaced");
  const correctPositions = run.questions.map((slot) => {
    const question = bank.find((item) => item.id === slot.questionId)!;
    return getCorrectDisplayIndex(question, slot);
  });
  const positionCounts = [0, 1, 2, 3].map(
    (position) => correctPositions.filter((value) => value === position).length
  );
  assert(
    positionCounts.every((count) => count >= 3),
    "correct answer positions are balanced across A-D"
  );
  assert(
    correctPositions.every(
      (position, index) =>
        index < 2 ||
        position !== correctPositions[index - 1] ||
        position !== correctPositions[index - 2]
    ),
    "correct answer position never repeats three times"
  );

  const first = run.questions[0]!;
  const q = bank.find((item) => item.id === first.questionId)!;
  const correct = getCorrectDisplayIndex(q, first);
  const wrong = [0, 1, 2, 3].find((index) => index !== correct)!;

  const ignored = lockAnswer({ ...run, phase: "answer_revealed" }, correct);
  assert(ignored.phase === "answer_revealed", "cannot lock twice / after reveal");

  run = lockAnswer(run, correct);
  assert(run.phase === "answer_locked", "lock moves to answer_locked");
  run = revealAnswer(run, bank);
  assert(run.phase === "answer_revealed", "reveal moves to answer_revealed");
  assert(run.questions[0]?.correct === true, "correct answer is marked");
  run = continueAfterReveal(run);
  assert(run.questionIndex === 1, "continue advances to the next question");
  assert(countCorrectAnswers(run) === 1, "correct count is 1");

  run = useFiftyFifty(run, bank);
  assert(run.lifelines.fiftyFifty, "50/50 is consumed");
  const hidden = run.questions[1]?.hiddenOptionIndexes ?? [];
  assert(hidden.length === 2, "50/50 hides two options");
  run = useCrowd(run, bank);
  assert(run.lifelines.crowd && run.questions[1]?.crowd, "crowd lifeline stores percents");
  run = usePhone(run, bank);
  assert(run.lifelines.phone && run.questions[1]?.phone, "phone lifeline stores a suggestion");
  const phoneQuote = run.questions[1]?.phone?.quote ?? "";
  assert(phoneQuote.length > 0, "phone quote is non-empty");
  assert(!/just the name that jumped out/i.test(phoneQuote), "phone quote is not the old name-only line");
  const beforeChange = run.questions[1]?.questionId;
  run = useChangeQuestion(run, bank);
  assert(run.lifelines.change, "change lifeline is consumed");
  assert(run.questions[1]?.questionId !== beforeChange, "change replaces the question");

  const again = useFiftyFifty(run, bank);
  assert(again.lifelines.fiftyFifty === true, "lifelines cannot be reused");

  const walked = walkAway(run);
  assert(walked.phase === "quiz_walked_away", "walk away ends the run");
  assert(walked.rewardAmount === getWalkAwayPayout(countCorrectAnswers(walked)), "walk away pays current prize");
}

console.log("\nWrong answer payout");
{
  let run = createQuizRun({ bank, mode: "millionaire" });
  for (let i = 0; i < 5; i++) {
    const slot = run.questions[run.questionIndex]!;
    const question = bank.find((item) => item.id === slot.questionId)!;
    const correct = getCorrectDisplayIndex(question, slot);
    run = continueAfterReveal(revealAnswer(lockAnswer(run, correct), bank));
  }
  const slot = run.questions[run.questionIndex]!;
  const question = bank.find((item) => item.id === slot.questionId)!;
  const correct = getCorrectDisplayIndex(question, slot);
  const wrong = [0, 1, 2, 3].find((index) => index !== correct)!;
  run = continueAfterReveal(revealAnswer(lockAnswer(run, wrong), bank));
  assert(run.phase === "quiz_failed", "wrong answer ends the run");
  assert(run.rewardAmount === 1_000, "fail after the first safe haven pays 1000");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
