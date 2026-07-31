"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Render above app chrome — escapes sticky headers / backdrop-filter containing blocks.
 * Sync document check avoids Strict Mode mount→null→remount flash that made popups vanish.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(
    () => typeof document !== "undefined"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
