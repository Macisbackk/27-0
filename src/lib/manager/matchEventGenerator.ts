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
  formatFullTimeEvent,
  territoryForMinute,
  type MatchStoryMemory,
} from "../match/matchEventTemplates";
import { buildOpponentTryScoringDetail } from "./managerOpponentScoring";
import { generateNrlSquadNames } from "./worldClubChallenge";
import type { ManagerCareer, ManagerCompetition, ManagerScheduledFixture } from "./types";
import type { LiveMatchEvent, MatchEventPeriod } from "./types";
import { isInvalidPlayerName } from "./managerPlayerNameGuards";

type TeamSide = "user" | "opponent";

/** Regulation length for simulated match commentary (no stoppage beyond FT). */
export const REGULATION_MATCH_MINUTES = 80;

/** Latest minute allowed for non-full_time regulation events (80 reserved for FT). */
const REGULATION_EVENT_MAX_MINUTE = REGULATION_MATCH_MINUTES - 1;

interface GeneratorInput {
  seed: string;
  fixtureKey: string;
  userClub: string;
  opponent: string;
  userScore: number;
  oppScore: number;
  userTries: number;
  oppTries: number;
  userScorers?: { name: string; playerId?: string }[];
  /** Named opponent try scorers — never club names. */
  opponentScorers?: { name: string; playerId?: string }[];
  /** Dedicated kickers per side — not try scorers unless they also scored. */
  userKicker?: string;
  opponentKicker?: string;
  career?: ManagerCareer;
  round?: number;
  /** When set, used to decide whether golden point / ET is allowed. */
  competition?: ManagerCompetition;
  /** League / draws-allowed fixtures never extend past regulation. */
  allowsDraw?: boolean;
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

/** Simulated generator stays in regulation unless a knockout forbids draws. */
function staysInRegulation(input: GeneratorInput): boolean {
  if (input.allowsDraw === true) return true;
  if (input.allowsDraw === false) return false;
  const comp = input.competition ?? "league";
  return comp === "league" || comp === "friendly";
}

function periodForMinute(
  minute: number,
  opts?: { goldenPoint?: boolean }
): MatchEventPeriod {
  if (opts?.goldenPoint) return "golden_point";
  if (minute <= 40) return "first_half";
  return "second_half";
}

function clampRegulationMinute(minute: number): number {
  return Math.max(1, Math.min(REGULATION_EVENT_MAX_MINUTE, Math.round(minute)));
}

function expandScorerEntries(
  scorers: { name: string; playerId?: string; tries?: number }[] | undefined,
  tries: number,
  teamNames: string[]
): { name: string; playerId?: string }[] {
  if (tries <= 0) return [];
  const valid = (scorers ?? [])
    .map((s) => ({
      name: s.name?.trim() ?? "",
      playerId: s.playerId,
      tries: s.tries,
    }))
    .filter(
      (s) => Boolean(s.name) && !isInvalidPlayerName(s.name, teamNames)
    );
  if (valid.length === 0) return [];
  const out: { name: string; playerId?: string }[] = [];
  for (const s of valid) {
    const count = Math.max(1, s.tries ?? 1);
    for (let i = 0; i < count && out.length < tries; i++) {
      out.push({ name: s.name, playerId: s.playerId });
    }
  }
  while (out.length < tries) {
    const pick = valid[out.length % valid.length]!;
    out.push({ name: pick.name, playerId: pick.playerId });
  }
  return out.slice(0, tries);
}

function makeEvent(
  id: string,
  minute: number,
  side: TeamSide,
  input: GeneratorInput,
  type: LiveMatchEvent["type"],
  description: string,
  points = 0,
  opts?: {
    playerName?: string;
    playerId?: string;
    kickerName?: string;
    importance?: MatchEventImportance;
    relatedEventId?: string;
    period?: MatchEventPeriod;
    goldenPoint?: boolean;
  }
): LiveMatchEvent {
  const isKick =
    type === "goal" ||
    type === "conversion" ||
    type === "missed_conversion" ||
    type === "penalty" ||
    type === "penalty_goal" ||
    type === "drop_goal" ||
    type === "missed_drop_goal";

  const cappedMinute =
    type === "full_time"
      ? REGULATION_MATCH_MINUTES
      : opts?.goldenPoint
        ? minute
        : clampRegulationMinute(minute);

  return {
    id,
    minute: cappedMinute,
    type,
    team: side,
    playerName: isKick ? undefined : opts?.playerName,
    playerId: isKick ? undefined : opts?.playerId,
    kickerName: isKick ? opts?.kickerName ?? opts?.playerName : undefined,
    description: eventMinutePrefix(cappedMinute, description),
    points,
    importance: opts?.importance ?? "medium",
    teamId: side,
    teamName: teamName(side, input),
    opponentTeamName: opponentOf(side, input),
    relatedEventId: opts?.relatedEventId,
    period:
      opts?.period ??
      periodForMinute(cappedMinute, { goldenPoint: opts?.goldenPoint }),
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
  return minutes
    .map(clampRegulationMinute)
    .sort((a, b) => a - b);
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

function resolveOpponentScorers(input: GeneratorInput): { name: string }[] {
  if (input.opponentScorers && input.opponentScorers.length > 0) {
    return input.opponentScorers;
  }
  if (input.career) {
    return buildOpponentTryScoringDetail(
      input.opponent,
      Math.max(1, input.oppTries),
      input.seed,
      input.round ?? 1,
      input.career.tactics,
      input.fixtureKey,
      input.career
    );
  }
  return [];
}

function resolveKicker(
  side: TeamSide,
  input: GeneratorInput,
  scorers: { name: string; playerId?: string }[]
): string {
  const teamNames = [input.userClub, input.opponent];
  if (
    side === "user" &&
    input.userKicker &&
    !isInvalidPlayerName(input.userKicker, teamNames)
  ) {
    return input.userKicker;
  }
  if (
    side === "opponent" &&
    input.opponentKicker &&
    !isInvalidPlayerName(input.opponentKicker, teamNames)
  ) {
    return input.opponentKicker;
  }
  const valid = scorers.filter((s) => !isInvalidPlayerName(s.name, teamNames));
  if (valid[0]) return valid[0].name;
  // Last resort for commentary only — never used as a try scorer identity.
  return side === "user" ? "the home kicker" : "the away kicker";
}

function finalizeRegulationEvents(
  events: LiveMatchEvent[],
  input: GeneratorInput
): LiveMatchEvent[] {
  const withoutOverage = events.filter((e) => {
    if (e.type === "full_time") return true;
    if (e.period === "golden_point") return true;
    return e.minute < REGULATION_MATCH_MINUTES;
  });

  const capped = withoutOverage.map((e) => {
    if (e.type === "full_time") {
      return {
        ...e,
        minute: REGULATION_MATCH_MINUTES,
        period: "second_half" as const,
        description: eventMinutePrefix(
          REGULATION_MATCH_MINUTES,
          e.description.replace(/^\d+'?\s*/, "")
        ),
      };
    }
    if (e.period === "golden_point") return e;
    if (e.minute > REGULATION_EVENT_MAX_MINUTE) {
      const minute = REGULATION_EVENT_MAX_MINUTE;
      return {
        ...e,
        minute,
        period: periodForMinute(minute),
        description: eventMinutePrefix(
          minute,
          e.description.replace(/^\d+'?\s*/, "")
        ),
      };
    }
    return {
      ...e,
      period: e.period ?? periodForMinute(e.minute),
    };
  });

  const withoutDupFt = capped.filter((e) => e.type !== "full_time");
  const fullTime =
    capped.find((e) => e.type === "full_time") ??
    ({
      id: "full-time",
      minute: REGULATION_MATCH_MINUTES,
      type: "full_time",
      team: "user",
      description: eventMinutePrefix(
        REGULATION_MATCH_MINUTES,
        formatFullTimeEvent({
          team: input.userClub,
          opponent: input.opponent,
          minute: REGULATION_MATCH_MINUTES,
          score: `${input.userScore}-${input.oppScore}`,
        })
      ),
      points: 0,
      importance: "major",
      period: "second_half",
    } satisfies LiveMatchEvent);

  return [...withoutDupFt, { ...fullTime, minute: REGULATION_MATCH_MINUTES }].sort(
    (a, b) =>
      a.minute - b.minute ||
      (a.id ?? "").localeCompare(b.id ?? "")
  );
}

/** Generate a coherent commentary feed that matches the final scoreline. */
export function generateSimulatedMatchEvents(
  input: GeneratorInput
): LiveMatchEvent[] {
  const events: LiveMatchEvent[] = [];
  const memory = createMatchStoryMemory();
  let eventIndex = 0;
  const nextId = () => `${input.fixtureKey}-ev-${eventIndex++}`;
  // This generator does not emit golden point / ET when draws are allowed.
  void staysInRegulation(input);

  const userTryMinutes = distributeMinutes(
    input.userTries,
    rngFor(input.seed, "ut")
  );
  const oppTryMinutes = distributeMinutes(
    input.oppTries,
    rngFor(input.seed, "ot")
  );

  const teamNames = [input.userClub, input.opponent];
  let userScorers = expandScorerEntries(
    input.userScorers,
    input.userTries,
    teamNames
  );
  if (userScorers.length < input.userTries && input.career) {
    const fromMatchday = [
      ...input.career.matchdayXiii,
      ...input.career.matchdayInterchange,
    ]
      .map((id) => {
        if (!id) return null;
        const fromRegistry = input.career?.playerRegistry?.[id];
        if (fromRegistry?.name) {
          return { name: fromRegistry.name, playerId: id };
        }
        const reserve = input.career?.reserves.find((r) => r.id === id);
        return reserve ? { name: reserve.name, playerId: id } : null;
      })
      .filter(
        (s): s is { name: string; playerId: string } =>
          Boolean(s?.name) && !isInvalidPlayerName(s!.name, teamNames)
      );
    userScorers = expandScorerEntries(
      fromMatchday,
      input.userTries,
      teamNames
    );
  }

  const oppScorerPool = resolveOpponentScorers(input);
  let oppScorers = expandScorerEntries(
    oppScorerPool,
    input.oppTries,
    teamNames
  );
  if (oppScorers.length < input.oppTries) {
    const nrl = generateNrlSquadNames(input.seed, input.opponent, 13);
    if (nrl.length > 0) {
      oppScorers = expandScorerEntries(
        nrl.map((p) => ({ name: p.name, playerId: p.id })),
        input.oppTries,
        teamNames
      );
    }
  }

  const userKicker = resolveKicker("user", input, userScorers);
  const oppKicker = resolveKicker("opponent", input, oppScorers);

  const addTryChain = (
    side: TeamSide,
    minute: number,
    scorer: { name: string; playerId?: string }
  ) => {
    const safeMinute = clampRegulationMinute(minute);
    const rng = rngFor(input.seed, `chain-${side}-${safeMinute}`);
    const kicker = side === "user" ? userKicker : oppKicker;
    let relatedTryId = "";
    const scorerName = scorer.name;

    if (rng() < 0.55) {
      const m = clampRegulationMinute(Math.max(1, safeMinute - 2));
      events.push(
        makeEvent(
          nextId(),
          m,
          side,
          input,
          "six_again",
          commentary("six_again", side, input, m, memory, rng),
          0,
          { importance: "low" }
        )
      );
    }
    if (rng() < 0.4) {
      const breakType: MatchEventType = rng() < 0.5 ? "line_break" : "big_break";
      const m = clampRegulationMinute(Math.max(1, safeMinute - 1));
      events.push(
        makeEvent(
          nextId(),
          m,
          side,
          input,
          breakType,
          commentary(breakType, side, input, m, memory, rng, scorerName),
          0,
          {
            playerName: scorerName,
            playerId: scorer.playerId,
            importance: "medium",
          }
        )
      );
    }

    relatedTryId = nextId();
    events.push(
      makeEvent(
        relatedTryId,
        safeMinute,
        side,
        input,
        "try",
        commentary("try", side, input, safeMinute, memory, rng, scorerName),
        4,
        {
          playerName: scorerName,
          playerId: scorer.playerId,
          importance: "major",
        }
      )
    );

    const convRng = rngFor(input.seed, `conv-${side}-${safeMinute}`);
    if (convRng() < 0.82) {
      events.push(
        makeEvent(
          nextId(),
          safeMinute,
          side,
          input,
          "conversion",
          commentary("conversion", side, input, safeMinute, memory, convRng, undefined, kicker),
          2,
          {
            kickerName: kicker,
            importance: "high",
            relatedEventId: relatedTryId,
          }
        )
      );
    } else {
      events.push(
        makeEvent(
          nextId(),
          safeMinute,
          side,
          input,
          "missed_conversion",
          commentary(
            "missed_conversion",
            side,
            input,
            safeMinute,
            memory,
            convRng,
            undefined,
            kicker
          ),
          0,
          {
            kickerName: kicker,
            importance: "medium",
            relatedEventId: relatedTryId,
          }
        )
      );
    }
  };

  userTryMinutes.forEach((minute, i) => {
    const scorer = userScorers[i];
    if (!scorer || isInvalidPlayerName(scorer.name, teamNames)) return;
    addTryChain("user", minute, scorer);
  });

  oppTryMinutes.forEach((minute, i) => {
    const scorer = oppScorers[i];
    if (!scorer || isInvalidPlayerName(scorer.name, teamNames)) return;
    addTryChain("opponent", minute, scorer);
  });

  const margin = input.userScore - input.oppScore;
  const closeGame = Math.abs(margin) <= 6;
  if (closeGame && input.userScore + input.oppScore > 0) {
    const lateRng = rngFor(input.seed, "late");
    const lateMinute = clampRegulationMinute(68 + Math.floor(lateRng() * 10));

    if (lateRng() < 0.45) {
      const side: TeamSide = margin >= 0 ? "user" : "opponent";
      const kicker = side === "user" ? userKicker : oppKicker;
      if (lateRng() < 0.35) {
        const pressureMin = clampRegulationMinute(lateMinute - 2);
        events.push(
          makeEvent(
            nextId(),
            pressureMin,
            side,
            input,
            "pressure_set",
            commentary("pressure_set", side, input, pressureMin, memory, lateRng),
            0,
            { importance: "medium" }
          )
        );
      }
      events.push(
        makeEvent(
          nextId(),
          lateMinute,
          side,
          input,
          "penalty_goal",
          commentary(
            "penalty_goal",
            side,
            input,
            lateMinute,
            memory,
            lateRng,
            undefined,
            kicker
          ),
          2,
          { kickerName: kicker, importance: "high" }
        )
      );
    }

    if (lateRng() < 0.3) {
      const side: TeamSide = margin >= 0 ? "user" : "opponent";
      const kicker = side === "user" ? userKicker : oppKicker;
      const made = lateRng() < 0.52;
      const dropMinute = clampRegulationMinute(76 + Math.floor(lateRng() * 4));
      events.push(
        makeEvent(
          nextId(),
          dropMinute,
          side,
          input,
          made ? "drop_goal" : "missed_drop_goal",
          commentary(
            made ? "drop_goal" : "missed_drop_goal",
            side,
            input,
            dropMinute,
            memory,
            lateRng,
            undefined,
            kicker
          ),
          made ? 1 : 0,
          { kickerName: kicker, importance: "major" }
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
          { importance: "medium" }
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
  const allPlayerNames = [
    ...userScorers.map((s) => s.name),
    ...oppScorers.map((s) => s.name),
    userKicker,
    oppKicker,
  ].filter((n) => n && !isInvalidPlayerName(n, teamNames));

  for (let i = 0; i < fillerTarget; i++) {
    // Leave room for +2 spacing and keep fillers ≤ 79 (80 is full_time only).
    if (lastFillerMinute >= 78) break;
    const minute = clampRegulationMinute(
      Math.max(lastFillerMinute + 2, 5 + Math.floor(fillerRng() * 74))
    );
    if (minute > REGULATION_EVENT_MAX_MINUTE) break;
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
      fillerType === "try_saver" && allPlayerNames.length > 0
        ? allPlayerNames[Math.floor(fillerRng() * allPlayerNames.length)]
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
        {
          playerName,
          importance: fillerType === "try_saver" ? "medium" : "low",
        }
      )
    );
  }

  if (rngFor(input.seed, "sinbin")() < 0.22 && allPlayerNames.length > 0) {
    const side: TeamSide =
      rngFor(input.seed, "sinbin-side")() < 0.5 ? "user" : "opponent";
    const minute = clampRegulationMinute(
      30 + Math.floor(rngFor(input.seed, "sinbin-m")() * 40)
    );
    const sinPlayer =
      allPlayerNames[Math.floor(rngFor(input.seed, "sinbin-p")() * allPlayerNames.length)]!;
    events.push(
      makeEvent(
        nextId(),
        minute,
        side,
        input,
        "sin_bin",
        commentary(
          "sin_bin",
          side,
          input,
          minute,
          memory,
          rngFor(input.seed, "sinbin-t"),
          sinPlayer
        ),
        0,
        { playerName: sinPlayer, importance: "high" }
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
      { importance: "major", period: "first_half" }
    )
  );
  events.push(
    makeEvent(
      nextId(),
      REGULATION_MATCH_MINUTES,
      "user",
      input,
      "full_time",
      commentary(
        "full_time",
        "user",
        input,
        REGULATION_MATCH_MINUTES,
        memory,
        rngFor(input.seed, "ft")
      ),
      0,
      { importance: "major", period: "second_half" }
    )
  );

  return finalizeRegulationEvents(events, input);
}

export function generateEventsFromFixture(
  career: ManagerCareer,
  fixture: MatchFixture,
  fixtureKey: string,
  sched?: Pick<ManagerScheduledFixture, "competition" | "opponent">
): LiveMatchEvent[] {
  const scorers =
    fixture.scoringDetail?.dreamTeam.tryScorers.map((s) => ({
      name: s.name,
      playerId: s.playerId,
      tries: s.tries,
    })) ?? [];
  let oppScorers =
    fixture.scoringDetail?.opponent.tryScorers.map((s) => ({
      name: s.name,
      playerId: s.playerId,
      tries: s.tries,
    })) ?? [];

  if (sched?.competition === "world_club_challenge") {
    const nrlSquad = generateNrlSquadNames(
      career.seed,
      sched.opponent,
      13
    );
    oppScorers = nrlSquad.map((p) => ({
      name: p.name,
      playerId: p.id,
      tries: 0,
    }));
  }

  const userKicker = fixture.scoringDetail?.dreamTeam.kicking?.name;
  const oppKicker =
    sched?.competition === "world_club_challenge" && oppScorers.length > 0
      ? (oppScorers[6]?.name ?? oppScorers[0]?.name)
      : fixture.scoringDetail?.opponent.kicking?.name;

  const competition = sched?.competition ?? "league";
  const allowsDraw = competition === "league" || competition === "friendly";

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
    opponentScorers: oppScorers,
    userKicker,
    opponentKicker: oppKicker,
    career,
    round: fixture.round,
    competition,
    allowsDraw,
  });

  fixture.matchBio = buildMatchStoryFromEvents(
    events.map((e) => ({
      id: e.id ?? "",
      minute: e.minute,
      teamId: e.teamId ?? e.team,
      teamName: e.teamName ?? (e.team === "user" ? career.club : fixture.opponent),
      playerName: e.playerName,
      kickerName: e.kickerName,
      type: e.type as MatchEventType,
      description: e.description,
      importance: e.importance ?? "medium",
    })),
    career.club
  );

  return events;
}
