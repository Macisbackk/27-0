import seedrandom from "seedrandom";
import type { MatchFixture } from "../game/season-simulation";
import { snapToRLScore, decomposeRLScore } from "../game/rl-scores";
import { getDisplayedOpponentTeamRating } from "./managerOpponentRating";
import { buildNrlMatchdayLineup } from "../nrl/nrlMatchdayLineup";
import type { Position } from "../types";
import type {
  LiveMatchCommand,
  LiveMatchPhase,
  ManagerCareer,
  ManagerCompetition,
  ManagerScheduledFixture,
  LiveMatchEvent,
  MatchEventPeriod,
} from "./types";
import {
  competitionAllowsDraw,
} from "./matchResolutionRules";
import { computeManagerTeamRating } from "./managerRating";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
} from "./managerPlayers";
import { getMatchdayTryWeight } from "./managerTryScoring";
import {
  buildMatchdayScorerCandidates,
  pickScorerFromCandidates,
  pickWeightedIndexSafe,
} from "./managerTryScorerSelection";
import { previewManagerMatchScoreline } from "./managerSimulation";
import { eventMinutePrefix } from "../game/match-events";
import type { MatchEventType } from "../game/match-events";
import {
  buildCommentaryLine,
  formatFullTimeEvent,
  formatGoldenPointStartEvent,
  formatHalfTimeEvent,
  memoryFromEvents,
  territoryForMinute,
} from "../match/matchEventTemplates";
import { selectClubMatchSquad } from "../game/opponent-scorers";
import { getManagerOpponentPoolOptions } from "./managerLeagueRosters";
import { generateNrlSquadNames } from "./worldClubChallenge";
import {
  getMatchPlayerRoleTryMultiplier,
  resolveEffectiveTactics,
} from "./managerTacticsScoring";

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
  champagne: "Champagne",
};

export function getLiveCommandLabel(cmd: LiveMatchCommand): string {
  return COMMAND_LABELS[cmd];
}

/** Compact labels for the live command grid on narrow screens. */
export function getLiveCommandShortLabel(cmd: LiveMatchCommand): string {
  if (cmd === "champagne") return "Champ.";
  if (cmd === "balanced") return "Bal.";
  return COMMAND_LABELS[cmd];
}

/** Map saved tactics to the live command used when simulating from the hub. */
export function commandFromTactics(career: ManagerCareer): LiveMatchCommand {
  const { playingStyle, attackFocus, defenceFocus } = resolveEffectiveTactics(
    career,
    career.nextMatchGameplan?.fixtureId
  );

  if (
    playingStyle === "defensive" ||
    defenceFocus === "conservative" ||
    defenceFocus === "goal_line"
  ) {
    return "defend";
  }
  if (
    playingStyle === "expansive" &&
    (attackFocus === "offloads" || defenceFocus === "aggressive_contact")
  ) {
    return "champagne";
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

export const LIVE_MATCH_COMMANDS: LiveMatchCommand[] = [
  "attack",
  "balanced",
  "defend",
  "champagne",
];

export function describeLiveCommand(cmd: LiveMatchCommand): string {
  switch (cmd) {
    case "attack":
      return "Push for tries — more attacking chances, slightly more risk.";
    case "defend":
      return "Protect the scoreline — tighter defence, less attacking output.";
    case "champagne":
      return "All-out attack — highest try chance, defence wide open. Extra risky when you're the weaker side.";
    default:
      return "Steady game — balance between attack and defence.";
  }
}

/** Why the current tactics map to a given live-play default. */
export function getTacticsLiveCommandReason(career: ManagerCareer): string {
  const { playingStyle, attackFocus, defenceFocus } = resolveEffectiveTactics(
    career,
    career.nextMatchGameplan?.fixtureId
  );

  if (
    playingStyle === "defensive" ||
    defenceFocus === "conservative" ||
    defenceFocus === "goal_line"
  ) {
    return "Defensive setup — live play opens on Defend.";
  }
  if (
    playingStyle === "expansive" &&
    (attackFocus === "offloads" || defenceFocus === "aggressive_contact")
  ) {
    return "Expansive, high-risk approach — live play opens on Champagne rugby.";
  }
  if (
    playingStyle === "high_tempo" ||
    attackFocus === "offloads" ||
    defenceFocus === "aggressive_contact"
  ) {
    return "Attacking emphasis — live play opens on Attack.";
  }
  return "Balanced setup — live play opens on Balanced.";
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

function commandAttackMod(
  cmd: LiveMatchCommand,
  ratingGap = 0
): {
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
    case "champagne": {
      const concedeVsBetter =
        ratingGap < 0 ? 0.15 + Math.min(0.55, Math.abs(ratingGap) * 0.04) : 0.1;
      return {
        userChance: 1.55,
        oppChance: 1.22 + concedeVsBetter,
        errorRisk: 1.35,
        momentumShift: 5,
      };
    }
    default:
      return { userChance: 1, oppChance: 1, errorRisk: 1, momentumShift: 0 };
  }
}

function tacticCommandBias(
  career: ManagerCareer,
  cmd: LiveMatchCommand
): { userChance: number; oppChance: number } {
  const t = resolveEffectiveTactics(
    career,
    career.nextMatchGameplan?.fixtureId
  );
  const scale = cmd === "balanced" ? 1 : 0.45;
  let userChance = 1;
  let oppChance = 1;
  if (t.playingStyle === "expansive") userChance += 0.08 * scale;
  if (t.playingStyle === "defensive") oppChance -= 0.06 * scale;
  if (t.playingStyle === "direct") userChance += 0.05 * scale;
  if (t.defenceFocus === "conservative") oppChance -= 0.05 * scale;
  if (cmd === "champagne" && t.playingStyle === "expansive") {
    userChance += 0.05;
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
    command === "balanced" && attackFocus === "middle";
  const preferBack =
    command === "champagne" ||
    command === "attack" ||
    (command === "balanced" && attackFocus === "edges");
  if (preferForward && FORWARD_POSITIONS.includes(pos)) return 1.12;
  if (preferBack && BACK_POSITIONS.includes(pos)) return 1.12;
  return 1;
}

function pickScorer(
  career: ManagerCareer,
  command: LiveMatchCommand,
  rng: () => number,
  priorUserTryEvents: LiveMatchEvent[]
): { id: string; name: string } {
  const candidates = buildMatchdayScorerCandidates(career);
  const triesAlready = candidates.map(
    (c) =>
      priorUserTryEvents.filter(
        (e) => e.type === "try" && e.team === "user" && e.playerId === c.id
      ).length
  );
  const teamTries = priorUserTryEvents.filter(
    (e) => e.type === "try" && e.team === "user"
  ).length;
  const attackFocus = resolveEffectiveTactics(
    career,
    career.nextMatchGameplan?.fixtureId
  ).attackFocus;
  const bias = (pos: Position) => {
    const roleMult = Math.max(
      1,
      ...candidates
        .filter((c) => c.position === pos)
        .map((c) =>
          getMatchPlayerRoleTryMultiplier(
            career.matchPlayerRoles?.[c.id],
            pos
          )
        )
    );
    return scorerPositionBias(pos, command, attackFocus) * roleMult;
  };
  const picked = pickScorerFromCandidates(
    candidates,
    triesAlready,
    Math.max(1, teamTries + 1),
    rng,
    bias
  );
  if (picked) {
    return { id: picked.scorer.id, name: picked.scorer.name };
  }
  // Last resort — resolve a real on-field / squad player; never fake "Try Scorer".
  for (const id of [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ]) {
    if (!id) continue;
    const p = getManagerPlayer(career, id);
    if (p) return { id: p.id, name: p.name };
  }
  const anySquad = career.squad[0];
  if (anySquad) {
    const p = getManagerPlayer(career, anySquad.playerId);
    if (p) return { id: p.id, name: p.name };
  }
  if (process.env.NODE_ENV === "development") {
    console.error("[scorer] no valid on-field player available for try");
  }
  return { id: "unresolved-scorer", name: "Unknown" };
}

function pickOpponentScorer(
  career: ManagerCareer,
  opponent: string,
  seed: string,
  round: number,
  rng: () => number,
  competition?: ManagerCompetition
): { id: string; name: string } {
  if (competition === "world_club_challenge") {
    const squad = buildNrlMatchdayLineup({
      seed,
      teamName: opponent,
      teamRating:
        career.worldClubChallenge?.currentFixture?.nrlChampionName === opponent
          ? career.worldClubChallenge.currentFixture.nrlChampionRating
          : undefined,
      seasonYear: career.seasonYear,
      count: 13,
    }).players;
    if (squad.length === 0) {
      return { id: `${opponent}-scorer`, name: opponent };
    }
    const pick = squad[Math.floor(rng() * squad.length)]!;
    return { id: pick.id, name: pick.name };
  }

  const pool = selectClubMatchSquad(
    opponent,
    seed,
    round,
    getManagerOpponentPoolOptions(career, opponent)
  );
  if (pool.length === 0) {
    const generated = generateNrlSquadNames(seed, opponent, 8);
    if (generated.length > 0) {
      const pick = generated[Math.floor(rng() * generated.length)]!;
      return { id: pick.id, name: pick.name };
    }
    return { id: `${opponent.replace(/\s+/g, "-").toLowerCase()}-1`, name: "Home forward" };
  }
  const pick = pool[Math.floor(rng() * pool.length)]!;
  return { id: pick.id, name: pick.name };
}

function pickOpponentKicker(
  career: ManagerCareer,
  opponent: string,
  seed: string,
  round: number,
  rng: () => number,
  competition?: ManagerCompetition
): string {
  if (competition === "world_club_challenge") {
    const squad = buildNrlMatchdayLineup({
      seed,
      teamName: opponent,
      teamRating:
        career.worldClubChallenge?.currentFixture?.nrlChampionName === opponent
          ? career.worldClubChallenge.currentFixture.nrlChampionRating
          : undefined,
      seasonYear: career.seasonYear,
      count: 13,
    }).players;
    if (squad.length === 0) return "Kicker";
    return squad[6]?.name ?? squad[0]!.name;
  }

  const pool = selectClubMatchSquad(
    opponent,
    seed,
    round,
    getManagerOpponentPoolOptions(career, opponent)
  );
  const halves = pool.filter(
    (p) =>
      p.position === "SCRUM_HALF" ||
      p.position === "STAND_OFF" ||
      p.position === "FULLBACK"
  );
  const source = halves.length > 0 ? halves : pool;
  if (source.length === 0) return "Opposition kicker";
  return source[Math.floor(rng() * source.length)]!.name;
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

  const pickIdx =
    halves.length > 0
      ? pickWeightedIndexSafe(
          halves.map((h) => h.weight),
          rng
        )
      : -1;
  const id =
    (pickIdx >= 0 ? halves[pickIdx]?.id : undefined) ??
    career.matchdayXiii[6] ??
    career.matchdayInterchange[0];
  return getManagerPlayer(career, id ?? "")?.name ?? "Kicker";
}

function effectivenessFromCommand(
  cmd: LiveMatchCommand,
  momentum: number
): string {
  if (cmd === "champagne" && momentum > 12) {
    return "Champagne rugby — all-out attack, defence wide open.";
  }
  if (cmd === "defend" && momentum < -10) {
    return "Under pressure — defensive line holding for now.";
  }
  if (cmd === "attack" && momentum > 20) {
    return "Dangerous — attack is flowing.";
  }
  return "Even contest — keep adjusting.";
}

function livePeriod(minute: number): MatchEventPeriod {
  return minute <= HALFTIME_MINUTE ? "first_half" : "second_half";
}

function liveFillTemplate(
  template: string,
  team: string,
  opp: string,
  player?: string
): string {
  return template
    .replace(/\{team\}/g, team)
    .replace(/\{opp\}/g, opp)
    .replace(/\{opponent\}/g, opp)
    .replace(/\{player\}/g, player ?? "a runner");
}

const LIVE_FILLER: Array<{
  type: LiveMatchEvent["type"];
  templates: string[];
  weight: number;
}> = [
  {
    type: "pressure_set",
    weight: 3,
    templates: [
      "{team} complete their set and force a dropout.",
      "Solid set from {team} — pressure building.",
    ],
  },
  {
    type: "last_tackle_kick",
    weight: 2.5,
    templates: [
      "Bomb goes up and {team} win the chase.",
      "{team} kick long and pin the defence back.",
    ],
  },
  {
    type: "forced_error",
    weight: 2.5,
    templates: [
      "Huge hit from {team} — ball spilled in contact.",
      "{team} wrap up the runner and win the play-the-ball.",
    ],
  },
  {
    type: "forty_twenty",
    weight: 2,
    templates: [
      "Penalty against {opp} — {team} get the ball back.",
      "Referee calls a penalty and {team} take the tap.",
    ],
  },
  {
    type: "six_again",
    weight: 2,
    templates: [
      "Six again for {team} — the attack rolls on.",
      "Referee signals six again and {team} stay on the front foot.",
    ],
  },
  {
    type: "knock_on",
    weight: 2,
    templates: [
      "Knock on from {opp} — {team} get the scrum feed.",
      "Handling error hands possession to {team}.",
    ],
  },
  {
    type: "line_break",
    weight: 1.5,
    templates: [
      "{team} find a half-gap and break the line!",
      "Clever play from {team} — through the defensive line.",
    ],
  },
  {
    type: "goal_line_dropout",
    weight: 1.5,
    templates: [
      "Sloppy play from {opp} gifts {team} field position.",
      "{opp} lose the ball in good ball — {team} capitalise.",
    ],
  },
];

function pushLiveFiller(
  events: LiveMatchEvent[],
  minute: number,
  side: "user" | "opponent",
  userClub: string,
  oppClub: string,
  rng: () => number
): void {
  const total = LIVE_FILLER.reduce((s, f) => s + f.weight, 0);
  let roll = rng() * total;
  let chosen = LIVE_FILLER[0]!;
  for (const f of LIVE_FILLER) {
    roll -= f.weight;
    if (roll <= 0) {
      chosen = f;
      break;
    }
  }
  const team = side === "user" ? userClub : oppClub;
  const opp = side === "user" ? oppClub : userClub;
  const template =
    chosen.templates[Math.floor(rng() * chosen.templates.length)] ??
    chosen.templates[0]!;
  events.push({
    minute,
    type: chosen.type,
    team: side,
    teamName: team,
    description: eventMinutePrefix(
      minute,
      liveFillTemplate(template, team, opp)
    ),
    points: 0,
    importance: "low",
    period: livePeriod(minute),
  });
}

function pushTryBuildUp(
  events: LiveMatchEvent[],
  minute: number,
  side: "user" | "opponent",
  userClub: string,
  oppClub: string,
  scorer: string,
  rng: () => number
): void {
  const team = side === "user" ? userClub : oppClub;
  const opp = side === "user" ? oppClub : userClub;
  if (rng() < 0.55 && minute > 1) {
    const m = minute - 1;
    events.push({
      minute: m,
      type: "six_again",
      team: side,
      teamName: team,
      description: eventMinutePrefix(
        m,
        liveFillTemplate(
          "Six again for {team} — the attack rolls on.",
          team,
          opp
        )
      ),
      points: 0,
      importance: "low",
      period: livePeriod(m),
    });
  }
  if (rng() < 0.4) {
    const breakType: LiveMatchEvent["type"] =
      rng() < 0.5 ? "line_break" : "big_break";
    events.push({
      minute,
      type: breakType,
      team: side,
      teamName: team,
      playerName: scorer,
      description: eventMinutePrefix(
        minute,
        liveFillTemplate(
          "{team} find a half-gap and {player} is through!",
          team,
          opp,
          scorer
        )
      ),
      points: 0,
      importance: "medium",
      period: livePeriod(minute),
    });
  }
}

function dominanceNote(
  userRating: number,
  oppRating: number,
  momentum: number,
  minute: number,
  userClub: string,
  oppClub: string,
  rng: () => number
): LiveMatchEvent | null {
  const diff = userRating - oppRating;
  if (diff <= -8 && momentum < -12 && rng() < 0.28) {
    return {
      minute,
      type: "note",
      team: "opponent",
      teamName: oppClub,
      description: eventMinutePrefix(
        minute,
        diff <= -12
          ? `${oppClub} dominating possession`
          : `Under heavy pressure from ${oppClub}`
      ),
      points: 0,
      importance: "low",
      period: livePeriod(minute),
    };
  }
  if (diff >= 8 && momentum > 12 && rng() < 0.25) {
    return {
      minute,
      type: "note",
      team: "user",
      teamName: userClub,
      description: eventMinutePrefix(
        minute,
        `${userClub} camped in the opposition half`
      ),
      points: 0,
      importance: "low",
      period: livePeriod(minute),
    };
  }
  if (Math.abs(momentum) > 18 && rng() < 0.18) {
    const withUser = momentum > 0;
    return {
      minute,
      type: "note",
      team: withUser ? "user" : "opponent",
      teamName: withUser ? userClub : oppClub,
      description: eventMinutePrefix(
        minute,
        withUser
          ? `Momentum with ${userClub}`
          : `${oppClub} on top at the moment`
      ),
      points: 0,
      importance: "low",
      period: livePeriod(minute),
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

/** Opponent strength for live ticks — same source as Hub display / instant sim. */
function resolveLiveOpponentRating(
  career: ManagerCareer,
  state: LiveMatchState
): number {
  return getDisplayedOpponentTeamRating(career, {
    opponent: state.opponent,
    round: state.round,
    competition: state.competition,
    id: state.fixtureId ?? `live-${state.round}`,
  });
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
  const memory = memoryFromEvents(
    events.map((e) => ({
      type: e.type as MatchEventType,
      description: e.description,
      playerName: e.playerName,
    }))
  );

  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions,
    career
  );
  const oppRating = resolveLiveOpponentRating(career, state);

  const ratingGap = userRating - oppRating;
  const mods = commandAttackMod(command, ratingGap);
  const tacticBias = tacticCommandBias(career, command);
  const champagneVsBetter =
    command === "champagne" && ratingGap < 0
      ? 1 + Math.min(0.5, Math.abs(ratingGap) * 0.045)
      : 1;

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
        mods.oppChance * tacticBias.oppChance * champagneVsBetter,
        rng
      );

    const note = dominanceNote(
      userRating,
      oppRating,
      momentum,
      minute,
      career.club,
      state.opponent,
      rng
    );
    if (note) events.push(note);

    if (userTry) {
      userTries++;
      userScore += 4;
      const scorer = pickScorer(career, command, rng, events);
      pushTryBuildUp(
        events,
        minute,
        "user",
        career.club,
        state.opponent,
        scorer.name,
        rng
      );
      const tryText = buildCommentaryLine(
        "try",
        {
          team: career.club,
          opponent: state.opponent,
          player: scorer.name,
          minute,
          area: territoryForMinute(minute),
          score: `${userScore}-${oppScore}`,
        },
        memory,
        rng
      );
      events.push({
        minute,
        type: "try",
        team: "user",
        playerName: scorer.name,
        playerId: scorer.id,
        description: eventMinutePrefix(minute, tryText),
        points: 4,
        importance: "major",
        teamName: career.club,
        period: livePeriod(minute),
      });
      if (rng() < 0.82) {
        userScore += 2;
        const kicker = pickKicker(career, rng);
        const goalText = buildCommentaryLine(
          "goal",
          {
            team: career.club,
            opponent: state.opponent,
            kicker,
            minute,
            area: territoryForMinute(minute),
            score: `${userScore}-${oppScore}`,
          },
          memory,
          rng
        );
        events.push({
          minute,
          type: "goal",
          team: "user",
          kickerName: kicker,
          playerName: undefined,
          description: eventMinutePrefix(minute, goalText),
          points: 2,
          importance: "high",
          teamName: career.club,
          period: livePeriod(minute),
        });
      }
      momentum += 8;
    } else if (oppTry) {
      oppTries++;
      oppScore += 4;
      const scorer = pickOpponentScorer(
        career,
        state.opponent,
        state.seed,
        state.round,
        rng,
        state.competition
      );
      pushTryBuildUp(
        events,
        minute,
        "opponent",
        career.club,
        state.opponent,
        scorer.name,
        rng
      );
      const tryText = buildCommentaryLine(
        "try",
        {
          team: state.opponent,
          opponent: career.club,
          player: scorer.name,
          minute,
          area: territoryForMinute(minute),
          score: `${userScore}-${oppScore}`,
        },
        memory,
        rng
      );
      events.push({
        minute,
        type: "try",
        team: "opponent",
        playerName: scorer.name,
        playerId: scorer.id,
        description: eventMinutePrefix(minute, tryText),
        points: 4,
        importance: "major",
        teamName: state.opponent,
        period: livePeriod(minute),
      });
      if (rng() < 0.8) {
        oppScore += 2;
        const kicker = pickOpponentKicker(
          career,
          state.opponent,
          state.seed,
          state.round,
          rng,
          state.competition
        );
        const convText = buildCommentaryLine(
          "goal",
          {
            team: state.opponent,
            opponent: career.club,
            kicker,
            minute,
            area: territoryForMinute(minute),
            score: `${userScore}-${oppScore}`,
          },
          memory,
          rng
        );
        events.push({
          minute,
          type: "goal",
          team: "opponent",
          kickerName: kicker,
          description: eventMinutePrefix(minute, convText),
          points: 2,
          importance: "high",
          teamName: state.opponent,
          period: livePeriod(minute),
        });
      }
      momentum -= 8;
    } else if (rng() < 0.32 * Math.min(1.35, mods.errorRisk)) {
      const side: "user" | "opponent" = rng() < 0.5 ? "user" : "opponent";
      pushLiveFiller(
        events,
        minute,
        side,
        career.club,
        state.opponent,
        rng
      );
      if (side === "user") momentum -= 1.5;
      else momentum += 1.5;
    }

    if (
      minute === HALFTIME_MINUTE &&
      !events.some((e) => e.type === "half_time")
    ) {
      events.push({
        minute: HALFTIME_MINUTE,
        type: "half_time",
        team: "user",
        teamName: career.club,
        description: eventMinutePrefix(
          HALFTIME_MINUTE,
          formatHalfTimeEvent({
            team: career.club,
            opponent: state.opponent,
            minute: HALFTIME_MINUTE,
            score: `${userScore}-${oppScore}`,
          })
        ),
        points: 0,
        importance: "major",
        period: "first_half",
      });
    }
  }

  const isComplete = minute >= 80;
  const atHalftime = minute >= HALFTIME_MINUTE && maxMinute <= HALFTIME_MINUTE;
  let finalUser = userScore;
  let finalOpp = oppScore;

  if (isComplete && !events.some((e) => e.type === "full_time")) {
    events.push({
      minute: 80,
      type: "full_time",
      team: "user",
      teamName: career.club,
      description: eventMinutePrefix(
        80,
        formatFullTimeEvent({
          team: career.club,
          opponent: state.opponent,
          minute: 80,
          score: `${userScore}-${oppScore}`,
        })
      ),
      points: 0,
      importance: "major",
      period: "second_half",
    });
  }

  // Cup / playoffs / WCC / friendlies: level at full time → golden point.
  // Manager league may finish as a draw — no golden point there.
  if (
    isComplete &&
    finalUser === finalOpp &&
    !competitionAllowsDraw(state.competition)
  ) {
    const rng = seedrandom(`${state.seed}-live-gp-${state.fixtureId}`);
    const kicker = pickKicker(career, rng);
    const userWinsGp = rng() < 0.52;
    if (userWinsGp) finalUser += 1;
    else finalOpp += 1;
    const winnerTeam = userWinsGp ? "user" : "opponent";
    const winnerName = userWinsGp ? career.club : state.opponent;
    events.push({
      minute: 80,
      type: "note",
      team: winnerTeam,
      description: eventMinutePrefix(
        80,
        formatGoldenPointStartEvent({
          team: winnerName,
          opponent: userWinsGp ? state.opponent : career.club,
          score: `${userScore}-${oppScore}`,
        })
      ),
      points: 0,
      teamName: winnerName,
      importance: "high",
      period: "golden_point",
    });
    events.push({
      minute: 81,
      type: "drop_goal",
      team: winnerTeam,
      kickerName: kicker,
      description: eventMinutePrefix(
        81,
        `${kicker} lands the Golden Point drop-goal! ${winnerName} prevail ${finalUser}-${finalOpp}.`
      ),
      points: 1,
      teamName: winnerName,
      importance: "high",
      period: "golden_point",
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

export function advanceLiveToFullTime(
  state: LiveMatchState,
  career: ManagerCareer,
  command: LiveMatchCommand
): LiveMatchState {
  let current: LiveMatchState = {
    ...state,
    command,
    phase:
      state.phase === "halftime"
        ? "second_half"
        : state.phase === "preview"
          ? "first_half"
          : state.phase,
    isPlaying: true,
  };

  const maxIterations = Math.ceil(80 / GAME_MINUTES_PER_TICK) + 5;
  for (let i = 0; i < maxIterations && !current.isComplete; i++) {
    current = advanceLiveTick(current, career, command, 80);
  }

  if (!current.isComplete) {
    current = finalizeLiveMatch(current);
  }

  return {
    ...current,
    isPlaying: false,
    effectivenessLine: "Full time — match simulated to the final whistle.",
  };
}

function finalizeLiveMatch(state: LiveMatchState): LiveMatchState {
  let userScore = snapToRLScore(state.userScore, false);
  let oppScore = snapToRLScore(state.oppScore, false);
  // League may finish level; knockouts / friendlies resolve via golden point
  // earlier in the tick — keep a decisive fallback here if scores are still tied.
  if (userScore === oppScore && !competitionAllowsDraw(state.competition)) {
    const rng = seedrandom(`${state.seed}-live-finalize-${state.fixtureId}`);
    // Golden Point is a single drop-goal (1 point), not a multi-point margin.
    if (rng() < 0.52) userScore += 1;
    else oppScore += 1;
  }

  const userTries = state.events.filter(
    (e) => e.type === "try" && e.team === "user"
  ).length;
  const oppTries = state.events.filter(
    (e) => e.type === "try" && e.team === "opponent"
  ).length;

  const events = [...state.events];
  if (!events.some((e) => e.type === "full_time")) {
    const userTeamName =
      events.find((e) => e.team === "user" && e.teamName)?.teamName ?? "Home";
    events.push({
      minute: 80,
      type: "full_time",
      team: "user",
      teamName: undefined,
      description: eventMinutePrefix(
        80,
        formatFullTimeEvent({
          team: userTeamName,
          opponent: state.opponent,
          minute: 80,
          score: `${userScore}-${oppScore}`,
        })
      ),
      points: 0,
      importance: "major",
      period: "second_half",
    });
  }

  return {
    ...state,
    minute: 80,
    userScore,
    oppScore,
    userTries: userTries > 0 ? userTries : state.userTries,
    oppTries: oppTries > 0 ? oppTries : state.oppTries,
    events,
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
  const isDraw = pointsFor === pointsAgainst;

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
    result: isDraw ? "D" : won ? "W" : "L",
    isUpset: false,
    isThrashing: Math.abs(pointsFor - pointsAgainst) >= 20,
  };
}

export function getLiveMatchEvents(state: LiveMatchState): LiveMatchEvent[] {
  return state.events;
}
