/**
 * Dev-only mount counters for flicker diagnostics.
 * Enable with localStorage.setItem("27-0-mount-diag", "1") then reload.
 */

const COUNTERS = new Map<string, number>();

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "development") return false;
  try {
    return window.localStorage.getItem("27-0-mount-diag") === "1";
  } catch {
    return false;
  }
}

export function recordShellMount(label: string): void {
  if (!enabled()) return;
  const next = (COUNTERS.get(label) ?? 0) + 1;
  COUNTERS.set(label, next);
  console.debug(`[mount-diag] ${label}=${next}`);
}

export function getShellMountCounts(): Record<string, number> {
  return Object.fromEntries(COUNTERS);
}

export function resetShellMountCounts(): void {
  COUNTERS.clear();
}
