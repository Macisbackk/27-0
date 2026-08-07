"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  clearStaleBodyScrollLocks,
  logDocumentScrollDiagnostics,
} from "@/lib/ui/document-page-scroll";
import { clearAbandonedAnimationScrollLocks } from "@/lib/ui/scroll-lock";
import { recordShellMount } from "@/lib/ui/mount-diagnostics";

type DocumentPageShellProps = {
  children: ReactNode;
  className?: string;
  /** Label used in optional scroll diagnostics (`localStorage 27-0-debug-page-scroll=1`). */
  diagnoseLabel?: string;
};

/**
 * Shared non-modal page shell: content stays in normal document flow and
 * the browser document is the primary vertical scroll owner.
 */
export function DocumentPageShell({
  children,
  className = "",
  diagnoseLabel = "DocumentPageShell",
}: DocumentPageShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recordShellMount(`shell:${diagnoseLabel}`);
    clearAbandonedAnimationScrollLocks();
    clearStaleBodyScrollLocks();
    const root = rootRef.current;
    logDocumentScrollDiagnostics(diagnoseLabel, root);

    const onScroll = (event: Event) => {
      if (process.env.NODE_ENV !== "development") return;
      try {
        if (window.localStorage.getItem("27-0-debug-page-scroll") !== "1") {
          return;
        }
      } catch {
        return;
      }
      const target = event.target;
      const tag =
        target instanceof Element
          ? target.tagName.toLowerCase()
          : target === document
            ? "document"
            : "unknown";
      console.info(`[document-scroll] scroll target: ${tag}`, {
        modalLockActive: document.body.style.overflow === "hidden",
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      clearStaleBodyScrollLocks();
    };
  }, [diagnoseLabel]);

  return (
    <div
      ref={rootRef}
      data-document-page-shell=""
      className={`relative w-full min-w-0 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** Explicit horizontal-only scroller — never creates a vertical scroll owner. */
export function HorizontalScrollRegion({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-horizontal-scroll=""
      className={`overflow-x-auto overflow-y-visible overscroll-x-contain ${className}`.trim()}
    >
      {children}
    </div>
  );
}
