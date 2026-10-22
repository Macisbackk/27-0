"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin bar under the header that starts the moment you tap an internal link and
 * finishes when the new page is in — so a slower page never feels like a dead tap.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const firstRef = useRef(true);

  useEffect(() => {
    let safety = 0;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      setState("loading");
      window.clearTimeout(safety);
      safety = window.setTimeout(() => setState("idle"), 8000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(safety);
    };
  }, []);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    setState((s) => (s === "loading" ? "done" : s));
    const t = window.setTimeout(() => setState("idle"), 420);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return <div aria-hidden className={`fl-nav-progress fl-nav-progress--${state}`} />;
}
