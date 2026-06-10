export type CompareEdge = "left" | "right" | "tie";

export function compareHigher(
  left: number,
  right: number,
  epsilon = 0.05
): CompareEdge {
  if (Math.abs(left - right) <= epsilon) return "tie";
  return left > right ? "left" : "right";
}

export function compareLower(
  left: number,
  right: number,
  epsilon = 0.05
): CompareEdge {
  if (Math.abs(left - right) <= epsilon) return "tie";
  return left < right ? "left" : "right";
}

export function parseWinPct(value: string): number | null {
  if (value === "—" || value.trim() === "") return null;
  const n = parseInt(value.replace("%", ""), 10);
  return Number.isFinite(n) ? n : null;
}
