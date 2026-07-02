import { getPlayerById } from "../players";
import type { Position } from "../types";
import type {
  AttackFocus,
  DefenceFocus,
  ManagerTactics,
  PlayingStyle,
  TacticMatchReviewAdvice,
} from "./types";

export interface TacticModifiers {
  strengthBonus: number;
  opponentPenalty: number;
  errorRisk: number;
  fatigueFactor: number;
  tacticLine: string;
}

const STYLE_LINES: Record<PlayingStyle, string | null> = {
  balanced: null,
  expansive: "expansive style targeted the edges",
  direct: "direct approach through the pack",
  defensive: "defensive shape kept the score tight",
  high_tempo: "high tempo opened the game up",
};

const ATTACK_LINES: Record<AttackFocus, string | null> = {
  middle: "forwards carried the attacking threat",
  edges: "width and the back line created chances",
  kicking_game: "kicking game shaped field position",
  offloads: "offloads kept the ball alive in contact",
  safe_sets: "safe sets limited errors in possession",
};

const DEFENCE_LINES: Record<DefenceFocus, string | null> = {
  line_speed: "line speed rushed their playmakers",
  conservative: "conservative line held its shape",
  aggressive_contact: "aggressive contact dominated the ruck",
  edge_defence: "edge defence targeted their wide threats",
  goal_line: "goal-line defence protected the middle",
};

/** Score-sim modifiers for all three tactic dimensions. */
export function getTacticModifiers(tactics: ManagerTactics): TacticModifiers {
  let strengthBonus = 0;
  let opponentPenalty = 0;
  let errorRisk = 0;
  let fatigueFactor = 1;
  const lines: string[] = [];

  switch (tactics.playingStyle) {
    case "expansive":
      strengthBonus += 2;
      errorRisk += 0.15;
      break;
    case "direct":
      strengthBonus += 1.5;
      break;
    case "defensive":
      strengthBonus -= 1;
      opponentPenalty -= 2;
      break;
    case "high_tempo":
      strengthBonus += 1;
      opponentPenalty += 1;
      fatigueFactor = 1.35;
      break;
    default:
      break;
  }

  switch (tactics.attackFocus) {
    case "middle":
      strengthBonus += 0.75;
      break;
    case "edges":
      strengthBonus += 0.75;
      break;
    case "kicking_game":
      strengthBonus += 1;
      break;
    case "offloads":
      strengthBonus += 0.5;
      errorRisk += 0.08;
      break;
    case "safe_sets":
      strengthBonus -= 0.5;
      errorRisk -= 0.12;
      opponentPenalty -= 0.5;
      break;
    default:
      break;
  }

  switch (tactics.defenceFocus) {
    case "line_speed":
      opponentPenalty -= 1;
      break;
    case "aggressive_contact":
      opponentPenalty -= 0.5;
      fatigueFactor += 0.15;
      break;
    case "conservative":
      opponentPenalty -= 1.5;
      strengthBonus -= 0.5;
      break;
    case "edge_defence":
      opponentPenalty -= 1.25;
      strengthBonus -= 0.25;
      break;
    case "goal_line":
      opponentPenalty -= 1.75;
      strengthBonus -= 0.75;
      break;
    default:
      break;
  }

  const styleLine = STYLE_LINES[tactics.playingStyle];
  const attackLine = ATTACK_LINES[tactics.attackFocus];
  const defenceLine = DEFENCE_LINES[tactics.defenceFocus];
  if (styleLine) lines.push(styleLine);
  if (attackLine && tactics.attackFocus !== "middle") lines.push(attackLine);
  if (defenceLine) lines.push(defenceLine);

  let tacticLine = "A balanced game plan from the coaching box.";
  if (lines.length > 0) {
    tacticLine = `Your ${lines.slice(0, 2).join(" while ")}.`;
    if (errorRisk > 0.1) tacticLine += " Errors crept in at key moments.";
    else if (fatigueFactor > 1.2) tacticLine += " Fatigue showed late on.";
  }

  return {
    strengthBonus,
    opponentPenalty,
    errorRisk,
    fatigueFactor,
    tacticLine,
  };
}

export interface TacticGameplaySummary {
  attackEffect: string;
  defenceEffect: string;
  matchImpact: string;
  cautions: string[];
}

/** Plain-language preview of how the current setup should play out. */
export function getTacticGameplaySummary(
  tactics: ManagerTactics
): TacticGameplaySummary {
  const mods = getTacticModifiers(tactics);
  const netEdge = mods.strengthBonus * 0.25 - mods.opponentPenalty * 0.12;

  const attackEffect: Record<AttackFocus, string> = {
    middle: "Pack-heavy attack — forwards favoured for tries",
    edges: "Wide attack — backs and edges favoured for tries",
    kicking_game: "Territory kicks — halves and wingers benefit",
    offloads: "Broken-field play — offloads create chaos",
    safe_sets: "Low-risk sets — fewer errors, fewer line breaks",
  };

  const defenceEffect: Record<DefenceFocus, string> = {
    line_speed: "Rush defence — shuts down halves, gaps behind the line",
    conservative: "Hold the line — fewer points conceded, less turnover ball",
    aggressive_contact: "Dominant contact — big hits, higher fatigue risk",
    edge_defence: "Shut down wingers — middle may leak tries",
    goal_line: "Protect the posts — edges and kicks are the danger",
  };

  const cautions: string[] = [];
  if (mods.errorRisk > 0.1) cautions.push("Higher error risk");
  if (mods.errorRisk < -0.08) cautions.push("Safer possession");
  if (mods.fatigueFactor >= 1.35) cautions.push("Extra fatigue & injury risk");
  if (mods.strengthBonus < 0 && mods.opponentPenalty < -1) {
    cautions.push("Limited attacking output");
  }

  let matchImpact = "Neutral tactical edge";
  if (netEdge >= 1.2) matchImpact = "Strong edge — should favour you";
  else if (netEdge >= 0.4) matchImpact = "Slight edge in your favour";
  else if (netEdge <= -1.2) matchImpact = "Tough setup — harder to win";
  else if (netEdge <= -0.4) matchImpact = "Slight disadvantage";

  return {
    attackEffect: attackEffect[tactics.attackFocus],
    defenceEffect: defenceEffect[tactics.defenceFocus],
    matchImpact,
    cautions,
  };
}

export function applyTacticFormAdjustment(
  combinedForm: number,
  mods: TacticModifiers
): number {
  return Math.max(-4, Math.min(8, combinedForm - mods.errorRisk * 2.5));
}

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

export function countOpponentTriesByZone(
  tryScorers: { playerId: string; tries: number }[]
): { edge: number; middle: number } {
  let edge = 0;
  let middle = 0;
  for (const scorer of tryScorers) {
    const p = getPlayerById(scorer.playerId);
    const position = p?.position ?? ("CENTRE" as Position);
    if (position === "WING" || position === "CENTRE" || position === "FULLBACK") {
      edge += scorer.tries;
    } else if (MIDDLE_POSITIONS.has(position)) {
      middle += scorer.tries;
    }
  }
  return { edge, middle };
}

const PLAYING_STYLE_LABELS: Record<PlayingStyle, string> = {
  balanced: "Balanced",
  expansive: "Expansive",
  direct: "Direct",
  defensive: "Defensive",
  high_tempo: "High Tempo",
};

const ATTACK_FOCUS_LABELS: Record<AttackFocus, string> = {
  middle: "Middle",
  edges: "Edges",
  kicking_game: "Kicking Game",
  offloads: "Offloads",
  safe_sets: "Safe Sets",
};

const DEFENCE_FOCUS_LABELS: Record<DefenceFocus, string> = {
  line_speed: "Line Speed",
  conservative: "Conservative",
  aggressive_contact: "Aggressive Contact",
  edge_defence: "Edge Defence",
  goal_line: "Goal-Line Defence",
};

const ALL_PLAYING_STYLES: PlayingStyle[] = [
  "balanced",
  "expansive",
  "direct",
  "defensive",
  "high_tempo",
];

const ALL_ATTACK_FOCUSES: AttackFocus[] = [
  "middle",
  "edges",
  "kicking_game",
  "offloads",
  "safe_sets",
];

const ALL_DEFENCE_FOCUSES: DefenceFocus[] = [
  "line_speed",
  "conservative",
  "aggressive_contact",
  "edge_defence",
  "goal_line",
];

function formatTacticsLabel(tactics: ManagerTactics): string {
  return `${PLAYING_STYLE_LABELS[tactics.playingStyle]} · ${ATTACK_FOCUS_LABELS[tactics.attackFocus]} · ${DEFENCE_FOCUS_LABELS[tactics.defenceFocus]}`;
}

function tacticsEqual(a: ManagerTactics, b: ManagerTactics): boolean {
  return (
    a.playingStyle === b.playingStyle &&
    a.attackFocus === b.attackFocus &&
    a.defenceFocus === b.defenceFocus
  );
}

interface TacticMatchContext {
  won: boolean;
  pointsFor: number;
  pointsAgainst: number;
  userTries: number;
  concededTries: number;
  forwardTries: number;
  backTries: number;
  conceded: { edge: number; middle: number };
}

function scoreDefenceForMatch(
  defenceFocus: DefenceFocus,
  opponentTryScorers: { playerId: string; tries: number }[]
): number {
  let score = 0;
  for (const scorer of opponentTryScorers) {
    const p = getPlayerById(scorer.playerId);
    const position = p?.position ?? ("CENTRE" as Position);
    const mult = getDefenceConcedeMultiplier(defenceFocus, position);
    score -= (mult - 1) * scorer.tries * 1.75;
  }
  const mods = getTacticModifiers({
    playingStyle: "balanced",
    attackFocus: "middle",
    defenceFocus,
  });
  score -= mods.opponentPenalty * 0.35;
  return score;
}

function scoreAttackForMatch(
  tactics: ManagerTactics,
  ctx: TacticMatchContext
): number {
  const mods = getTacticModifiers(tactics);
  let score = mods.strengthBonus * 0.45 - mods.errorRisk * (ctx.won ? 0.4 : 1.1);

  if (ctx.userTries < ctx.concededTries) {
    if (
      tactics.playingStyle === "expansive" ||
      tactics.playingStyle === "direct" ||
      tactics.playingStyle === "high_tempo"
    ) {
      score += 0.85;
    }
    if (tactics.attackFocus !== "safe_sets") score += 0.45;
    if (tactics.playingStyle === "defensive") score -= 1.25;
  }

  if (ctx.forwardTries > ctx.backTries) {
    score +=
      getPlayingStyleTryMultiplier(tactics.playingStyle, "PROP") * 0.35 +
      getAttackFocusTryMultiplier(tactics.attackFocus, "PROP") * 0.35;
  }
  if (ctx.backTries > ctx.forwardTries) {
    score +=
      getPlayingStyleTryMultiplier(tactics.playingStyle, "WING") * 0.35 +
      getAttackFocusTryMultiplier(tactics.attackFocus, "WING") * 0.35;
  }

  if (!ctx.won && ctx.pointsFor < ctx.pointsAgainst) {
    const margin = ctx.pointsAgainst - ctx.pointsFor;
    if (margin >= 12 && tactics.playingStyle === "defensive") score -= 0.75;
    if (margin <= 6 && tactics.attackFocus === "safe_sets") score -= 0.5;
  }

  return score;
}

function scoreTacticsForMatch(
  tactics: ManagerTactics,
  ctx: TacticMatchContext,
  opponentTryScorers: { playerId: string; tries: number }[]
): number {
  return (
    scoreDefenceForMatch(tactics.defenceFocus, opponentTryScorers) +
    scoreAttackForMatch(tactics, ctx)
  );
}

function findBestTacticsForMatch(
  ctx: TacticMatchContext,
  opponentTryScorers: { playerId: string; tries: number }[]
): ManagerTactics {
  let best: ManagerTactics = {
    playingStyle: "balanced",
    attackFocus: "middle",
    defenceFocus: "goal_line",
  };
  let bestScore = -Infinity;

  for (const playingStyle of ALL_PLAYING_STYLES) {
    for (const attackFocus of ALL_ATTACK_FOCUSES) {
      for (const defenceFocus of ALL_DEFENCE_FOCUSES) {
        const candidate = { playingStyle, attackFocus, defenceFocus };
        const score = scoreTacticsForMatch(candidate, ctx, opponentTryScorers);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
  }

  return best;
}

function buildTacticRecommendations(
  current: ManagerTactics,
  best: ManagerTactics,
  ctx: TacticMatchContext
): string[] {
  const recs: string[] = [];

  if (ctx.won && tacticsEqual(current, best)) {
    return [
      "This setup matched how the game played out — keep it against similar opposition.",
    ];
  }

  if (ctx.won) {
    return [
      `You won with ${formatTacticsLabel(current)}, but ${formatTacticsLabel(best)} may have stretched the margin.`,
    ];
  }

  if (best.defenceFocus !== current.defenceFocus) {
    if (ctx.conceded.edge > ctx.conceded.middle) {
      recs.push(
        `Switch defence to ${DEFENCE_FOCUS_LABELS[best.defenceFocus]} — they scored ${ctx.conceded.edge} try${ctx.conceded.edge === 1 ? "" : "ies"} out wide.`
      );
    } else if (ctx.conceded.middle > 0) {
      recs.push(
        `Switch defence to ${DEFENCE_FOCUS_LABELS[best.defenceFocus]} — close-range tries through the middle cost you.`
      );
    } else {
      recs.push(
        `Tighten up with ${DEFENCE_FOCUS_LABELS[best.defenceFocus]} — you conceded ${ctx.concededTries} tries.`
      );
    }
  }

  if (
    best.attackFocus !== current.attackFocus &&
    ctx.userTries <= ctx.concededTries
  ) {
    recs.push(
      `Shift attack to ${ATTACK_FOCUS_LABELS[best.attackFocus]} — ${ctx.userTries} tries was not enough to win.`
    );
  }

  if (best.playingStyle !== current.playingStyle) {
    const styleReasons: Record<PlayingStyle, string> = {
      direct:
        "run direct through the forwards — the pack needed more ball",
      expansive:
        "spread the ball wide — the edges offered more scoring threat",
      defensive:
        "sit in and grind — this was a game to limit damage first",
      high_tempo:
        "lift the tempo — you needed to chase the scoreboard",
      balanced:
        "steady the ship with a balanced approach",
    };
    recs.push(
      `Try ${PLAYING_STYLE_LABELS[best.playingStyle]} — ${styleReasons[best.playingStyle]}.`
    );
  }

  if (recs.length === 0) {
    recs.push(`Better fit: ${formatTacticsLabel(best)}.`);
  }

  return recs.slice(0, 3);
}

/** Post-match advice on what tactics would have won (or improved) the result. */
export function buildTacticMatchReviewAdvice(
  tactics: ManagerTactics,
  won: boolean,
  pointsFor: number,
  pointsAgainst: number,
  userTries: number,
  concededTries: number,
  forwardTries: number,
  backTries: number,
  opponentTryScorers: { playerId: string; tries: number }[] = []
): TacticMatchReviewAdvice {
  const conceded = countOpponentTriesByZone(opponentTryScorers);
  const ctx: TacticMatchContext = {
    won,
    pointsFor,
    pointsAgainst,
    userTries,
    concededTries,
    forwardTries,
    backTries,
    conceded,
  };

  const best = findBestTacticsForMatch(ctx, opponentTryScorers);
  const margin = pointsFor - pointsAgainst;

  let headline: string;
  if (won) {
    headline =
      tacticsEqual(tactics, best)
        ? "Your tactics were the right call"
        : "You got the result — a tweak could have helped";
  } else if (margin >= -6) {
    headline = "A different game plan could have turned this";
  } else {
    headline = "The wrong setup for this match-up";
  }

  return {
    headline,
    usedLabel: formatTacticsLabel(tactics),
    recommendations: buildTacticRecommendations(tactics, best, ctx),
  };
}

export function buildTacticEffectivenessLine(
  tactics: ManagerTactics,
  won: boolean,
  userTries: number,
  concededTries: number,
  forwardTries: number,
  backTries: number,
  opponentTryScorers: { playerId: string; tries: number }[] = []
): string {
  const { playingStyle, attackFocus, defenceFocus } = tactics;
  const conceded = countOpponentTriesByZone(opponentTryScorers);

  if (playingStyle === "direct" && forwardTries >= 2) {
    return "Your Direct style worked well — the forwards created repeat pressure and scored through the middle.";
  }
  if (playingStyle === "expansive" && backTries >= 2) {
    return "Your Expansive style stretched the defence — the backs finished chances out wide.";
  }
  if (defenceFocus === "edge_defence") {
    if (conceded.edge === 0 && concededTries > 0) {
      return "Edge Defence worked — their wide threats were kept quiet all afternoon.";
    }
    if (conceded.edge >= 2) {
      return "Edge Defence leaked out wide — their wingers found too much space.";
    }
    if (concededTries <= 1) {
      return "The Edge Defence plan limited their wingers, though the middle still had moments.";
    }
  }
  if (defenceFocus === "goal_line") {
    if (conceded.middle <= 1 && concededTries <= 2) {
      return "Goal-Line Defence held firm — close-range tries were hard to come by.";
    }
    if (conceded.edge >= 2) {
      return "Goal-Line Defence protected the middle but kicks and width hurt you.";
    }
  }
  if (defenceFocus === "line_speed" && backTries > forwardTries && concededTries >= 2) {
    return "Line Speed pressured the halves, but kicks behind the line caused problems.";
  }
  if (defenceFocus === "conservative" && conceded.middle >= 2) {
    return "Conservative defence gave up territory — close-range tries hurt you.";
  }
  if (attackFocus === "offloads" && userTries >= 3) {
    return "Offloads kept the ball alive and created broken-field tries.";
  }
  if (attackFocus === "safe_sets" && userTries <= 2 && won) {
    return "Safe sets kept errors down — enough to grind out the result.";
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
