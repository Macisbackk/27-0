import type { PlayerCategory } from "../types";
import verifiedData from "../../../data/career-tries-verified.json";

const VERIFIED_MAP = new Map(
  Object.entries(verifiedData as Record<string, number>)
);

/**
 * Returns verified career try total, or undefined when unknown.
 * Active players and unverified records never invent totals.
 */
export function resolveCareerTries(
  id: string,
  _category: PlayerCategory
): number | undefined {
  const verified = VERIFIED_MAP.get(id);
  if (verified !== undefined) return verified;

  return undefined;
}

export function formatCareerTries(tries: number | undefined): string {
  return tries !== undefined ? String(tries) : "Unknown";
}
