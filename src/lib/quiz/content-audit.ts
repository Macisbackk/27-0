import { isEligibleMiniGameQuizTeamId } from "@/lib/mini-games/eligibility";
import { isObviousTeamChallengeAnswer, topicFamily } from "./selection";
import { normalizeQuestionStem, stemSimilarity } from "./validate";
import type { QuizQuestion, QuizTeamId } from "./types";

export type QuizAuditSeverity = "reject" | "flag";

export interface QuizAuditFinding {
  id: string;
  severity: QuizAuditSeverity;
  reason: string;
}

const SUBJECTIVE_STEM =
  /\b(who led|who was the most important|who was the greatest|who was the key|who was the star|who was the main reason|who was the best|who inspired|who was the most influential|who is considered|mainstay|major figure|central to|legend at|super league star)\b/i;

const GENERIC_RIVALRY_STEM =
  /which (two )?(clubs?|teams?|sides?).*(derby|rival)|who (are|is) .{0,40}(main |local )?rival|traditional local rivals/i;

export function isSubjectiveQuestion(question: QuizQuestion): boolean {
  if (question.answerType === "subjective") return true;
  if (question.answerType === "objective") {
    return SUBJECTIVE_STEM.test(question.question);
  }
  return SUBJECTIVE_STEM.test(question.question);
}

export function isGenericRivalryQuestion(question: QuizQuestion): boolean {
  const stem = question.question.toLowerCase();
  if (!GENERIC_RIVALRY_STEM.test(stem) && !/\b(derby|local rival)\b/.test(stem)) {
    return false;
  }
  if (/\b(19|20)\d{2}\b/.test(stem)) return false;
  if (/\b(score|final|trophy|first meeting|record|commonly called|good friday)\b/.test(stem)) {
    return false;
  }
  return GENERIC_RIVALRY_STEM.test(stem);
}

export function auditQuestionBank(questions: readonly QuizQuestion[]): QuizAuditFinding[] {
  const findings: QuizAuditFinding[] = [];
  const byTopic = new Map<string, string>();
  const byFact = new Map<string, string>();
  const byStem = new Map<string, string>();
  const byAnswerKey = new Map<string, string[]>();

  for (const question of questions) {
    if (question.topicId) {
      const existingTopic = byTopic.get(question.topicId);
      if (existingTopic) {
        findings.push({
          id: question.id,
          severity: "reject",
          reason: `Duplicate topicId ${question.topicId} (also ${existingTopic})`,
        });
      } else {
        byTopic.set(question.topicId, question.id);
      }
    }

    const family = topicFamily(question.topicId);
    const existingFact = byFact.get(family);
    if (
      existingFact &&
      family !== question.topicId &&
      (family.startsWith("stadium:") || family.startsWith("record:"))
    ) {
      findings.push({
        id: question.id,
        severity: "flag",
        reason: `Same underlying fact family ${family} as ${existingFact}`,
      });
    } else if (!existingFact) {
      byFact.set(family, question.id);
    }

    const stem = normalizeQuestionStem(question.question);
    const existingStem = byStem.get(stem);
    if (existingStem) {
      findings.push({
        id: question.id,
        severity: "reject",
        reason: `Duplicate wording (same as ${existingStem})`,
      });
    } else {
      byStem.set(stem, question.id);
    }

    const answerKey = `${family}::${question.correctAnswer.trim().toLowerCase()}`;
    const answerIds = byAnswerKey.get(answerKey) ?? [];
    answerIds.push(question.id);
    byAnswerKey.set(answerKey, answerIds);

    if (isSubjectiveQuestion(question)) {
      findings.push({
        id: question.id,
        severity: "reject",
        reason: "Subjective or ambiguous wording",
      });
    }

    if (isGenericRivalryQuestion(question)) {
      findings.push({
        id: question.id,
        severity: "reject",
        reason: "Generic derby/rivalry fact",
      });
    }

    for (const team of question.teams) {
      if (!isEligibleMiniGameQuizTeamId(team)) continue;
      if (isObviousTeamChallengeAnswer(question, team)) {
        findings.push({
          id: question.id,
          severity: "flag",
          reason: `Team Challenge giveaway for ${team}`,
        });
      }
    }
  }

  for (const [key, ids] of byAnswerKey) {
    if (ids.length < 2) continue;
    if (!key.startsWith("stadium:") && !key.startsWith("record:")) continue;
    findings.push({
      id: ids[1]!,
      severity: "flag",
      reason: `Duplicate answer for the same statistic (${ids.join(", ")})`,
    });
  }

  for (let i = 0; i < questions.length; i++) {
    const left = questions[i];
    if (!left) continue;
    for (let j = i + 1; j < questions.length; j++) {
      const right = questions[j];
      if (!right) continue;
      if (left.topicId === right.topicId) continue;
      if (stemSimilarity(left.question, right.question) >= 0.86) {
        findings.push({
          id: left.id,
          severity: "flag",
          reason: `Near-identical wording to ${right.id}`,
        });
      }
    }
  }

  return findings;
}

export function teamChallengePool(
  questions: readonly QuizQuestion[],
  teamId: QuizTeamId
): QuizQuestion[] {
  return questions.filter(
    (question) =>
      question.teams.includes(teamId) &&
      !isObviousTeamChallengeAnswer(question, teamId) &&
      !isGenericRivalryQuestion(question) &&
      !isSubjectiveQuestion(question)
  );
}
