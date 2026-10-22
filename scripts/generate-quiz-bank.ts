/**
 * Build generated quiz questions from verified tables + historic/current squads.
 * Run: npx tsx scripts/generate-quiz-bank.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  CHALLENGE_CUPS,
  CLUB_HISTORY,
  GOLDEN_BOOT_WINNERS,
  GRAND_FINAL_MAN_OF_MATCH,
  GRAND_FINALS,
  HISTORIC_CHALLENGE_CUP_FINALS,
  HISTORIC_CLUB_IDS,
  LANCE_TODD_WINNERS,
  LEAGUE_LEADERS,
  STADIUMS,
  WORLD_CLUB_CHALLENGES,
  WORLD_CUPS,
  type FinalRecord,
} from "../data/quiz/facts";
import type {
  QuizCategory,
  QuizDifficulty,
  QuizQuestion,
  QuizTeamId,
} from "../src/lib/quiz/types";
import { QUIZ_TEAM_IDS } from "../src/lib/quiz/types";
import {
  loadWikiPlayers,
  WIKI_NATIONS,
  WIKI_SL_CLUBS,
  type WikiPlayer,
} from "./lib/quiz-wiki-infobox";

const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data/quiz/generated/bank.json");

const NAME_TO_ID: Record<string, QuizTeamId> = {
  "Bradford Bulls": "bradford",
  "Castleford Tigers": "castleford",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds",
  "Leigh Leopards": "leigh",
  "London Broncos": "london",
  "Salford Red Devils": "salford",
  "St Helens": "st-helens",
  "Toulouse Olympique": "toulouse",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Widnes Vikings": "widnes",
  "Wigan Warriors": "wigan",
  "York Knights": "york",
};

const POSITION_LABEL: Record<string, string> = {
  FB: "full-back",
  W: "wing",
  C: "centre",
  FE: "stand-off",
  HB: "scrum-half",
  FR: "prop",
  HK: "hooker",
  "2R": "second-row",
  L: "loose forward",
  B: "interchange",
  FULLBACK: "full-back",
  WING: "wing",
  CENTRE: "centre",
  STAND_OFF: "stand-off",
  STAND_HALF: "stand-off",
  SCRUM_HALF: "scrum-half",
  PROP: "prop",
  HOOKER: "hooker",
  SECOND_ROW: "second-row",
  LOOSE_FORWARD: "loose forward",
  HALFBACK: "scrum-half",
};

interface StartingRow {
  club: string;
  year: number;
  squad: { number: number; position: string; name: string }[];
}

interface RosterPlayer {
  name: string;
  club: string;
  position?: string;
  nationality?: string;
}

function clubQuestionName(id: QuizTeamId, year: number, fallback: string): string {
  if (id === "leigh" && year < 2023) return "Leigh";
  if (id === "salford" && year < 2014) return "Salford";
  if (id === "london" && year >= 2006 && year <= 2011) return "London";
  return fallback;
}

function eraForYear(year: number): string {
  if (year >= 2020) return "2020s";
  if (year >= 2010) return "2010s";
  if (year >= 2000) return "2000s";
  return "1990s";
}

function difficultyForYear(year: number, base: QuizDifficulty): QuizDifficulty {
  if (year <= 2004 && base === "easy") return "medium";
  if (year <= 2004 && base === "medium") return "hard";
  if (year >= 2022 && base === "expert") return "hard";
  if (base === "expert" && year % 2 === 0) return "very-hard";
  return base;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function pickDistractors(
  correct: string,
  pool: string[],
  count: number
): string[] {
  const options = unique(pool.filter((name) => name && name !== correct));
  const picked: string[] = [];
  for (const name of options) {
    if (picked.length >= count) break;
    picked.push(name);
  }
  return picked;
}

function makeQuestion(
  id: string,
  question: string,
  correct: string,
  distractors: string[],
  extra: Omit<QuizQuestion, "id" | "question" | "options" | "correctAnswer">
): QuizQuestion | null {
  const variedDistractors = unique(
    distractors.filter((value) => value && value !== correct)
  ).sort((a, b) => stableHash(`${id}:${a}`) - stableHash(`${id}:${b}`));
  const options = [correct, ...variedDistractors].filter(Boolean);
  if (options.length < 4 || !correct) return null;
  const four = options.slice(0, 4) as [string, string, string, string];
  if (!four.includes(correct)) return null;
  if (new Set(four.map((value) => value.toLowerCase())).size !== 4) return null;
  return {
    id,
    question,
    options: four,
    correctAnswer: correct,
    ...extra,
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isTeamId(value: string): value is QuizTeamId {
  return (QUIZ_TEAM_IDS as readonly string[]).includes(value);
}

function buildFinalsQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  const expand = (
    records: FinalRecord[],
    competition: "Super League Grand Final" | "Challenge Cup final",
    category: QuizCategory,
    prefix: string
  ) => {
    const winners = unique(records.map((record) => record.winnerName));

    for (const record of records) {
      const winnerTeams = isTeamId(record.winnerId) ? [record.winnerId] : [];
      const yearDiff = difficultyForYear(
        record.year,
        record.year >= 2018 ? "easy" : record.year >= 2010 ? "medium" : "hard"
      );

      questions.push(
        makeQuestion(
          `${prefix}-winner-${record.year}`,
          `Which club won the ${record.year} ${competition}?`,
          record.winnerName,
          pickDistractors(record.winnerName, winners, 6),
          {
            topicId: `final:${prefix}:${record.year}`,
            difficulty: yearDiff,
            category,
            teams: winnerTeams,
            era: eraForYear(record.year),
            sourceType: "finals",
            answerType: "objective",
          }
        )!
      );
    }
  };

  expand(GRAND_FINALS, "Super League Grand Final", "grand-finals", "gf");
  expand(CHALLENGE_CUPS, "Challenge Cup final", "challenge-cup", "cc");

  for (const record of GRAND_FINALS) {
    if (!record.score) continue;
    const winnerTeams = isTeamId(record.winnerId) ? [record.winnerId] : [];
    const runnerTeams = isTeamId(record.runnerUpId) ? [record.runnerUpId] : [];
    const scores = unique(
      GRAND_FINALS.map((row) => row.score).filter((value): value is string => Boolean(value))
    );
    questions.push(
      makeQuestion(
        `gf-score-${record.year}`,
        `What was the score in the ${record.year} Super League Grand Final?`,
        record.score,
        pickDistractors(record.score, scores, 6),
        {
          topicId: `final:gf:${record.year}:score`,
          difficulty: record.year >= 2020 ? "medium" : "hard",
          category: "grand-finals",
          teams: [...winnerTeams, ...runnerTeams],
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )!
    );
  }

  const llsNames = unique(LEAGUE_LEADERS.map((row) => row.name));
  for (const row of LEAGUE_LEADERS) {
    // 2013 is already asked as "In which year did Huddersfield win the League Leaders' Shield?".
    if (row.year === 2013) continue;
    questions.push(
      makeQuestion(
        `lls-winner-${row.year}`,
        `Which club won the Super League League Leaders' Shield in ${row.year}?`,
        row.name,
        pickDistractors(row.name, llsNames, 6),
        {
          topicId: `league-leaders:${row.year}`,
          difficulty: row.year >= 2021 ? "medium" : "hard",
          category: "records",
          teams: [row.id],
          era: eraForYear(row.year),
          sourceType: "records",
          answerType: "objective",
        }
      )!
    );
  }

  return questions.filter((question): question is QuizQuestion => Boolean(question));
}

/** Same club under a different era name ("Wigan" / "Wigan Warriors") counts as one option. */
function clubKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(warriors|rhinos|bulls|vikings|wolves|giants|tigers|dragons|leopards|centurions|red devils|city reds|northern|broncos|eagles|olympique|trinity|knights)\b/g, "")
    .replace(/\bkingston rovers\b/, "kr")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Up to `count` distractors, nearest in time first. `rows` give a year and candidate names;
 * anything equal to (or the same club as) an excluded name is skipped.
 */
function nearestByYear(
  year: number,
  rows: { year: number; names: string[] }[],
  exclude: string[],
  count: number,
  key: (value: string) => string = (value) => value.toLowerCase()
): string[] {
  const banned = new Set(exclude.map(key));
  const sorted = [...rows].sort(
    (a, b) =>
      Math.abs(a.year - year) - Math.abs(b.year - year) ||
      stableHash(`${year}:${a.year}`) - stableHash(`${year}:${b.year}`)
  );
  const picked: string[] = [];
  for (const row of sorted) {
    for (const name of row.names) {
      if (picked.length >= count) return picked;
      const k = key(name);
      if (!name || banned.has(k)) continue;
      banned.add(k);
      picked.push(name);
    }
  }
  return picked;
}

function teamIdsFor(...ids: (string | undefined)[]): QuizTeamId[] {
  return unique(ids.filter((id): id is QuizTeamId => Boolean(id) && isTeamId(id!)));
}

function buildFinalsExtraQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const push = (question: QuizQuestion | null) => {
    if (question) questions.push(question);
  };

  const finalRows = (records: FinalRecord[]) =>
    records.map((record) => ({
      year: record.year,
      names: [record.winnerName, record.runnerUpName],
    }));

  // Runners-up. Skipped years already have a question that names the beaten finalist.
  const gfSkip = new Set([2004, 2005, 2006, 2017, 2019, 2024]);
  for (const record of GRAND_FINALS) {
    if (gfSkip.has(record.year)) continue;
    push(
      makeQuestion(
        `gf-runner-up-${record.year}`,
        `Who did ${record.winnerName} beat in the ${record.year} Super League Grand Final?`,
        record.runnerUpName,
        nearestByYear(record.year, finalRows(GRAND_FINALS), [record.winnerName, record.runnerUpName], 3),
        {
          topicId: `final:gf:${record.year}:runner-up`,
          difficulty:
            record.year >= 2018 ? "medium" : record.year >= 2008 ? "hard" : "very-hard",
          category: "grand-finals",
          teams: teamIdsFor(record.winnerId, record.runnerUpId),
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }

  const ccSkip = new Set([1998, 1999]);
  for (const record of CHALLENGE_CUPS) {
    if (ccSkip.has(record.year)) continue;
    push(
      makeQuestion(
        `cc-runner-up-${record.year}`,
        `Who did ${record.winnerName} beat in the ${record.year} Challenge Cup final?`,
        record.runnerUpName,
        nearestByYear(record.year, finalRows(CHALLENGE_CUPS), [record.winnerName, record.runnerUpName], 3),
        {
          topicId: `final:cc:${record.year}:runner-up`,
          difficulty:
            record.year >= 2018 ? "medium" : record.year >= 2008 ? "hard" : "very-hard",
          category: "challenge-cup",
          teams: teamIdsFor(record.winnerId, record.runnerUpId),
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }

  const ccScoreRows = CHALLENGE_CUPS.filter((record) => record.score).map((record) => ({
    year: record.year,
    names: [record.score!],
  }));
  for (const record of CHALLENGE_CUPS) {
    if (!record.score) continue;
    push(
      makeQuestion(
        `cc-score-${record.year}`,
        `What was the score in the ${record.year} Challenge Cup final, ${record.winnerName} v ${record.runnerUpName}?`,
        record.score,
        nearestByYear(record.year, ccScoreRows, [record.score], 3),
        {
          topicId: `final:cc:${record.year}:score`,
          difficulty:
            record.year >= 2020 ? "hard" : record.year >= 2008 ? "very-hard" : "expert",
          category: "challenge-cup",
          teams: teamIdsFor(record.winnerId, record.runnerUpId),
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }

  const venuePool = [
    "Wembley Stadium",
    "Murrayfield",
    "Twickenham",
    "Millennium Stadium",
    "Old Trafford",
    "Elland Road",
    "Tottenham Hotspur Stadium",
    "Anfield",
  ];
  for (const record of CHALLENGE_CUPS) {
    if (!record.venue) continue;
    // Always offer Wembley, the usual home of the final, as a wrong answer.
    const others = venuePool
      .filter(
        (venue) =>
          venue !== record.venue &&
          venue !== "Wembley Stadium" &&
          // Opened in 2019, so no use as a wrong answer for the Wembley-rebuild years.
          !(record.year < 2019 && venue === "Tottenham Hotspur Stadium")
      )
      .sort(
        (a, b) =>
          stableHash(`ccv:${record.year}:${a}`) - stableHash(`ccv:${record.year}:${b}`)
      );
    push(
      makeQuestion(
        `cc-venue-${record.year}`,
        `At which stadium was the ${record.year} Challenge Cup final played?`,
        record.venue,
        ["Wembley Stadium", ...others.slice(0, 2)],
        {
          topicId: `final:cc:${record.year}:venue`,
          difficulty: record.year >= 2020 ? "hard" : "very-hard",
          category: "stadiums",
          teams: teamIdsFor(record.winnerId, record.runnerUpId),
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }
  for (const record of GRAND_FINALS) {
    if (!record.venue) continue;
    push(
      makeQuestion(
        `gf-venue-${record.year}`,
        `With Old Trafford unavailable, at which ground was the ${record.year} Super League Grand Final played?`,
        record.venue,
        ["Headingley", "Totally Wicked Stadium", "Elland Road"],
        {
          topicId: `final:gf:${record.year}:venue`,
          difficulty: "hard",
          category: "stadiums",
          teams: teamIdsFor(record.winnerId, record.runnerUpId),
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }

  // First Grand Final win (Wigan, Hull KR and Wakefield already have equivalent questions).
  const firstGf = new Map<string, FinalRecord>();
  for (const record of GRAND_FINALS) {
    if (!firstGf.has(record.winnerId)) firstGf.set(record.winnerId, record);
  }
  for (const [id, record] of firstGf) {
    if (id === "wigan" || id === "hull-kr" || id === "wakefield" || !isTeamId(id)) continue;
    const years = GRAND_FINALS.map((row) => String(row.year)).filter(
      (year) => year !== String(record.year)
    );
    push(
      makeQuestion(
        `gf-first-win-${id}`,
        `In which year did ${record.winnerName} win their first Super League Grand Final?`,
        String(record.year),
        nearestByYear(
          record.year,
          years.map((year) => ({ year: Number(year), names: [year] })),
          [String(record.year)],
          3
        ),
        {
          topicId: `record:${id}:first-grand-final`,
          difficulty: "hard",
          category: "grand-finals",
          teams: [id],
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }

  // First Challenge Cup of the Super League era (others are already covered by curated questions).
  const firstCc = new Map<string, FinalRecord>();
  for (const record of CHALLENGE_CUPS) {
    if (!firstCc.has(record.winnerId)) firstCc.set(record.winnerId, record);
  }
  // St Helens left out: their answer (1996) is the first season of the era, so it would be a giveaway.
  const ccFirstAllowed = new Set(["leeds", "bradford", "wigan", "hull-fc", "hull-kr"]);
  for (const [id, record] of firstCc) {
    if (!ccFirstAllowed.has(id) || !isTeamId(id)) continue;
    const rows = CHALLENGE_CUPS.map((row) => ({ year: row.year, names: [String(row.year)] }));
    push(
      makeQuestion(
        `cc-first-sl-era-${id}`,
        `In which year did ${record.winnerName} win their first Challenge Cup of the Super League era (since 1996)?`,
        String(record.year),
        nearestByYear(record.year, rows, [String(record.year)], 3),
        {
          topicId: `record:${id}:first-sl-era-challenge-cup`,
          difficulty: "very-hard",
          category: "challenge-cup",
          teams: [id],
          era: eraForYear(record.year),
          sourceType: "finals",
          answerType: "objective",
        }
      )
    );
  }

  return questions;
}

function buildHistoricChallengeCupQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const rows = HISTORIC_CHALLENGE_CUP_FINALS.map((row) => ({
    year: row.year,
    names: [row.winner, row.runnerUp],
  }));
  for (const final of HISTORIC_CHALLENGE_CUP_FINALS) {
    const winnerTeams = teamIdsFor(HISTORIC_CLUB_IDS[final.winner]);
    const bothTeams = teamIdsFor(HISTORIC_CLUB_IDS[final.winner], HISTORIC_CLUB_IDS[final.runnerUp]);
    const era = `${Math.floor(final.year / 10) * 10}s`;
    const winnerDifficulty: QuizDifficulty =
      final.year >= 1988 ? "hard" : final.year >= 1970 ? "very-hard" : "expert";
    const stem = final.replay
      ? `Which club won the ${final.year} Challenge Cup, after the final was drawn ${final.replay.drawnScore} and replayed at ${final.replay.venue}?`
      : `Which club won the ${final.year} Challenge Cup final?`;
    const winner = makeQuestion(
      `cc-winner-${final.year}`,
      stem,
      final.winner,
      [final.runnerUp, ...nearestByYear(final.year, rows, [final.winner, final.runnerUp], 2, clubKey)],
      {
        topicId: `final:cc:${final.year}`,
        difficulty: winnerDifficulty,
        category: "challenge-cup",
        teams: winnerTeams,
        era,
        sourceType: "finals",
        answerType: "objective",
      }
    );
    if (winner) questions.push(winner);

    if (final.year < 1960 || final.replay) continue;
    const runnerUp = makeQuestion(
      `cc-runner-up-${final.year}`,
      `Who did ${final.winner} beat in the ${final.year} Challenge Cup final?`,
      final.runnerUp,
      nearestByYear(final.year, rows, [final.winner, final.runnerUp], 3, clubKey),
      {
        topicId: `final:cc:${final.year}:runner-up`,
        difficulty: "expert",
        category: "challenge-cup",
        teams: bothTeams,
        era,
        sourceType: "finals",
        answerType: "objective",
      }
    );
    if (runnerUp) questions.push(runnerUp);
  }
  return questions;
}

function buildGrandFinalManOfMatchQuestions(): QuizQuestion[] {
  const squads = JSON.parse(
    readFileSync(join(ROOT, "data/era-starting-17s.json"), "utf8")
  ) as StartingRow[];
  const squadFor = (club: string, year: number) =>
    squads.find((row) => row.club === club && row.year === year)?.squad ?? [];
  const surname = (name: string) => name.trim().split(/\s+/).pop()!.toLowerCase();
  const questions: QuizQuestion[] = [];
  const winnerRows = GRAND_FINAL_MAN_OF_MATCH.map((row) => ({
    year: row.year,
    names: [row.player],
  }));

  for (const row of GRAND_FINAL_MAN_OF_MATCH) {
    const final = GRAND_FINALS.find((record) => record.year === row.year);
    if (!final) continue;
    // Plausible wrong answers: the key playmakers (1, 6, 7, 9, 13) from both finalists' squads.
    const keyNumbers = new Set([1, 6, 7, 9, 13]);
    const squadNames = [
      ...squadFor(final.winnerName, row.year),
      ...squadFor(final.runnerUpName, row.year),
    ]
      .filter((player) => keyNumbers.has(player.number))
      .map((player) => player.name.replace(/\bMc([a-z])/g, (_, letter: string) => `Mc${letter.toUpperCase()}`))
      // Skip mangled scraped names such as "Lauiti'Iti".
      .filter((name) => !/[a-z]'[A-Z]/.test(name))
      .filter((name) => surname(name) !== surname(row.player));
    const fromSquads = unique(squadNames)
      .sort(
        (a, b) =>
          stableHash(`motm:${row.year}:${a}`) - stableHash(`motm:${row.year}:${b}`)
      )
      .slice(0, 3);
    const distractors =
      fromSquads.length >= 3
        ? fromSquads
        : [
            ...fromSquads,
            ...nearestByYear(row.year, winnerRows, [row.player, ...fromSquads], 3 - fromSquads.length),
          ];
    const award = row.year >= 2024 ? "Rob Burrow Award" : "Harry Sunderland Trophy";
    const q = makeQuestion(
      `gf-motm-${row.year}`,
      `Who won the ${award} as man of the match in the ${row.year} Super League Grand Final?`,
      row.player,
      distractors,
      {
        topicId: `honour:harry-sunderland:${row.year}`,
        difficulty:
          row.year >= 2020
            ? "medium"
            : row.year >= 2010
              ? "hard"
              : row.year >= 2004
                ? "very-hard"
                : "expert",
        category: "grand-finals",
        teams: [row.clubId],
        era: eraForYear(row.year),
        sourceType: "honours",
        answerType: "objective",
      }
    );
    if (q) questions.push(q);
  }
  return questions;
}

function buildWorldClubChallengeQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const rows = WORLD_CLUB_CHALLENGES.map((row) => ({
    year: row.year,
    names: [row.winner, row.loser],
  }));
  const isBritish = (name: string) =>
    WORLD_CLUB_CHALLENGES.some((row) => clubKey(row.britishClub) === clubKey(name));

  for (const match of WORLD_CLUB_CHALLENGES) {
    const difficulty: QuizDifficulty =
      match.year >= 2017
        ? "medium"
        : match.year >= 2005
          ? "hard"
          : match.year >= 2000
            ? "very-hard"
            : "expert";
    const era = match.year >= 2000 ? eraForYear(match.year) : `${Math.floor(match.year / 10) * 10}s`;
    const winner = makeQuestion(
      `wcc-winner-${match.year}`,
      `Which club won the ${match.year} World Club Challenge?`,
      match.winner,
      [match.loser, ...nearestByYear(match.year, rows, [match.winner, match.loser], 2, clubKey)],
      {
        topicId: `final:wcc:${match.year}`,
        difficulty,
        category: "records",
        teams: [match.britishId],
        era,
        sourceType: "records",
        answerType: "objective",
      }
    );
    if (winner) questions.push(winner);

    // Which NRL side did the British winner beat? Distractors are other Australian clubs.
    if (clubKey(match.winner) !== clubKey(match.britishClub) || match.year < 2000) continue;
    const nrlRows = rows.map((row) => ({
      year: row.year,
      names: row.names.filter((name) => !isBritish(name)),
    }));
    const opponent = makeQuestion(
      `wcc-opponent-${match.year}`,
      `Which NRL club did ${match.britishClub} beat in the ${match.year} World Club Challenge?`,
      match.loser,
      nearestByYear(match.year, nrlRows, [match.loser], 3, clubKey),
      {
        topicId: `final:wcc:${match.year}:opponent`,
        difficulty: match.year >= 2017 ? "hard" : "very-hard",
        category: "records",
        teams: [match.britishId],
        era,
        sourceType: "records",
        answerType: "objective",
      }
    );
    if (opponent) questions.push(opponent);
  }
  return questions;
}

function buildWorldCupQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const cupName = (year: string) =>
    year === "2021"
      ? "2021 Rugby League World Cup (played in 2022)"
      : `${year} Rugby League World Cup`;
  const winnerDifficulty: Record<string, QuizDifficulty> = {
    "1954": "expert",
    "1957": "expert",
    "1960": "expert",
    "1968": "very-hard",
    "1970": "very-hard",
    "1972": "very-hard",
    "1977": "very-hard",
    "1995": "hard",
    "2000": "hard",
    "2008": "hard",
    "2013": "medium",
    "2017": "medium",
    "2021": "medium",
  };
  for (const cup of WORLD_CUPS) {
    const year = Number(cup.year);
    const era = year >= 2000 ? eraForYear(year) : `${Math.floor(year / 10) * 10}s`;
    // Before 1995 Great Britain played as one team; afterwards England.
    const pool = (year < 1995
      ? ["Australia", "Great Britain", "France", "New Zealand"]
      : ["Australia", "New Zealand", "England", "Samoa", "Tonga", "Papua New Guinea"]
    ).filter((nation) => nation !== cup.winner && nation !== cup.runnerUp);
    const winner = makeQuestion(
      `wc-winner-${cup.year}`,
      `Which nation won the ${cupName(cup.year)}?`,
      cup.winner,
      [cup.runnerUp, ...pool.sort((a, b) => stableHash(`wc:${cup.year}:${a}`) - stableHash(`wc:${cup.year}:${b}`)).slice(0, 2)],
      {
        topicId: `final:wc:${cup.year}`,
        difficulty: winnerDifficulty[cup.year] ?? "hard",
        category: "history",
        teams: [],
        era,
        sourceType: "records",
        answerType: "objective",
      }
    );
    if (winner) questions.push(winner);

    if (cup.finalScore && cup.year !== "1972") {
      const others = (year < 1995
        ? ["Australia", "New Zealand", "Great Britain", "France", "Wales"]
        : ["Australia", "New Zealand", "England", "Samoa", "Tonga", "Papua New Guinea", "Fiji"]
      )
        .filter((nation) => nation !== cup.winner && nation !== cup.runnerUp)
        .sort((a, b) => stableHash(`wcr:${cup.year}:${a}`) - stableHash(`wcr:${cup.year}:${b}`))
        .slice(0, 3);
      const runnerUp = makeQuestion(
        `wc-runner-up-${cup.year}`,
        `Who did ${cup.winner} beat in the final of the ${cupName(cup.year)}?`,
        cup.runnerUp,
        others,
        {
          topicId: `final:wc:${cup.year}:runner-up`,
          difficulty:
            year >= 2013 ? "medium" : year >= 1995 ? "hard" : year >= 1968 ? "very-hard" : "expert",
          category: "history",
          teams: [],
          era,
          sourceType: "records",
          answerType: "objective",
        }
      );
      if (runnerUp) questions.push(runnerUp);
    }

    if (cup.finalVenue && cup.finalVenue !== "Lang Park") {
      const venues = [
        "Old Trafford",
        "Wembley Stadium",
        "Headingley",
        "Elland Road",
        "Anfield",
        "Sydney Cricket Ground",
        "Stade de Gerland",
        "Parc des Princes",
      ].filter((venue) => venue !== cup.finalVenue);
      const venue = makeQuestion(
        `wc-venue-${cup.year}`,
        `Which stadium hosted the final of the ${cupName(cup.year)}?`,
        cup.finalVenue,
        venues
          .sort((a, b) => stableHash(`wcv:${cup.year}:${a}`) - stableHash(`wcv:${cup.year}:${b}`))
          .slice(0, 3),
        {
          topicId: `final:wc:${cup.year}:venue`,
          difficulty: year >= 2021 ? "medium" : year >= 1995 ? "hard" : year >= 1970 ? "very-hard" : "expert",
          category: "stadiums",
          teams: [],
          era,
          sourceType: "records",
          answerType: "objective",
        }
      );
      if (venue) questions.push(venue);
    }
  }
  return questions;
}

/**
 * Player career questions from the cached Wikipedia articles. The right answer comes from the
 * infobox; wrong answers are only clubs / nations the whole article never mentions, so a short
 * spell missing from the infobox can't turn a wrong answer into a right one.
 */
function buildWikiPlayerQuestions(): QuizQuestion[] {
  const squads = JSON.parse(
    readFileSync(join(ROOT, "data/era-starting-17s.json"), "utf8")
  ) as StartingRow[];
  const seasons = new Map<string, number>();
  const firstYear = new Map<string, number>();
  const lastYear = new Map<string, number>();
  const squadTeams = new Map<string, Set<QuizTeamId>>();
  for (const row of squads) {
    const teamId = NAME_TO_ID[row.club];
    for (const player of row.squad) {
      seasons.set(player.name, (seasons.get(player.name) ?? 0) + 1);
      firstYear.set(player.name, Math.min(firstYear.get(player.name) ?? 9999, row.year));
      lastYear.set(player.name, Math.max(lastYear.get(player.name) ?? 0, row.year));
      if (teamId) {
        const set = squadTeams.get(player.name) ?? new Set<QuizTeamId>();
        set.add(teamId);
        squadTeams.set(player.name, set);
      }
    }
  }

  const byId = loadHonourPlayers();
  const famous = new Set<string>();
  const addFamous = (name: string | undefined) => name && famous.add(name.toLowerCase());
  for (const row of LANCE_TODD_WINNERS) addFamous(row.winnerName);
  for (const row of GRAND_FINAL_MAN_OF_MATCH) addFamous(row.player);
  for (const file of ["data/man-of-steel-winners.json", "data/dream-team-years.json"]) {
    const map = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as Record<string, number[]>;
    for (const id of Object.keys(map)) addFamous(byId.get(id)?.name);
  }

  // Index articles by display name; drop names shared by two articles.
  const byName = new Map<string, WikiPlayer[]>();
  for (const player of loadWikiPlayers(ROOT)) {
    const name = player.title.replace(/\s*\(.*\)\s*$/, "").trim();
    const list = byName.get(name) ?? [];
    list.push(player);
    byName.set(name, list);
  }

  type Candidate = {
    name: string;
    player: WikiPlayer;
    clubs: { club: string; teamId: QuizTeamId; appearances: number }[];
    famous: boolean;
    seasons: number;
    score: number;
  };
  const candidates: Candidate[] = [];
  for (const [name, list] of byName) {
    if (list.length !== 1) continue;
    const player = list[0]!;
    const count = seasons.get(name) ?? 0;
    if (count < 2) continue;
    const totals = new Map<string, { club: string; teamId: QuizTeamId; appearances: number }>();
    for (const spell of player.spells) {
      if (spell.loan) continue;
      const entry = totals.get(spell.club) ?? { club: spell.club, teamId: spell.teamId, appearances: 0 };
      entry.appearances += spell.appearances;
      totals.set(spell.club, entry);
    }
    const clubs = [...totals.values()].filter((entry) => entry.appearances >= 10);
    if (clubs.length === 0) continue;
    // Same person check: the article's clubs must include a club from our squad data.
    const known = squadTeams.get(name) ?? new Set<QuizTeamId>();
    if (!clubs.some((entry) => known.has(entry.teamId))) continue;
    const isFamous = famous.has(name.toLowerCase());
    candidates.push({
      name,
      player,
      clubs,
      famous: isFamous,
      seasons: count,
      score: count + (isFamous ? 10 : 0),
    });
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      stableHash(`wiki:${a.name}`) - stableHash(`wiki:${b.name}`)
  );

  // Wrong-answer clubs must have been in Super League during the player's career.
  const slYears = JSON.parse(
    readFileSync(join(ROOT, "data/super-league-club-years.json"), "utf8")
  ) as Record<string, { ranges: [number, number][] }>;
  const slRanges = new Map<QuizTeamId, [number, number][]>();
  for (const [club, value] of Object.entries(slYears)) {
    const id = NAME_TO_ID[club];
    if (id) slRanges.set(id, value.ranges);
  }
  const inSuperLeagueDuring = (teamId: QuizTeamId, from: number, to: number) =>
    (slRanges.get(teamId) ?? []).some(([start, end]) => start <= to && end >= from);

  const questions: QuizQuestion[] = [];

  // "Which of these clubs did X play for?" — max 150, at most 12 per answer club.
  const perClub = new Map<string, number>();
  let clubQuestions = 0;
  for (const candidate of candidates) {
    if (clubQuestions >= 150) break;
    if (candidate.seasons < 3) continue;
    const { player, clubs, name } = candidate;
    const multi = clubs.length > 1;
    const answer = [...clubs].sort((a, b) => a.appearances - b.appearances)[0]!;
    if ((perClub.get(answer.club) ?? 0) >= 12) continue;
    const from = (firstYear.get(name) ?? 1996) - 1;
    const to = (lastYear.get(name) ?? 2026) + 1;
    const free = WIKI_SL_CLUBS.filter(
      (club) =>
        !club.mention.test(player.wikitext) && inSuperLeagueDuring(club.teamId, from, to)
    )
      .map((club) => club.name)
      .sort((a, b) => stableHash(`wclub:${name}:${a}`) - stableHash(`wclub:${name}:${b}`));
    if (free.length < 3) continue;
    const difficulty: QuizDifficulty = !multi
      ? candidate.famous
        ? "easy"
        : candidate.seasons >= 6
          ? "medium"
          : "hard"
      : candidate.famous
        ? answer.appearances >= 30
          ? "hard"
          : "very-hard"
        : answer.appearances >= 30
          ? "very-hard"
          : "expert";
    const q = makeQuestion(
      `wiki-club-${slug(name)}`,
      `Which of these clubs did ${name} play for?`,
      answer.club,
      free.slice(0, 3),
      {
        topicId: `player:${slug(name)}:clubs`,
        difficulty,
        category: multi ? "transfers" : "players",
        teams: unique(clubs.map((entry) => entry.teamId)),
        era: eraForYear(firstYear.get(name) ?? 2000),
        sourceType: "records",
        answerType: "objective",
      }
    );
    if (!q) continue;
    questions.push(q);
    perClub.set(answer.club, (perClub.get(answer.club) ?? 0) + 1);
    clubQuestions += 1;
  }

  // "Which nation did X represent?" — only the less obvious nations; max 70.
  const obvious = new Set(["England", "Australia", "New Zealand", "Great Britain"]);
  let nationQuestions = 0;
  for (const candidate of candidates) {
    if (nationQuestions >= 70) break;
    const { player, name } = candidate;
    const answer = player.nations.find(
      (nation) => !obvious.has(nation) && WIKI_NATIONS.some((row) => row.name === nation)
    );
    if (!answer) continue;
    const group = WIKI_NATIONS.find((row) => row.name === answer)!.group;
    const free = WIKI_NATIONS.filter(
      (row) =>
        row.name !== answer &&
        row.name !== "Australia" &&
        // Minor nations only make sense as wrong answers next to another minor nation.
        (group === "other" || !["Malta", "Greece", "Serbia", "Lebanon"].includes(row.name)) &&
        !row.mention.test(player.wikitext)
    ).sort(
      (a, b) =>
        Number(b.group === group) - Number(a.group === group) ||
        stableHash(`wnat:${name}:${a.name}`) - stableHash(`wnat:${name}:${b.name}`)
    );
    if (free.length < 3) continue;
    const q = makeQuestion(
      `wiki-nation-${slug(name)}`,
      `Which nation did ${name} represent in international rugby league?`,
      answer,
      free.slice(0, 3).map((row) => row.name),
      {
        topicId: `player:${slug(name)}:nation`,
        difficulty: candidate.famous ? "medium" : candidate.seasons >= 5 ? "hard" : "very-hard",
        category: "players",
        teams: unique(candidate.clubs.map((entry) => entry.teamId)),
        era: eraForYear(firstYear.get(name) ?? 2000),
        sourceType: "records",
        answerType: "objective",
      }
    );
    if (!q) continue;
    questions.push(q);
    nationQuestions += 1;
  }

  return questions;
}

function buildStadiumQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const stadiumNames = STADIUMS.map((row) => row.stadium);

  for (const row of STADIUMS) {
    const clubName =
      Object.entries(NAME_TO_ID).find(([, id]) => id === row.id)?.[0] ?? row.id;
    questions.push(
      makeQuestion(
        `stad-${row.id}`,
        row.asOfSeason
          ? `What was ${possessive(clubName)} home stadium called in the ${row.asOfSeason} Super League season?`
          : `What is ${possessive(clubName)} home stadium?`,
        row.stadium,
        pickDistractors(
          row.stadium,
          stadiumNames.filter((name) => !row.alsoKnownAs?.includes(name)),
          6
        ),
        {
          topicId: `stadium:${row.id}:home`,
          difficulty: "easy",
          category: "stadiums",
          teams: [row.id],
          sourceType: "curated",
          answerType: "objective",
        }
      )!
    );
  }
  return questions.filter((question): question is QuizQuestion => Boolean(question));
}

function buildStarting17Questions(): QuizQuestion[] {
  const path = join(ROOT, "data/era-starting-17s.json");
  const rows = JSON.parse(readFileSync(path, "utf8")) as StartingRow[];
  const questions: QuizQuestion[] = [];

  const byYearNumber = new Map<string, string[]>();
  for (const row of rows) {
    for (const player of row.squad) {
      const key = `${row.year}-${player.number}`;
      const list = byYearNumber.get(key) ?? [];
      list.push(player.name);
      byYearNumber.set(key, list);
    }
  }

  const allNames = unique(rows.flatMap((row) => row.squad.map((player) => player.name)));
  const rowsUsedByClub = new Map<string, number>();

  for (const row of rows) {
    const teamId = NAME_TO_ID[row.club];
    if (!teamId) continue;
    const usedForClub = rowsUsedByClub.get(row.club) ?? 0;
    if (usedForClub >= 12) continue;
    rowsUsedByClub.set(row.club, usedForClub + 1);
    const label = clubQuestionName(teamId, row.year, row.club);
    const targets =
      teamId === "widnes"
        ? [1, 7, 13]
        : teamId === "london"
          ? [1, 7, 13]
          : [1 + (row.year % 13)];

    for (const number of targets) {
      const player = row.squad.find((entry) => entry.number === number);
      if (!player?.name) continue;
      const sameNumber = byYearNumber.get(`${row.year}-${number}`) ?? [];
      const distractors = pickDistractors(player.name, [...sameNumber, ...allNames], 8);
      const base: QuizDifficulty =
        number === 1 || number === 7
          ? "medium"
          : number === 13
            ? "expert"
            : number === 6
              ? "hard"
              : "expert";

      const shirt = makeQuestion(
        `s17-${teamId}-${row.year}-n${number}`,
        `Who wore shirt number ${number} in ${possessive(label)} ${row.year} Super League squad?`,
        player.name,
        distractors,
        {
          topicId: `squad:${teamId}:${row.year}:shirt-${number}`,
          difficulty: difficultyForYear(row.year, base),
          category: "players",
          teams: [teamId],
          era: eraForYear(row.year),
          sourceType: "starting-17",
        }
      );
      if (shirt) questions.push(shirt);

    }
  }

  return questions;
}

function loadCurrentRosters(): RosterPlayer[] {
  const dir = join(ROOT, "data/players/chunks/current");
  const files = [
    "bradford-bulls.json",
    "castleford-tigers.json",
    "catalans-dragons.json",
    "huddersfield-giants.json",
    "hull-fc.json",
    "hull-kr.json",
    "leeds-rhinos.json",
    "leigh-leopards.json",
    "st-helens.json",
    "toulouse-olympique.json",
    "wakefield-trinity.json",
    "warrington-wolves.json",
    "wigan-warriors.json",
    "york-knights.json",
  ];
  const players: RosterPlayer[] = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as RosterPlayer[];
    for (const player of raw) {
      if (player.name && player.club && NAME_TO_ID[player.club]) {
        players.push(player);
      }
    }
  }
  return players;
}

function buildRosterQuestions(): QuizQuestion[] {
  const players = loadCurrentRosters();
  const questions: QuizQuestion[] = [];
  const byClub = new Map<string, RosterPlayer[]>();
  for (const player of players) {
    const list = byClub.get(player.club) ?? [];
    list.push(player);
    byClub.set(player.club, list);
  }

  for (const [club, squad] of byClub) {
    const teamId = NAME_TO_ID[club];
    if (!teamId) continue;
    const others = players.filter((player) => player.club !== club).map((player) => player.name);

    const targetCounts: Partial<Record<QuizTeamId, number>> = {
      york: 17,
      toulouse: 17,
      widnes: 12,
      leigh: 10,
      london: 14,
      wakefield: 13,
      huddersfield: 7,
      salford: 6,
      castleford: 1,
    };
    const rosterTargets = squad.slice(0, targetCounts[teamId] ?? 0);
    const needsPositionDepth = ["york", "toulouse", "widnes", "leigh"].includes(teamId);

    for (const [playerIndex, player] of rosterTargets.entries()) {
      if (playerIndex === 0) {
        const who = makeQuestion(
          `ros-who-${teamId}-${slug(player.name)}`,
          `Which of these players was named in ${possessive(club)} 2026 squad?`,
          player.name,
          pickDistractors(player.name, others, 8),
          {
            topicId: `squad:${teamId}:2026:${slug(player.name)}:membership`,
            difficulty: "easy",
            category: "players",
            teams: [teamId],
            era: "current",
            sourceType: "roster",
          }
        );
        if (who) questions.push(who);
      }

      const posLabel = player.position
        ? POSITION_LABEL[player.position] ?? player.position.toLowerCase().replace(/_/g, " ")
        : "";
      if (posLabel && needsPositionDepth) {
        const positionDifficulty: QuizDifficulty =
          playerIndex < 5
            ? "medium"
            : playerIndex < (teamId === "york" ? 8 : 7)
              ? "hard"
              : playerIndex === rosterTargets.length - 1
                ? "expert"
                : "very-hard";
        const pos = makeQuestion(
          `ros-pos-${teamId}-${slug(player.name)}`,
          `Which position did ${player.name} play for ${club} in the 2026 squad?`,
          posLabel,
          pickDistractors(posLabel, Object.values(POSITION_LABEL), 8),
          {
            topicId: `squad:${teamId}:2026:${slug(player.name)}:position`,
            difficulty: positionDifficulty,
            category: "players",
            teams: [teamId],
            era: "current",
            sourceType: "roster",
          }
        );
        if (pos) questions.push(pos);
      }
    }
  }

  return questions;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function possessive(value: string): string {
  return value.endsWith("s") ? `${value}'` : `${value}'s`;
}

function buildClubHistoryQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const club of CLUB_HISTORY) {
    const founded = makeQuestion(
      `hist-founded-${club.id}`,
      club.foundedQuestion,
      club.founded,
      club.foundedDistractors,
      {
        topicId: `history:${club.id}:founded`,
        difficulty: "easy",
        category: "history",
        teams: [club.id],
        sourceType: "records",
      }
    );
    if (founded) questions.push(founded);

    if (club.formerName && club.formerNameQuestion && club.formerNameDistractors) {
      const former = makeQuestion(
        `hist-former-${club.id}`,
        club.formerNameQuestion,
        club.formerName,
        club.formerNameDistractors,
        {
          topicId: `history:${club.id}:former-name`,
          difficulty: "hard",
          category: "clubs",
          teams: [club.id],
          sourceType: "records",
        }
      );
      if (former) questions.push(former);
    }

    const milestone = makeQuestion(
      `hist-mile-${club.id}`,
      club.milestoneQuestion,
      club.milestone,
      club.milestoneDistractors,
      {
        topicId: `history:${club.id}:milestone`,
        difficulty: club.milestoneDifficulty ?? "medium",
        category: club.milestoneCategory ?? "history",
        teams: [club.id],
        sourceType: "records",
      }
    );
    if (milestone) questions.push(milestone);
  }
  return questions;
}

type HonourPlayer = {
  id: string;
  name: string;
  club?: string;
  displayClub?: string;
  team?: string;
};

function loadHonourPlayers(): Map<string, HonourPlayer> {
  const byId = new Map<string, HonourPlayer>();
  for (const file of [
    "historic-players.json",
    "legends.json",
    "current-squads.json",
  ]) {
    const rows = JSON.parse(
      readFileSync(join(ROOT, "data", file), "utf8")
    ) as HonourPlayer[];
    for (const row of rows) {
      if (row?.id && row?.name) byId.set(row.id, row);
    }
  }
  return byId;
}

function teamsForPlayer(player: HonourPlayer | undefined): QuizTeamId[] {
  if (!player) return [];
  const club = String(player.displayClub ?? player.team ?? player.club ?? "");
  const fromClub = NAME_TO_ID[club];
  if (fromClub) return [fromClub];
  for (const id of QUIZ_TEAM_IDS) {
    if (player.id.startsWith(`${id}-`)) return [id];
  }
  return [];
}

function displayNameForId(
  id: string,
  byId: Map<string, HonourPlayer>
): string | null {
  return byId.get(id)?.name ?? null;
}

function preferCanonicalId(ids: string[]): string {
  const scored = ids.map((id) => {
    let score = 0;
    if (!/-\d{4}$/.test(id)) score += 50;
    if (!id.includes("-hist-") && !id.includes("-cur-") && !id.includes("-leg-")) {
      score += 20;
    }
    return { id, score };
  });
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored[0]!.id;
}

function invertPlayerYearMap(
  map: Record<string, number[]>,
  byId: Map<string, HonourPlayer>
): Map<number, { id: string; name: string; teams: QuizTeamId[] }> {
  const byYear = new Map<number, string[]>();
  for (const [id, years] of Object.entries(map)) {
    if (!byId.has(id)) continue;
    for (const year of years) {
      if (!Number.isFinite(year)) continue;
      const list = byYear.get(year) ?? [];
      list.push(id);
      byYear.set(year, list);
    }
  }
  const out = new Map<number, { id: string; name: string; teams: QuizTeamId[] }>();
  for (const [year, ids] of byYear) {
    const id = preferCanonicalId([...new Set(ids)]);
    const name = displayNameForId(id, byId);
    if (!name) continue;
    out.set(year, { id, name, teams: teamsForPlayer(byId.get(id)) });
  }
  return out;
}

function buildHonourQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const byId = loadHonourPlayers();

  const manOfSteel = invertPlayerYearMap(
    JSON.parse(
      readFileSync(join(ROOT, "data/man-of-steel-winners.json"), "utf8")
    ) as Record<string, number[]>,
    byId
  );
  const dreamTeam = JSON.parse(
    readFileSync(join(ROOT, "data/dream-team-years.json"), "utf8")
  ) as Record<string, number[]>;

  const mosNames = unique([...manOfSteel.values()].map((row) => row.name));
  for (const [year, winner] of [...manOfSteel.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const q = makeQuestion(
      `mos-winner-${year}`,
      `Who won the Man of Steel award in ${year}?`,
      winner.name,
      pickDistractors(winner.name, mosNames, 8),
      {
        topicId: `honour:man-of-steel:${year}`,
        difficulty: difficultyForYear(
          year,
          year >= 2020 ? "easy" : year >= 2012 ? "medium" : "hard"
        ),
        category: "players",
        teams: winner.teams,
        era: eraForYear(year),
        sourceType: "honours",
        answerType: "objective",
      }
    );
    if (q) questions.push(q);
  }

  // Golden Boot: verified list in facts.ts (golden-boot-years.json only holds the
  // winners who are in the player database). Wrong answers are winners from nearby years.
  const gbRows = GOLDEN_BOOT_WINNERS.map((row) => ({ year: row.year, names: [row.player] }));
  for (const row of GOLDEN_BOOT_WINNERS) {
    const q = makeQuestion(
      `golden-boot-${row.year}`,
      `Who won the Golden Boot in ${row.year}?`,
      row.player,
      nearestByYear(row.year, gbRows, [row.player], 3),
      {
        topicId: `honour:golden-boot:${row.year}`,
        difficulty:
          row.teams?.length || row.year >= 2010
            ? "hard"
            : row.year >= 1999
              ? "very-hard"
              : "expert",
        category: "records",
        teams: row.teams ?? [],
        era: row.year >= 2000 ? eraForYear(row.year) : `${Math.floor(row.year / 10) * 10}s`,
        sourceType: "honours",
        answerType: "objective",
      }
    );
    if (q) questions.push(q);
  }

  const ltNames = unique(
    LANCE_TODD_WINNERS.flatMap((row) =>
      [row.winnerName, row.sharedWinnerName].filter(
        (name): name is string => Boolean(name)
      )
    )
  );
  for (const row of LANCE_TODD_WINNERS) {
    if (row.sharedWinnerName) continue;
    const winnerName =
      row.winnerName === "Robbie Hunter-Paul"
        ? ([...byId.values()].find((p) => p.name === "Robbie Hunter-Paul")
            ?.name ?? "Robbie Hunter-Paul")
        : row.winnerName;
    const player = [...byId.values()].find(
      (p) => p.name.toLowerCase() === winnerName.toLowerCase()
    );
    const q = makeQuestion(
      `lance-todd-${row.year}`,
      `Who won the Lance Todd Trophy in the ${row.year} Challenge Cup final?`,
      winnerName,
      pickDistractors(winnerName, ltNames, 8),
      {
        topicId: `honour:lance-todd:${row.year}`,
        difficulty: difficultyForYear(
          row.year,
          row.year >= 2020 ? "easy" : row.year >= 2012 ? "medium" : "hard"
        ),
        category: "challenge-cup",
        teams: teamsForPlayer(player),
        era: eraForYear(row.year),
        sourceType: "honours",
        answerType: "objective",
      }
    );
    if (q) questions.push(q);
  }

  const dreamByYear = new Map<
    number,
    { id: string; name: string; teams: QuizTeamId[] }[]
  >();
  for (const [id, years] of Object.entries(dreamTeam)) {
    if (/-\d{4}$/.test(id)) continue;
    const name = displayNameForId(id, byId);
    if (!name) continue;
    for (const year of years) {
      const list = dreamByYear.get(year) ?? [];
      list.push({ id, name, teams: teamsForPlayer(byId.get(id)) });
      dreamByYear.set(year, list);
    }
  }

  const allDreamNames = unique(
    [...dreamByYear.values()].flatMap((rows) => rows.map((row) => row.name))
  );
  for (const [year, rows] of [...dreamByYear.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const uniqueRows = [
      ...new Map(rows.map((row) => [row.name.toLowerCase(), row])).values(),
    ];
    if (uniqueRows.length === 0) continue;
    uniqueRows.sort(
      (a, b) =>
        stableHash(`dream:${year}:${a.id}`) -
        stableHash(`dream:${year}:${b.id}`)
    );
    const pick = uniqueRows[0]!;
    const q = makeQuestion(
      `dream-team-${year}-${slug(pick.name)}`,
      `Which of these players was named in the ${year} Super League Dream Team?`,
      pick.name,
      pickDistractors(pick.name, allDreamNames, 8),
      {
        topicId: `honour:dream-team:${year}:${slug(pick.name)}`,
        difficulty: difficultyForYear(year, year >= 2020 ? "medium" : "hard"),
        category: "players",
        teams: pick.teams,
        era: eraForYear(year),
        sourceType: "honours",
        answerType: "objective",
      }
    );
    if (q) questions.push(q);
  }

  return questions;
}

function main(): void {
  const questions = [
    ...buildFinalsQuestions(),
    ...buildFinalsExtraQuestions(),
    ...buildHistoricChallengeCupQuestions(),
    ...buildGrandFinalManOfMatchQuestions(),
    ...buildWorldClubChallengeQuestions(),
    ...buildWorldCupQuestions(),
    ...buildStadiumQuestions(),
    ...buildClubHistoryQuestions(),
    ...buildStarting17Questions(),
    ...buildRosterQuestions(),
    ...buildHonourQuestions(),
    ...buildWikiPlayerQuestions(),
  ].filter(Boolean);

  const seenIds = new Set<string>();
  const seenTopics = new Set<string>();
  const uniqueQuestions: QuizQuestion[] = [];
  for (const question of questions) {
    if (!question || seenIds.has(question.id) || seenTopics.has(question.topicId)) {
      continue;
    }
    seenIds.add(question.id);
    seenTopics.add(question.topicId);
    uniqueQuestions.push(question);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(uniqueQuestions, null, 2)}\n`, "utf8");

  const byTeam = new Map<string, number>();
  for (const id of QUIZ_TEAM_IDS) byTeam.set(id, 0);
  for (const question of uniqueQuestions) {
    for (const team of question.teams) {
      byTeam.set(team, (byTeam.get(team) ?? 0) + 1);
    }
  }

  const honourCount = uniqueQuestions.filter(
    (question) => question.sourceType === "honours"
  ).length;
  console.log(`Wrote ${uniqueQuestions.length} generated questions to ${OUT}`);
  console.log(`Honour questions: ${honourCount}`);
  console.log("Per-team tagged counts:");
  for (const [id, count] of [...byTeam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${id}: ${count}`);
  }
}

main();
