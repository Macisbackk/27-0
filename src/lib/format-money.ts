/**
 * The one way the game writes money: £850, £15k, £1.2m, £12m.
 * Club Funds, squad and player values and Manager Mode budgets all use it, so the same amount
 * always reads the same everywhere. Dependency-free (safe for any bundle).
 */
export function formatPounds(amount: number): string {
  if (!Number.isFinite(amount)) return "£0";
  const sign = amount < 0 ? "-" : "";
  const value = Math.round(Math.abs(amount));
  if (value >= 999_500) {
    const millions = value / 1_000_000;
    if (millions >= 10) return `${sign}£${Math.round(millions)}m`;
    const rounded = Math.round(millions * 10) / 10;
    return `${sign}£${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}m`;
  }
  if (value >= 1_000) return `${sign}£${Math.round(value / 1_000)}k`;
  return `${sign}£${value}`;
}

/** Full exact value, e.g. £1,250,000 (expanded panels, prize ladders). */
export function formatPoundsExact(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}£${Math.round(Math.abs(amount)).toLocaleString("en-GB")}`;
}
