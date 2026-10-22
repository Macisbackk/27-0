import { useEffect, useState } from "react";

/**
 * False for a moment after mount, then true. For buttons that appear in the same spot as the
 * button that opened their screen: a double tap's second tap would otherwise "press" the new
 * button too (e.g. Open the transfer window → Start the season).
 */
export function useArmed(ms = 450): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return armed;
}
