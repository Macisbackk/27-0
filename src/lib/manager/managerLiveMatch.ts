import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import { snapToRLScore, decomposeRLScore } from "../game/rl-scores";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import type { LiveMatchCommand, ManagerCareer, ManagerScheduledFixture } from "./types";
import { computeManagerTeamRating } from "./managerRating";
import { getMatchPrediction } from "./managerScoring";

export interface LiveMatchEvent {
  minute: number;
  type: "try" | "goal" | "penalty" | "drop_goal" | "note";
  team: "user" | "opponent";
  playerName?: string;
  description: string;
}

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
}

const CHUNK_MINUTES = 5;

const COMMAND_LABELS: Record<LiveMatchCommand, string> = {
  attack: "Attack",
  defend: "Defend",
  balanced: "Balanced",
  kick_early: "Kick Early",
  use_forwards: "Use Forwards",
  spread_wide: "Spread Wide",
  calm_down: "Calm Down / Low Risk",
};

export function getLiveCommandLabel(cmd: LiveMatchCommand): string {
  return COMMAND_LABELS[cmd];
}

function commandAttackMod(cmd: LiveMatchCommand): {
  userChance: number;
  oppChance: number;
  fatigue: number;
  errorRisk: number;
  momentumShift: number;
} {
  switch (cmd) {
    case "attack":
      return { userChance: 1.35, oppChance: 1.1, fatigue: 1.2, errorRisk: 1.15, momentumShift: 3 };
    case "defend":
      return { userChance: 0.75, oppChance: 0.85, fatigue: 0.9, errorRisk: 0.8, momentumShift: -2 };
    case "kick_early":
      return { userChance: 0.95, oppChance: 0.9, fatigue: 0.85, errorRisk: 0.75, momentumShift: 1 };
    case "use_forwards":
      return { userChance: 1.2, oppChance: 1.0, fatigue: 1.15, errorRisk: 1.05, momentumShift: 2 };
    case "spread_wide":
      return { userChance: 1.15, oppChance: 1.05, fatigue: 1.1, errorRisk: 1.1, momentumShift: 2 };
    case "calm_down":
      return { userChance: 0.88, oppChance: 0.92, fatigue: 0.8, errorRisk: 0.65, momentumShift: 0 };
    default:
      return { userChance: 1, oppChance: 1, fatigue: 1, errorRisk: 1, momentumShift: 0 };
  }
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
    effectivenessLine: "Kick-off — issue a command to shape the contest.",
    isComplete: false,
    opponent: sched.opponent,
    isHome: sched.isHome,
    round: sched.round,
  };
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
  const base = 0.06 + mod * 0.04;
  const prob = base + diff * 0.004;
  return rng() < Math.max(0.02, Math.min(0.22, prob));
}

export function advanceLiveMatch(
  state: LiveMatchState,
  career: ManagerCareer,
  command: LiveMatchCommand
): LiveMatchState {
  if (state.isComplete) return state;

  const sched = career.schedule.find((s) => s.round === state.round);
  if (!sched) return state;

  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
  const oppRating = getOpponentMatchRating(
    sched.opponent,
    career.seed,
    sched.round,
    { currentSeasonOnly: true }
  );

  const rng = seedrandom(
    `${career.seed}-live-r${sched.round}-m${state.minute}-${command}`
  );
  const mods = commandAttackMod(command);
  let momentum = state.momentum + mods.momentumShift;
  let userScore = state.userScore;
  let oppScore = state.oppScore;
  let userTries = state.userTries;
  let oppTries = state.oppTries;
  const events = [...state.events];
  let minute = state.minute;

  for (let step = 0; step < CHUNK_MINUTES; step++) {
    minute++;
    if (minute > 80) break;

    const userTry = rollTryChance(
      userRating,
      oppRating,
      sched.isHome,
      momentum,
      mods.userChance,
      rng
    );
    const oppTry = rollTryChance(
      oppRating,
      userRating,
      !sched.isHome,
      -momentum,
      mods.oppChance,
      rng
    );

    if (userTry) {
      userTries++;
      userScore += 4;
      const goal = rng() < 0.82;
      if (goal) userScore += 2;
      momentum += 8;
      events.push({
        minute,
        type: "try",
        team: "user",
        description: `${minute}' Try — ${career.club}`,
      });
      if (goal) {
        events.push({
          minute,
          type: "goal",
          team: "user",
          description: `${minute}' Goal`,
        });
      }
    } else if (oppTry) {
      oppTries++;
      oppScore += 4;
      const goal = rng() < 0.8;
      if (goal) oppScore += 2;
      momentum -= 8;
      events.push({
        minute,
        type: "try",
        team: "opponent",
        description: `${minute}' Try — ${sched.opponent}`,
      });
      if (goal) {
        events.push({
          minute,
          type: "goal",
          team: "opponent",
          description: `${minute}' Goal — ${sched.opponent}`,
        });
      }
    } else if (rng() < 0.03 * mods.errorRisk) {
      events.push({
        minute,
        type: "note",
        team: "user",
        description: `${minute}' Error under pressure`,
      });
      momentum -= 3;
    }
  }

  userScore = snapToRLScore(userScore, false);
  oppScore = snapToRLScore(oppScore, false);
  if (userScore === oppScore && minute >= 80) {
    userScore += 2;
  }

  const isComplete = minute >= 80;
  return {
    ...state,
    minute: Math.min(80, minute),
    userScore,
    oppScore,
    userTries,
    oppTries,
    command,
    momentum: Math.max(-50, Math.min(50, momentum)),
    events: events.slice(-12),
    effectivenessLine: effectivenessFromCommand(command, momentum),
    isComplete,
  };
}

export function liveMatchToFixture(
  state: LiveMatchState,
  career: ManagerCareer
): MatchFixture {
  const won = state.userScore > state.oppScore;
  const pf = snapToRLScore(state.userScore, false);
  const pa = snapToRLScore(state.oppScore, false);
  const scoringFor = decomposeRLScore(pf);
  const scoringAgainst = decomposeRLScore(pa);

  const fixture: MatchFixture = {
    round: state.round,
    opponent: state.opponent,
    isHome: state.isHome,
    pointsFor: pf,
    pointsAgainst: pa,
    triesFor: scoringFor.tries,
    triesAgainst: scoringAgainst.tries,
    scoringFor,
    scoringAgainst,
    result: won ? "W" : "L",
    isUpset: false,
    isThrashing: Math.abs(pf - pa) >= 20,
  };

  return fixture;
}

export function getLiveMatchPrediction(career: ManagerCareer): string {
  const sched = career.schedule[career.currentRound];
  if (!sched) return "";
  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
  const oppRating = getOpponentMatchRating(
    sched.opponent,
    career.seed,
    sched.round,
    { currentSeasonOnly: true }
  );
  return getMatchPrediction(userRating, oppRating, sched.isHome);
}
