import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import { snapToRLScore, decomposeRLScore } from "../game/rl-scores";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import type { Position } from "../types";
import type {
  LiveMatchCommand,
  LiveMatchPhase,
  ManagerCareer,
  ManagerCompetition,
  ManagerScheduledFixture,
  LiveMatchEvent,
} from "./types";
import { computeManagerTeamRating } from "./managerRating";
import { getManagerPlayer, getManagerPlayerEligiblePositions } from "./managerPlayers";
import { getMatchdayTryWeight } from "./managerTryScoring";
import { previewManagerMatchScoreline } from "./managerSimulation";

export type { LiveMatchEvent };

export const REAL_TICK_MS = 500;
export const GAME_MINUTES_PER_TICK = 2;
export const HALFTIME_MINUTE = 40;

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
  isPlaying: boolean;
  phase: LiveMatchPhase;
  opponent: string;
  isHome: boolean;
  round: number;
  fixtureId: string;
  competition: ManagerCompetition;
  seed: string;
  targetPointsFor: number;
  targetPointsAgainst: number;
  targetTriesFor: number;
  targetTriesAgainst: number;
}

const COMMAND_LABELS: Record<LiveMatchCommand, string> = {
  attack: "Attack",
  defend: "Defend",
  balanced: "Balanced",
  use_forwards: "Use Forwards",
  spread_wide: "Spread Wide",
};

export function getLiveCommandLabel(cmd: LiveMatchCommand): string {
  return COMMAND_LABELS[cmd];
}

/** Map saved tactics to the live command used when simulating from the hub. */
export function commandFromTactics(career: ManagerCareer): LiveMatchCommand {
  const { playingStyle, attackFocus, defenceFocus } = career.tactics;

  if (
    playingStyle === "defensive" ||
    defenceFocus === "conservative" ||
    defenceFocus === "goal_line"
  ) {
    return "defend";
  }
  if (attackFocus === "middle" || playingStyle === "direct") {
    return "use_forwards";
  }
  if (attackFocus === "edges" || playingStyle === "expansive") {
    return "spread_wide";
  }
  if (
    playingStyle === "high_tempo" ||
    attackFocus === "offloads" ||
    defenceFocus === "aggressive_contact"
  ) {
    return "attack";
  }
  return "balanced";
}

export function formatLiveClock(minute: number): string {
  return `${Math.min(80, Math.max(0, minute))}:00`;
}

export function getMatchStatusLabel(
  userScore: number,
  oppScore: number,
  isHome: boolean
): { pill: string; line: string; tone: "win" | "loss" | "level" } {
  const margin = userScore - oppScore;
  if (margin > 0) {
    return {
      pill: "Winning",
      line: `Winning by ${margin}`,
      tone: "win",
    };
  }
  if (margin < 0) {
    return {
      pill: "Losing",
      line: `Losing by ${Math.abs(margin)}`,
      tone: "loss",
    };
  }
  return {
    pill: "Level",
    line: `Level at ${userScore}-${oppScore}`,
    tone: "level",
  };
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
    case "use_forwards":
      return { userChance: 1.2, oppChance: 1.0, errorRisk: 1.05, momentumShift: 2 };
    case "spread_wide":
      return { userChance: 1.15, oppChance: 1.05, errorRisk: 1.1, momentumShift: 2 };
    default:
      return { userChance: 1, oppChance: 1, errorRisk: 1, momentumShift: 0 };
  }
}

function tacticCommandBias(
  career: ManagerCareer,
  cmd: LiveMatchCommand
): { userChance: number; oppChance: number } {
  const t = career.tactics;
  const scale = cmd === "balanced" ? 1 : 0.45;
  let userChance = 1;
  let oppChance = 1;
  if (t.playingStyle === "expansive") userChance += 0.08 * scale;
  if (t.playingStyle === "defensive") oppChance -= 0.06 * scale;
  if (t.playingStyle === "direct") userChance += 0.05 * scale;
  if (t.defenceFocus === "conservative") oppChance -= 0.05 * scale;
  if (cmd === "use_forwards" && t.attackFocus === "middle") {
    userChance += 0.06;
  }
  if (cmd === "spread_wide" && t.attackFocus === "edges") {
    userChance += 0.06;
  }
  if (cmd === "defend" && t.defenceFocus === "goal_line") {
    oppChance -= 0.05;
  }
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

function scorerPositionBias(
  pos: Position,
  command: LiveMatchCommand,
  attackFocus: ManagerCareer["tactics"]["attackFocus"]
): number {
  const preferForward =
    command === "use_forwards" ||
    (command === "balanced" && attackFocus === "middle");
  const preferBack =
    command === "spread_wide" ||
    (command === "balanced" && attackFocus === "edges");
  if (preferForward && FORWARD_POSITIONS.includes(pos)) return 1.12;
  if (preferBack && BACK_POSITIONS.includes(pos)) return 1.12;
  return 1;
}

function pickWeightedId(
  weighted: { id: string; weight: number }[],
  rng: () => number
): string | undefined {
  const sum = weighted.reduce((acc, entry) => acc + entry.weight, 0);
  if (sum <= 0) return weighted[0]?.id;
  let roll = rng() * sum;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]?.id;
}

function pickScorer(
  career: ManagerCareer,
  command: LiveMatchCommand,
  rng: () => number
): { id: string; name: string } {
  const weighted: { id: string; weight: number }[] = [];

  for (let i = 0; i < career.matchdayXiii.length; i++) {
    const id = career.matchdayXiii[i];
    const pos = career.xiiiSlotPositions[i];
    if (!id || !pos) continue;
    weighted.push({
      id,
      weight:
        getMatchdayTryWeight(pos, false) *
        scorerPositionBias(pos, command, career.tactics.attackFocus),
    });
  }

  for (const id of career.matchdayInterchange) {
    if (!id) continue;
    const positions = getManagerPlayerEligiblePositions(career, id);
    const pos = positions[0];
    if (!pos) continue;
    weighted.push({
      id,
      weight:
        getMatchdayTryWeight(pos, true) *
        scorerPositionBias(pos, command, career.tactics.attackFocus),
    });
  }

  const pick =
    pickWeightedId(weighted, rng) ?? career.matchdayXiii[0] ?? career.matchdayInterchange[0];
  const player = getManagerPlayer(career, pick ?? "");
  return {
    id: pick ?? "",
    name: player?.name ?? career.club,
  };
}

function pickKicker(career: ManagerCareer, rng: () => number): string {
  const halves: { id: string; weight: number }[] = [];

  for (let i = 0; i < career.matchdayXiii.length; i++) {
    const id = career.matchdayXiii[i];
    const pos = career.xiiiSlotPositions[i];
    if (!id || !pos) continue;
    if (pos === "SCRUM_HALF" || pos === "STAND_OFF") {
      halves.push({ id, weight: getMatchdayTryWeight(pos, false) });
    }
  }

  for (const id of career.matchdayInterchange) {
    if (!id) continue;
    const positions = getManagerPlayerEligiblePositions(career, id);
    const halfPos = positions.find(
      (p) => p === "SCRUM_HALF" || p === "STAND_OFF"
    );
    if (halfPos) {
      halves.push({ id, weight: getMatchdayTryWeight(halfPos, true) });
    }
  }

  const id =
    pickWeightedId(halves, rng) ??
    career.matchdayXiii[6] ??
    career.matchdayInterchange[0];
  return getManagerPlayer(career, id ?? "")?.name ?? "Kicker";
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
  return "Even contest — keep adjusting.";
}

function dominanceNote(
  userRating: number,
  oppRating: number,
  momentum: number,
  minute: number,
  rng: () => number
): LiveMatchEvent | null {
  const diff = userRating - oppRating;
  if (diff <= -8 && momentum < -12 && rng() < 0.35) {
    return {
      minute,
      type: "note",
      team: "opponent",
      description: `${minute}' ${diff <= -12 ? "Opponents dominating possession" : "Under heavy pressure in defence"}`,
      points: 0,
    };
  }
  if (diff >= 8 && momentum > 12 && rng() < 0.3) {
    return {
      minute,
      type: "note",
      team: "user",
      description: `${minute}' Camped in the opposition half`,
      points: 0,
    };
  }
  if (Math.abs(momentum) > 18 && rng() < 0.22) {
    return {
      minute,
      type: "note",
      team: momentum > 0 ? "user" : "opponent",
      description: `${minute}' ${momentum > 0 ? "Momentum with your side" : "Opponents on top at the moment"}`,
      points: 0,
    };
  }
  return null;
}

function rollTryChance(
  rating: number,
  oppRating: number,
  isHome: boolean,
  momentum: number,
  mod: number,
  rng: () => number
): boolean {
  const ratingDiff = rating - oppRating;
  const diff =
    ratingDiff + (isHome ? 3 : 0) + momentum * 0.06;
  const base = 0.038 + mod * 0.028;
  let prob = base + diff * 0.007;
  if (ratingDiff >= 12) prob += 0.025;
  else if (ratingDiff >= 6) prob += 0.012;
  else if (ratingDiff <= -12) prob -= 0.025;
  else if (ratingDiff <= -6) prob -= 0.012;
  return rng() < Math.max(0.01, Math.min(0.22, prob));
}

export function createLiveMatch(
  career: ManagerCareer,
  sched: ManagerScheduledFixture
): LiveMatchState {
  const preview = previewManagerMatchScoreline(career, sched);
  return {
    minute: 0,
    userScore: 0,
    oppScore: 0,
    userTries: 0,
    oppTries: 0,
    command: "balanced",
    momentum: 0,
    events: [],
    effectivenessLine: "Ready for kick-off — press Start Game when you're set.",
    isComplete: false,
    isPlaying: false,
    phase: "preview",
    opponent: sched.opponent,
    isHome: sched.isHome,
    round: sched.round,
    fixtureId: sched.id,
    competition: sched.competition ?? "league",
    seed: career.seed,
    targetPointsFor: preview.pointsFor,
    targetPointsAgainst: preview.pointsAgainst,
    targetTriesFor: preview.triesFor,
    targetTriesAgainst: preview.triesAgainst,
  };
}

/** Advance live match; stops at maxMinute (40 for half-time, 80 for full time). */
export function advanceLiveTick(
  state: LiveMatchState,
  career: ManagerCareer,
  command: LiveMatchCommand,
  maxMinute = 80
): LiveMatchState {
  if (state.isComplete || state.minute >= maxMinute) {
    if (maxMinute >= 80 && state.minute >= 80) {
      return finalizeLiveMatch(state);
    }
    return { ...state, minute: Math.min(state.minute, maxMinute), isPlaying: false };
  }

  let minute = state.minute;
  let momentum = state.momentum;
  let userScore = state.userScore;
  let oppScore = state.oppScore;
  let userTries = state.userTries;
  let oppTries = state.oppTries;
  const events = [...state.events];

  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions,
    career
  );
  const oppRating = getOpponentMatchRating(
    state.opponent,
    state.seed,
    state.round,
    { currentSeasonOnly: true }
  );

  const mods = commandAttackMod(command);
  const tacticBias = tacticCommandBias(career, command);

  for (let step = 0; step < GAME_MINUTES_PER_TICK; step++) {
    minute++;
    if (minute > maxMinute) break;

    const rng = seedrandom(
      `${state.seed}-live-${state.fixtureId}-m${minute}-${command}`
    );
    momentum += mods.momentumShift * 0.5;

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

    const note = dominanceNote(userRating, oppRating, momentum, minute, rng);
    if (note) events.push(note);

    if (userTry) {
      userTries++;
      userScore += 4;
      const scorer = pickScorer(career, command, rng);
      events.push({
        minute,
        type: "try",
        team: "user",
        playerName: scorer.name,
        description: `${minute}' Try — ${scorer.name}`,
        points: 4,
      });
      if (rng() < 0.82) {
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
      if (rng() < 0.8) {
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
    }
  }

  const isComplete = minute >= 80;
  const atHalftime = minute >= HALFTIME_MINUTE && maxMinute <= HALFTIME_MINUTE;
  let finalUser = userScore;
  let finalOpp = oppScore;
  if (isComplete && finalUser === finalOpp) {
    finalUser += 2;
    const rng = seedrandom(`${state.seed}-live-ft-${state.fixtureId}`);
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
    minute: Math.min(maxMinute, minute),
    userScore: finalUser,
    oppScore: finalOpp,
    userTries,
    oppTries,
    command,
    momentum: Math.max(-50, Math.min(50, momentum)),
    events,
    effectivenessLine: atHalftime
      ? "Half time — review the first half and set your command."
      : effectivenessFromCommand(command, momentum),
    isComplete,
    isPlaying: !isComplete && !atHalftime,
    phase: isComplete
      ? "full_time"
      : atHalftime
        ? "halftime"
        : minute > 0
          ? minute < HALFTIME_MINUTE
            ? "first_half"
            : "second_half"
          : state.phase,
  };
}

export function advanceLiveMinute(
  state: LiveMatchState,
  career: ManagerCareer,
  command: LiveMatchCommand
): LiveMatchState {
  return advanceLiveTick(state, career, command);
}

function schedFromLiveState(state: LiveMatchState): ManagerScheduledFixture {
  return {
    id: state.fixtureId,
    round: state.round,
    opponent: state.opponent,
    isHome: state.isHome,
    competition: state.competition ?? "league",
    label: `Round ${state.round}`,
  };
}

function isColdStartSimulate(state: LiveMatchState): boolean {
  return (
    state.phase === "preview" ||
    (state.minute === 0 &&
      state.userScore === 0 &&
      state.oppScore === 0 &&
      state.events.length === 0)
  );
}

function tryCountFromState(state: LiveMatchState, team: "user" | "opponent"): number {
  const fromEvents = state.events.filter(
    (e) => e.type === "try" && e.team === team
  ).length;
  if (team === "user") {
    return Math.max(state.userTries, fromEvents);
  }
  return Math.max(state.oppTries, fromEvents);
}

function applyPreviewFullTime(
  state: LiveMatchState,
  preview: MatchFixture
): LiveMatchState {
  return {
    ...state,
    minute: 80,
    userScore: preview.pointsFor,
    oppScore: preview.pointsAgainst,
    userTries: preview.triesFor,
    oppTries: preview.triesAgainst,
    targetPointsFor: preview.pointsFor,
    targetPointsAgainst: preview.pointsAgainst,
    targetTriesFor: preview.triesFor,
    targetTriesAgainst: preview.triesAgainst,
    isComplete: true,
    isPlaying: false,
    phase: "full_time",
    effectivenessLine: "Full time — match simulated to the final whistle.",
  };
}

/** Finish from in-progress live scores toward targets set at kick-off. */
function completeMidGameToTarget(state: LiveMatchState): LiveMatchState {
  const targetFor = state.targetPointsFor;
  const targetAgainst = state.targetPointsAgainst;
  const targetTriesFor = state.targetTriesFor;
  const targetTriesAgainst = state.targetTriesAgainst;

  const minute =
    state.phase === "halftime"
      ? HALFTIME_MINUTE
      : Math.min(state.minute, 80);
  const shareRemaining = Math.max(0, (80 - minute) / 80);

  const curFor = snapToRLScore(state.userScore, false);
  const curAgainst = snapToRLScore(state.oppScore, false);

  let finalFor =
    curFor + Math.round(Math.max(0, targetFor - curFor) * shareRemaining);
  let finalAgainst =
    curAgainst +
    Math.round(Math.max(0, targetAgainst - curAgainst) * shareRemaining);

  finalFor = snapToRLScore(finalFor, false);
  finalAgainst = snapToRLScore(finalAgainst, false);
  finalFor = Math.max(finalFor, curFor);
  finalAgainst = Math.max(finalAgainst, curAgainst);

  if (finalFor === finalAgainst) {
    if (targetFor > targetAgainst) finalFor += 2;
    else if (targetAgainst > targetFor) finalAgainst += 2;
    else finalFor += 2;
  }

  const curTriesFor = tryCountFromState(state, "user");
  const curTriesAgainst = tryCountFromState(state, "opponent");
  const finalTriesFor =
    curTriesFor +
    Math.round(Math.max(0, targetTriesFor - curTriesFor) * shareRemaining);
  const finalTriesAgainst =
    curTriesAgainst +
    Math.round(Math.max(0, targetTriesAgainst - curTriesAgainst) * shareRemaining);

  return {
    ...state,
    minute: 80,
    userScore: finalFor,
    oppScore: finalAgainst,
    userTries: Math.max(finalTriesFor, curTriesFor),
    oppTries: Math.max(finalTriesAgainst, curTriesAgainst),
    isComplete: true,
    isPlaying: false,
    phase: "full_time",
    effectivenessLine: "Full time — match simulated to the final whistle.",
  };
}

export function advanceLiveToFullTime(
  state: LiveMatchState,
  career: ManagerCareer,
  _command: LiveMatchCommand
): LiveMatchState {
  if (!isColdStartSimulate(state)) {
    return completeMidGameToTarget(state);
  }

  const preview = previewManagerMatchScoreline(career, schedFromLiveState(state));
  return applyPreviewFullTime(state, preview);
}

function finalizeLiveMatch(state: LiveMatchState): LiveMatchState {
  let userScore = snapToRLScore(state.userScore, false);
  let oppScore = snapToRLScore(state.oppScore, false);
  if (userScore === oppScore) userScore += 2;

  const userTries = state.events.filter(
    (e) => e.type === "try" && e.team === "user"
  ).length;
  const oppTries = state.events.filter(
    (e) => e.type === "try" && e.team === "opponent"
  ).length;

  return {
    ...state,
    minute: 80,
    userScore,
    oppScore,
    userTries: userTries > 0 ? userTries : state.userTries,
    oppTries: oppTries > 0 ? oppTries : state.oppTries,
    isComplete: true,
    isPlaying: false,
    phase: "full_time",
    effectivenessLine: "Full time — the hooter has gone.",
  };
}

export function liveMatchToFixture(
  state: LiveMatchState,
  _career: ManagerCareer
): MatchFixture {
  const finalized = state.isComplete ? state : finalizeLiveMatch(state);

  const pointsFor = finalized.userScore;
  const pointsAgainst = finalized.oppScore;
  const triesFor = finalized.userTries;
  const triesAgainst = finalized.oppTries;

  const userGoals = finalized.events.filter(
    (e) => e.type === "goal" && e.team === "user"
  ).length;
  const oppGoals = finalized.events.filter(
    (e) => e.type === "goal" && e.team === "opponent"
  ).length;
  const userPenalties = finalized.events.filter(
    (e) => e.type === "penalty" && e.team === "user"
  ).length;
  const oppPenalties = finalized.events.filter(
    (e) => e.type === "penalty" && e.team === "opponent"
  ).length;
  const userDrops = finalized.events.filter(
    (e) => e.type === "drop_goal" && e.team === "user"
  ).length;
  const oppDrops = finalized.events.filter(
    (e) => e.type === "drop_goal" && e.team === "opponent"
  ).length;

  const userKicking =
    userGoals + userPenalties + userDrops > 0
      ? {
          conversions: userGoals,
          penalties: userPenalties,
          dropGoals: userDrops,
        }
      : decomposeRLScore(pointsFor);
  const oppKicking =
    oppGoals + oppPenalties + oppDrops > 0
      ? {
          conversions: oppGoals,
          penalties: oppPenalties,
          dropGoals: oppDrops,
        }
      : decomposeRLScore(pointsAgainst);

  const won = pointsFor > pointsAgainst;

  const scoringFor = {
    tries: triesFor,
    conversions: userKicking.conversions,
    penalties: userKicking.penalties,
    dropGoals: userKicking.dropGoals,
    points: pointsFor,
  };
  const scoringAgainst = {
    tries: triesAgainst,
    conversions: oppKicking.conversions,
    penalties: oppKicking.penalties,
    dropGoals: oppKicking.dropGoals,
    points: pointsAgainst,
  };

  return {
    round: state.round,
    opponent: state.opponent,
    isHome: state.isHome,
    pointsFor,
    pointsAgainst,
    triesFor,
    triesAgainst,
    scoringFor,
    scoringAgainst,
    result: won ? "W" : "L",
    isUpset: false,
    isThrashing: Math.abs(pointsFor - pointsAgainst) >= 20,
  };
}

export function getLiveMatchEvents(state: LiveMatchState): LiveMatchEvent[] {
  return state.events;
}
