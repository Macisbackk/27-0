import type { Position } from "../types";
import { getInMatchMultiTryMultiplier } from "../game/multi-try";
import {
  getMatchdayTryWeight,
  pickWeightedIndexSafe,
  sanitizeWeight,
} from "./managerTryScoring";
import type { ManagerCareer } from "./types";
import { getManagerPlayer, getManagerPlayerEligiblePositions } from "./managerPlayers";

/** Conservative ability when rating is missing — floor of new professional scale. */
export const CONSERVATIVE_FALLBACK_RATING = 80;

export interface ScorerCandidate {
  id: string;
  name: string;
  position: Position;
  rating: number;
  form: number;
  isInterchange: boolean;
  baseWeight: number;
}

export interface ScorerPickDiagnostics {
  playerId: string;
  name: string;
  baseRating: number;
  form: number;
  position: Position;
  scorerWeight: number;
  finalProbability: number;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function resolvePlayerRating(
  raw: unknown,
  context: { playerId: string; name: string }
): number {
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[scorer] string rating coerced for ${context.name} (${context.playerId}): ${raw}`
        );
      }
      return Math.max(1, Math.min(99, parsed));
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.max(1, Math.min(99, raw));
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[scorer] missing rating for ${context.name} (${context.playerId}) — using ${CONSERVATIVE_FALLBACK_RATING}`
    );
  }
  return CONSERVATIVE_FALLBACK_RATING;
}

/** Ability × form × position share. */
export function computeAbilityScorerFactor(
  rating: number,
  form: number,
  _fitness = 100
): number {
  // Do not floor at senior 80 — reserves/FAs at 70–79 must not get elite weight.
  const r = Math.max(1, rating);
  const formMul = 0.72 + (Math.max(1, Math.min(99, form)) / 100) * 0.56;
  // Baseline 83 (squad/rotation on the senior scale). Lower ratings stay meaningful.
  return Math.pow(r / 83, 1.5) * formMul;
}

export { sanitizeWeight, pickWeightedIndexSafe } from "./managerTryScoring";

export function buildMatchdayScorerCandidates(
  career: ManagerCareer,
  options?: {
    matchdayXiii?: string[];
    xiiiSlotPositions?: Position[];
    matchdayInterchange?: string[];
  }
): ScorerCandidate[] {
  const xiii = options?.matchdayXiii ?? career.matchdayXiii;
  const slots = options?.xiiiSlotPositions ?? career.xiiiSlotPositions;
  const bench = options?.matchdayInterchange ?? career.matchdayInterchange;
  const seen = new Set<string>();
  const out: ScorerCandidate[] = [];

  const pushCandidate = (
    id: string | null | undefined,
    pos: Position | undefined,
    isInterchange: boolean
  ) => {
    if (!id || !pos) return;
    if (seen.has(id)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[scorer] duplicate lineup id rejected: ${id}`);
      }
      return;
    }
    const player = getManagerPlayer(career, id);
    if (!player) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[scorer] unresolved lineup player: ${id}`);
      }
      return;
    }
    seen.add(id);
    const squadState = career.squad.find((p) => p.playerId === id);
    const reserve = career.reserves?.find((r) => r.id === id);
    const form = squadState?.form ?? reserve?.form ?? 50;
    const rating = resolvePlayerRating(player.peakRating, {
      playerId: player.id,
      name: player.name,
    });
    const posWeight = getMatchdayTryWeight(pos, isInterchange);
    const ability = computeAbilityScorerFactor(rating, form);
    out.push({
      id: player.id,
      name: player.name,
      position: pos,
      rating,
      form,
      isInterchange,
      baseWeight: sanitizeWeight(posWeight * ability),
    });
  };

  for (let i = 0; i < xiii.length; i++) {
    pushCandidate(xiii[i], slots[i], false);
  }
  for (const id of bench) {
    if (!id) continue;
    const positions = getManagerPlayerEligiblePositions(career, id);
    pushCandidate(id, positions[0], true);
  }

  return out;
}

export function buildEffectiveScorerWeights(
  candidates: ScorerCandidate[],
  triesAlready: number[],
  teamTriesInMatch: number,
  positionBias: (pos: Position) => number = () => 1
): number[] {
  return candidates.map((c, i) => {
    const multi = getInMatchMultiTryMultiplier(
      triesAlready[i] ?? 0,
      c.position,
      c.rating,
      0,
      Math.max(1, teamTriesInMatch)
    );
    return sanitizeWeight(c.baseWeight * positionBias(c.position) * multi);
  });
}

export function pickScorerFromCandidates(
  candidates: ScorerCandidate[],
  triesAlready: number[],
  teamTriesInMatch: number,
  rng: () => number,
  positionBias?: (pos: Position) => number
): { scorer: ScorerCandidate; diagnostics: ScorerPickDiagnostics[] } | null {
  if (candidates.length === 0) return null;
  const weights = buildEffectiveScorerWeights(
    candidates,
    triesAlready,
    teamTriesInMatch,
    positionBias
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  const idx = pickWeightedIndexSafe(weights, rng);
  if (idx < 0 || !candidates[idx]) return null;
  const diagnostics: ScorerPickDiagnostics[] = candidates.map((c, i) => ({
    playerId: c.id,
    name: c.name,
    baseRating: c.rating,
    form: c.form,
    position: c.position,
    scorerWeight: weights[i] ?? 0,
    finalProbability: sum > 0 ? (weights[i] ?? 0) / sum : 1 / candidates.length,
  }));
  if (process.env.NODE_ENV === "development" && process.env.DEBUG_SCORER === "1") {
    console.debug("[scorer-pick]", diagnostics);
  }
  return { scorer: candidates[idx]!, diagnostics };
}

/**
 * Allocate tries one-by-one with diminishing multi-try odds.
 * Never selects a fake placeholder identity.
 */
export function allocateTriesWithDiminishing(
  totalTries: number,
  candidates: ScorerCandidate[],
  rng: () => number,
  positionBias?: (pos: Position) => number
): { alloc: number[]; diagnosticsLog: ScorerPickDiagnostics[][] } {
  const alloc = new Array(candidates.length).fill(0) as number[];
  const diagnosticsLog: ScorerPickDiagnostics[][] = [];
  if (totalTries <= 0 || candidates.length === 0) {
    return { alloc, diagnosticsLog };
  }

  for (let t = 0; t < totalTries; t++) {
    const picked = pickScorerFromCandidates(
      candidates,
      alloc,
      totalTries,
      rng,
      positionBias
    );
    if (!picked) break;
    const idx = candidates.findIndex((c) => c.id === picked.scorer.id);
    if (idx < 0) break;
    alloc[idx]!++;
    diagnosticsLog.push(picked.diagnostics);
  }
  return { alloc, diagnosticsLog };
}
