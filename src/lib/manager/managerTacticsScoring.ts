import { getPlayerById } from "../players";
import type { Position } from "../types";
import type {
  AttackFocus,
  DefenceFocus,
  ManagerTactics,
  PlayingStyle,
} from "./types";

const FORWARD_POSITIONS = new Set<Position>([
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
]);

const BACK_POSITIONS = new Set<Position>([
  "FULLBACK",
  "WING",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
]);

const EDGE_POSITIONS = new Set<Position>(["WING", "CENTRE", "SECOND_ROW"]);

const MIDDLE_POSITIONS = new Set<Position>([
  "PROP",
  "HOOKER",
  "LOOSE_FORWARD",
]);

const HALVES_POSITIONS = new Set<Position>(["STAND_OFF", "SCRUM_HALF"]);

export function getPlayingStyleTryMultiplier(
  style: PlayingStyle,
  position: Position
): number {
  switch (style) {
    case "direct":
      if (MIDDLE_POSITIONS.has(position)) return 1.55;
      if (position === "SECOND_ROW") return 1.25;
      if (BACK_POSITIONS.has(position) && position !== "FULLBACK") return 0.72;
      return 0.85;
    case "expansive":
      if (position === "WING" || position === "CENTRE") return 1.5;
      if (position === "FULLBACK") return 1.35;
      if (FORWARD_POSITIONS.has(position)) return 0.8;
      return 1.0;
    case "defensive":
      return 0.88;
    case "high_tempo":
      return 1.15;
    default:
      return 1.0;
  }
}

export function getAttackFocusTryMultiplier(
  focus: AttackFocus,
  position: Position
): number {
  switch (focus) {
    case "middle":
      return MIDDLE_POSITIONS.has(position) ? 1.45 : 0.9;
    case "edges":
      return EDGE_POSITIONS.has(position) ? 1.4 : 0.92;
    case "kicking_game":
      if (position === "WING" || position === "FULLBACK") return 1.35;
      if (HALVES_POSITIONS.has(position)) return 1.2;
      return 0.95;
    case "offloads":
      if (
        position === "FULLBACK" ||
        position === "SECOND_ROW" ||
        position === "LOOSE_FORWARD" ||
        position === "CENTRE"
      ) {
        return 1.3;
      }
      return 1.05;
    case "safe_sets":
      return 0.82;
    default:
      return 1.0;
  }
}

/** Opponent try scorer weight by user defence focus. */
export function getDefenceConcedeMultiplier(
  focus: DefenceFocus,
  position: Position
): number {
  switch (focus) {
    case "line_speed":
      if (MIDDLE_POSITIONS.has(position)) return 0.75;
      if (position === "WING" || position === "FULLBACK") return 1.35;
      if (position === "CENTRE") return 1.2;
      return 1.0;
    case "conservative":
      if (MIDDLE_POSITIONS.has(position)) return 1.35;
      if (EDGE_POSITIONS.has(position)) return 0.9;
      return 1.05;
    case "aggressive_contact":
      if (position === "HOOKER" || position === "LOOSE_FORWARD") return 1.3;
      if (position === "WING" || position === "CENTRE") return 1.15;
      return 1.0;
    case "edge_defence":
      if (position === "WING" || position === "CENTRE") return 0.7;
      if (MIDDLE_POSITIONS.has(position)) return 1.35;
      return 1.0;
    case "goal_line":
      if (MIDDLE_POSITIONS.has(position)) return 0.72;
      if (position === "WING" || position === "CENTRE" || position === "FULLBACK")
        return 1.3;
      return 1.0;
    default:
      return 1.0;
  }
}

export function buildTacticEffectivenessLine(
  tactics: ManagerTactics,
  won: boolean,
  userTries: number,
  concededTries: number,
  forwardTries: number,
  backTries: number
): string {
  const { playingStyle, attackFocus, defenceFocus } = tactics;

  if (playingStyle === "direct" && forwardTries >= 2) {
    return "Your Direct style worked well — the forwards created repeat pressure and scored through the middle.";
  }
  if (playingStyle === "expansive" && backTries >= 2) {
    return "Your Expansive style stretched the defence — the backs finished chances out wide.";
  }
  if (defenceFocus === "edge_defence" && concededTries <= 1) {
    return "The Edge Defence plan limited their wingers, though the middle still had moments.";
  }
  if (defenceFocus === "line_speed" && backTries > forwardTries && concededTries >= 2) {
    return "Line Speed pressured the halves, but kicks behind the line caused problems.";
  }
  if (defenceFocus === "conservative" && concededTries >= 3) {
    return "Conservative defence gave up territory — close-range tries hurt you.";
  }
  if (playingStyle === "high_tempo") {
    return won
      ? "High Tempo created chances and kept the scoreboard ticking."
      : "High Tempo created chances but fatigue hurt you late on.";
  }
  if (attackFocus === "kicking_game") {
    return "The kicking game from the halves shaped field position all afternoon.";
  }
  if (playingStyle === "defensive") {
    return won
      ? "A disciplined defensive display — you did enough to win a tight contest."
      : "Defensive shape kept the score close, but attacking output was limited.";
  }
  if (!won && concededTries >= 3) {
    return `The ${defenceFocus.replace(/_/g, " ")} plan leaked too many tries — time to reassess.`;
  }
  return won
    ? "Your game plan came together when it mattered most."
    : "A frustrating afternoon — the tactical plan didn't quite click.";
}

export function countTriesByPositionGroup(
  tryScorers: { playerId: string; tries: number }[],
  slotPositions: Position[],
  xiiiIds: string[]
): { forward: number; back: number } {
  let forward = 0;
  let back = 0;
  for (const scorer of tryScorers) {
    const idx = xiiiIds.indexOf(scorer.playerId);
    const pos = idx >= 0 ? slotPositions[idx] : undefined;
    const p = getPlayerById(scorer.playerId);
    const position =
      pos ?? p?.position ?? ("CENTRE" as Position);
    if (FORWARD_POSITIONS.has(position)) forward += scorer.tries;
    else back += scorer.tries;
  }
  return { forward, back };
}
