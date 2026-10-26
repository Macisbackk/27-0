/**
 * Validate the Quiz Mode question bank.
 * Run: npx tsx scripts/validate-quiz-bank.ts
 */
import { isEligibleMiniGameQuizTeamId } from "../src/lib/mini-games/eligibility";
import { CURATED_QUIZ_QUESTIONS } from "../data/quiz/curated";
import { VARIETY_QUESTIONS } from "../data/quiz/variety-2026-10";
import { getQuizQuestionBank, summarizeQuestionBank } from "../src/lib/quiz/bank";
import { auditQuestionBank, teamChallengePool } from "../src/lib/quiz/content-audit";
import { QUIZ_TEAM_IDS } from "../src/lib/quiz/types";
import {
  answerPositionShares,
  questionsMissingSource,
  validateQuestionBank,
} from "../src/lib/quiz/validate";
import {
  FINAL_QUESTION_DIFFICULTIES,
  LEADING_DIFFICULTY_QUOTA,
} from "../src/lib/quiz/selection";
import { QUIZ_DIFFICULTIES } from "../src/lib/quiz/types";

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

// Stored answer slots: within 5 percentage points of an even 25% each.
const shares = answerPositionShares(bank);
const slotLine = shares
  .map((share, index) => `${"ABCD"[index]} ${(share * 100).toFixed(1)}%`)
  .join(", ");
const slotsOk = shares.every((share) => Math.abs(share - 0.25) <= 0.05);
console.log(`Answer slots: ${slotLine} ${slotsOk ? "✓" : "✗ (must be 20–30% each)"}`);

// Every tier stocked for at least ten Golden Point Quiz runs without a repeat.
const RUNS_WITHOUT_REPEAT = 10;
let tierFail = 0;
for (const difficulty of QUIZ_DIFFICULTIES) {
  const have = bank.filter((question) => question.difficulty === difficulty).length;
  const need = LEADING_DIFFICULTY_QUOTA[difficulty] * RUNS_WITHOUT_REPEAT;
  const ok = have >= need;
  if (!ok) tierFail += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${difficulty}: ${have} (need ${need})`);
}
const finalPool = bank.filter((question) =>
  FINAL_QUESTION_DIFFICULTIES.includes(question.difficulty)
).length;
const finalNeed = 150;
if (finalPool < finalNeed) tierFail += 1;
console.log(`  ${finalPool >= finalNeed ? "✓" : "✗"} win-question pool (hard+): ${finalPool} (need ${finalNeed})`);

// Hand-authored files must not reuse an id (the bank loader would silently drop one).
const authored = [...CURATED_QUIZ_QUESTIONS, ...VARIETY_QUESTIONS];
const authoredIds = new Map<string, number>();
for (const question of authored) {
  authoredIds.set(question.id, (authoredIds.get(question.id) ?? 0) + 1);
}
const duplicateAuthoredIds = [...authoredIds.entries()].filter(([, count]) => count > 1);
for (const [id] of duplicateAuthoredIds) console.error(`  duplicate authored id: ${id}`);
const shadowedAuthored = authored.filter(
  (question) => !bank.some((loaded) => loaded.id === question.id)
);
for (const question of shadowedAuthored) {
  console.error(`  authored question dropped by topic dedupe: ${question.id} (${question.topicId})`);
}
if (duplicateAuthoredIds.length > 0 || shadowedAuthored.length > 0) {
  console.error("Hand-authored questions are duplicated or shadowed");
  process.exit(1);
}

const unsourced = questionsMissingSource(bank);
console.log(
  `Sources: ${bank.filter((question) => question.source).length}/${bank.length} questions carry a source URL; ` +
    `${unsourced.length} new/generated questions missing one`
);
for (const question of unsourced.slice(0, 10)) {
  console.error(`  missing source: ${question.id}`);
}

if (!slotsOk) {
  console.error("Correct answers are not spread evenly across A–D");
  process.exit(1);
}
if (tierFail > 0) {
  console.error(`${tierFail} difficulty tiers are under-stocked for the ladder`);
  process.exit(1);
}
if (unsourced.length > 0) {
  console.error(`${unsourced.length} new or generated questions have no source`);
  process.exit(1);
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
