/**
 * Quiz bank mix report: topic, era, difficulty and question-style breakdown.
 * Run: bun scripts/quiz-mix-report.ts [--before path/to/bank.json]
 * With --before, prints before/after columns (the JSON is an array of QuizQuestion).
 */
import { readFileSync } from "fs";
import { getQuizQuestionBank } from "../src/lib/quiz/bank";
import { answerPositionShares } from "../src/lib/quiz/validate";
import { QUIZ_DIFFICULTIES, type QuizQuestion } from "../src/lib/quiz/types";

export const TOPIC_BUCKETS = [
  "Super League 2026 season",
  "Women's / wheelchair RL",
  "NRL links / Origin / World Club",
  "Internationals / World Cup",
  "Rules / laws",
  "Man of Steel / awards",
  "Grand Finals",
  "Challenge Cup",
  "Records / stats",
  "Coaches",
  "Stadiums",
  "Nicknames / colours",
  "Transfers / career moves",
  "History pre-1996",
  "Clubs / club history",
  "Players / squads",
] as const;
type TopicBucket = (typeof TOPIC_BUCKETS)[number];

const ERA_BUCKETS = [
  "1895–1945",
  "1946–1979",
  "1980–1995",
  "1996–2009",
  "2010–2019",
  "2020–2025",
  "2026",
  "Timeless / undated",
] as const;
type EraBucket = (typeof ERA_BUCKETS)[number];

const STYLE_BUCKETS = [
  "Odd one out (NOT / never)",
  "Which of these…",
  "Which year / season",
  "How many / number",
  "Score",
  "Where / venue",
  "Who (person)",
  "Which club / nation",
  "What (other)",
] as const;
type StyleBucket = (typeof STYLE_BUCKETS)[number];

function yearOf(question: QuizQuestion): number | null {
  const text = `${question.question} ${question.topicId}`;
  const years = [...text.matchAll(/\b(18[89]\d|19\d\d|20[0-2]\d)\b/g)].map((m) => Number(m[1]));
  if (years.length > 0) return Math.min(...years);
  const era = question.era?.match(/(\d{4})s/);
  if (era) return Number(era[1]);
  if (question.era === "pre-1996") return 1980;
  if (question.era === "current") return 2026;
  return null;
}

export function topicBucket(question: QuizQuestion): TopicBucket {
  const stem = question.question;
  const topic = question.topicId;
  const category = question.category;
  if (/\b2026\b/.test(stem) && question.sourceType !== "roster") return "Super League 2026 season";
  if (category === "womens" || category === "wheelchair" || /\bwomen|wheelchair/i.test(stem)) {
    return "Women's / wheelchair RL";
  }
  if (category === "nrl" || /\bNRL\b|State of Origin|Clive Churchill|World Club Challenge/.test(stem)) {
    return "NRL links / Origin / World Club";
  }
  if (
    category === "internationals" ||
    /World Cup|Ashes|Four Nations|Golden Boot|represent in international|England|Great Britain/.test(stem)
  ) {
    return "Internationals / World Cup";
  }
  if (category === "laws" || (category === "general" && /point|minutes|players|interchange|sin bin|extra time|tackle/i.test(stem))) {
    return "Rules / laws";
  }
  if (/^honour:/.test(topic) || /Man of Steel|Lance Todd|Harry Sunderland|Rob Burrow Award|Dream Team/.test(stem)) {
    return "Man of Steel / awards";
  }
  if (category === "grand-finals" || /^final:gf/.test(topic)) return "Grand Finals";
  if (category === "challenge-cup" || /^final:cc/.test(topic)) return "Challenge Cup";
  if (category === "records" || category === "statistics") return "Records / stats";
  if (category === "coaches") return "Coaches";
  if (category === "stadiums" || /^stadium:/.test(topic)) return "Stadiums";
  if (/nickname|known as|known by|colours|commonly called/i.test(stem)) return "Nicknames / colours";
  if (category === "transfers") return "Transfers / career moves";
  const year = yearOf(question);
  if ((category === "history" || category === "seasons") && year !== null && year < 1996) {
    return "History pre-1996";
  }
  if (category === "clubs" || category === "history" || category === "seasons" || category === "general") {
    return "Clubs / club history";
  }
  return "Players / squads";
}

function eraBucket(question: QuizQuestion): EraBucket {
  const year = yearOf(question);
  if (year === null) return "Timeless / undated";
  if (year <= 1945) return "1895–1945";
  if (year <= 1979) return "1946–1979";
  if (year <= 1995) return "1980–1995";
  if (year <= 2009) return "1996–2009";
  if (year <= 2019) return "2010–2019";
  if (year <= 2025) return "2020–2025";
  return "2026";
}

function styleBucket(question: QuizQuestion): StyleBucket {
  const stem = question.question;
  if (/\bNOT\b|\bnever\b/.test(stem)) return "Odd one out (NOT / never)";
  if (/^Which of these\b/i.test(stem)) return "Which of these…";
  if (/\b(which|what) (year|season)\b|^In which (year|season)|\bwhich decade\b/i.test(stem)) {
    return "Which year / season";
  }
  if (/\bscore\b/i.test(stem) && question.options.filter((o) => /\d+[–-]\d+/.test(o)).length >= 2) {
    return "Score";
  }
  if (/\bhow many\b|\bhow much\b|\bwhat (age|attendance)\b|\bhow far\b|\bhow long\b/i.test(stem)) {
    return "How many / number";
  }
  if (/^(Where|At which|In which (city|town|country|part)|Which (ground|stadium|venue|American stadium))\b/i.test(stem)) {
    return "Where / venue";
  }
  if (/^Who\b|\bwhich (player|coach|winger|forward|half-back|full-back|prop|hooker|centre|scrum-half|stand-off|loose forward|captain|[A-Z][a-z]+ (player|winger|forward|half-back|full-back|prop|hooker|centre))/i.test(stem)) {
    return "Who (person)";
  }
  if (/\bwhich (club|nation|side|team|state|Hull club|French club|Cumbrian club|Lancashire club|London club|Catalan club|York side)\b/i.test(stem)) {
    return "Which club / nation";
  }
  return "What (other)";
}

function tally<T extends string>(
  questions: readonly QuizQuestion[],
  buckets: readonly T[],
  pick: (question: QuizQuestion) => T
): Map<T, number> {
  const counts = new Map<T, number>(buckets.map((bucket) => [bucket, 0]));
  for (const question of questions) {
    const bucket = pick(question);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return counts;
}

function pct(count: number, total: number): string {
  return `${count} (${((count / total) * 100).toFixed(1)}%)`;
}

function table<T extends string>(
  title: string,
  buckets: readonly T[],
  pick: (question: QuizQuestion) => T,
  after: readonly QuizQuestion[],
  before?: readonly QuizQuestion[]
): string {
  const a = tally(after, buckets, pick);
  const b = before ? tally(before, buckets, pick) : null;
  const lines = [
    `### ${title}`,
    "",
    b ? "| | Before | After |" : "| | Count |",
    b ? "|---|---:|---:|" : "|---|---:|",
  ];
  for (const bucket of buckets) {
    lines.push(
      b
        ? `| ${bucket} | ${pct(b.get(bucket) ?? 0, before!.length)} | ${pct(a.get(bucket) ?? 0, after.length)} |`
        : `| ${bucket} | ${pct(a.get(bucket) ?? 0, after.length)} |`
    );
  }
  return lines.join("\n");
}

function main(): void {
  const beforeFlag = process.argv.indexOf("--before");
  const before =
    beforeFlag >= 0
      ? (JSON.parse(readFileSync(process.argv[beforeFlag + 1]!, "utf8")) as QuizQuestion[])
      : undefined;
  const after = getQuizQuestionBank();

  const out: string[] = [];
  out.push(`Questions: ${before ? `${before.length} before, ` : ""}${after.length}${before ? " after" : ""}`);
  out.push("");
  out.push(table("Topic", TOPIC_BUCKETS, topicBucket, after, before));
  out.push("");
  out.push(table("Era (earliest year the question is about)", ERA_BUCKETS, eraBucket, after, before));
  out.push("");
  out.push(table("Difficulty", QUIZ_DIFFICULTIES, (q) => q.difficulty, after, before));
  out.push("");
  out.push(table("Question style", STYLE_BUCKETS, styleBucket, after, before));
  out.push("");
  const slots = (bank: readonly QuizQuestion[]) =>
    answerPositionShares(bank)
      .map((share, i) => `${"ABCD"[i]} ${(share * 100).toFixed(1)}%`)
      .join(", ");
  out.push("### Stored answer slot");
  out.push("");
  if (before) out.push(`- Before: ${slots(before)}`);
  out.push(`- After: ${slots(after)}`);
  console.log(out.join("\n"));
}

main();
