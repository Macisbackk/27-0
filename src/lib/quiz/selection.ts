import { isEligibleMiniGameQuizTeamId } from "@/lib/mini-games/eligibility";
import { createRng, shuffledCopy } from "./rng";
import type { QuizCategory, QuizDifficulty, QuizQuestion, QuizTeamId } from "./types";
import { QUIZ_DIFFICULTIES, QUIZ_QUESTION_COUNT } from "./types";

/** Final (Q15) must be hard-tier so the win question stays tough. */
export const FINAL_QUESTION_DIFFICULTIES: QuizDifficulty[] = [
  "hard",
  "very-hard",
  "expert",
];

/** @deprecated Kept for callers that still import the old ladder shape. */
export const QUESTION_DIFFICULTY_BANDS: QuizDifficulty[][] = Array.from(
  { length: QUIZ_QUESTION_COUNT },
  (_, index) =>
    index === QUIZ_QUESTION_COUNT - 1
      ? FINAL_QUESTION_DIFFICULTIES
      : [...QUIZ_DIFFICULTIES]
);

const CATEGORY_SOFT_CAPS: Partial<Record<QuizCategory, number>> = {
  stadiums: 3,
  "grand-finals": 4,
  "challenge-cup": 4,
  players: 5,
};

export function topicFamily(topicId: string): string {
  const parts = topicId.split(":");
  if (parts[0] === "stadium" && parts[1]) {
    return `stadium:${parts[1]}`;
  }
  if (parts[0] === "record" && parts[1] && parts[2]) {
    return `record:${parts[1]}:${parts[2]}`;
  }
  if (parts[0] === "history" || parts[0] === "squad") {
    return parts.slice(0, 2).join(":");
  }
  if (parts[0] === "final") {
    return parts.slice(0, 3).join(":");
  }
  // One Man of Steel / Lance Todd / Golden Boot / Dream Team stem per run.
  if (parts[0] === "honour" && parts[1]) {
    return `honour:${parts[1]}`;
  }
  if (parts[0] === "curated") {
    return topicId;
  }
  return topicId;
}

export function filterTeamChallengeQuestions(
  questions: readonly QuizQuestion[],
  teamId: QuizTeamId
): QuizQuestion[] {
  return questions.filter((question) => {
    if (!question.teams.includes(teamId)) return false;
    if (question.answerType === "subjective") return false;
    if (isGenericTeamChallengeQuestion(question)) return false;
    return !isObviousTeamChallengeAnswer(question, teamId);
  });
}

const SUBJECTIVE_TEAM_STEM =
  /\b(who led|who was the most important|who was the greatest|who was the key|who was the star|who was the main reason|who was the best|who inspired|who was the most influential|who is considered|mainstay|major figure|central to)\b/i;

const GENERIC_RIVALRY_STEM =
  /which (two )?(clubs?|teams?|sides?).*(derby|rival)|who (are|is) .{0,40}(main |local )?rival|traditional local rivals/i;

export function isGenericTeamChallengeQuestion(question: QuizQuestion): boolean {
  const stem = question.question.toLowerCase();
  if (SUBJECTIVE_TEAM_STEM.test(stem)) return true;
  if (!GENERIC_RIVALRY_STEM.test(stem)) return false;
  if (/\b(19|20)\d{2}\b/.test(stem)) return false;
  if (/\b(score|final|trophy|first meeting|record|commonly called|good friday)\b/.test(stem)) {
    return false;
  }
  return true;
}

/**
 * Team Challenge must not ask a question whose answer is handed over by
 * selecting the club (winner, home stadium occupant, nickname-as-club).
 */
export function isObviousTeamChallengeAnswer(
  question: QuizQuestion,
  teamId: QuizTeamId
): boolean {
  const answer = question.correctAnswer.trim().toLowerCase();
  const clubNames = teamChallengeAliases(teamId);
  const answerIsSelectedClub = clubNames.some(
    (name) => answer === name || answer.startsWith(`${name} and `) || answer.endsWith(` and ${name}`)
  );
  const stem = question.question.toLowerCase();

  if (
    answerIsSelectedClub &&
    (/which (club|team|side|of these clubs)/.test(stem) ||
      /who won/.test(stem) ||
      /associated with/.test(stem) ||
      /based at/.test(stem) ||
      /plays? (its |their )?(home )?(matches )?at/.test(stem) ||
      /which club is that/.test(stem))
  ) {
    return true;
  }

  if (!answerIsSelectedClub) return false;

  const optionClubs = question.options.filter(
    (option) =>
      clubNames.some((name) => option.trim().toLowerCase() === name) ||
      /bulls|tigers|dragons|giants|rhinos|leopards|warriors|wolves|kr|fc|trinity|knights|olympique|saints|helens/i.test(
        option
      )
  );
  return optionClubs.length >= 3;
}

function teamChallengeAliases(teamId: QuizTeamId): string[] {
  const aliases: Record<string, string[]> = {
    bradford: ["bradford bulls", "bradford"],
    castleford: ["castleford tigers", "castleford"],
    catalans: ["catalans dragons", "catalans"],
    huddersfield: ["huddersfield giants", "huddersfield"],
    "hull-fc": ["hull fc", "hull"],
    "hull-kr": ["hull kr", "hull kingston rovers"],
    leeds: ["leeds rhinos", "leeds"],
    leigh: ["leigh leopards", "leigh"],
    london: ["london broncos", "london"],
    salford: ["salford red devils", "salford"],
    "st-helens": ["st helens", "st. helens", "saints"],
    toulouse: ["toulouse olympique", "toulouse"],
    wakefield: ["wakefield trinity", "wakefield"],
    warrington: ["warrington wolves", "warrington"],
    widnes: ["widnes vikings", "widnes"],
    wigan: ["wigan warriors", "wigan"],
    york: ["york knights", "york"],
  };
  return aliases[teamId] ?? [teamId];
}

export function filterMillionaireQuestions(
  questions: readonly QuizQuestion[]
): QuizQuestion[] {
  return [...questions];
}

function primaryTeam(question?: QuizQuestion): QuizTeamId | null {
  return question?.teams[0] ?? null;
}

function scoreCandidate(options: {
  question: QuizQuestion;
  previous: readonly QuizQuestion[];
  recentIds: ReadonlySet<string>;
  recentTopics: ReadonlySet<string>;
  usedTopics: ReadonlySet<string>;
  usedFamilies: ReadonlySet<string>;
  categoryCounts: Map<QuizCategory, number>;
  usedCategories: ReadonlySet<QuizCategory>;
  mode: "millionaire" | "team";
  rng: () => number;
}): number {
  const {
    question,
    previous,
    recentIds,
    recentTopics,
    usedTopics,
    usedFamilies,
    categoryCounts,
    usedCategories,
    mode,
    rng,
  } = options;

  let score = 40 + rng() * 20;

  if (recentIds.has(question.id)) score -= 55;
  if (recentTopics.has(question.topicId)) score -= 70;
  if (usedTopics.has(question.topicId)) score -= 1000;
  if (usedFamilies.has(topicFamily(question.topicId))) score -= 45;

  const prev = previous[previous.length - 1];
  const prev2 = previous[previous.length - 2];
  if (prev?.category === question.category) score -= 35;
  if (prev2?.category === question.category) score -= 18;
  if (!usedCategories.has(question.category)) score += 12;

  const cap = CATEGORY_SOFT_CAPS[question.category];
  const count = categoryCounts.get(question.category) ?? 0;
  if (cap !== undefined && count >= cap) score -= 40;

  if (mode === "millionaire") {
    const team = primaryTeam(question);
    if (team && primaryTeam(prev) === team) score -= 22;
  }

  return score;
}

function pickWeighted(
  candidates: QuizQuestion[],
  scoreFor: (question: QuizQuestion) => number
): QuizQuestion | null {
  if (candidates.length === 0) return null;
  let best: QuizQuestion | null = null;
  let bestScore = -Infinity;
  for (const question of candidates) {
    const score = scoreFor(question);
    if (score > bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Difficulty mix for the 14 questions before the win question. The order is shuffled
 * afterwards (the ladder is deliberately not easy-to-hard), but every run gets the same
 * spread instead of mirroring the bank's skew towards "hard".
 */
export const LEADING_DIFFICULTY_QUOTA: Record<QuizDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 4,
  "very-hard": 2,
  expert: 1,
};

/** Hard per-run cap on one category; the soft caps above still bite earlier. */
export const CATEGORY_HARD_CAP = 4;
/** In the Golden Point Quiz a single club is the subject of at most this many questions. */
export const TEAM_HARD_CAP = 2;

const DIFFICULTY_FALLBACK: Record<QuizDifficulty, QuizDifficulty[]> = {
  easy: ["easy", "medium", "hard", "very-hard", "expert"],
  medium: ["medium", "easy", "hard", "very-hard", "expert"],
  hard: ["hard", "medium", "very-hard", "expert", "easy"],
  "very-hard": ["very-hard", "hard", "expert", "medium", "easy"],
  expert: ["expert", "very-hard", "hard", "medium", "easy"],
};

function bandCandidates(
  source: readonly QuizQuestion[],
  band: readonly QuizDifficulty[],
  usedIds: ReadonlySet<string>
): QuizQuestion[] {
  const unused = source.filter((question) => !usedIds.has(question.id));
  // Walk outwards from the wanted tier so a thin tier borrows from its neighbour first.
  const order = band.length === 1 ? DIFFICULTY_FALLBACK[band[0]!] : [band];
  for (const tier of order) {
    const tiers = Array.isArray(tier) ? tier : [tier];
    const preferred = unused.filter((question) => tiers.includes(question.difficulty));
    if (preferred.length > 0) return preferred;
  }
  return unused;
}

/** Keep only the candidates that pass `keep`, unless that would leave none. */
function preferWhere(
  candidates: QuizQuestion[],
  keep: (question: QuizQuestion) => boolean
): QuizQuestion[] {
  const kept = candidates.filter(keep);
  return kept.length > 0 ? kept : candidates;
}

function sharesTeam(a: QuizQuestion, b: QuizQuestion): boolean {
  return a.teams.some((team) => b.teams.includes(team));
}

/** True when two questions should not be asked back to back. */
export function questionsClash(
  a: QuizQuestion,
  b: QuizQuestion,
  mode: "millionaire" | "team"
): boolean {
  if (a.category === b.category) return true;
  if (topicFamily(a.topicId) === topicFamily(b.topicId)) return true;
  // Team Challenge is all one club by design; only the Golden Point Quiz spreads clubs.
  return mode === "millionaire" && sharesTeam(a, b);
}

/**
 * Order the leading questions so neighbours differ in category, topic family and (in the
 * Golden Point Quiz) club, ending next to the fixed win question. Greedy with a seeded
 * random pick among the non-clashing questions; falls back to the least-clashing one.
 */
export function arrangeForVariety(
  leading: readonly QuizQuestion[],
  finalQuestion: QuizQuestion | null,
  mode: "millionaire" | "team",
  rng: () => number
): QuizQuestion[] {
  const clashScore = (q: QuizQuestion, prev?: QuizQuestion, next?: QuizQuestion) => {
    let score = 0;
    for (const other of [prev, next]) {
      if (!other) continue;
      if (other.category === q.category) score += 4;
      if (topicFamily(other.topicId) === topicFamily(q.topicId)) score += 4;
      if (mode === "millionaire" && sharesTeam(other, q)) score += 2;
    }
    return score;
  };

  let best: QuizQuestion[] = [];
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 12 && bestScore > 0; attempt++) {
    const remaining = shuffledCopy([...leading], rng);
    const ordered: QuizQuestion[] = [];
    while (remaining.length > 0) {
      const prev = ordered[ordered.length - 1];
      const isLast = remaining.length === 1;
      let pickIndex = -1;
      let pickScore = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;
        const score = clashScore(
          candidate,
          prev,
          isLast && finalQuestion ? finalQuestion : undefined
        );
        if (score < pickScore) {
          pickScore = score;
          pickIndex = i;
          if (score === 0) break;
        }
      }
      ordered.push(remaining.splice(pickIndex, 1)[0]!);
    }
    const sequence = finalQuestion ? [...ordered, finalQuestion] : ordered;
    let total = 0;
    for (let i = 1; i < sequence.length; i++) {
      total += clashScore(sequence[i]!, sequence[i - 1]);
    }
    if (total < bestScore) {
      bestScore = total;
      best = ordered;
    }
  }
  return best;
}

export function selectQuizQuestions(options: {
  questions: readonly QuizQuestion[];
  mode: "millionaire" | "team";
  teamId?: QuizTeamId | null;
  recentIds?: readonly string[];
  recentTopicIds?: readonly string[];
  seed: string;
}): QuizQuestion[] {
  const rng = createRng(`${options.seed}:select`);
  if (
    options.mode === "team" &&
    (!options.teamId || !isEligibleMiniGameQuizTeamId(options.teamId))
  ) {
    throw new Error("Team Challenge is limited to current Super League clubs");
  }
  const source =
    options.mode === "team" && options.teamId
      ? filterTeamChallengeQuestions(options.questions, options.teamId)
      : filterMillionaireQuestions(options.questions);

  if (source.length < QUIZ_QUESTION_COUNT) {
    throw new Error(
      options.mode === "team"
        ? `Not enough Team Challenge questions for ${options.teamId}`
        : "Not enough Golden Point Quiz questions"
    );
  }

  const recentIds = new Set(options.recentIds ?? []);
  const recentTopics = new Set(options.recentTopicIds ?? []);
  const usedIds = new Set<string>();
  const usedTopics = new Set<string>();
  const usedFamilies = new Set<string>();
  const usedCategories = new Set<QuizCategory>();
  const categoryCounts = new Map<QuizCategory, number>();
  const teamCounts = new Map<QuizTeamId, number>();

  const pickNext = (
    band: readonly QuizDifficulty[],
    previous: readonly QuizQuestion[]
  ): QuizQuestion => {
    let candidates = bandCandidates(source, band, usedIds);
    // Not asked in the last ten runs, when the pool allows it.
    candidates = preferWhere(
      candidates,
      (question) => !recentIds.has(question.id) && !recentTopics.has(question.topicId)
    );
    candidates = preferWhere(candidates, (question) => !usedTopics.has(question.topicId));
    candidates = preferWhere(
      candidates,
      (question) => !usedFamilies.has(topicFamily(question.topicId))
    );
    candidates = preferWhere(
      candidates,
      (question) => (categoryCounts.get(question.category) ?? 0) < CATEGORY_HARD_CAP
    );
    if (options.mode === "millionaire") {
      candidates = preferWhere(candidates, (question) => {
        const team = primaryTeam(question);
        return !team || (teamCounts.get(team) ?? 0) < TEAM_HARD_CAP;
      });
    }
    const prior = previous[previous.length - 1];
    if (prior) {
      candidates = preferWhere(
        candidates,
        (question) => question.category !== prior.category
      );
      candidates = preferWhere(
        candidates,
        (question) => topicFamily(question.topicId) !== topicFamily(prior.topicId)
      );
      if (options.mode === "millionaire") {
        candidates = preferWhere(candidates, (question) => !sharesTeam(question, prior));
      }
    }
    const pool = shuffledCopy(candidates, rng);
    const pick =
      pickWeighted(pool, (question) =>
        scoreCandidate({
          question,
          previous,
          recentIds,
          recentTopics,
          usedTopics,
          usedFamilies,
          categoryCounts,
          usedCategories,
          mode: options.mode,
          rng,
        })
      ) ?? pool[0];

    if (!pick) {
      throw new Error("Could not fill a 15-question quiz run");
    }

    usedIds.add(pick.id);
    usedTopics.add(pick.topicId);
    usedFamilies.add(topicFamily(pick.topicId));
    usedCategories.add(pick.category);
    categoryCounts.set(pick.category, (categoryCounts.get(pick.category) ?? 0) + 1);
    const team = primaryTeam(pick);
    if (team) teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
    return pick;
  };

  // Lock the win question as hard-tier first, then fill to the difficulty quota.
  const finalQuestion = pickNext(FINAL_QUESTION_DIFFICULTIES, []);
  const targets = shuffledCopy(
    (Object.entries(LEADING_DIFFICULTY_QUOTA) as [QuizDifficulty, number][]).flatMap(
      ([difficulty, count]) => Array.from({ length: count }, () => difficulty)
    ),
    rng
  );
  const leading: QuizQuestion[] = [];
  for (let index = 0; index < QUIZ_QUESTION_COUNT - 1; index++) {
    const target = targets[index] ?? "medium";
    leading.push(pickNext([target], leading));
  }

  return [...arrangeForVariety(leading, finalQuestion, options.mode, rng), finalQuestion];
}

export function selectReplacementQuestion(options: {
  questions: readonly QuizQuestion[];
  mode: "millionaire" | "team";
  teamId?: QuizTeamId | null;
  excludeIds: ReadonlySet<string>;
  excludeTopics: ReadonlySet<string>;
  recentIds?: readonly string[];
  recentTopicIds?: readonly string[];
  preferredDifficulty?: QuizDifficulty;
  previous?: readonly QuizQuestion[];
  seed: string;
}): QuizQuestion | null {
  const rng = createRng(`${options.seed}:replace`);
  if (
    options.mode === "team" &&
    (!options.teamId || !isEligibleMiniGameQuizTeamId(options.teamId))
  ) {
    return null;
  }
  const source =
    options.mode === "team" && options.teamId
      ? filterTeamChallengeQuestions(options.questions, options.teamId)
      : filterMillionaireQuestions(options.questions);

  const available = source.filter(
    (question) =>
      !options.excludeIds.has(question.id) &&
      !options.excludeTopics.has(question.topicId)
  );
  if (available.length === 0) return null;

  const preferred = options.preferredDifficulty
    ? available.filter((question) => question.difficulty === options.preferredDifficulty)
    : available;
  const pool = preferred.length > 0 ? preferred : available;
  const previous = options.previous ?? [];
  const categoryCounts = new Map<QuizCategory, number>();
  const usedCategories = new Set<QuizCategory>();
  const usedFamilies = new Set<string>();
  for (const question of previous) {
    categoryCounts.set(
      question.category,
      (categoryCounts.get(question.category) ?? 0) + 1
    );
    usedCategories.add(question.category);
    usedFamilies.add(topicFamily(question.topicId));
  }

  return (
    pickWeighted(shuffledCopy(pool, rng), (question) =>
      scoreCandidate({
        question,
        previous,
        recentIds: new Set(options.recentIds ?? []),
        recentTopics: new Set(options.recentTopicIds ?? []),
        usedTopics: options.excludeTopics,
        usedFamilies,
        categoryCounts,
        usedCategories,
        mode: options.mode,
        rng,
      })
    ) ?? pool[0] ??
    null
  );
}
