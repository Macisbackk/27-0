import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import type { ManagerCareer } from "./types";
import {
  type MatchEventImportance,
  eventMinutePrefix,
} from "../game/match-events";
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

function rngFor(seed: string, key: string): () => number {
  return seedrandom(`${seed}-events-${key}`);
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function teamName(side: TeamSide, input: GeneratorInput): string {
  return side === "user" ? input.userClub : input.opponent;
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

function pressurePhrases(side: TeamSide, input: GeneratorInput, rng: () => number): string {
  const club = teamName(side, input);
  return pick(
    [
      `${club} win a six-again call and keep the pressure on`,
      `${club} force a repeat set near the line`,
      `${club} camp in the opposition 20`,
      `${club} pin the defence on their own line`,
    ],
    rng
  );
}

function lineBreakPhrase(player: string, rng: () => number): string {
  return pick(
    [
      `${player} breaks through the middle`,
      `${player} finds a gap on the edge`,
      `${player} straightens the attack and goes through`,
      `${player} slices through a tired defence`,
    ],
    rng
  );
}

function tryPhrase(player: string, rng: () => number): string {
  return pick(
    [
      `${player} crashes over beside the posts`,
      `${player} finishes in the corner`,
      `${player} dots down under the sticks`,
      `${player} powers over from close range`,
    ],
    rng
  );
}

function errorPhrase(club: string, rng: () => number): string {
  return pick(
    [
      `${club} knock on under pressure`,
      `${club} spill the ball coming out of yardage`,
      `${club} lose possession on their own line`,
      `${club} are punished for a forward pass`,
    ],
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

/** Generate a coherent commentary feed that matches the final scoreline. */
export function generateSimulatedMatchEvents(
  input: GeneratorInput
): LiveMatchEvent[] {
  const events: LiveMatchEvent[] = [];
  let eventIndex = 0;
  const nextId = () => `${input.fixtureKey}-ev-${eventIndex++}`;

  const userTryMinutes = distributeMinutes(input.userTries, rngFor(input.seed, "ut"));
  const oppTryMinutes = distributeMinutes(input.oppTries, rngFor(input.seed, "ot"));

  const userScorerNames =
    input.userScorers?.map((s) => s.name) ?? ["Try scorer"];
  const kicker = userScorerNames[0] ?? "Kicker";

  const addTryChain = (
    side: TeamSide,
    minute: number,
    scorerName: string
  ) => {
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
          pressurePhrases(side, input, rng),
          0,
          undefined,
          "low"
        )
      );
    }
    if (rng() < 0.45) {
      events.push(
        makeEvent(
          nextId(),
          Math.max(1, minute - 1),
          side,
          input,
          "line_break",
          lineBreakPhrase(scorerName, rng),
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
        tryPhrase(scorerName, rng),
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
          `${scorerName === kicker ? kicker : kicker} converts`,
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
          `Conversion missed`,
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
    const lateMinute = 72 + Math.floor(lateRng() * 7);
    if (lateRng() < 0.4) {
      const side: TeamSide = margin >= 0 ? "user" : "opponent";
      events.push(
        makeEvent(
          nextId(),
          lateMinute,
          side,
          input,
          "penalty",
          `${teamName(side, input)} take the two points`,
          2,
          kicker,
          "high"
        )
      );
    }
    if (lateRng() < 0.25) {
      const side: TeamSide = margin >= 0 ? "user" : "opponent";
      const made = lateRng() < 0.55;
      events.push(
        makeEvent(
          nextId(),
          79,
          side,
          input,
          made ? "drop_goal" : "missed_conversion",
          made
            ? `${kicker} nails a drop goal`
            : `Drop goal missed, ${teamName(side === "user" ? "opponent" : "user", input)} hold on`,
          made ? 1 : 0,
          kicker,
          "major"
        )
      );
    }
  }

  const fillerRng = rngFor(input.seed, "filler");
  const fillerCount = 8 + Math.floor(fillerRng() * 12);
  for (let i = 0; i < fillerCount; i++) {
    const minute = 5 + Math.floor(fillerRng() * 75);
    const side: TeamSide = fillerRng() < 0.5 ? "user" : "opponent";
    const club = teamName(side, input);
    if (fillerRng() < 0.35) {
      events.push(
        makeEvent(
          nextId(),
          minute,
          side,
          input,
          "try_saver",
          `${club === input.userClub ? input.opponent : input.userClub} scramble well with a try-saving tackle`,
          0,
          undefined,
          "low"
        )
      );
    } else if (fillerRng() < 0.5) {
      const errorSide: TeamSide = fillerRng() < 0.5 ? "user" : "opponent";
      events.push(
        makeEvent(
          nextId(),
          minute,
          errorSide,
          input,
          "knock_on",
          errorPhrase(teamName(errorSide, input), fillerRng),
          0,
          undefined,
          "medium"
        )
      );
    } else {
      events.push(
        makeEvent(
          nextId(),
          minute,
          side,
          input,
          "momentum_shift",
          `${club} win the battle for field position`,
          0,
          undefined,
          "low"
        )
      );
    }
  }

  events.push(
    makeEvent(nextId(), 40, "user", input, "half_time", "Half time", 0, undefined, "major")
  );
  events.push(
    makeEvent(nextId(), 80, "user", input, "full_time", "Full time", 0, undefined, "major")
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

  return generateSimulatedMatchEvents({
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
}
