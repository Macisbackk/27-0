"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEFERRED_PREFETCH_ROUTES } from "@/lib/heavy-routes";

/**
 * Prefetches the heavy routes (lib/heavy-routes.ts) a few seconds after the page has loaded and
 * the main thread is idle, instead of while the page is still loading and hydrating. Skipped on
 * Save-Data / 2G connections, like Next's own prefetching would be on a slow link.
 */
export function DeferredRoutePrefetch() {
  const router = useRouter();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return;
    let timer: number | undefined;
    let idle: number | undefined;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const run = () => {
      for (const href of DEFERRED_PREFETCH_ROUTES) {
        if (window.location.pathname === href) continue;
        try {
          router.prefetch(href);
        } catch {
          /* prefetch is best effort */
        }
      }
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (ric) idle = ric(run, { timeout: 4000 });
        else run();
      }, 4000);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (timer !== undefined) window.clearTimeout(timer);
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle !== undefined && cic) cic(idle);
    };
  }, [router]);
  return null;
}
