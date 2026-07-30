import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import {
  buildMatchStoryFromEvents,
  eventMinutePrefix,
  type MatchEventImportance,
  type MatchEventType,
} from "../game/match-events";
import {
  buildCommentaryLine,
  createMatchStoryMemory,
  territoryForMinute,
  type MatchStoryMemory,
} from "../match/matchEventTemplates";
import type { ManagerCareer } from "./types";
import type { LiveMatchEvent } from "./types";

type TeamSide = "user" | "opponent";

interface GeneratorInput {
  seed: string;
  fixtureKey: string;
  userClub: string;
  opponent: string;
  userScore: number;
  oppScore: number;
  userTries: number;
  oppTries: number;
  userScorers?: { name: string }[];
}

type FillerType =
  | "try_saver"
  | "knock_on"
  | "forced_error"
  | "momentum_shift"
  | "pressure_set"
  | "last_tackle_kick"
  | "forty_twenty"
  | "held_up"
  | "goal_line_dropout"
  | "sin_bin"
  | "interchange";

const FILLER_TYPES: FillerType[] = [
  "try_saver",
  "knock_on",
  "forced_error",
  "momentum_shift",
  "pressure_set",
  "last_tackle_kick",
  "forty_twenty",
  "held_up",
  "goal_line_dropout",
  "interchange",
];

function rngFor(seed: string, key: string): () => number {
  return seedrandom(`${seed}-events-${key}`);
}

function teamName(side: TeamSide, input: GeneratorInput): string {
  return side === "user" ? input.userClub : input.opponent;
}

function opponentOf(side: TeamSide, input: GeneratorInput): string {
  return side === "user" ? input.opponent : input.userClub;
}

function makeEvent(
  id: string,
  minute: number,
  side: TeamSide,
  input: GeneratorInput,
  type: LiveMatchEvent["type"],
  description: string,
  points = 0,
  playerName?: string,
  importance: MatchEventImportance = "medium"
): LiveMatchEvent {
  const teamNameStr = teamName(side, input);
  return {
    id,
    minute,
    type,
    team: side,
    playerName,
    description: eventMinutePrefix(minute, description),
    points,
    importance,
    teamId: side,
    teamName: teamNameStr,
  };
}

function eventContext(
  side: TeamSide,
  input: GeneratorInput,
  minute: number,
  player?: string,
  kicker?: string
) {
  return {
    team: teamName(side, input),
    opponent: opponentOf(side, input),
    player,
    kicker,
    minute,
    area: territoryForMinute(minute),
    score: `${input.userScore}-${input.oppScore}`,
  };
}

function commentary(
  type: MatchEventType,
  side: TeamSide,
  input: GeneratorInput,
  minute: number,
  memory: MatchStoryMemory,
  rng: () => number,
  player?: string,
  kicker?: string
): string {
  return buildCommentaryLine(
    type,
    eventContext(side, input, minute, player, kicker),
    memory,
    rng
  );
}

function distributeMinutes(count: number, rng: () => number): number[] {
  const minutes: number[] = [];
  for (let i = 0; i < count; i++) {
    minutes.push(8 + Math.floor(rng() * 70));
  }
  return minutes.sort((a, b) => a - b);
}

function targetEventCount(input: GeneratorInput): number {
  const totalPoints = input.userScore + input.oppScore;
  if (totalPoints <= 20) return 15 + Math.floor(rngFor(input.seed, "density")() * 10);
  if (totalPoints <= 36) return 25 + Math.floor(rngFor(input.seed, "density")() * 15);
  return 35 + Math.floor(rngFor(input.seed, "density")() * 20);
}

function pickFillerType(
  memory: MatchStoryMemory,
  rng: () => number,
  lateGame: boolean
): FillerType {
  const pool = lateGame
    ? ([
        "try_saver",
        "knock_on",
        "forced_error",
        "pressure_set",
        "last_tackle_kick",
        "held_up",
        "momentum_shift",
      ] as FillerType[])
    : FILLER_TYPES;

  const recent = memory.recentEventTypes.slice(-3);
  const candidates = pool.filter((t) => !recent.includes(t));
  const pick = candidates.length > 0 ? candidates : pool;
  return pick[Math.floor(rng() * pick.length)]!;
}

/** Generate a coherent commentary feed that matches the final scoreline. */
export function generateSimulatedMatchEvents(
  input: GeneratorInput
): LiveMatchEvent[] {
  const events: LiveMatchEvent[] = [];
  const memory = createMatchStoryMemory();
  let eventIndex = 0;
  const nextId = () => `${input.fixtureKey}-ev-${eventIndex++}`;

  const userTryMinutes = distributeMinutes(
    input.userTries,
    rngFor(input.seed, "ut")
  );
  const oppTryMinutes = distributeMinutes(
    input.oppTries,
    rngFor(input.seed, "ot")
  );

  const userScorerNames =
    input.userScorers?.map((s) => s.name) ?? ["Try scorer"];
  const kicker = userScorerNames[0] ?? "Kicker";

  const addTryChain = (side: TeamSide, minute: number, scorerName: string) => {
    const rng = rngFor(input.seed, `chain-${side}-${minute}`);
    const club = teamName(side, input);

    if (rng() < 0.55) {
      events.push(
        makeEvent(
          nextId(),
          Math.max(1, minute - 2),
          side,
          input,
          "six_again",
          commentary("six_again", side, input, Math.max(1, minute - 2), memory, rng),
          0,
          undefined,
          "low"
        )
      );
    }
    if (rng() < 0.4) {
      events.push(
        makeEvent(
          nextId(),
          Math.max(1, minute - 1),
          side,
          input,
          rng() < 0.5 ? "line_break" : "big_break",
          commentary(
            rng() < 0.5 ? "line_break" : "big_break",
            side,
            input,
            Math.max(1, minute - 1),
            memory,
            rng,
            scorerName
          ),
          0,
          scorerName,
          "medium"
        )
      );
    }

    events.push(
      makeEvent(
        nextId(),
        minute,
        side,
        input,
        "try",
        commentary("try", side, input, minute, memory, rng, scorerName),
        4,
        scorerName,
        "major"
      )
    );

    const convRng = rngFor(input.seed, `conv-${side}-${minute}`);
    if (convRng() < 0.82) {
      events.push(
        makeEvent(
          nextId(),
          minute,
          side,
          input,
          "goal",
          commentary("goal", side, input, minute, memory, convRng, undefined, kicker),
          2,
          kicker,
          "high"
        )
      );
    } else {
      events.push(
        makeEvent(
          nextId(),
          minute,
          side,
          input,
          "missed_conversion",
          commentary(
            "missed_conversion",
            side,
            input,
            minute,
            memory,
            convRng,
            undefined,
            kicker
          ),
          0,
          kicker,
          "medium"
        )
      );
    }
  };

  userTryMinutes.forEach((minute, i) => {
    const scorer = userScorerNames[i % userScorerNames.length] ?? kicker;
    addTryChain("user", minute, scorer);
  });

  oppTryMinutes.forEach((minute) => {
    addTryChain("opponent", minute, input.opponent);
  });

  const margin = input.userScore - input.oppScore;
  const closeGame = Math.abs(margin) <= 6;
  if (closeGame && input.userScore + input.oppScore > 0) {
    const lateRng = rngFor(input.seed, "late");
    const lateMinute = 68 + Math.floor(lateRng() * 10);

    if (lateRng() < 0.45) {
      const side: TeamSide = margin >= 0 ? "user" : "opponent";
      if (lateRng() < 0.35) {
        events.push(
          makeEvent(
            nextId(),
            lateMinute - 2,
            side,
            input,
            "pressure_set",
            commentary("pressure_set", side, input, lateMinute - 2, memory, lateRng),
            0,
            undefined,
            "medium"
          )
        );
      }
      events.push(
        makeEvent(
          nextId(),
          lateMinute,
          side,
          input,
          "penalty",
          commentary("penalty", side, input, lateMinute, memory, lateRng, undefined, kicker),
          2,
          kicker,
          "high"
        )
      );
    }

    if (lateRng() < 0.3) {
      const side: TeamSide = margin >= 0 ? "user" : "opponent";
      const made = lateRng() < 0.52;
      events.push(
        makeEvent(
          nextId(),
          76 + Math.floor(lateRng() * 4),
          side,
          input,
          made ? "drop_goal" : "missed_drop_goal",
          commentary(
            made ? "drop_goal" : "missed_drop_goal",
            side,
            input,
            79,
            memory,
            lateRng,
            undefined,
            kicker
          ),
          made ? 1 : 0,
          kicker,
          "major"
        )
      );
    }

    if (lateRng() < 0.2) {
      const trailing: TeamSide = margin >= 0 ? "opponent" : "user";
      events.push(
        makeEvent(
          nextId(),
          74,
          trailing,
          input,
          "knock_on",
          commentary("knock_on", trailing, input, 74, memory, lateRng),
          0,
          undefined,
          "medium"
        )
      );
    }
  }

  const fillerRng = rngFor(input.seed, "filler");
  const fillerTarget = Math.max(
    6,
    targetEventCount(input) - events.length - 2
  );
  let lastFillerMinute = 0;

  for (let i = 0; i < fillerTarget; i++) {
    const minute = Math.max(
      lastFillerMinute + 2,
      5 + Math.floor(fillerRng() * 75)
    );
    lastFillerMinute = minute;
    const possessionSide: TeamSide = fillerRng() < 0.5 ? "user" : "opponent";
    const lateGame = minute >= 65;
    const fillerType = pickFillerType(memory, fillerRng, lateGame);
    const defendingSide: TeamSide =
      fillerType === "try_saver" || fillerType === "forced_error"
        ? possessionSide === "user"
          ? "opponent"
          : "user"
        : possessionSide;
    const playerName =
      fillerType === "try_saver"
        ? teamName(defendingSide, input)
        : undefined;

    events.push(
      makeEvent(
        nextId(),
        minute,
        defendingSide,
        input,
        fillerType,
        commentary(
          fillerType,
          defendingSide,
          input,
          minute,
          memory,
          fillerRng,
          playerName
        ),
        0,
        playerName,
        fillerType === "try_saver" || fillerType === "sin_bin"
          ? "medium"
          : "low"
      )
    );
  }

  if (rngFor(input.seed, "sinbin")() < 0.22) {
    const side: TeamSide = rngFor(input.seed, "sinbin-side")() < 0.5 ? "user" : "opponent";
    const minute = 30 + Math.floor(rngFor(input.seed, "sinbin-m")() * 40);
    events.push(
      makeEvent(
        nextId(),
        minute,
        side,
        input,
        "sin_bin",
        commentary("sin_bin", side, input, minute, memory, rngFor(input.seed, "sinbin-t"), "the player"),
        0,
        "the player",
        "high"
      )
    );
  }

  events.push(
    makeEvent(
      nextId(),
      40,
      "user",
      input,
      "half_time",
      commentary("half_time", "user", input, 40, memory, rngFor(input.seed, "ht")),
      0,
      undefined,
      "major"
    )
  );
  events.push(
    makeEvent(
      nextId(),
      80,
      "user",
      input,
      "full_time",
      commentary("full_time", "user", input, 80, memory, rngFor(input.seed, "ft")),
      0,
      undefined,
      "major"
    )
  );

  return events.sort(
    (a, b) =>
      a.minute - b.minute ||
      (a.id ?? "").localeCompare(b.id ?? "")
  );
}

export function generateEventsFromFixture(
  career: ManagerCareer,
  fixture: MatchFixture,
  fixtureKey: string
): LiveMatchEvent[] {
  const scorers =
    fixture.scoringDetail?.dreamTeam.tryScorers.map((s) => ({ name: s.name })) ??
    [];

  const events = generateSimulatedMatchEvents({
    seed: career.seed,
    fixtureKey,
    userClub: career.club,
    opponent: fixture.opponent,
    userScore: fixture.pointsFor,
    oppScore: fixture.pointsAgainst,
    userTries: fixture.triesFor,
    oppTries: fixture.triesAgainst,
    userScorers: scorers,
  });

  fixture.matchBio = buildMatchStoryFromEvents(
    events.map((e) => ({
      id: e.id ?? "",
      minute: e.minute,
      teamId: e.teamId ?? e.team,
      teamName: e.teamName ?? (e.team === "user" ? career.club : fixture.opponent),
      playerName: e.playerName,
      type: e.type as MatchEventType,
      description: e.description,
      importance: e.importance ?? "medium",
    })),
    career.club
  );

  return events;
}
