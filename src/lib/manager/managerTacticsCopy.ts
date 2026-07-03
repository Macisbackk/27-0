import type {
  AttackFocus,
  DefenceFocus,
  ManagerTactics,
  PlayingStyle,
} from "./types";

export const PLAYING_STYLE_LABELS: Record<PlayingStyle, string> = {
  balanced: "Balanced",
  expansive: "Expansive",
  direct: "Direct",
  defensive: "Defensive",
  high_tempo: "High Tempo",
};

export const ATTACK_FOCUS_LABELS: Record<AttackFocus, string> = {
  middle: "Middle",
  edges: "Edges",
  kicking_game: "Kicking Game",
  offloads: "Offloads",
  safe_sets: "Safe Sets",
};

export const DEFENCE_FOCUS_LABELS: Record<DefenceFocus, string> = {
  line_speed: "Line Speed",
  conservative: "Conservative",
  aggressive_contact: "Aggressive Contact",
  edge_defence: "Edge Defence",
  goal_line: "Goal-Line Defence",
};

export const PLAYING_STYLE_BIOS: Record<PlayingStyle, string> = {
  balanced: "Even risk and reward — reliable in most match-ups.",
  expansive:
    "Spread the ball wide for more tries; higher error risk. Strong attacking edge.",
  direct: "Run hard through the middle — forwards score more, backs less.",
  defensive:
    "Tighter defence, fewer points conceded; harder to score yourself.",
  high_tempo:
    "Fast sets open the game but tire players faster — extra injury risk.",
};

export const ATTACK_FOCUS_BIOS: Record<AttackFocus, string> = {
  middle: "Target the pack — +edge for forward tries.",
  edges: "Use width — wingers and centres favoured for tries.",
  kicking_game: "Territory through kicks — halves and wingers benefit.",
  offloads:
    "Keep the ball alive in contact — broken-field tries, slightly more errors.",
  safe_sets: "Fewer errors and a tighter game — less explosive attack.",
};

export const DEFENCE_FOCUS_BIOS: Record<DefenceFocus, string> = {
  line_speed: "Rush defence shuts down halves; watch kicks behind the line.",
  conservative:
    "Hold your line — fewer tries conceded, less turnover ball to attack with.",
  aggressive_contact:
    "Dominant tackles and contact; higher fatigue and injury risk.",
  edge_defence: "Shut down wingers — strong wide defence, middle can leak.",
  goal_line:
    "Protect the posts — tough to score close range, edges remain a threat.",
};

export const TACTIC_ATTACK_EFFECT: Record<AttackFocus, string> = {
  middle: "Pack-heavy attack — forwards favoured for tries",
  edges: "Wide attack — backs and edges favoured for tries",
  kicking_game: "Territory kicks — halves and wingers benefit",
  offloads: "Broken-field play — offloads create chaos",
  safe_sets: "Low-risk sets — fewer errors, fewer line breaks",
};

export const TACTIC_DEFENCE_EFFECT: Record<DefenceFocus, string> = {
  line_speed: "Rush defence — shuts down halves, gaps behind the line",
  conservative: "Hold the line — fewer points conceded, less turnover ball",
  aggressive_contact: "Dominant contact — big hits, higher fatigue risk",
  edge_defence: "Shut down wingers — middle may leak tries",
  goal_line: "Protect the posts — edges and kicks are the danger",
};

export const PLAYING_STYLE_OPTIONS = (
  Object.keys(PLAYING_STYLE_LABELS) as PlayingStyle[]
).map((value) => ({
  value,
  label: PLAYING_STYLE_LABELS[value],
}));

export const ATTACK_FOCUS_OPTIONS = (
  Object.keys(ATTACK_FOCUS_LABELS) as AttackFocus[]
).map((value) => ({
  value,
  label: ATTACK_FOCUS_LABELS[value],
}));

export const DEFENCE_FOCUS_OPTIONS = (
  Object.keys(DEFENCE_FOCUS_LABELS) as DefenceFocus[]
).map((value) => ({
  value,
  label: DEFENCE_FOCUS_LABELS[value],
}));

export function formatTacticsLabel(tactics: ManagerTactics): string {
  return `${PLAYING_STYLE_LABELS[tactics.playingStyle]} · ${ATTACK_FOCUS_LABELS[tactics.attackFocus]} · ${DEFENCE_FOCUS_LABELS[tactics.defenceFocus]}`;
}

export function formatPlayingStyleLabel(style: PlayingStyle): string {
  return PLAYING_STYLE_LABELS[style];
}

export function formatAttackFocusLabel(focus: AttackFocus): string {
  return ATTACK_FOCUS_LABELS[focus];
}

export function formatDefenceFocusLabel(focus: DefenceFocus): string {
  return DEFENCE_FOCUS_LABELS[focus];
}
