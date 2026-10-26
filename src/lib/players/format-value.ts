import { formatPounds } from "../format-money";

/** Money formatting for player/squad values. Dependency-free (no player database). */
export function formatValue(value: number): string {
  return formatPounds(value);
}
