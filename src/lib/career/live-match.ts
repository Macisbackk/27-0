/**
 * Live match: the user's fixture played minute by minute, stopping for the big calls.
 *
 * Every match has the half-time team talk and a late-game call that depends on the score.
 * Around those, each match draws a different mix from a pool of moments — a penalty in range,
 * a short kick-off, a 40/20 chance, a fresh-legs interchange — plus things that just happen
 * (sin bins, injuries, a try you can send to the captain's challenge, golden point).
 * Same strength model as the instant sim, so results stay in line with the rest of the league.
 * Deterministic: the same rng and the same calls always give the same match.
 */
import { expectedTries, pickMotm, pickScorer, sheetStrength, type TeamSheet } from "./match";
import { randInt, shuffle, type Rng } from "./rng";
import type { CareerPlayer, FixtureResult } from "./types";

export type Side = "home" | "away";

export type LiveEventKind = "try" | "goal" | "drop-goal" | "miss" | "info" | "call" | "whistle" | "card";

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

export type LiveCallId =
  | "kick-off"
  | "penalty"
  | "forty-twenty"
  | "challenge"
  | "sin-bin-them"
  | "sin-bin-us"
  | "injury"
  | "team-talk"
  | "interchange"
  | "late"
  | "golden-point";

export interface LiveCall {
  id: LiveCallId;
  title: string;
  prompt: string;
  /** options[0] is the sensible default (used by "Skip to full time"). */
  options: LiveOption[];
}

interface ScheduledCall {
  id: LiveCallId;
  minute: number;
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
  /** Planned calls for this match (drawn at kick-off). */
  schedule: ScheduledCall[];
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
  /** Under the cosh on your own line until this minute (failed short kick-off etc.). */
  underPressureUntil: number;
  /** Sin bin: which side is down to 12, and until when. */
  binSide: Side | null;
  binUntil: number;
  /** Temporary boost window for the user (interchange). */
  boostFrom: number;
  boostUntil: number;
  boostAttack: number;
  boostDefence: number;
  /** The captain's challenge can be used once a match (and is offered at most twice). */
  challengeUsed: boolean;
  challengeOffers: number;
  /** Last opponent try (minute + scorer + points), for the captain's challenge. */
  lastOppTry: { minute: number; scorer: string; points: number } | null;
  /** Random incidents already used (each at most once a match). */
  incidents: { bin: boolean; injury: boolean };
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
const BIN_MINUTES = 10;

function kickAccuracy(rating: number) {
  return Math.min(0.85, 0.55 + (rating - 75) * 0.015);
}

function name(players: Record<string, CareerPlayer>, id: string) {
  return players[id]?.name ?? "A player";
}

const other = (side: Side): Side => (side === "home" ? "away" : "home");
const userIs = (m: LiveMatch, side: Side) => m.userSide === side;
const usScore = (m: LiveMatch) => (m.userSide === "home" ? m.homeScore : m.awayScore);
const themScore = (m: LiveMatch) => (m.userSide === "home" ? m.awayScore : m.homeScore);
const clubName = (m: LiveMatch, side: Side) => (side === "home" ? m.homeName : m.awayName);
const userSideName = (m: LiveMatch) => clubName(m, m.userSide);
const oppSideName = (m: LiveMatch) => clubName(m, other(m.userSide));
const userSheet = (m: LiveMatch) => (m.userSide === "home" ? m.home : m.away);

function addPoints(m: LiveMatch, side: Side, points: number) {
  if (side === "home") m.homeScore += points;
  else m.awayScore += points;
}

function nudgeMomentum(m: LiveMatch, side: Side, amount: number) {
  const signed = userIs(m, side) ? amount : -amount;
  m.momentum = Math.max(-1, Math.min(1, m.momentum + signed));
}

function randomPlayer(rng: Rng, sheet: TeamSheet, players: Record<string, CareerPlayer>): string {
  const ids = sheet.lineup.filter((id) => players[id]);
  return ids.length ? ids[Math.floor(rng() * ids.length)]! : "";
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
  if (!userIs(m, side)) m.lastOppTry = { minute: m.minute, scorer, points: converted ? 6 : 4 };
}

/* ------------------------------------------------------------------- set-up */

/** First-half moments: two of these per match, in a random order and at random minutes. */
const FIRST_HALF_POOL: LiveCallId[] = ["kick-off", "penalty", "forty-twenty", "penalty"];

function planSchedule(rng: Rng): ScheduledCall[] {
  const picks = [...new Set(shuffle(rng, FIRST_HALF_POOL))].slice(0, 2);
  const schedule: ScheduledCall[] = [];
  for (const id of picks) {
    if (id === "kick-off") schedule.push({ id, minute: 0 });
    else if (schedule.some((s) => s.minute >= 10)) schedule.push({ id, minute: randInt(rng, 24, 34) });
    else schedule.push({ id, minute: randInt(rng, 10, 22) });
  }
  schedule.push({ id: "team-talk", minute: 40 });
  if (rng() < 0.4) schedule.push({ id: "interchange", minute: randInt(rng, 48, 56) });
  schedule.push({ id: "late", minute: randInt(rng, 62, 70) });
  return schedule.sort((a, b) => a.minute - b.minute);
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
  // The penalty call is an extra shot at goal for the user, so their open-play penalty rate drops to match.
  const userPenCut = 0.6;
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
    schedule: planSchedule(rng),
    callsDone: [],
    callsWon: 0,
    userAttack: 1,
    userDefence: 1,
    oppPenalties: 1,
    pressureUntil: -1,
    underPressureUntil: -1,
    binSide: null,
    binUntil: -1,
    boostFrom: -1,
    boostUntil: -1,
    boostAttack: 1,
    boostDefence: 1,
    challengeUsed: false,
    challengeOffers: 0,
    lastOppTry: null,
    incidents: { bin: false, injury: false },
    momentum: 0,
    goldenPoint: false,
    finished: false,
    base: {
      homeTries: expectedTries(h.attack, a.defence, true),
      awayTries: expectedTries(a.attack, h.defence, false),
      homePens: Math.max(0.1, 0.45 + Math.max(0, h.rating - 80) * 0.03 - (params.userSide === "home" ? userPenCut : 0)),
      awayPens: Math.max(0.1, 0.45 + Math.max(0, a.rating - 80) * 0.03 - (params.userSide === "away" ? userPenCut : 0)),
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

function buildCall(m: LiveMatch, id: LiveCallId, players: Record<string, CareerPlayer>, detail = ""): LiveCall {
  const diff = usScore(m) - themScore(m);
  const clock = `${MINUTES - m.minute} minutes left`;
  switch (id) {
    case "kick-off":
      return {
        id,
        title: "Kick-off — your call",
        prompt: `${userSideName(m)} kick off. How do you start?`,
        options: [
          { id: "deep", label: "Kick it deep", hint: "Make them work from their own line." },
          { id: "short", label: "Short kick-off", hint: "Win it back and you're on the attack. Lose it and you're defending." },
        ],
      };
    case "penalty":
      return {
        id,
        title: "Penalty — your call",
        prompt: "Penalty to you, 20 metres out and right in front.",
        options: [
          { id: "two", label: "Take the two", hint: "Safe points on the board." },
          { id: "tap", label: "Tap and go", hint: "Try or bust. Better odds with a strong attack." },
          { id: "touch", label: "Kick to touch", hint: "Camp on their line for the next few minutes." },
        ],
      };
    case "forty-twenty":
      return {
        id,
        title: "Space in behind",
        prompt: "Their back three are up flat. Your half has the ball on the last tackle.",
        options: [
          { id: "safe-kick", label: "Kick for position", hint: "Pin them deep. Nothing fancy." },
          { id: "4020", label: "Go for the 40/20", hint: "Find touch and you get the ball back on their line." },
          { id: "bomb", label: "Bomb the winger", hint: "A high kick to the corner. Could go either way." },
        ],
      };
    case "challenge":
      return {
        id,
        title: "Captain's challenge?",
        prompt: `${detail} Your captain thinks there was a knock-on in the build-up.`,
        options: [
          { id: "accept", label: "Accept it", hint: "Save your one challenge for later." },
          { id: "challenge", label: "Challenge it", hint: "Overturned and the try comes off. Lose it and it stands." },
        ],
      };
    case "sin-bin-them":
      return {
        id,
        title: "They're down to 12",
        prompt: `${detail} Ten minutes with an extra man.`,
        options: [
          { id: "wide", label: "Go wide", hint: "Stretch them. More tries for you." },
          { id: "tight", label: "Keep it tight", hint: "Grind them down. Fewer mistakes." },
        ],
      };
    case "sin-bin-us":
      return {
        id,
        title: "You're down to 12",
        prompt: `${detail} Ten minutes a man short.`,
        options: [
          { id: "hold", label: "Hold the line", hint: "Everyone in. Tighter defence." },
          { id: "slow", label: "Slow it down", hint: "Kill the clock. Fewer points both ways for ten minutes." },
          { id: "attack-12", label: "Attack anyway", hint: "Best form of defence. Big risk." },
        ],
      };
    case "injury":
      return {
        id,
        title: "Injury",
        prompt: `${detail} He can't carry on.`,
        options: [
          { id: "like-for-like", label: "Like-for-like off the bench", hint: "Keep the shape. Small drop in quality." },
          { id: "reshuffle", label: "Reshuffle the backs", hint: "Move your best players about. Attack stays sharp, defence weaker." },
          { id: "forward", label: "Bring on an extra forward", hint: "Tighter defence, blunter attack." },
        ],
      };
    case "team-talk": {
      const state = diff > 0 ? `${diff} up` : diff < 0 ? `${-diff} down` : "all square";
      return {
        id,
        title: "Half-time team talk",
        prompt: `${m.homeScore}–${m.awayScore} at the break: you're ${state}.`,
        options: [
          { id: "calm", label: "Keep it calm", hint: "Tighter defence in the second half." },
          { id: "fire", label: "Fire them up", hint: "More attack, but more penalties given away." },
          { id: "hairdryer", label: "The hairdryer", hint: "Huge lift if you're behind. Backfires if you're not." },
        ],
      };
    }
    case "interchange":
      return {
        id,
        title: "Fresh legs",
        prompt: "Your middles are blowing. When do the bench forwards go on?",
        options: [
          { id: "now", label: "Now", hint: "A lift for the next 15 minutes." },
          { id: "later", label: "Save them for the last 15", hint: "Finish strong when it matters." },
        ],
      };
    case "golden-point":
      return {
        id,
        title: "Golden point",
        prompt: `${m.homeScore}–${m.awayScore} after 80 minutes. Next score wins.`,
        options: [
          { id: "gp-drop", label: "Drop goal straight away", hint: "Get in range and pull the trigger." },
          { id: "gp-patient", label: "Work the field position", hint: "Build pressure, take the shot when it's on." },
          { id: "gp-try", label: "Go for the try", hint: "Back yourselves to cross. Riskiest." },
        ],
      };
    case "late":
    default:
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
}

function openScheduledCall(m: LiveMatch, players: Record<string, CareerPlayer>): boolean {
  for (const s of m.schedule) {
    if (s.minute !== m.minute || m.callsDone.includes(s.id)) continue;
    m.pending = buildCall(m, s.id, players);
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
  const opp = other(side);
  const say = (text: string, kind: LiveEventKind = "call") => m.events.push({ minute: m.minute, side, kind, text });
  const userKick = side === "home" ? m.base.homeKick : m.base.awayKick;
  const userRating = side === "home" ? m.base.homeRating : m.base.awayRating;
  const edge = m.base.userAttackRating - m.base.oppDefenceRating;
  const behind = usScore(m) < themScore(m);

  switch (option.id) {
    /* kick-off */
    case "deep":
      say("Kicked deep. They start from their own line.");
      break;
    case "short":
      if (rng() < 0.32) {
        say("Short kick-off — and you've won it back!");
        m.pressureUntil = m.minute + 4;
        nudgeMomentum(m, side, 0.3);
        m.callsWon++;
      } else {
        say("Short kick-off doesn't go ten. Penalty and they're on the attack.", "miss");
        m.underPressureUntil = m.minute + 4;
        nudgeMomentum(m, side, -0.25);
      }
      break;
    /* penalty */
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
    /* 40/20 */
    case "safe-kick":
      say("Long kick, well chased. They're pinned deep.");
      m.userDefence *= 0.97;
      break;
    case "4020":
      if (rng() < 0.3) {
        say("40/20! Bounces into touch — your ball, ten metres out.");
        m.pressureUntil = m.minute + 5;
        nudgeMomentum(m, side, 0.35);
        m.callsWon++;
      } else {
        say("Goes for the 40/20 but it stays in field. They run it back.", "miss");
        m.underPressureUntil = m.minute + 3;
      }
      break;
    case "bomb":
      if (rng() < Math.max(0.15, Math.min(0.45, 0.25 + edge * 0.02))) {
        say("Bomb to the corner — the winger can't hold it and you pounce!");
        scoreTry(m, side, rng, players);
        m.callsWon++;
      } else if (rng() < 0.5) {
        say("Bomb to the corner, defused cleanly. Seven-tackle set to them.", "miss");
      } else {
        say("Bomb to the corner, knocked on. Scrum to you on their line.");
        m.pressureUntil = m.minute + 3;
      }
      break;
    /* captain's challenge */
    case "accept":
      say("You accept it and keep the challenge in your pocket.");
      break;
    case "challenge":
      m.challengeUsed = true;
      if (m.lastOppTry && rng() < 0.4) {
        const t = m.lastOppTry;
        addPoints(m, opp, -t.points);
        const tries = opp === "home" ? m.homeTries : m.awayTries;
        const at = tries.lastIndexOf(t.scorer);
        if (at >= 0) tries.splice(at, 1);
        say("Captain's challenge — overturned! Knock-on in the build-up. No try.");
        nudgeMomentum(m, side, 0.35);
        m.callsWon++;
      } else {
        say("Captain's challenge — try stands. Challenge lost.", "miss");
        nudgeMomentum(m, side, -0.1);
      }
      m.lastOppTry = null;
      break;
    /* sin bins */
    case "wide":
      m.boostFrom = m.minute;
      m.boostUntil = m.binUntil;
      m.boostAttack = 1.35;
      m.boostDefence = 1.1;
      say("Go wide. Make the extra man count.");
      break;
    case "tight":
      m.boostFrom = m.minute;
      m.boostUntil = m.binUntil;
      m.boostAttack = 1.15;
      m.boostDefence = 0.9;
      say("Keep it tight and grind them down.");
      break;
    case "hold":
      m.boostFrom = m.minute;
      m.boostUntil = m.binUntil;
      m.boostAttack = 0.9;
      m.boostDefence = 0.85;
      say("Everyone in. Hold the line.");
      break;
    case "slow":
      m.boostFrom = m.minute;
      m.boostUntil = m.binUntil;
      m.boostAttack = 0.6;
      m.boostDefence = 0.7;
      say("Slow it right down. Every play-the-ball takes an age.");
      break;
    case "attack-12":
      m.boostFrom = m.minute;
      m.boostUntil = m.binUntil;
      m.boostAttack = 1.25;
      m.boostDefence = 1.2;
      say("Best form of defence. Keep the ball and attack.");
      break;
    /* injury */
    case "like-for-like":
      m.userAttack *= 0.97;
      say("Like-for-like change off the bench.");
      break;
    case "reshuffle":
      m.userDefence *= 1.07;
      say("Backs reshuffled. The attack stays sharp.");
      break;
    case "forward":
      m.userAttack *= 0.93;
      m.userDefence *= 0.94;
      say("Extra forward on. Tighter, blunter.");
      break;
    /* half-time */
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
    /* interchange */
    case "now":
      m.boostFrom = m.minute;
      m.boostUntil = m.minute + 15;
      m.boostAttack = 1.15;
      m.boostDefence = 0.9;
      say("Bench forwards on. Fresh legs through the middle.");
      break;
    case "later":
      m.boostFrom = 65;
      m.boostUntil = 80;
      m.boostAttack = 1.18;
      m.boostDefence = 0.88;
      say("Bench held back for the final 15.");
      break;
    /* late */
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
      if (rng() < 0.42 + Math.max(0, userRating - 78) * 0.02) {
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
    /* golden point */
    case "gp-drop":
    case "gp-patient":
    case "gp-try":
      resolveGoldenPoint(m, option.id, rng, players);
      break;
  }
  m.callsDone.push(call.id);
  m.pending = null;
  if (call.id === "golden-point") endMatch(m);
}

/* ------------------------------------------------------------------- the clock */

/** Things that just happen: a sin bin or an injury, at most once each, sometimes needing a call. */
function maybeIncident(m: LiveMatch, rng: Rng, players: Record<string, CareerPlayer>): boolean {
  if (m.minute < 6 || m.minute > 72) return false;
  if (!m.incidents.bin && m.binSide === null && rng() < 0.3 / 66) {
    m.incidents.bin = true;
    const side: Side = rng() < 0.5 ? m.userSide : other(m.userSide);
    const sheet = side === "home" ? m.home : m.away;
    const offender = randomPlayer(rng, sheet, players);
    m.binSide = side;
    m.binUntil = m.minute + BIN_MINUTES;
    const who = offender ? name(players, offender) : `A ${clubName(m, side)} player`;
    const text = `Sin bin! ${who} is sent off for ten minutes for a high tackle.`;
    m.events.push({ minute: m.minute, side, kind: "card", text });
    m.pending = buildCall(m, userIs(m, side) ? "sin-bin-us" : "sin-bin-them", players, text.replace("Sin bin! ", ""));
    return true;
  }
  if (!m.incidents.injury && rng() < 0.3 / 66) {
    m.incidents.injury = true;
    const hurt = randomPlayer(rng, userSheet(m), players);
    const who = hurt ? name(players, hurt) : "One of your players";
    m.events.push({ minute: m.minute, side: m.userSide, kind: "info", text: `${who} goes down injured.` });
    m.pending = buildCall(m, "injury", players, `${who} goes down injured.`);
    return true;
  }
  return false;
}

/** Play one minute. Stops (without advancing) when a call is waiting. */
export function stepMinute(m: LiveMatch, rng: Rng, players: Record<string, CareerPlayer>): void {
  if (m.finished || m.pending) return;
  if (openScheduledCall(m, players)) return;

  m.minute += 1;
  const oppTriesBefore = (m.userSide === "home" ? m.awayTries : m.homeTries).length;
  const boosted = m.minute > m.boostFrom && m.minute <= m.boostUntil;
  const binned = m.binSide !== null && m.minute <= m.binUntil;

  for (const side of ["home", "away"] as Side[]) {
    const user = userIs(m, side);
    let tryRate = (side === "home" ? m.base.homeTries : m.base.awayTries) / MINUTES;
    tryRate *= user ? m.userAttack : m.userDefence;
    if (boosted) tryRate *= user ? m.boostAttack : m.boostDefence;
    if (user && m.minute <= m.pressureUntil) tryRate *= 2.6;
    if (!user && m.minute <= m.underPressureUntil) tryRate *= 2.2;
    // A side down to 12 concedes more and creates less.
    if (binned) tryRate *= m.binSide === side ? 0.7 : 1.6;
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

  if (m.binSide && m.minute === m.binUntil) {
    m.events.push({ minute: m.minute, side: m.binSide, kind: "info", text: `${clubName(m, m.binSide)} are back to 13.` });
    m.binSide = null;
  }
  if (m.minute === 40) m.events.push({ minute: 40, side: null, kind: "whistle", text: `Half-time: ${m.homeScore}–${m.awayScore}.` });

  // A close-game opponent try can go to the captain's challenge (once a match).
  const oppScoredNow = (m.userSide === "home" ? m.awayTries : m.homeTries).length > oppTriesBefore;
  if (
    oppScoredNow &&
    !m.challengeUsed &&
    m.challengeOffers < 2 &&
    m.lastOppTry &&
    m.minute < MINUTES &&
    Math.abs(usScore(m) - themScore(m)) <= 8 &&
    rng() < 0.35
  ) {
    m.challengeOffers++;
    m.pending = buildCall(m, "challenge", players, `${oppSideName(m)} score.`);
    return;
  }

  if (m.minute >= MINUTES) {
    finishNormalTime(m, players);
    return;
  }
  maybeIncident(m, rng, players);
}

function finishNormalTime(m: LiveMatch, players: Record<string, CareerPlayer>) {
  if (m.knockout && m.homeScore === m.awayScore) {
    m.goldenPoint = true;
    m.events.push({ minute: 80, side: null, kind: "whistle", text: `Full time: ${m.homeScore}–${m.awayScore}. Golden point!` });
    m.pending = buildCall(m, "golden-point", players);
    return;
  }
  endMatch(m);
}

function resolveGoldenPoint(m: LiveMatch, optionId: string, rng: Rng, players: Record<string, CareerPlayer>) {
  const side = m.userSide;
  const opp = other(side);
  const userRating = side === "home" ? m.base.homeRating : m.base.awayRating;
  const oppRating = side === "home" ? m.base.awayRating : m.base.homeRating;
  const gap = (userRating - oppRating) * 0.05;
  // Same overall odds as before (≈ rating gap), each call trades speed for certainty.
  const chance =
    optionId === "gp-drop" ? 0.5 + gap : optionId === "gp-patient" ? 0.52 + gap : 0.46 + gap * 1.6;
  const userWins = rng() < Math.max(0.1, Math.min(0.9, chance));
  const winner = userWins ? side : opp;
  if (userWins && optionId === "gp-try") {
    // A golden-point try ends the game straight away: no conversion is taken.
    const scorer = pickScorer(rng, userSheet(m), players);
    if (scorer) (side === "home" ? m.homeTries : m.awayTries).push(scorer);
    addPoints(m, side, 4);
    m.events.push({
      minute: 80,
      side,
      kind: "try",
      text: `Golden-point try! ${scorer ? name(players, scorer) : userSideName(m)} goes over and it's all over.`,
    });
  } else {
    addPoints(m, winner, 1);
    m.events.push({
      minute: 80,
      side: winner,
      kind: "drop-goal",
      text: userWins ? `Golden point! ${clubName(m, winner)} win it with a drop goal.` : `Golden point to ${clubName(m, winner)} — drop goal. Heartbreak.`,
    });
  }
  if (userWins) m.callsWon++;
}

function endMatch(m: LiveMatch) {
  m.finished = true;
  m.events.push({ minute: 80, side: null, kind: "whistle", text: `Full time: ${m.homeScore}–${m.awayScore}.` });
}

/** Play the rest of the match instantly, taking the default option at every call. */
export function playToEnd(m: LiveMatch, rng: Rng, players: Record<string, CareerPlayer>): void {
  let guard = 0;
  while (!m.finished && guard++ < 500) {
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

/** Exposed for tests and the UI copy: every call type a match can throw at you. */
export const ALL_CALL_IDS: LiveCallId[] = [
  "kick-off",
  "penalty",
  "forty-twenty",
  "challenge",
  "sin-bin-them",
  "sin-bin-us",
  "injury",
  "team-talk",
  "interchange",
  "late",
  "golden-point",
];
