import { useEffect, useState } from "react";

/** Matches Tailwind `sm` and Manager compact chrome (bottom nav, tutorial). */
export const COMPACT_MAX_PX = 639;
export const COMPACT_MEDIA_QUERY = `(max-width: ${COMPACT_MAX_PX}px)`;
export const WIDE_MIN_PX = COMPACT_MAX_PX + 1;

export function isCompactViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(COMPACT_MEDIA_QUERY).matches;
}

/** Subscribe to the compact (phone) breakpoint. SSR-safe: starts compact. */
export function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(isCompactViewport);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MEDIA_QUERY);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return compact;
}
