import { useEffect, useState } from "react";

const NOT_ARMED = Symbol("not-armed");

/**
 * False for a moment after mount (and again whenever `key` changes), then true. For buttons that
 * appear in the same spot as the button that was just pressed: a double tap's second tap would
 * otherwise "press" the new button too (e.g. Open the transfer window → Start the season, or
 * Continue → Play match, or Renew → the next player's Renew).
 * `armedOnMount` skips the first wait, for screens that only need guarding after a change.
 */
export function useArmed(ms = 450, key: string | number | null = null, { armedOnMount = false } = {}): boolean {
  const [armedKey, setArmedKey] = useState<string | number | null | typeof NOT_ARMED>(armedOnMount ? key : NOT_ARMED);
  useEffect(() => {
    if (Object.is(armedKey, key)) return;
    const t = window.setTimeout(() => setArmedKey(key), ms);
    return () => window.clearTimeout(t);
  }, [ms, key, armedKey]);
  // Derived, so a key change disarms in the same render (no one-frame gap for a fast second tap).
  return Object.is(armedKey, key);
}
