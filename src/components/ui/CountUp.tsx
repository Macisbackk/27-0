"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that rolls to its new value instead of jumping, with a small bump when it
 * changes. First render shows the value straight away (no count-up on page load).
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 500,
  className = "",
  bump = true,
  from,
}: {
  value: number;
  /** Count up from this on first show (e.g. 0 for a payout reveal). */
  from?: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
  bump?: boolean;
}) {
  const [shown, setShown] = useState(from ?? value);
  const [bumpKey, setBumpKey] = useState(0);
  const fromRef = useRef(from ?? value);
  const firstRef = useRef(from === undefined);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    if (bump) setBumpKey((k) => k + 1);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, bump]);

  return (
    <span key={bumpKey} className={`inline-block ${bumpKey > 0 ? "fl-bump" : ""} ${className}`.trim()}>
      {format(shown)}
    </span>
  );
}
