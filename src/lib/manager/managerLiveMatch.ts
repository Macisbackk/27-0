import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import { snapToRLScore, decomposeRLScore } from "../game/rl-scores";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import { getPlayerById } from "../players";
import type { Position } from "../types";
import type {
  LiveMatchCommand,
  ManagerCareer,
  ManagerCompetition,
  ManagerScheduledFixture,
  LiveMatchEvent,
} from "./types";
import { computeManagerTeamRating } from "./managerRating";

export type { LiveMatchEvent };

export interface LiveMatchState {
  minute: number;
  userScore: number;
  oppScore: number;
  userTries: number;
  oppTries: number;
  command: LiveMatchCommand;
  momentum: number;
  events: LiveMatchEvent[];
  effectivenessLine: string;
  isComplete: boolean;
  opponent: string;
  isHome: boolean;
  round: number;
  fixtureId: string;
  competition: ManagerCompetition;
  seed: string;
}

const COMMAND_LABELS: Record<LiveMatchCommand, string> = {
  attack: "Attack",
  defend: "Defend",
  balanced: "Balanced",
  kick_early: "Kick Early",
  use_forwards: "Use Forwards",
  spread_wide: "Spread Wide",
  calm_down: "Calm Down",
};

export function getLiveCommandLabel(cmd: LiveMatchCommand): string {
  return COMMAND_LABELS[cmd];
}

export function formatLiveClock(minute: number): string {
  return `${Math.min(80, Math.max(0, minute))}:00`;
}

function commandAttackMod(cmd: LiveMatchCommand): {
  userChance: number;
  oppChance: number;
  errorRisk: number;
  momentumShift: number;
} {
  switch (cmd) {
    case "attack":
      return { userChance: 1.35, oppChance: 1.1, errorRisk: 1.15, momentumShift: 3 };
    case "defend":
      return { userChance: 0.75, oppChance: 0.85, errorRisk: 0.8, momentumShift: -2 };
    case "kick_early":
      return { userChance: 0.95, oppChance: 0.9, errorRisk: 0.75, momentumShift: 1 };
    case "use_forwards":
      return { userChance: 1.2, oppChance: 1.0, errorRisk: 1.05, momentumShift: 2 };
    case "spread_wide":
      return { userChance: 1.15, oppChance: 1.05, errorRisk: 1.1, momentumShift: 2 };
    case "calm_down":
      return { userChance: 0.88, oppChance: 0.92, errorRisk: 0.65, momentumShift: 0 };
    default:
      return { userChance: 1, oppChance: 1, errorRisk: 1, momentumShift: 0 };
  }
}

function tacticCommandBias(
  career: ManagerCareer,
  cmd: LiveMatchCommand
): { userChance: number; oppChance: number } {
  if (cmd !== "balanced") return { userChance: 1, oppChance: 1 };
  const t = career.tactics;
  let userChance = 1;
  let oppChance = 1;
  if (t.playingStyle === "expansive") userChance += 0.08;
  if (t.playingStyle === "defensive") oppChance -= 0.06;
  if (t.playingStyle === "direct") userChance += 0.05;
  if (t.defenceFocus === "conservative") oppChance -= 0.05;
  return { userChance, oppChance };
}

const FORWARD_POSITIONS: Position[] = [
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];
const BACK_POSITIONS: Position[] = [
  "WING",
  "CENTRE",
  "FULLBACK",
  "STAND_OFF",
  "SCRUM_HALF",
];

function pickScorer(
  career: ManagerCareer,
  command: LiveMatchCommand,
  rng: () => number
): string {
  const pool: string[] = [];
  for (let i = 0; i < career.matchdayXiii.length; i++) {
    const id = career.matchdayXiii[i]!;
    const pos = career.xiiiSlotPositions[i];
    if (!id || !pos) continue;
    const preferForward =
      command === "use_forwards" ||
      (command === "balanced" && career.tactics.attackFocus === "middle");
    const preferBack =
      command === "spread_wide" ||
      (command === "balanced" && career.tactics.attackFocus === "edges");
    if (preferForward && FORWARD_POSITIONS.includes(pos)) pool.push(id);
    else if (preferBack && BACK_POSITIONS.includes(pos)) pool.push(id);
    else pool.push(id);
  }
  const pick = pool[Math.floor(rng() * pool.length)] ?? career.matchdayXiii[0];
  return getPlayerById(pick ?? "")?.name ?? career.club;
}

function pickKicker(career: ManagerCareer, rng: () => number): string {
  const halves = career.matchdayXiii.filter((id, i) => {
    const pos = career.xiiiSlotPositions[i];
    return pos === "SCRUM_HALF" || pos === "STAND_OFF";
  });
  const id = halves[Math.floor(rng() * halves.length)] ?? career.matchdayXiii[6];
  return getPlayerById(id ?? "")?.name ?? "Kicker";
}

function effectivenessFromCommand(
  cmd: LiveMatchCommand,
  momentum: number
): string {
  if (cmd === "use_forwards" && momentum > 15) {
    return "Good — your pack is winning territory.";
  }
  if (cmd === "spread_wide" && momentum > 10) {
    return "The edges are creating space out wide.";
  }
  if (cmd === "defend" && momentum < -10) {
    return "Under pressure — defensive line holding for now.";
  }
  if (cmd === "attack" && momentum > 20) {
    return "Dangerous — attack is flowing.";
  }
  if (cmd === "calm_down") {
    return "Settled — fewer errors, less risk.";
  }
  if (cmd === "kick_early") {
    return "Territory game — kicking for position.";
  }
  return "Even contest — keep adjusting.";
}

function rollTryChance(
  rating: number,
  oppRating: number,
  isHome: boolean,
  momentum: number,
  mod: number,
  rng: () => number
): boolean {
  const diff = rating - oppRating + (isHome ? 2 : 0) + momentum * 0.08;
  const base = 0.055 + mod * 0.035;
  const prob = base + diff * 0.004;
  return rng() < Math.max(0.015, Math.min(0.2, prob));
}

export function createLiveMatch(
  career: ManagerCareer,
  sched: ManagerScheduledFixture
): LiveMatchState {
  return {
    minute: 0,
    userScore: 0,
    oppScore: 0,
    userTries: 0,
    oppTries: 0,
    command: "balanced",
    momentum: 0,
    events: [],
    effectivenessLine: "Kick-off — the clock is running.",
    isComplete: false,
    opponent: sched.opponent,
    isHome: sched.isHome,
    round: sched.round,
    fixtureId: sched.id,
    competition: sched.competition ?? "league",
    seed: career.seed,
  };
}

/** Advance the live match by one game minute. */
export function advanceLiveMinute(
  state: LiveMatchState,
  career: ManagerCareer,
  command: LiveMatchCommand
): LiveMatchState {
  if (state.isComplete || state.minute >= 80) {
    return finalizeLiveMatch(state);
  }

  const minute = state.minute + 1;
  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
  const oppRating = getOpponentMatchRating(
    state.opponent,
    state.seed,
    state.round,
    { currentSeasonOnly: true }
  );

  const rng = seedrandom(
    `${state.seed}-live-${state.fixtureId}-m${minute}-${command}`
  );
  const mods = commandAttackMod(command);
  const tacticBias = tacticCommandBias(career, command);
  let momentum = state.momentum + mods.momentumShift;
  let userScore = state.userScore;
  let oppScore = state.oppScore;
  let userTries = state.userTries;
  let oppTries = state.oppTries;
  const events = [...state.events];

  const userTry = rollTryChance(
    userRating,
    oppRating,
    state.isHome,
    momentum,
    mods.userChance * tacticBias.userChance,
    rng
  );
  const oppTry =
    !userTry &&
    rollTryChance(
      oppRating,
      userRating,
      !state.isHome,
      -momentum,
      mods.oppChance * tacticBias.oppChance,
      rng
    );

  if (userTry) {
    userTries++;
    userScore += 4;
    const scorer = pickScorer(career, command, rng);
    events.push({
      minute,
      type: "try",
      team: "user",
      playerName: scorer,
      description: `${minute}' Try — ${scorer}`,
      points: 4,
    });
    const goal = rng() < 0.82;
    if (goal) {
      userScore += 2;
      const kicker = pickKicker(career, rng);
      events.push({
        minute,
        type: "goal",
        team: "user",
        playerName: kicker,
        description: `${minute}' Goal — ${kicker}`,
        points: 2,
      });
    }
    momentum += 8;
  } else if (oppTry) {
    oppTries++;
    oppScore += 4;
    events.push({
      minute,
      type: "try",
      team: "opponent",
      description: `${minute}' Try — ${state.opponent}`,
      points: 4,
    });
    const goal = rng() < 0.8;
    if (goal) {
      oppScore += 2;
      events.push({
        minute,
        type: "goal",
        team: "opponent",
        description: `${minute}' Goal — ${state.opponent}`,
        points: 2,
      });
    }
    momentum -= 8;
  } else if (rng() < 0.018 * mods.errorRisk) {
    events.push({
      minute,
      type: "note",
      team: "user",
      description: `${minute}' Error under pressure`,
      points: 0,
    });
    momentum -= 3;
  } else if (command === "kick_early" && rng() < 0.04) {
    events.push({
      minute,
      type: "note",
      team: "user",
      description: `${minute}' Good kick — strong field position`,
      points: 0,
    });
    momentum += 2;
  }

  const isComplete = minute >= 80;
  let finalUser = userScore;
  let finalOpp = oppScore;
  if (isComplete && finalUser === finalOpp) {
    finalUser += 2;
    const kicker = pickKicker(career, rng);
    events.push({
      minute: 80,
      type: "penalty",
      team: "user",
      playerName: kicker,
      description: `80' Penalty Goal — ${kicker}`,
      points: 2,
    });
  }

  return {
    ...state,
    minute,
    userScore: finalUser,
    oppScore: finalOpp,
    userTries,
    oppTries,
    command,
    momentum: Math.max(-50, Math.min(50, momentum)),
    events: events.slice(-20),
    effectivenessLine: effectivenessFromCommand(command, momentum),
    isComplete,
  };
}

export function advanceLiveToFullTime(
  state: LiveMatchState,
  career: ManagerCareer,
  command: LiveMatchCommand
): LiveMatchState {
  let next = state;
  let guard = 0;
  while (!next.isComplete && guard < 85) {
    next = advanceLiveMinute(next, career, command);
    guard++;
  }
  return finalizeLiveMatch(next);
}

function finalizeLiveMatch(state: LiveMatchState): LiveMatchState {
  let userScore = snapToRLScore(state.userScore, false);
  let oppScore = snapToRLScore(state.oppScore, false);
  if (userScore === oppScore) userScore += 2;
  return {
    ...state,
    minute: 80,
    userScore,
    oppScore,
    isComplete: true,
    effectivenessLine: "Full time — the hooter has gone.",
  };
}

export function liveMatchToFixture(
  state: LiveMatchState,
  career: ManagerCareer
): MatchFixture {
  const pf = snapToRLScore(state.userScore, false);
  const pa = snapToRLScore(state.oppScore, false);
  const finalPf = pf <= pa && state.isComplete ? pf + (pf === pa ? 2 : 0) : pf;
  const won = finalPf > pa;
  const scoringFor = decomposeRLScore(finalPf);
  const scoringAgainst = decomposeRLScore(pa);

  return {
    round: state.round,
    opponent: state.opponent,
    isHome: state.isHome,
    pointsFor: finalPf,
    pointsAgainst: pa,
    triesFor: scoringFor.tries,
    triesAgainst: scoringAgainst.tries,
    scoringFor,
    scoringAgainst,
    result: won ? "W" : "L",
    isUpset: false,
    isThrashing: Math.abs(finalPf - pa) >= 20,
  };
}

export function getLiveMatchEvents(state: LiveMatchState): LiveMatchEvent[] {
  return state.events;
}
