/**
 * Live match: the user's fixture played minute by minute with three big calls
 * (a penalty decision, the half-time team talk and a late-game call).
 * Same strength model as the instant sim, so results stay in line with the rest of the league.
 * Deterministic: the same rng and the same calls always give the same match.
 */
import { expectedTries, pickMotm, pickScorer, sheetStrength, type TeamSheet } from "./match";
import { randInt, type Rng } from "./rng";
import type { CareerPlayer, FixtureResult } from "./types";

export type Side = "home" | "away";

export type LiveEventKind = "try" | "goal" | "drop-goal" | "miss" | "info" | "call" | "whistle";

export interface LiveEvent {
  minute: number;
  side: Side | null;
  kind: LiveEventKind;
  text: string;
}

export interface LiveOption {
  id: string;
  label: string;
  hint: string;
}

export type LiveCallId = "penalty" | "team-talk" | "late";

export interface LiveCall {
  id: LiveCallId;
  title: string;
  prompt: string;
  /** options[0] is the sensible default (used by "Skip to full time"). */
  options: LiveOption[];
}

export interface LiveMatch {
  home: TeamSheet;
  away: TeamSheet;
  homeName: string;
  awayName: string;
  userSide: Side;
  knockout: boolean;
  /** Minutes played (0–80). */
  minute: number;
  homeScore: number;
  awayScore: number;
  homeTries: string[];
  awayTries: string[];
  events: LiveEvent[];
  pending: LiveCall | null;
  callMinutes: Record<LiveCallId, number>;
  callsDone: LiveCallId[];
  /** Calls whose gamble paid off straight away (shown at full time). */
  callsWon: number;
  /** Multiplies the user's try rate. */
  userAttack: number;
  /** Multiplies the opponent's try rate (lower is better for the user). */
  userDefence: number;
  /** Multiplies the opponent's penalty rate. */
  oppPenalties: number;
  /** Camped on their line until this minute (kick to touch / go for the try). */
  pressureUntil: number;
  /** -1 (them) … 1 (you), for the momentum bar. */
  momentum: number;
  goldenPoint: boolean;
  finished: boolean;
  base: {
    homeTries: number;
    awayTries: number;
    homePens: number;
    awayPens: number;
    homeKick: number;
    awayKick: number;
    homeRating: number;
    awayRating: number;
    userAttackRating: number;
    oppDefenceRating: number;
  };
}

const MINUTES = 80;

function kickAccuracy(rating: number) {
  return Math.min(0.85, 0.55 + (rating - 75) * 0.015);
}

function name(players: Record<string, CareerPlayer>, id: string) {
  return players[id]?.name ?? "A player";
}

const userIs = (m: LiveMatch, side: Side) => m.userSide === side;
const usScore = (m: LiveMatch) => (m.userSide === "home" ? m.homeScore : m.awayScore);
const themScore = (m: LiveMatch) => (m.userSide === "home" ? m.awayScore : m.homeScore);
const clubName = (m: LiveMatch, side: Side) => (side === "home" ? m.homeName : m.awayName);
const userSideName = (m: LiveMatch) => clubName(m, m.userSide);

function addPoints(m: LiveMatch, side: Side, points: number) {
  if (side === "home") m.homeScore += points;
  else m.awayScore += points;
}

function nudgeMomentum(m: LiveMatch, side: Side, amount: number) {
  const signed = userIs(m, side) ? amount : -amount;
  m.momentum = Math.max(-1, Math.min(1, m.momentum + signed));
}

function scoreTry(m: LiveMatch, side: Side, rng: Rng, players: Record<string, CareerPlayer>) {
  const sheet = side === "home" ? m.home : m.away;
  const scorer = pickScorer(rng, sheet, players);
  if (scorer) (side === "home" ? m.homeTries : m.awayTries).push(scorer);
  addPoints(m, side, 4);
  const kick = side === "home" ? m.base.homeKick : m.base.awayKick;
  const converted = rng() < kick;
  if (converted) addPoints(m, side, 2);
  m.events.push({
    minute: m.minute,
    side,
    kind: "try",
    text: `Try! ${scorer ? name(players, scorer) : clubName(m, side)} goes over for ${clubName(m, side)}${converted ? " — converted." : ". Conversion missed."}`,
  });
  nudgeMomentum(m, side, 0.45);
}

export function createLiveMatch(params: {
  home: TeamSheet;
  away: TeamSheet;
  homeName: string;
  awayName: string;
  userSide: Side;
  knockout: boolean;
  players: Record<string, CareerPlayer>;
  rng: Rng;
}): LiveMatch {
  const { home, away, players, rng } = params;
  const h = sheetStrength(home, players);
  const a = sheetStrength(away, players);
  const user = params.userSide === "home" ? h : a;
  const opp = params.userSide === "home" ? a : h;
  return {
    home,
    away,
    homeName: params.homeName,
    awayName: params.awayName,
    userSide: params.userSide,
    knockout: params.knockout,
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    homeTries: [],
    awayTries: [],
    events: [{ minute: 0, side: null, kind: "whistle", text: "Kick-off." }],
    pending: null,
    callMinutes: { penalty: randInt(rng, 14, 30), "team-talk": 40, late: randInt(rng, 62, 70) },
    callsDone: [],
    callsWon: 0,
    userAttack: 1,
    userDefence: 1,
    oppPenalties: 1,
    pressureUntil: -1,
    momentum: 0,
    goldenPoint: false,
    finished: false,
    base: {
      homeTries: expectedTries(h.attack, a.defence, true),
      awayTries: expectedTries(a.attack, h.defence, false),
      // The penalty call is an extra shot at goal for the user, so their open-play penalty rate drops to match.
      homePens: Math.max(0.1, 0.45 + Math.max(0, h.rating - 80) * 0.03 - (params.userSide === "home" ? 0.6 : 0)),
      awayPens: Math.max(0.1, 0.45 + Math.max(0, a.rating - 80) * 0.03 - (params.userSide === "away" ? 0.6 : 0)),
      homeKick: kickAccuracy(h.rating),
      awayKick: kickAccuracy(a.rating),
      homeRating: h.rating,
      awayRating: a.rating,
      userAttackRating: user.attack,
      oppDefenceRating: opp.defence,
    },
  };
}

/* ----------------------------------------------------------------- the calls */

function penaltyCall(): LiveCall {
  return {
    id: "penalty",
    title: "Penalty — your call",
    prompt: "Penalty to you, 20 metres out and right in front.",
    options: [
      { id: "two", label: "Take the two", hint: "Safe points on the board." },
      { id: "tap", label: "Tap and go", hint: "Try or bust. Better odds with a strong attack." },
      { id: "touch", label: "Kick to touch", hint: "Camp on their line for the next few minutes." },
    ],
  };
}

function teamTalkCall(m: LiveMatch): LiveCall {
  const diff = usScore(m) - themScore(m);
  const state = diff > 0 ? `${diff} up` : diff < 0 ? `${-diff} down` : "all square";
  return {
    id: "team-talk",
    title: "Half-time team talk",
    prompt: `${m.homeScore}–${m.awayScore} at the break: you're ${state}.`,
    options: [
      { id: "calm", label: "Keep it calm", hint: "Tighter defence in the second half." },
      { id: "fire", label: "Fire them up", hint: "More attack, but more penalties given away." },
      { id: "hairdryer", label: "The hairdryer", hint: "Huge lift if you're behind. Backfires if you're not." },
    ],
  };
}

function lateCall(m: LiveMatch): LiveCall {
  const diff = usScore(m) - themScore(m);
  const clock = `${MINUTES - m.minute} minutes left`;
  if (diff > 0) {
    return {
      id: "late",
      title: "Closing stages",
      prompt: `${clock}, ${diff} up. How do you see it out?`,
      options: [
        { id: "shut", label: "Shut up shop", hint: "Slow it down. Fewer points both ways." },
        { id: "kill", label: "Go for the kill", hint: "More tries for you — and for them." },
      ],
    };
  }
  if (diff >= -1) {
    return {
      id: "late",
      title: "Last tackle, 30 metres out",
      prompt: `${clock}, ${diff === 0 ? "all square" : "1 down"}. What's the play?`,
      options: [
        { id: "drop", label: "Drop goal", hint: "One point. Decent odds." },
        { id: "push", label: "Go for the try", hint: "Pin them on their line and keep attacking." },
      ],
    };
  }
  if (diff >= -6) {
    return {
      id: "late",
      title: "Chasing the game",
      prompt: `${clock}, ${-diff} down. One score in it.`,
      options: [
        { id: "patient", label: "Stay patient", hint: "Build pressure, keep it tight at the back." },
        { id: "grubber", label: "Grubber to the corner", hint: "One shot at a try right now." },
        { id: "run", label: "Run everything", hint: "All-out attack. Leaves gaps at the back." },
      ],
    };
  }
  return {
    id: "late",
    title: "Big hole to climb out of",
    prompt: `${clock}, ${-diff} down.`,
    options: [
      { id: "pride", label: "Play for pride", hint: "Keep the score down." },
      { id: "everything", label: "Throw everything at it", hint: "Big attack boost, big risk." },
    ],
  };
}

function openCall(m: LiveMatch): boolean {
  for (const id of ["penalty", "team-talk", "late"] as LiveCallId[]) {
    if (m.callsDone.includes(id) || m.minute !== m.callMinutes[id]) continue;
    m.pending = id === "penalty" ? penaltyCall() : id === "team-talk" ? teamTalkCall(m) : lateCall(m);
    return true;
  }
  return false;
}

/** Apply the user's choice for the pending call. */
export function resolveCall(m: LiveMatch, optionId: string, rng: Rng, players: Record<string, CareerPlayer>): void {
  const call = m.pending;
  if (!call || m.finished) return;
  const option = call.options.find((o) => o.id === optionId) ?? call.options[0]!;
  const side = m.userSide;
  const say = (text: string, kind: LiveEventKind = "call") => m.events.push({ minute: m.minute, side, kind, text });
  const userKick = side === "home" ? m.base.homeKick : m.base.awayKick;
  const edge = m.base.userAttackRating - m.base.oppDefenceRating;
  const behind = usScore(m) < themScore(m);

  switch (option.id) {
    case "two":
      if (rng() < Math.min(0.95, userKick + 0.12)) {
        addPoints(m, side, 2);
        say(`You take the two. Penalty goal for ${userSideName(m)}.`, "goal");
        m.callsWon++;
      } else {
        say("You take the two — and it drifts wide.", "miss");
      }
      break;
    case "tap":
      if (rng() < Math.max(0.15, Math.min(0.6, 0.34 + edge * 0.03))) {
        say("Quick tap — and they're through!");
        scoreTry(m, side, rng, players);
        m.callsWon++;
      } else {
        say("Quick tap, held up over the line. Their ball.", "miss");
        nudgeMomentum(m, side, -0.25);
      }
      break;
    case "touch":
      m.pressureUntil = m.minute + 6;
      say("Kick to touch. Five tackles on their line.");
      nudgeMomentum(m, side, 0.2);
      break;
    case "calm":
      m.userDefence *= 0.92;
      say("Calm words at half-time. Tighten up and trust the system.");
      break;
    case "fire":
      m.userAttack *= 1.12;
      m.oppPenalties *= 1.35;
      say("Fired up at half-time. They come out flying.");
      nudgeMomentum(m, side, 0.2);
      break;
    case "hairdryer":
      if (behind) {
        m.userAttack *= 1.35;
        say("The hairdryer treatment. They come out like a different side.");
        nudgeMomentum(m, side, 0.35);
        m.callsWon++;
      } else {
        m.userAttack *= 0.95;
        m.userDefence *= 1.1;
        say("The hairdryer at half-time. It doesn't land well.");
        nudgeMomentum(m, side, -0.2);
      }
      break;
    case "shut":
      m.userAttack *= 0.6;
      m.userDefence *= 0.6;
      say("Slow it down, kick long, squeeze the clock.");
      break;
    case "kill":
      m.userAttack *= 1.3;
      m.userDefence *= 1.3;
      say("No let-up. Go for the kill.");
      break;
    case "drop":
      if (rng() < 0.42 + Math.max(0, (side === "home" ? m.base.homeRating : m.base.awayRating) - 78) * 0.02) {
        addPoints(m, side, 1);
        say(`Drop goal! ${userSideName(m)} edge in front.`, "drop-goal");
        nudgeMomentum(m, side, 0.3);
        m.callsWon++;
      } else {
        say("The drop goal is charged down.", "miss");
      }
      break;
    case "push":
      m.pressureUntil = m.minute + 5;
      say("Back yourselves. Keep the ball and go for the line.");
      break;
    case "patient":
      m.userDefence *= 0.92;
      m.pressureUntil = m.minute + 3;
      say("Patience. Build the pressure.");
      break;
    case "grubber":
      if (rng() < Math.max(0.15, Math.min(0.45, 0.28 + edge * 0.025))) {
        say("Grubber to the corner — it sits up perfectly!");
        scoreTry(m, side, rng, players);
        m.callsWon++;
      } else {
        say("Grubber to the corner, dead ball. Chance gone.", "miss");
      }
      break;
    case "run":
      m.userAttack *= 1.6;
      m.userDefence *= 1.25;
      say("Run everything. Every ball goes wide.");
      break;
    case "pride":
      m.userAttack *= 0.8;
      m.userDefence *= 0.7;
      say("Keep the score respectable.");
      break;
    case "everything":
      m.userAttack *= 1.8;
      m.userDefence *= 1.4;
      say("Throw everything at it.");
      break;
  }
  m.callsDone.push(call.id);
  m.pending = null;
}

/* ------------------------------------------------------------------- the clock */

/** Play one minute. Stops (without advancing) when a call is waiting. */
export function stepMinute(m: LiveMatch, rng: Rng, players: Record<string, CareerPlayer>): void {
  if (m.finished || m.pending) return;
  if (openCall(m)) return;

  m.minute += 1;
  for (const side of ["home", "away"] as Side[]) {
    const user = userIs(m, side);
    let tryRate = (side === "home" ? m.base.homeTries : m.base.awayTries) / MINUTES;
    tryRate *= user ? m.userAttack : m.userDefence;
    if (user && m.minute <= m.pressureUntil) tryRate *= 2.6;
    if (rng() < tryRate) scoreTry(m, side, rng, players);

    let penRate = (side === "home" ? m.base.homePens : m.base.awayPens) / MINUTES;
    if (!user) penRate *= m.oppPenalties;
    if (rng() < penRate) {
      addPoints(m, side, 2);
      m.events.push({ minute: m.minute, side, kind: "goal", text: `Penalty goal for ${clubName(m, side)}.` });
      nudgeMomentum(m, side, 0.1);
    }
  }
  m.momentum *= 0.93;

  if (m.minute === 40) m.events.push({ minute: 40, side: null, kind: "whistle", text: `Half-time: ${m.homeScore}–${m.awayScore}.` });
  if (m.minute >= MINUTES) finish(m, rng);
}

function finish(m: LiveMatch, rng: Rng) {
  if (m.knockout && m.homeScore === m.awayScore) {
    m.goldenPoint = true;
    const homeWins = rng() < 0.5 + (m.base.homeRating - m.base.awayRating) * 0.06 + 0.04;
    const side: Side = homeWins ? "home" : "away";
    addPoints(m, side, 1);
    m.events.push({ minute: 80, side, kind: "drop-goal", text: `Golden point! ${clubName(m, side)} win it with a drop goal.` });
  }
  m.finished = true;
  m.events.push({ minute: 80, side: null, kind: "whistle", text: `Full time: ${m.homeScore}–${m.awayScore}.` });
}

/** Play the rest of the match instantly, taking the default option at every call. */
export function playToEnd(m: LiveMatch, rng: Rng, players: Record<string, CareerPlayer>): void {
  let guard = 0;
  while (!m.finished && guard++ < 400) {
    if (m.pending) resolveCall(m, m.pending.options[0]!.id, rng, players);
    else stepMinute(m, rng, players);
  }
}

export function liveResult(m: LiveMatch, rng: Rng, players: Record<string, CareerPlayer>): FixtureResult {
  const motm = pickMotm(rng, m.home, m.away, m.homeScore, m.awayScore, m.homeTries, m.awayTries, players);
  return {
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeTries: [...m.homeTries],
    awayTries: [...m.awayTries],
    goldenPoint: m.goldenPoint || undefined,
    motm,
  };
}
