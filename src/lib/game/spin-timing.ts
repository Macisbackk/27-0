/** Dev-only spin pipeline timing — no-op in production. */
export function spinTimingMark(label: string, startMs?: number): number {
  const now = performance.now();
  if (process.env.NODE_ENV === "development") {
    if (startMs !== undefined) {
      console.debug(`[spin-timing] ${label}: ${(now - startMs).toFixed(1)}ms`);
    } else {
      console.debug(`[spin-timing] ${label}`);
    }
  }
  return now;
}
