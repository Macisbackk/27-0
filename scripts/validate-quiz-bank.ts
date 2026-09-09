/**
 * Validate the Quiz Mode question bank.
 * Run: npx tsx scripts/validate-quiz-bank.ts
 */
import { isEligibleMiniGameQuizTeamId } from "../src/lib/mini-games/eligibility";
import { getQuizQuestionBank, summarizeQuestionBank } from "../src/lib/quiz/bank";
import { auditQuestionBank, teamChallengePool } from "../src/lib/quiz/content-audit";
import { QUIZ_TEAM_IDS } from "../src/lib/quiz/types";
import { validateQuestionBank } from "../src/lib/quiz/validate";

const bank = getQuizQuestionBank();
const issues = validateQuestionBank(bank);
const audit = auditQuestionBank(bank);
const summary = summarizeQuestionBank(bank);

console.log(`Questions: ${summary.total}`);
console.log(`Unique topics: ${summary.topics}`);
console.log("Difficulty:", summary.byDifficulty);
console.log("Categories:", summary.byCategory);
console.log("Sources:", summary.bySource);
console.log("Per team (tagged / Team Challenge pool):");
let teamFail = 0;
for (const id of QUIZ_TEAM_IDS) {
  const tagged = bank.filter((question) => question.teams.includes(id));
  const challenge = teamChallengePool(bank, id);
  const difficulty = challenge.reduce<Record<string, number>>(
    (counts, question) => {
      counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const current = isEligibleMiniGameQuizTeamId(id);
  const ok = current
    ? challenge.length >= 15 &&
      (difficulty.easy ?? 0) >= 3 &&
      (difficulty.medium ?? 0) >= 3 &&
      (difficulty.hard ?? 0) >= 3 &&
      (difficulty["very-hard"] ?? 0) >= 2 &&
      (difficulty.expert ?? 0) >= 1
    : tagged.length >= 8;
  if (!ok) teamFail += 1;
  console.log(
    `  ${ok ? "✓" : "✗"} ${id}: tagged ${tagged.length}, challenge ${challenge.length}` +
      (current
        ? ` (E${difficulty.easy ?? 0}/M${difficulty.medium ?? 0}/H${difficulty.hard ?? 0}/V${difficulty["very-hard"] ?? 0}/X${difficulty.expert ?? 0})`
        : " (historic / millionaire only)")
  );
}

const rejects = audit.filter((finding) => finding.severity === "reject");
const flags = audit.filter((finding) => finding.severity === "flag");
console.log(`Content audit — rejected: ${rejects.length}, flagged: ${flags.length}`);
for (const finding of [...rejects, ...flags.slice(0, 24)]) {
  console[finding.severity === "reject" ? "error" : "warn"](
    `  ${finding.severity.toUpperCase()} ${finding.id}: ${finding.reason}`
  );
}

if (issues.length) {
  console.error(`Validation issues: ${issues.length}`);
  for (const issue of issues.slice(0, 30)) {
    console.error(`  ${issue.id}: ${issue.message}`);
  }
  process.exit(1);
}

if (rejects.length) {
  console.error(`${rejects.length} questions failed the content audit`);
  process.exit(1);
}

if (summary.total < 500) {
  console.error(`Need at least 500 questions, found ${summary.total}`);
  process.exit(1);
}

if (teamFail > 0) {
  console.error(
    `${teamFail} teams lack the required Team Challenge or millionaire coverage`
  );
  process.exit(1);
}

console.log("Quiz bank OK");
