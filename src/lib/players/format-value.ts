/** Money formatting for player/squad values. Dependency-free (no player database). */
export function formatValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `£${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `£${Math.round(value / 1_000)}K`;
  }
  return `£${value.toLocaleString()}`;
}
