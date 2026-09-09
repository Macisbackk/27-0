import { isEligibleMiniGameQuizTeamId } from "@/lib/mini-games/eligibility";
import { createRng, shuffledCopy } from "./rng";
import type { QuizCategory, QuizDifficulty, QuizQuestion, QuizTeamId } from "./types";
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
  ["very-hard"],
  ["very-hard"],
  ["expert"],
];

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

function bandCandidates(
  source: readonly QuizQuestion[],
  band: readonly QuizDifficulty[],
  usedIds: ReadonlySet<string>
): QuizQuestion[] {
  const preferred = source.filter(
    (question) => band.includes(question.difficulty) && !usedIds.has(question.id)
  );
  if (preferred.length > 0) return preferred;
  return source.filter((question) => !usedIds.has(question.id));
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
        : "Not enough Super League Millionaire questions"
    );
  }

  const recentIds = new Set(options.recentIds ?? []);
  const recentTopics = new Set(options.recentTopicIds ?? []);
  const usedIds = new Set<string>();
  const usedTopics = new Set<string>();
  const usedFamilies = new Set<string>();
  const usedCategories = new Set<QuizCategory>();
  const categoryCounts = new Map<QuizCategory, number>();
  const selected: QuizQuestion[] = [];

  for (let index = 0; index < QUIZ_QUESTION_COUNT; index++) {
    const band = QUESTION_DIFFICULTY_BANDS[index] ?? ["medium"];
    let candidates = bandCandidates(source, band, usedIds);
    const previous = selected[selected.length - 1];
    if (
      previous &&
      candidates.some((question) => question.category !== previous.category)
    ) {
      candidates = candidates.filter(
        (question) => question.category !== previous.category
      );
    }
    if (
      previous &&
      candidates.some(
        (question) =>
          topicFamily(question.topicId) !== topicFamily(previous.topicId)
      )
    ) {
      candidates = candidates.filter(
        (question) =>
          topicFamily(question.topicId) !== topicFamily(previous.topicId)
      );
    }
    if (
      options.mode === "millionaire" &&
      previous &&
      primaryTeam(previous) &&
      candidates.some(
        (question) => primaryTeam(question) !== primaryTeam(previous)
      )
    ) {
      candidates = candidates.filter(
        (question) => primaryTeam(question) !== primaryTeam(previous)
      );
    }
    const pool = shuffledCopy(candidates, rng);
    const pick =
      pickWeighted(pool, (question) =>
        scoreCandidate({
          question,
          previous: selected,
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

    selected.push(pick);
    usedIds.add(pick.id);
    usedTopics.add(pick.topicId);
    usedFamilies.add(topicFamily(pick.topicId));
    usedCategories.add(pick.category);
    categoryCounts.set(pick.category, (categoryCounts.get(pick.category) ?? 0) + 1);
  }

  return selected;
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
