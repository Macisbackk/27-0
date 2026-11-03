/**
 * The game plan (v1.66): attacking style, defensive line and kicking game. Each setting is a
 * small trade, never a free lunch: a bit more of one thing costs a bit of another, or makes the
 * game wilder (more tries both ways) or tighter. A tight game suits an underdog (fewer tries, more
 * luck); an open one suits the stronger side. The old single tactic maps onto these on load.
 */
import type { AttackStyle, DefenceLine, KickingGame, Tactic, TacticSettings } from "./types";

export const DEFAULT_TACTICS: TacticSettings = { attack: "balanced", defence: "balanced", kicking: "balanced" };

/**
 * attack / defence: rating points added to the side's attack and defence.
 * tempo: multiplies both sides' try rates (above 1 = a more open game).
 * pens: extra penalties the side concedes per game (the other side's shots at goal).
 */
interface Effect {
  attack: number;
  defence: number;
  tempo: number;
  pens: number;
}

const ATTACK: Record<AttackStyle, Effect> = {
  expansive: { attack: 0.4, defence: -0.4, tempo: 1.03, pens: 0 },
  balanced: { attack: 0, defence: 0, tempo: 1, pens: 0 },
  direct: { attack: -0.3, defence: 0.3, tempo: 0.98, pens: 0 },
};
const DEFENCE: Record<DefenceLine, Effect> = {
  rush: { attack: 0, defence: 0.35, tempo: 1.01, pens: 0.25 },
  balanced: { attack: 0, defence: 0, tempo: 1, pens: 0 },
  drift: { attack: 0, defence: 0.1, tempo: 0.98, pens: -0.1 },
};
const KICKING: Record<KickingGame, Effect> = {
  territory: { attack: -0.25, defence: 0.25, tempo: 0.98, pens: 0 },
  balanced: { attack: 0, defence: 0, tempo: 1, pens: 0 },
  attacking: { attack: 0.3, defence: -0.3, tempo: 1.02, pens: 0 },
};

export type TacticEffect = Effect;

/** The combined effect of a game plan (or of an old single tactic). */
export function tacticEffect(settings: TacticSettings | undefined, legacy?: Tactic): TacticEffect {
  const t = settings ?? tacticsFromLegacy(legacy ?? "balanced");
  const parts = [ATTACK[t.attack] ?? ATTACK.balanced, DEFENCE[t.defence] ?? DEFENCE.balanced, KICKING[t.kicking] ?? KICKING.balanced];
  return {
    attack: parts.reduce((s, p) => s + p.attack, 0),
    defence: parts.reduce((s, p) => s + p.defence, 0),
    tempo: parts.reduce((s, p) => s * p.tempo, 1),
    pens: parts.reduce((s, p) => s + p.pens, 0),
  };
}

/** Old saves: "attack" → expansive with attacking kicks, "defend" → direct with a territory kicking game. */
export function tacticsFromLegacy(t: Tactic | undefined): TacticSettings {
  if (t === "attack") return { attack: "expansive", defence: "balanced", kicking: "attacking" };
  if (t === "defend") return { attack: "direct", defence: "balanced", kicking: "territory" };
  return { ...DEFAULT_TACTICS };
}

/** The nearest old single tactic (kept in step for anything still reading `tactic`). */
export function legacyTactic(t: TacticSettings): Tactic {
  const e = tacticEffect(t);
  const lean = e.attack - e.defence;
  return lean >= 0.8 ? "attack" : lean <= -0.8 ? "defend" : "balanced";
}

/** A save's game plan, valid whatever version wrote it. */
export function tacticsOf(state: { tactics?: TacticSettings; tactic?: Tactic }): TacticSettings {
  const t = state.tactics;
  if (t && t.attack in ATTACK && t.defence in DEFENCE && t.kicking in KICKING) return t;
  return tacticsFromLegacy(state.tactic);
}

export const ATTACK_OPTIONS: Array<{ id: AttackStyle; label: string; hint: string }> = [
  { id: "expansive", label: "Expansive", hint: "Throw it wide: more tries, more mistakes." },
  { id: "balanced", label: "Balanced", hint: "Play what's in front of you." },
  { id: "direct", label: "Direct", hint: "Up the middle: fewer errors, fewer tries." },
];
export const DEFENCE_OPTIONS: Array<{ id: DefenceLine; label: string; hint: string }> = [
  { id: "rush", label: "Rush", hint: "Shut them down fast, but give away more penalties." },
  { id: "balanced", label: "Balanced", hint: "Hold the line." },
  { id: "drift", label: "Drift", hint: "Slide and stay safe: a tighter, cleaner game." },
];
export const KICKING_OPTIONS: Array<{ id: KickingGame; label: string; hint: string }> = [
  { id: "territory", label: "Territory", hint: "Pin them back: safer, but fewer chances." },
  { id: "balanced", label: "Balanced", hint: "Mix it up." },
  { id: "attacking", label: "Attacking", hint: "Grubbers and bombs to score, at a risk." },
];

/** One short line for the Match tab: what this plan does. */
export function tacticSummary(t: TacticSettings): string {
  const e = tacticEffect(t);
  const lean = e.attack - e.defence;
  const style = lean >= 1.2 ? "All-out attack" : lean >= 0.5 ? "Attack-minded" : lean <= -1 ? "Shut up shop" : lean <= -0.5 ? "Defence first" : "Even keel";
  const tempo = e.tempo >= 1.03 ? "an open game" : e.tempo <= 0.97 ? "a tight game" : "a normal tempo";
  return `${style}, ${tempo}${e.pens > 0.1 ? ", more penalties against" : ""}.`;
}
