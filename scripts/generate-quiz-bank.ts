/**
 * Build generated quiz questions from verified tables + historic/current squads.
 * Run: npx tsx scripts/generate-quiz-bank.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  CHALLENGE_CUPS,
  CLUB_HISTORY,
  GRAND_FINALS,
  LEAGUE_LEADERS,
  STADIUMS,
  type FinalRecord,
} from "../data/quiz/facts";
import type {
  QuizCategory,
  QuizDifficulty,
  QuizQuestion,
  QuizTeamId,
} from "../src/lib/quiz/types";
import { QUIZ_TEAM_IDS } from "../src/lib/quiz/types";

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
      const runnerTeams = isTeamId(record.runnerUpId) ? [record.runnerUpId] : [];
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
            teams: [...winnerTeams, ...runnerTeams],
            era: eraForYear(record.year),
            sourceType: "finals",
          }
        )!
      );
    }
  };

  expand(GRAND_FINALS, "Super League Grand Final", "grand-finals", "gf");
  expand(CHALLENGE_CUPS, "Challenge Cup final", "challenge-cup", "cc");

  const llsNames = unique(LEAGUE_LEADERS.map((row) => row.name));
  for (const row of LEAGUE_LEADERS) {
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
        }
      )!
    );
  }

  return questions.filter((question): question is QuizQuestion => Boolean(question));
}

function buildStadiumQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const names = STADIUMS.map((row) => {
    const club = Object.entries(NAME_TO_ID).find(([, id]) => id === row.id);
    return club?.[0] ?? row.id;
  });

  for (const row of STADIUMS) {
    const clubName =
      Object.entries(NAME_TO_ID).find(([, id]) => id === row.id)?.[0] ?? row.id;
    questions.push(
      makeQuestion(
        `stad-${row.id}`,
        `Which rugby league club is associated with ${row.stadium}?`,
        clubName,
        pickDistractors(clubName, names, 6),
        {
          topicId: `stadium:${row.id}:home`,
          difficulty: "easy",
          category: "stadiums",
          teams: [row.id],
          sourceType: "curated",
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
    "london-broncos.json",
    "salford-red-devils.json",
    "st-helens.json",
    "toulouse-olympique.json",
    "wakefield-trinity.json",
    "warrington-wolves.json",
    "widnes-vikings.json",
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

function main(): void {
  const questions = [
    ...buildFinalsQuestions(),
    ...buildStadiumQuestions(),
    ...buildClubHistoryQuestions(),
    ...buildStarting17Questions(),
    ...buildRosterQuestions(),
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

  console.log(`Wrote ${uniqueQuestions.length} generated questions to ${OUT}`);
  console.log("Per-team tagged counts:");
  for (const [id, count] of [...byTeam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${id}: ${count}`);
  }
}

main();
