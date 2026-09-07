/**
 * Validate the Quiz Mode question bank.
 * Run: npx tsx scripts/validate-quiz-bank.ts
 */
import { getQuizQuestionBank, summarizeQuestionBank } from "../src/lib/quiz/bank";
import { QUIZ_TEAM_IDS } from "../src/lib/quiz/types";
import { validateQuestionBank } from "../src/lib/quiz/validate";

const bank = getQuizQuestionBank();
const issues = validateQuestionBank(bank);
const summary = summarizeQuestionBank(bank);

console.log(`Questions: ${summary.total}`);
console.log("Difficulty:", summary.byDifficulty);
console.log("Categories:", summary.byCategory);
console.log("Per team:");
let teamFail = 0;
for (const id of QUIZ_TEAM_IDS) {
  const teamQuestions = bank.filter((question) => question.teams.includes(id));
  const count = teamQuestions.length;
  const difficulty = teamQuestions.reduce<Record<string, number>>(
    (counts, question) => {
      counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const ok =
    count >= 30 &&
    (difficulty.easy ?? 0) >= 3 &&
    (difficulty.medium ?? 0) >= 3 &&
    (difficulty.hard ?? 0) >= 3 &&
    (difficulty.expert ?? 0) >= 1;
  if (!ok) teamFail += 1;
  console.log(
    `  ${ok ? "✓" : "✗"} ${id}: ${count} ` +
      `(E${difficulty.easy ?? 0}/M${difficulty.medium ?? 0}/H${difficulty.hard ?? 0}/X${difficulty.expert ?? 0})`
  );
}

if (issues.length) {
  console.error(`Validation issues: ${issues.length}`);
  for (const issue of issues.slice(0, 20)) {
    console.error(`  ${issue.id}: ${issue.message}`);
  }
  process.exit(1);
}

if (summary.total < 500) {
  console.error(`Need at least 500 questions, found ${summary.total}`);
  process.exit(1);
}

if (teamFail > 0) {
  console.error(
    `${teamFail} teams lack 30 questions or the required difficulty pools`
  );
  process.exit(1);
}

console.log("Quiz bank OK");
